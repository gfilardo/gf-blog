---
title: "Live updates with HTTP QUERY and server-sent events"
slug: http-query-live-results-with-sse
date: "2026-10-28"
description: "From a JSON filter to a live response: QUERY, SSE, EventSource, and what happens when a stream disconnects."
tags:
  - HTTP
  - API_design
  - architecture
  - SSE
series:
  id: http-query-and-sse
  title: HTTP QUERY in practice
  part: 2
companion: https://github.com/gfilardo/gf-blog-examples/tree/main/http-query-live-results-with-sse
draft: false
---
The first article gave us a search endpoint: a JSON filter goes in, matching results come back. Now imagine an operations dashboard for background jobs. An operator is watching imports for the warehouse project, filtered to running or failed jobs. While the page is open, one import finishes and another fails. A list fetched once no longer tells them what needs attention.

This is a useful place for live results. Completed jobs should leave the view; failed jobs should remain visible for investigation. A fuller dashboard might combine project, job type, status, owner, and submission time in its filter. The example below keeps just project and status so the streaming behavior stays easy to follow.

![Illustrative warehouse dashboard showing four imports: one failed, two running with progress indicators, and one queued. A completed import has left the filtered view.](/assets/posts/http-query-live-results-with-sse/import-jobs-dashboard.png)

The dashboard above includes queued jobs too; our example uses a smaller running-or-failed selection.

Polling would be one answer. Another would be to keep the response open and send new results as they become available. Could the same `QUERY` request start that conversation?

[The first article](/posts/http-query-can-i-just-use-it/) followed a request through the stack to discover what “supports QUERY” actually means. Streaming gives us another version of that question. This time, the distinction begins inside the browser.

## SSE and EventSource are not quite the same thing

Server-sent events, or SSE, provide a text format for delivering events. EventSource is the browser API that makes receiving them convenient. They are closely associated, which makes it easy to assume that choosing one means choosing the other.

The native [EventSource interface](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface) starts a `GET` request. Its constructor accepts a URL and an option for credentials, but no method, request body, or arbitrary headers. So this cannot simply become our JSON-filtered `QUERY` request:

```js
// Native EventSource opens a GET request, with no filter body.
const events = new EventSource('/jobs/live');
```

That is a restriction of this API. It does not mean a server must reject every other method before returning an event stream.

The architectural inference is straightforward: a `QUERY` endpoint can return `text/event-stream`, provided the operation still honors its safe, idempotent contract. Keeping a read open does not inherently turn it into a write. Creating a durable subscription with its own lifecycle, billing, or externally visible state would be a separate operation to design, rather than something hidden inside the read.

Fetch gives us the method and body controls we need. What it does not give us is all of EventSource's behavior for free.

## One response, several events

An SSE response has a `Content-Type` of `text/event-stream`. A small event might look like this:

```text
event: snapshot
data: {"matches":[{"id":1,"project":"warehouse","status":"running"}]}

```

The blank line ends the event. The `event` field names its type; `data` carries text that our application happens to interpret as JSON. SSE itself does not require JSON.

The same endpoint can send the current matching jobs as its first event, then keep sending updates in that same response body. There is no need for a separate request to load the initial list and another to watch it. One request opens the response; the first snapshot populates the view; later events keep it current. Those later events can contain complete replacement snapshots or individual changes, according to the API contract.

The server does not send a new HTTP status line or another set of response headers for each update. Instead, the initial headers establish the `text/event-stream` contract, and all subsequent events travel down that single, long-lived response body. 

```mermaid Several events can arrive within one HTTP response.
sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: QUERY + JSON filter
    S-->>C: 200 + text/event-stream headers
    S-->>C: snapshot event
    S-->>C: another snapshot event
    Note over C,S: The same response remains open
```

Keeping a response open also has practical resource implications across your network layers. Under HTTP/1.1, each long-running SSE stream occupies an entire TCP connection, quickly exhausting the browser's per-origin limit (historically six concurrent connections). Under HTTP/2 and HTTP/3, [multiplexing](https://www.rfc-editor.org/rfc/rfc9113.html#section-5) allows multiple concurrent data streams to share a single transport connection. While multiplexing eliminates connection exhaustion at the socket layer, long-lived streams still hold open memory buffers, file descriptors, and worker contexts in reverse proxies and application servers.

## From a filter to a live view

The browser can open that response with a regular Fetch call:

```js
// The request carries the filter; the response carries SSE events.
const response = await fetch('/jobs/live', {
  method: 'QUERY',
  headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
  body: JSON.stringify({ project: 'warehouse', statuses: ['running', 'failed'] }),
});
```

Imagine two imports running. When one completes, it leaves the selection. When the other fails, it stays visible with its new status. Sending complete snapshots keeps the client simple: each one replaces the previous list.

The companion examples include a dashboard that receives full snapshots and a separate demonstration of reconnection and replay. The dashboard uses scripted snapshots to make the behavior easy to inspect; it is not a database change feed.

## Why do we await Fetch twice?

The familiar JSON request involves two separate `await`s:

```js
// First the headers, then the complete JSON body.
const response = await fetch('/jobs');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const jobs = await response.json();
```

The first `await` gives us a `Response` once the status and headers are available. It does not wait for the complete body, or even require the first body byte to have arrived. The second `await` reads the body to completion and parses it as JSON. `response.text()` also waits for the entire body, returning text instead.

That distinction is easy to overlook when a small response arrives almost immediately. With a live stream, it becomes the whole point: the headers are available, but the body may keep arriving for minutes or hours. Waiting for `response.text()` would accumulate that body until it ends; `response.json()` would additionally expect one JSON document, not SSE framing.

Instead, `response.body` lets us read progressively. Each read waits for another chunk, or the end of the stream. The companion server makes the separation visible by sending the headers before its first timed snapshot. A later disconnect can still fail a body read after Fetch has resolved.

```mermaid Fetch can resolve while the response body is still arriving.
sequenceDiagram
    participant C as Browser code
    participant S as Server
    C->>S: Request
    S-->>C: Status and headers
    Note over C: await fetch resolves
    S-->>C: Body chunk
    Note over C: Stream reader can process data
    S-->>C: More body chunks
    S-->>C: Response ends, if finite
    Note over C: text() or json() can finish
```

## Bytes need decoding; text needs parsing

A Fetch response body arrives in chunks, but those chunks are not events. One chunk may contain several events, half a line, or part of a multibyte character. Calling `JSON.parse()` on each chunk would eventually fail, even if a local test happened to work.

There are two steps here. A [streaming text decoder](https://encoding.spec.whatwg.org/#interface-textdecoderstream) turns bytes into text without losing characters split across chunks. An SSE parser then turns text into complete events. Besides blank lines, the format has rules for multiline data, comments, and line endings. A parser is a better fit than a hurried `split('\n\n')`.

With a parser doing that work, the stream becomes a sequence of events our application can handle:

```js
// After checking the response, decode bytes and parse complete SSE events.
const events = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new EventSourceParserStream());
for await (const event of events) {
  if (event.event === 'snapshot') showJobs(JSON.parse(event.data).matches);
}
```

This is an excerpt: `EventSourceParserStream` comes from [eventsource-parser](https://github.com/rexxars/eventsource-parser), and `showJobs` represents replacing the displayed list. The companion example includes the imports, response checks, cancellation and completion handling. The parser turns text into events; it does not open requests or reconnect them.

## A caveat: reconnecting does not reconcile the view

Both EventSource and a Fetch-based client need an API that defines how the view stays consistent. EventSource reconnects automatically, but that alone does not recover missed changes. Two common patterns are:

- **Full snapshots:** each update replaces the displayed selection. Every new connection starts with a fresh snapshot, so reconnecting brings the view up to date without replaying intermediate changes.
- **A snapshot followed by changes:** the client builds its initial view, then applies additions, updates, and removals. After a disconnect, it needs either replay from a known position or a fresh snapshot that replaces its old state. The handoff between snapshot and changes must also avoid gaps.

EventSource remembers event IDs and can send `Last-Event-ID` when reconnecting. That is a resume hint, not a guarantee: the server must retain and replay the relevant changes, or provide a reset when it cannot. With Fetch, the client also owns the reconnection and cursor bookkeeping. Neither API reconciles application state on its own.

For this small dashboard, full snapshots are a reasonable starting point. The example sends complete selections, although its scripted sequence restarts on each request. A real endpoint would start each connection with the current matching jobs and send updated selections as they change. The screen needs an accurate current view; preserving every transition is a different requirement.

## Streaming infrastructure: middleboxes and buffering

From the perspective of your backend server, the SSE wire format is unchanged: the application writes `text/event-stream` chunks over the open socket, and intermediate proxies forward them downstream. `QUERY` simply initiated the conversation with a JSON payload instead of URL query parameters.

However, your intermediate infrastructure must treat this route with the same streaming care as a conventional `GET` event stream:

- **Proxy buffering:** Reverse proxies like NGINX buffer upstream responses by default to optimize throughput. For SSE, buffering is catastrophic—it delays event delivery until the buffer fills or the connection closes. You must ensure [`proxy_buffering off`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering) (or the `X-Accel-Buffering: no` response header) is explicitly enabled for your `QUERY` route.
- **Timeouts and heartbeats:** Edge proxies, cloud load balancers, and API gateways enforce idle client and upstream read timeouts. A quiet stream with no job events will eventually be severed unless the server periodically emits SSE comments (e.g. `: keepalive\n\n`) as heartbeats.

A working `GET` event stream elsewhere in your application does not guarantee that a new `QUERY` route inherits the same location-level proxy configuration. Verifying that events flush immediately through your staging gateway is essential before deploying to production.

## Would keeping EventSource be simpler?

Quite possibly. If the filter fits comfortably in a URL, native EventSource avoids writing connection-management and stream-parsing code entirely. Its automatic reconnection is convenient, provided your server supports replay via `Last-Event-ID`.

For larger or sensitive filters, an alternative architecture is a two-step handshake: the client sends a `POST` request to create a saved query or subscription resource, and the server returns a temporary URL that native `EventSource` opens with `GET`. This preserves browser convenience, but introduces stateful server resources that require lifecycle management, storage, authorization, and cleanup.

`Fetch` combined with `QUERY` is attractive when you want a single, direct, self-contained read: the input belongs in the request body, no server-side subscription state needs to be managed, and the client retains full control over HTTP headers, authentication tokens, and stream cancellation.

## Why SSE in 2026, when we have WebSockets?

For a dashboard like our background jobs monitor, the client sends a filter once and then mostly listens. SSE matches that unidirectional shape naturally: updates arrive as an ordinary HTTP response, while occasional user actions (like canceling a job) remain standard API calls. Notifications, build status, and live feeds follow this exact pattern.

[WebSockets](https://websockets.spec.whatwg.org/) are the right tool when communication is genuinely bidirectional, messages travel frequently in both directions, or subscriptions must be modified dynamically over the same persistent TCP channel without reconnecting. They also support binary framing.

However, WebSockets operate outside the standard HTTP request-response pipeline. They require separate connection management, custom authentication handshakes, and specialized load balancer configurations. SSE remains compelling in 2026 because it is simply HTTP: it works cleanly with standard authorization headers, leverages existing HTTP/2 multiplexing, traverses corporate proxies effortlessly, and requires no custom protocol layer when all you need is a live stream of server updates.

## What have we gained?

The original question was whether a body-based read could keep delivering results. It can, provided the server and the path support that exchange. The surprising obstacle is that the browser API usually associated with SSE cannot initiate our QUERY request.

Separating the pieces makes the choice easier to explain. QUERY describes the read. SSE describes the events in its response. Fetch gives the client access to that response. The application decides whether a disconnect calls for a fresh snapshot or a continuation of retained history.

For our job dashboard, a fresh filtered snapshot may be exactly what the screen needs. For an audit trail, it would be only the beginning of the design. The same transport can carry both; the promise to the reader is different.

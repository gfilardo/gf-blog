---
title: "HTTP has QUERY now. Can I just use it?"
slug: http-query-can-i-just-use-it
date: "2026-10-26"
description: A working QUERY request is the beginning. Follow a complex read through browsers, gateways, frameworks, retries, caches, and API tooling.
tags:
  - HTTP
  - API_design
  - architecture
series:
  id: http-query-and-sse
  title: HTTP QUERY in practice
  part: 1
companion: https://github.com/gfilardo/gf-blog-examples/tree/main/http-query-can-i-just-use-it
draft: false
---

HTTP has `QUERY` now. Can I just use it?

A search endpoint is a familiar example. It starts with a category and a price range, so a `GET` request with a couple of URL parameters is enough. Then someone needs several categories, nested conditions, a list of a hundred product IDs, and three ways to sort the results. At some point, accepting a JSON body through `POST /products/search` starts to feel much more comfortable.

There is nothing too wrong with that. `POST` can load data after all, and you can make that operation repeatable. But someone looking at the method alone cannot tell whether it searches for products or buys them. They have to know your API.

Could we send the JSON filter with `GET`? Browser Fetch does not allow that. Even outside the browser, HTTP does not define how a `GET` body should affect the result. Our server might understand the filter, while a cache could ignore it and return the wrong results.

This is where `QUERY` becomes interesting. Standardized in June 2026 as [RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html), a Proposed Standard, it gives us a safe, idempotent operation whose input belongs in the request body. We can keep the JSON filter and tell the rest of the system what kind of request this is. It shares those properties with `GET`, while defining its own body-based query semantics.

This makes the API's contract visible at a glance. Searches, batch lookups, and analytical reports no longer have to disguise themselves as `POST` operations alongside resource creations and mutations. This isn't about being pedantically “RESTful” (REST encompasses far more than verb choices, and our `POST` search was technically valid all along), but about clearer HTTP semantics that intermediate tools and human callers can understand immediately.

In practical terms, `QUERY` gives us a few useful things:

- **Room for complex filters.** Nested conditions and long lists can travel in a JSON body instead of being squeezed into the URL.
- **A visible read operation.** People browsing the API can distinguish queries from operations that change data without reading every endpoint description.
- **A basis for automatic retries.** Suppose the server runs the search, but the connection drops before the response reaches the client. Software that understands `QUERY` can safely repeat the request without needing to know whether the first attempt finished or what the endpoint's business rules are. Whether it actually retries depends on its implementation and policy.
- **Defined caching semantics.** A cache with `QUERY` support can distinguish results using the request body and related metadata. That requires explicit support; changing the method does not switch caching on.
- **Less exposure in URL logs.** Filters stay out of the URL, although request bodies can still be logged and sensitive fields still need redaction.

## Wasn't there already SEARCH?

Yes, and this idea has been around for a while. The [proposal's history](https://datatracker.ietf.org/doc/draft-snell-search-method/history/) goes back to April 2015 under the name `SEARCH`, with working-group adoption in December 2020.

`SEARCH` also already existed in WebDAV, standardized in 2008. It required XML request support but allowed other formats, and its successful multistatus responses followed WebDAV's XML conventions. So the story is not simply that `QUERY` finally lets us send JSON. It gives general-purpose queries a separate contract without inheriting that WebDAV response model.

## A filter in the body

The request itself is unremarkable. The URL identifies the search, and the body describes which products we want:

```js
// Same search endpoint, with the selection in the body.
fetch('/products/search', {
  method: 'QUERY',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ category: 'books', maxPrice: 25 }),
});
```

That is the idea, rather than a complete client implementation: the URL identifies the resource or search endpoint, while the payload in the body refines the selection. The server evaluates the filter and returns the matching products, just as our `POST` search did.

Notice that `fetch()` doesn't need a dedicated helper or new API method; standard `fetch` has always accepted custom method strings. The uppercase spelling is essential, however: HTTP method names are case-sensitive by specification, and `query` is not `QUERY`. While Fetch normalizes a few standard methods like `GET` and `POST`, novel methods are sent exactly as written.

Furthermore, `QUERY` is not coupled to JSON. The `Content-Type` header identifies the body format—whether that is JSON, XML, or a domain-specific query language—while the server endpoint defines what fields like `category` and `maxPrice` actually mean.

Sending the request from a browser is the easy part. Whether the rest of the infrastructure along the network path understands it is the more interesting question.

## The interesting part: the answer goes missing

Suppose the server receives our book filter, runs the query, and prepares the results. Just before the answer reaches the client, the connection drops.

Now what? The client cannot tell whether the server finished the work or never received the request. With a purchase, repeating the request could place a second order. With our search, we can ask again.

`QUERY` makes that permission visible in the method. A browser's HTTP stack, a client library, application retry logic, or a proxy can use its idempotency to repeat the request after a communication failure, without knowing the business rules of our catalogue. That is why HTTP's [rules for retrying idempotent requests](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) are useful in practice.

Our `POST` search can be repeatable too. We simply have to supply that extra knowledge to the caller. With `QUERY`, software that understands the method already has it.

There is an important distinction here: the method permits automatic retries; it does not guarantee that your browser or proxy implements them for `QUERY`. Choosing `QUERY` in a Fetch call does not add an application retry loop. A successful response tells us nothing about what will happen after a dropped connection.

```mermaid A retry is a new request, permitted only when the implementation and policy allow it.
sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: QUERY + filter
    S->>S: Evaluate filter
    Note over C,S: Connection drops; response is lost
    Note over C: Did the request finish?
    opt Retry supported and permitted
        C->>S: Repeat QUERY + same filter
        S->>S: Evaluate filter again
        S-->>C: Current results
    end
```

And asking again is still another read. A book's price may have changed in the catalogue, the database query will execute a second time, and the access log will record two requests. _Safe and idempotent does not mean identical answers, zero incidental effects, or exactly-once execution_. We are issuing a complete, new HTTP exchange to recover from a lost message at the application layer, not quietly repairing dropped packets under the hood.

## My example works. What have I actually verified?

We have a browser sending a method that the server accepts, a router finding the handler, and JSON going in and coming out. It feels like enough to start replacing a `POST` route.

Then we put the application behind its usual infrastructure:

```mermaid One possible request path: every boundary can apply its own rules.
flowchart TD
    B[Browser] -->|Method allowed?| E[CDN / WAF]
    E -->|Route and credentials accepted?| G[API gateway]
    G -->|Method and body preserved?| P[Reverse proxy]
    P -->|Parsed and routed?| A[Application]
```

What happens at each boundary? In a deployment with these layers, the trip might look like this:

1. **Browser → CDN / WAF:** The browser resolves the API's hostname and establishes an HTTPS connection to the edge. The CDN handles traffic near the client, while a web application firewall checks requests against security rules. Before our filter gets anywhere near Express, those rules may already have an opinion about which methods are allowed.
2. **CDN / WAF → API gateway:** The edge forwards the request to the API's entry point. The gateway can select a backend, validate credentials, and apply limits per client or tenant. Its routes and policies need to admit `QUERY` and preserve the body.
3. **API gateway → reverse proxy:** The gateway sends the request further into the deployment. A reverse proxy, such as NGINX or Envoy, can route it to the appropriate service. This adds another place where method restrictions, body limits, or timeouts may affect the request.
4. **Reverse proxy → application:** The proxy forwards the request to an application instance, possibly balancing traffic across several. Only then does the application's HTTP parser accept the method, Express parse the JSON, and our handler evaluate the filter. TLS may also be used on these internal connections; where it terminates depends on the deployment.

An API does not need all these layers. In a smaller setup, one component may perform both gateway and reverse-proxy duties, or the client may reach the application directly. They are shown separately here because each boundary is another place to check: does the request still reach the handler, with its method and body intact?

This is where “supports QUERY” becomes a slippery phrase. What exactly does that support let us do?

- **Forward the request:** accept the method and pass its body through to the application.
- **Cache the response:** distinguish queries using their bodies and related metadata, then apply the appropriate caching rules.
- **Retry the request:** recognize its idempotency, replay its body, and decide when another attempt is appropriate.
- **Generate SDK code:** turn the API description into a usable client operation that sends the right method and body.

These are separate capabilities, not successive levels of support. A proxy can forward `QUERY` without caching or retrying it. You might be able to send and retry a `QUERY` request with a few lines of handwritten code, while your SDK generator does not yet support `QUERY` operations. A documentation page can display the operation perfectly while the request never makes it through the gateway.

Knowing that a tool ‘supports QUERY’ is not enough. We need to know which parts it supports. Our local example has shown that the request can get through and return data. Caching, retries, and generated clients each need their own evidence.

## Follow the request out of localhost

The first useful check is a request from the real frontend. If the API is on another origin, `QUERY` needs a CORS preflight. The `OPTIONS` exchange must allow the method and requested headers, with the appropriate origin and credentials policy if you use credentials. Setting `mode: 'no-cors'` will not get around this; that mode only permits `GET`, `HEAD`, and `POST`.

The edge introduces another question. An API gateway's “any method” option sounds promising, but hang on: does it mean any valid method or any method on that product's list?

Once the request reaches the application server, the runtime parser still has to accept it before Express can do anything. Then the router, body parser, and validation need to handle it. Adding a catch-all route cannot help if the runtime rejects the request first.

Changing `POST` to `QUERY` may also affect your security rules. For example, a gateway configured to allow `POST /products/search` might reject the same request sent with `QUERY`. Those rules should be updated while keeping the existing login and permission checks: a request that only reads data can still expose private information.

Retry behavior also introduces practical boundaries. In practice, you need to know which component is actually responsible for retrying: is it the frontend client library, an SDK, or an intermediate proxy? Because `QUERY` carries a payload, whatever component attempts the retry must buffer and replay the entire request body. Deliberately interrupting connections during testing will quickly reveal whether your client or proxy actually replays that payload as intended.

Even when replaying works, retry policies demand operational caution. A small catalogue search is cheap to run again. A complex analytical report that takes thirty seconds to compute is a very different proposition—repeating it three times under high load can easily cascade into a denial-of-service against your own database. Idempotency grants permission to repeat; operational sanity requires strict retry budgets, backoff intervals, and sensible timeouts.

Finally, remember the contract boundaries. Automatic retries only make sense for transient network failures or dropped connections; another attempt will never repair a 400 Bad Request caused by a malformed filter. And the server handler must uphold its side of the bargain: quietly introducing side effects (like “search for items and immediately reserve them in inventory”) violates the safety contract that clients and proxies rely upon when retrying.

## And caching? The body changes the question

Two calls to `/products/search` can ask for completely different products. If a cache only looks at the URL, our book search might receive the game results.

That is why QUERY's [caching rules](https://www.rfc-editor.org/rfc/rfc10008.html#section-2.7) require the cache key to incorporate the request body and related metadata. Responses are cacheable by specification, but a CDN that forwards `QUERY` does not automatically know how to cache it correctly.

Historically, `POST` was not categorically uncacheable (HTTP specifications technically permit caching `POST` responses under specific conditions), but in the real world almost no CDN or reverse proxy caches them safely. `QUERY` finally provides a standardized, body-aware caching contract, but that support must be explicitly implemented and configured.

Until you have verified that your caching layer understands this contract, the safest starting point is to disable caching (`Cache-Control: no-store`). When you are ready to enable it, verify that cache keys correctly incorporate the full request body and headers. If your catalogue is multi-tenant, ensure one tenant's query never serves cached results to another. Changing the HTTP method introduces a clearer contract, but freshness, tenant isolation, and authorization rules remain your responsibility.

## How this shows up in actual tools

Checking the documentation on **26 October 2026** turned up some useful examples of how uneven “support” can be.

For AWS API Gateway REST APIs, the [methods covered by `ANY`](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-settings-method-request.html) do not include `QUERY`. That is worth finding out before changing a route. It is also a statement about that REST API product, not the separate HTTP API product.

NGINX's [`limit_except` directive](https://nginx.org/en/docs/http/ngx_http_core_module.html#limit_except) does not list `QUERY` among its method arguments either. That tells us to inspect the access policy; it does not establish that NGINX cannot forward the request.

On the documentation side, [OpenAPI 3.2.1 has a native `query` operation](https://spec.openapis.org/oas/v3.2.1.html#path-item-object). That gets us closer to the readable API description I wanted at the beginning. But I would still generate the SDK and call the endpoint with it. The description format, documentation renderer, and client generator are separate pieces of software. The API console and test runner deserve the same check: a missing dropdown option and an incapable transport are different problems.

Observability needs the same scrutiny. In your metrics dashboards, does `QUERY` register cleanly, or does it disappear into an unclassified "Other" bucket? Verifying this with a few synthetic requests upfront avoids surprises during post-deployment monitoring.

Similarly, consider logging and audit trails. Moving complex query parameters out of the URL prevents sensitive filter criteria from leaking into web server access logs, browser history, or referrer headers. But the request body is not an encrypted vault: application middleware, tracing agents, and debug loggers often capture request bodies indiscriminately. Sensitive query fields still require explicit redaction, and retained logs still require proper access policies.

## So, can I ship it?

If I control the client and can test the whole path, I would start with one search endpoint. The `POST` route could remain available during migration, with both routes calling the same validated read operation. There is no reason to maintain two versions of the search just to try another HTTP method.

The endpoint should be exercised under the same conditions as the application: logged in, through the public edge, with valid and invalid filters. That includes calls from the generated client, visible traces, and a connection failure that reveals the retry behavior. Caching can remain disabled until its behavior has been verified for this route.

For a public API with clients I cannot upgrade, I might keep `POST` available for much longer. The useful question is whether `QUERY` makes this API clearer and easier to operate for its callers, not whether every read has acquired the newest verb.

**I like what it offers here.** The JSON body fits the problem, the documentation can show that we are loading data, and software that understands the method has enough information to repeat the request when an answer goes missing. Following that request through the system tells us how much of that benefit is available today.

There is one more thing I want to try with our filter. What if I do not just want the products that match now? What if I want to keep receiving updates as those products change?

Could `QUERY` initiate a server-sent events (SSE) response with those filters in its body? And would the browser's native `EventSource` let me make that request? That is the next investigation in this two-part series.

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
  title: HTTP QUERY and live results
  part: 1
draft: false
---

HTTP has `QUERY` now. Can I just use it?

A search endpoint is a familiar example. It starts with a category and a price range, so a `GET` request with a couple of URL parameters is enough. Then someone needs several categories, nested conditions, a list of a hundred product IDs, and three ways to sort the results. At some point, accepting a JSON body through `POST /products/search` starts to feel much more comfortable.

There is nothing too wrong with that. `POST` can load data after all, and you can make that operation repeatable. But someone looking at the method alone cannot tell whether it searches for products or buys them. They have to know your API.

Could we send the JSON filter with `GET`? Browser Fetch does not allow that. Even outside the browser, HTTP does not define how a `GET` body should affect the result. Our server might understand the filter, while a cache could ignore it and return the wrong results.

This is where `QUERY` becomes interesting. Standardized in June 2026 as [RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html), a Proposed Standard, it gives us a safe, idempotent operation whose input belongs in the request body. We can keep the JSON filter and tell the rest of the system what kind of request this is. It shares those properties with `GET`, while defining its own body-based query semantics.

Even browsing the API documentation gets a little nicer. Searches, reports, and updates no longer all have to appear as `POST` operations. I would call that clearer HTTP semantics rather than automatically “more RESTful”: REST describes more than the choice of method, and our `POST` search was valid all along.

In practical terms, `QUERY` gives us a few useful things:

- **Room for complex filters.** Nested conditions and long lists can travel in a JSON body instead of being squeezed into the URL.
- **A visible read operation.** People browsing the API can distinguish queries from operations that change data without reading every endpoint description.
- **A basis for automatic retries.** Suppose the server runs the search, but the connection drops before the response reaches the client. Software that understands `QUERY` can safely repeat the request without needing to know whether the first attempt finished or what the endpoint's business rules are. Whether it actually retries depends on its implementation and policy.
- **Defined caching semantics.** A cache with `QUERY` support can distinguish results using the request body and related metadata. That requires explicit support; changing the method does not switch caching on.
- **Less exposure in URL logs.** Filters stay out of the URL, although request bodies can still be logged and sensitive fields still need redaction.

## Wasn't there already SEARCH?

Yes, and this idea has been around for a while. The [proposal's history](https://datatracker.ietf.org/doc/draft-snell-search-method/history/) goes back to April 2015 under the name `SEARCH`, with working-group adoption in December 2020.

`SEARCH` also already existed in WebDAV, standardized in 2008. It required XML request support but allowed other formats, and its successful multistatus responses followed WebDAV's XML conventions. So the story is not simply that `QUERY` finally lets us send JSON. It gives general-purpose queries a separate contract without inheriting that WebDAV response model.

## Example: Start with something that returns JSON

Let's search a tiny catalogue. This example uses Node.js 24 and Express 5.3.0, with its `app.query` routing helper. Support depends on the installed versions: the [Express documentation](https://expressjs.com/en/api/application/#app.query) lists the required Node versions, but a suitable runtime alone does not add the helper to an older framework.

In a separate scratch project, install Express with `npm install express@5.3.0`, save this as `server.mjs`, and run `node server.mjs`:

```js
import express from 'express';

const app = express();
const products = [
  { id: 1, category: 'books', price: 18 },
  { id: 2, category: 'books', price: 35 },
  { id: 3, category: 'games', price: 24 },
];

app.use(express.json({ limit: '16kb' }));
app.get('/', (_req, res) => {
  res.type('html').send('<h1>QUERY playground</h1>');
});

app.query('/products/search', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { category, maxPrice } = req.body ?? {};
  if (typeof category !== 'string' ||
      typeof maxPrice !== 'number' ||
      !Number.isFinite(maxPrice) || maxPrice < 0) {
    return res.status(400).json({ error: 'Expected category and maxPrice' });
  }

  const matches = products.filter(product =>
    product.category === category && product.price <= maxPrice
  );
  res.json({ matches });
});

app.listen(3000, '127.0.0.1');
```

Open `http://127.0.0.1:3000/` and run this in that page's browser console:

```js
const response = await fetch('/products/search', {
  method: 'QUERY',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ category: 'books', maxPrice: 25 }),
});

if (!response.ok) throw new Error(`HTTP ${response.status}`);
console.log(await response.json());
// { matches: [{ id: 1, category: 'books', price: 18 }] }
```

With `maxPrice` set to `40`, both books match. With the original price limit and `category` set to `'games'`, the result is the game instead. Same URL, different selection in the body.

There isn't much ceremony here. Express parses the JSON, we check the two fields, and the handler returns the matching products. The filter is deliberately small enough to read; it could grow into a nested expression without changing how we send it.

`QUERY` is not tied to JSON; an endpoint could accept another query format. The request should include `Content-Type` to identify its format. Here, `application/json` tells Express to parse JSON; our API still defines what `category` and `maxPrice` mean.

Fetch does not need a new `fetch.query()` function. It already accepts method names beyond the familiar ones, and `QUERY` is not forbidden. HTTP method names are case-sensitive: the standard defines `QUERY`, while lowercase `query` names a different method. Fetch normalizes some familiar names, but that behavior should not be assumed here.

I have kept the page and API on the same origin and set `Cache-Control: no-store`. For now, I want to see a request go out and the right data come back. We can give the infrastructure something more interesting to do in a moment.

## The interesting part: the answer goes missing

Suppose the server receives our book filter, runs the query, and prepares the results. Just before the answer reaches the client, the connection drops.

Now what? The client cannot tell whether the server finished the work or never received the request. With a purchase, repeating the request could place a second order. With our search, we can ask again.

`QUERY` makes that permission visible in the method. A browser's HTTP stack, a client library, application retry logic, or a proxy can use its idempotency to repeat the request after a communication failure, without knowing the business rules of our catalogue. That is why HTTP's [rules for retrying idempotent requests](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) are useful in practice.

Our `POST` search can be repeatable too. We simply have to supply that extra knowledge to the caller. With `QUERY`, software that understands the method already has it.

There is an important distinction here: the method permits automatic retries; it does not guarantee that your browser or proxy implements them for `QUERY`. The Fetch example above has no application retry loop. A successful response tells us nothing about what will happen after a dropped connection.

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

And asking again is still another read. A book's price may have changed, the query may execute twice, and there may be two access-log entries. _Safe and idempotent does not mean identical answers, zero incidental effects, or exactly-once execution_. We are talking about repeating a whole HTTP request, not TCP retransmitting bytes within a connection.

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

Retry behavior also depends on which component is responsible for it. Is it the client library? The proxy? A deliberately interrupted connection can reveal what actually happens. Can that component replay the body, and does it stop after a sensible number of attempts? Our three-product search is cheap. A report that takes a minute is a different proposition, even if repeating it is perfectly valid. Repeated attempts can multiply that cost, so retries need a limit. Another attempt will not repair an invalid filter, either. The handler must also remain a read: quietly adding “and reserve the stock” would break the promise we are making.

## And caching? The body changes the question

Two calls to `/products/search` can ask for completely different products. If a cache only looks at the URL, our book search might receive the game results.

That is why QUERY's [caching rules](https://www.rfc-editor.org/rfc/rfc10008.html#section-2.7) require the key to incorporate the request body and related metadata. Responses are cacheable, but a CDN that forwards QUERY does not necessarily know how to cache it correctly.

I would leave `no-store` in place until there is a reason to change it. Then I would try different filters and different callers, change the underlying products, and inspect actual cache hits. If the catalogue belongs to a tenant, checking that one tenant cannot receive another's results is part of that work. Freshness and authorization do not disappear because we changed the method.

Nor was `POST` categorically uncacheable: HTTP allows its responses to be reused for subsequent `GET` or `HEAD` requests under specific conditions. `QUERY` gives this kind of read a clearer contract; it does not magically switch caching on across the stack.

## How this shows up in actual tools

Checking the documentation on **26 October 2026** turned up some useful examples of how uneven “support” can be.

For AWS API Gateway REST APIs, the [methods covered by `ANY`](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-settings-method-request.html) do not include `QUERY`. That is worth finding out before changing a route. It is also a statement about that REST API product, not the separate HTTP API product.

NGINX's [`limit_except` directive](https://nginx.org/en/docs/http/ngx_http_core_module.html#limit_except) does not list `QUERY` among its method arguments either. That tells us to inspect the access policy; it does not establish that NGINX cannot forward the request.

On the documentation side, [OpenAPI 3.2.1 has a native `query` operation](https://spec.openapis.org/oas/v3.2.1.html#path-item-object). That gets us closer to the readable API description I wanted at the beginning. But I would still generate the SDK and call the endpoint with it. The description format, documentation renderer, and client generator are separate pieces of software. The API console and test runner deserve the same check: a missing dropdown option and an incapable transport are different problems.

The request should also be visible in the dashboards. Did it appear as `QUERY`, disappear from a method-based chart, or end up under an “other” category? That is easier to establish with a handful of known requests than after a rollout.

One last practical detail: moving the filter out of the URL reduces its exposure in URL-oriented logs, but the body is not a secret compartment. Middleware, application code, and diagnostics can log it too. Sensitive fields still need redaction, and retained logs need an access policy.

## So, can I ship it?

If I control the client and can test the whole path, I would start with one search endpoint. The `POST` route could remain available during migration, with both routes calling the same validated read operation. There is no reason to maintain two versions of the search just to try another HTTP method.

The endpoint should be exercised under the same conditions as the application: logged in, through the public edge, with valid and invalid filters. That includes calls from the generated client, visible traces, and a connection failure that reveals the retry behavior. Caching can remain disabled until its behavior has been verified for this route.

For a public API with clients I cannot upgrade, I might keep `POST` available for much longer. The useful question is whether `QUERY` makes this API clearer and easier to operate for its callers, not whether every read has acquired the newest verb.

**I like what it offers here.** The JSON body fits the problem, the documentation can show that we are loading data, and software that understands the method has enough information to repeat the request when an answer goes missing. Following that request through the system tells us how much of that benefit is available today.

There is one more thing I want to try with our filter. What if I do not just want the products that match now? What if I want to keep receiving updates as those products change?

Could `QUERY` initiate a server-sent events (SSE) response with those filters in its body? And would the browser's native `EventSource` let me make that request? That is the next investigation in this two-part series.

---
title: "WebMCP: Building an agent-ready transaction"
slug: webmcp-agent-ready-transaction
date: "2026-10-30"
description: "A proposed quote, approval, and booking architecture that preserves user authority through execution."
tags:
  - WebMCP
  - AI
  - API_design
  - architecture
series:
  id: webmcp-agent-ready-web
  title: "WebMCP and the agent-ready web"
  part: 4
draft: true
---

A useful way to explore WebMCP is to take one consequential workflow and make its assumptions explicit.

For this example, the workflow is a ride booking. The user receives an €85 offer, approves it through a trusted path, and asks the application to complete the booking.

The design below is a proposed application architecture. WebMCP exposes the capabilities; the application remains responsible for offers, approval, and execution. A runnable local simulation accompanies this design in the [companion repository](https://github.com/gfilardo/gf-blog-examples), under `webmcp-agent-ready-transaction/`. It demonstrates the domain checks and annotation declarations; it does not establish browser-agent interoperability or prove human presence.

## Start with the offer

The first operation creates a quote containing the facts needed for a decision:

| Fact | Purpose |
| --- | --- |
| Offer identity | Connect subsequent approval and booking to the same offer |
| Journey and service | Establish what will be purchased |
| Total price and currency | Make the financial commitment explicit |
| Material cancellation conditions | Describe an important consequence |
| Expiry | Bound how long the offer remains usable |
| Offer version | Detect changes to the agreed conditions |

The application must distinguish a binding quote from an estimate. If the final price can vary, that variability and any applicable cap belong in the offer.

Both the human view and the agent result should derive from these business facts.

## Establish approval through a trusted path

For the initial implementation, use a confirmation flow controlled by the application.

It presents the offer, collects approval, and records which user approved which version. The server establishes the approval record; the booking caller cannot manufacture one by supplying a boolean.

This design deliberately starts with transaction-specific approval. Supporting external delegated authority would require another explicit design: who issues it, how it is verified, which conditions it covers, and how it is revoked.

A reference to an approval record is not sufficient by itself. The backend must also check its relationship to the authenticated user, the offer, and the permitted operation. This applies OWASP’s [transaction-authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html): enforce authorization server-side and protect the significant transaction data against modification.

## Put the approval prerequisite in the tool contract

An offer identity says what to buy. An approval reference says which recorded decision the application should verify. The tool contract should carry both rather than expose an unexplained commit operation.

The following registration is an illustrative version of the companion’s expanded `book_ride` tool. It is intended for the page, after the application’s offer and approval steps. The approval reference is an opaque lookup identifier, not a boolean assertion of consent or a WebMCP-issued credential.

```javascript
// api() is the companion's authenticated, same-origin HTTP helper.
await document.modelContext.registerTool({
  name: "book_ride",
  description:
    "Commit a ride using approval recorded for this exact offer. " +
    "Obtain approval through the application's fare-acceptance flow first.",
  inputSchema: {
    type: "object",
    properties: {
      offerId: {
        type: "string",
        description: "Identity of the quoted offer, including its fare and conditions."
      },
      approvalId: {
        type: "string",
        description: "Reference to application-recorded approval for this offer."
      },
      attemptId: {
        type: "string",
        description: "Reuse for retries of the same logical booking attempt."
      }
    },
    required: ["offerId", "approvalId", "attemptId"],
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: false,
    consequentialHint: true
  },
  execute: async ({ offerId, approvalId, attemptId }) =>
    api("/api/bookings", { offerId, approvalId, attemptId })
});
```

The [tool dictionary](https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool) calls this field `inputSchema`; the annotations belong inside `annotations`. The required approval reference makes the dependency discoverable to an agent and expressible in its call. It cannot prove that the reference is genuine, current or appropriate. Those are server checks. Direct HTTP callers can bypass a tool schema, so the backend must also reject missing or invalid approval.

There are two ways to carry this dependency. The main tool above passes the approval reference explicitly. The simpler two-lane comparison passes only `offerId` and lets the server look up approval for that account and offer. That lookup variant enforces the rule, but its description and error response must still explain that fare acceptance is required. The explicit variant makes the prerequisite easier to see in the input contract. Neither variant accepts a caller-supplied `accepted: true` as evidence.

## Reflect shared application state

The visible quote and the tool’s offer should come from the same application model, identified by offer identity and version. A callback should resolve the current selection when invoked rather than retain a stale quote captured when a component mounted.

The same applies to constraints: if the page shows a filtered selection, a tool advertised as acting on that selection should use the same filters. If it deliberately searches more broadly, its contract should say so. Sharing the page does not automatically synchronize the callback with its viewmodel.

In the companion, both lanes refer to the same server-created offer. Starting a fresh comparison replaces the selected offer; changing API mode disables the old controls until a fresh comparison starts. The advanced offer list reads the same domain records used for quote and booking checks. This demonstrates the selected-offer case, not a general reactive-state framework or the flight-filter scenario discussed in Part 2.

Shared frontend state prevents one kind of drift. The backend remains authoritative: it reloads the offer and approval and checks their current validity at commitment. A perfectly synchronized screen can still become stale before its request reaches the service.

## Enforce the conditions when booking

The booking service loads the authoritative offer and approval. It verifies that they match, remain valid, and cover the requested action.

```mermaid Application-controlled approval is a demo assumption, not attestation of human presence.
sequenceDiagram
    participant A as Agent via page tool
    participant UI as Application approval UI
    participant U as User
    participant S as Domain service
    A->>S: Request quote
    S-->>A: Offer, price, conditions and expiry
    U->>UI: Review and approve offer
    UI->>S: Record approval for this offer
    S-->>UI: Approval reference
    A->>S: Book with offer, approval and attempt ID
    alt Offer and approval remain valid
        S->>S: Verify and commit atomically
        S-->>A: Booking result
    else Expired, changed or unauthorized
        S-->>A: Reject with a specific reason
    end
```

If a material condition changes, the service rejects the attempt and returns a new offer or a requirement for renewed approval.

The check must hold at the point of commitment. Checking a price and then booking against independently changing state would leave a race between verification and execution. The implementation needs an atomic transition or an equivalent guarantee from the booking provider.

## Treat retries as normal
```mermaid A retry returns the recorded outcome without creating another ride.
sequenceDiagram
    participant A as Agent via page tool
    participant S as Booking service
    participant D as Transaction store
    A->>S: Book using attempt K
    S->>D: Commit booking and record K atomically
    D-->>S: Booking B recorded
    S--xA: Response lost
    A->>S: Retry with attempt K and identical inputs
    S->>D: Look up account and attempt K
    D-->>S: Existing booking B
    S-->>A: Return booking B
    Note over S,D: No second booking is created
```


An agent calls the booking tool. The booking succeeds, but the response is lost.

Repeating the request must not create a second ride.

Use an idempotency mechanism scoped to the authenticated account and logical booking attempt. The same request returns the established outcome; reuse with different transaction details is rejected. Amazon’s [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) explains caller-scoped request identifiers, equivalent retry responses and rejection when a caller reuses an identifier with different parameters.

Approval consumption and booking state also need to be coordinated. With an external provider, the workflow may require a durable state machine and reconciliation rather than one database transaction.

An uncertain response should produce an inspectable pending state, not an invitation to start another purchase.

## Give the agent useful outcomes

The tool should distinguish between an expired offer, missing approval, changed conditions, a pending booking, and a completed booking.

These outcomes tell the agent what the application actually knows. They should also support a human-readable explanation without exposing unnecessary personal information.

Cancellation needs similar care. Stopping a tool call does not necessarily reverse work already committed. The user needs a way to inspect the resulting booking and use the product’s cancellation process.

## Keep WebMCP’s role clear

The browser-facing tools are adapters to the application workflow. Their declarations follow the draft’s [`ModelContextTool` dictionary](https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool) and [`registerTool()` operation](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool). These API definitions do not supply the application’s offer or approval model.

They should describe whether a capability retrieves an offer or commits a booking, expose material results, and use appropriate annotations. The domain service should enforce the same rules for human, agent, and other supported entry points.

The annotations help an agent reason about a capability. They do not replace the approval record or execution checks. The draft defines `readOnlyHint`, `untrustedContentHint`, `consequentialHint` and `debugging` under `annotations`. The companion uses the first three for user-facing tools; no tool is mislabeled as debugging merely to exercise the fourth. See the [WebMCP tool annotations](https://webmachinelearning.github.io/webmcp/#dictdef-toolannotations) and [Chrome’s security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools).

## Demonstrate the boundaries

A small prototype becomes persuasive when it shows failure cases as clearly as the successful path:

- An unchanged approved offer produces one booking.
- A changed price requires the applicable fresh approval.
- An expired offer cannot be booked.
- Approval belonging to another account is rejected.
- A retried request returns the original outcome.
- A lost response can be reconciled without another purchase.

The companion’s automated tests exercise these domain boundaries, HTTP session isolation and the shared tool callbacks. Native browser-agent behavior remains a manual compatibility check.

These are established transaction-design concerns applied to a new interaction model.

WebMCP makes application capabilities easier for agents to invoke. An agent-ready architecture makes the meaning and authority behind those invocations explicit—and preserves them through to the final commitment.

## Run the companion

In the [sibling examples repository](https://github.com/gfilardo/gf-blog-examples), open `webmcp-agent-ready-transaction/`, run `npm test`, then `npm start`. Visit `http://127.0.0.1:8001`. The README documents setup, scenarios, source references and trust limits.

The page begins with two lanes: what the person sees and what the agent does. The human lane presents an €85 surge warning and requires fare acceptance before enabling booking. The agent lane logs a direct booking tool call. With the flawed API, it books without recorded approval; with the corrected API, it is rejected until approval for that quote exists. Switch APIs and start a fresh comparison to inspect the different outcomes.

These paths call actual local HTTP routes and the same callbacks used for native tool registration. No model or real payment is involved. The implementation details are collapsed beneath the comparison, including read-only and untrusted-content annotation examples, offer expiry, changed fares, revocation and retry handling. Both booking adapters retain the consequential-action hint, so readers can distinguish metadata from API enforcement.

The application records approvals separately from booking. Its same-origin approval endpoint is not proof of a human gesture: a browser agent with page privileges could still invoke it. The example deliberately exposes this unresolved trust boundary instead of claiming a consent screen or CSRF token solves delegated authority. [OWASP’s CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) describes tokens and origin checks as defenses against cross-site requests; those controls do not establish human presence. The browser-agent implication is a trust analysis of this example, rather than a new guarantee in that guidance.

## References and further reading

- [WebMCP tool definition](https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool) and [registration API](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool) — the browser adapter contract.
- [WebMCP annotation dictionary](https://webmachinelearning.github.io/webmcp/#dictdef-toolannotations) — exact metadata fields; consult browser implementation support separately.
- [Chrome: WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — annotation guidance and restrictions on tool exposure.
- [OWASP: Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) — server-side enforcement and binding approval to transaction data.
- [Amazon Builders’ Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — caller request identifiers, atomicity and changed-input handling.
- [OWASP: CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) — what request-origin defenses address, distinct from proof of user approval.
- [Companion repository](https://github.com/gfilardo/gf-blog-examples) — run instructions and trust limits in `webmcp-agent-ready-transaction/README.md`; tool declarations in `public/tools.mjs`, enforcement in `domain.mjs`, checks in `example.test.mjs`.

*Documentation checked on 30 October 2026. WebMCP is evolving; specification text, browser implementation and agent-host behavior should be checked separately.*

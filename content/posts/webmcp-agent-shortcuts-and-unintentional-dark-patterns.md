---
title: "WebMCP: Agent shortcuts and unintentional dark patterns"
slug: webmcp-agent-shortcuts-and-unintentional-dark-patterns
date: "2026-10-30"
description: "How material conditions can disappear between human and agent interfaces, creating unintended dark patterns."
tags:
  - WebMCP
  - AI
  - API_design
  - architecture
series:
  id: webmcp-agent-ready-web
  title: "WebMCP and the agent-ready web"
  part: 2
draft: true
---

> In an agent-ready web, **dark patterns** can emerge entirely by accident. When an application exposes a direct WebMCP tool that bypasses the warning banners, price checks, and acceptance steps displayed on screen, the result is an unintentional dark pattern. To the developer, it was just a clean tool wrapper. But to the user holding an unapproved charge, the outcome is indistinguishable from deceptive design: commitment without informed consent.

A ride-booking website shows a warning: surge pricing is active, and the ride costs €85. The person must press **Accept this fare** before the booking button becomes available.

An agent receives a broad request to get the user home. A WebMCP tool calls the booking operation directly. The ride is booked, although the application has no recorded approval for the €85 quote.

Nobody set out to deceive the user. The implementation assumed that every booking request came after the acceptance screen. The tool introduced another route to the same operation, and that assumption stopped holding.

## One operation, two journeys

WebMCP tools are registered by the page itself, through `document.modelContext.registerTool()`, and their callbacks execute within the web application. This is a second interface to the application in the active tab, rather than an unrelated remote service. The distinction matters: the visual interface and the tool can share a session while expressing different prerequisites. See the [registration API](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool) and Chrome’s [comparison with MCP](https://developer.chrome.com/docs/ai/webmcp/compare-mcp).

The human journey has a price-specific acceptance step. The tool journey invokes the capability directly. That difference is useful only if the application carries the important prerequisites across both paths.

Here, the UI requires acceptance while the API merely assumes it. A disabled button guides a person through a screen sequence; it does not enforce a rule on other callers.

The fare can even be present in the tool result. This example does not depend on the agent inventing a price, assuming a missing fee is zero, or misunderstanding cancellation terms. The failure is the absence of a required approval check when booking.

## Friction asymmetry: the decision disappears in the shortcut

I call this **friction asymmetry**: the human journey pauses for a decision, while the agent interface offers a direct action. A warning, price comparison or explicit acceptance can give a person an opportunity to reconsider. A compact tool contract can reduce several interactions to one invocation.

The useful distinction is between unnecessary effort and a meaningful decision. Making someone scroll through terms does not establish understanding. Requiring acceptance of a clearly presented price serves a more specific purpose. When we compress a journey into a tool, that decision must remain represented somewhere in the contract and enforcement.

In the flawed ride tool, the only required input is the offer identity. Its schema and callback contract do not represent the prerequisite: approval for that quote. The implementation has compressed “show fare, accept fare, book” into “book this offer.” It also fails to explain how the agent should obtain or establish the missing approval. The price can be visible while the acceptance requirement is absent.

The agent can therefore make a schema-valid call without satisfying the human journey’s rule. This does not mean it is incapable of discovering the warning by inspecting the page. It means the exposed capability does not reliably communicate or enforce the prerequisite.

## The illusion of shared context

Someone looking at a browser agent beside an open website may reasonably expect it to respect the same warning and constraints as the buttons on screen. The tab appears to be shared ground: the fare is there, the booking button is disabled, and acceptance has not happened.

A callback does not automatically inherit those visual constraints. It may call the booking service without consulting the component state that disables the button. Sharing a tab or login session does not establish agreement about what has been accepted.

This is the mismatch worth designing for. The user sees one coherent product; the implementation has two entry points with different contracts.

## How an unintentional dark pattern emerges

```mermaid The UI requires acceptance, while the flawed API assumes it happened.
flowchart TD
    H[Human journey] --> W[Show EUR 85 surge warning]
    W --> A[Require fare acceptance]
    A --> B[Enable booking button]
    B --> API[Flawed booking API]
    T[WebMCP booking tool] --> API
    API --> C[Book without checking approval]
```

Dark patterns in human interfaces are usually deliberate: a growth team adds pre-checked add-ons, hides fees, or obscures a cancellation button to steer user behavior.

In an agent-ready web, dark patterns can emerge entirely by accident. When an application exposes a direct WebMCP tool that bypasses the warning banners, price checks, and acceptance steps displayed on screen, the result is an **unintentional dark pattern**.

A team implements a confirmation screen. The booking API is then reused by a naive WebMCP adapter, without moving the confirmation requirement into the underlying operation. The product now makes a financial commitment on a path that does not require the price-specific acceptance its human interface promises.

To the developer, it was just a clean tool wrapper and an architectural omission. But to the user holding an unapproved €85 charge, the outcome is indistinguishable from deceptive design: commitment without informed consent. “Get me home” is treated as sufficient to commit to this €85 fare, even though the product ordinarily asks the user to accept that exact price.

Strictly speaking, statutory definitions of dark patterns (such as those in the EU Digital Services Act or FTC enforcement policies) were conceived around manipulative visual interfaces: deceptive layouts, disguised buttons, and trick microcopy. An API adapter omitting an approval check does not fit that classical regulatory taxonomy. 

Yet consumer protection frameworks share an essential principle: unfair and deceptive practices are evaluated by their **effect on user autonomy and choice, not the developer's subjective intent**. The law does not ask whether an engineering team had malicious intent or merely made an architectural omission; it asks whether the user was committed without free and informed consent. From the user's perspective, the technical nuance between a deceptive button and an unaligned agent tool is meaningless. The danger of WebMCP is that teams can inadvertently produce dark-pattern outcomes simply by leaving a gap between what the visual interface promises and what the tool interface permits.

This is an illustrative failure scenario, not evidence that WebMCP itself deceives users or that all agents will behave this way. An agent host might independently request confirmation. The application should nevertheless enforce its own approval requirement rather than depend on an unspecified caller behavior.

The draft’s discussion of [misrepresentation of intent](https://webmachinelearning.github.io/webmcp/#misrepresentation-of-intent) and [ambiguous finalization](https://webmachinelearning.github.io/webmcp/#scenario-ambiguous-finalization) provides relevant background. The ride scenario and diagnosis here are this series’ application-design analysis.

## Isn’t this just a backend bug?

Yes: a script calling the same endpoint could expose the missing check too. Depending on the particular control, the pattern belongs to the established problem described by [CWE-602: Client-Side Enforcement of Server-Side Security](https://cwe.mitre.org/data/definitions/602.html). WebMCP does not invent that weakness.

But that diagnosis alone misses the product-design problem. The page now advertises a structured capability to an agent, alongside a visual journey that promises a prior decision. Reusing a backend operation without translating the visual journey’s prerequisites creates a divergence between the two interfaces. Fixing the server check is necessary; making the tool’s contract explain how to satisfy it is necessary for a usable integration.

The unintentional dark pattern emerges in that divergence. The human UI clearly discloses the price, and the tool looks like an ordinary wrapper, yet the combined system treats an unapproved fare as accepted. The user experiences the exact loss of agency that consumer protection frameworks seek to prevent, even when no one intended to deceive.

## Make the API enforce what the UI requires

The correction is straightforward: the acceptance action records approval for the quoted offer, and the booking operation checks for that approval before committing.

```mermaid Both entry points check approval for the specific offer at the API.
flowchart TD
    H[Human booking button] --> V{Approved?}
    T[WebMCP booking tool] --> V
    V -->|No| R[Reject: approval required]
    R --> P[Present fare for acceptance]
    P --> A[Record approval for the quoted offer]
    A --> RETRY[Retry booking]
    RETRY --> V
    V -->|Yes| C[Check conditions and commit]
```

The frontend presents the surge warning and price. Accepting creates an application approval record tied to that offer. A direct tool call cannot substitute an “accepted” boolean for the record. If the quote changes or expires, its approval cannot silently authorize a different commitment.

This was already sound application design before agents. [OWASP’s transaction-authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) requires server-side enforcement and protection of significant transaction data. A prescribed UI journey could conceal missing enforcement; a structured agent entry point makes the omission particularly visible.

## The same mismatch beyond ride booking

The ride remains the companion’s single main scenario. Three other hypothetical cases help identify the same class of divergence in a product review:

- **Checkout defaults:** a person can remove an optional €25 add-on, but `completeCheckout({ cartId })` offers no equivalent choice and silently uses the default. The issue is whether the tool preserves control over the same purchase, not whether its schema is syntactically valid.
- **Visible filters:** the page shows direct flights after 18:00, but a generic search-and-book callback ignores that selected view. The interface suggests shared selection state while the tool acts on a different set of options.
- **Unequal capabilities:** a product exposes a convenient subscription tool but no equivalent cancellation capability. A tool that makes cancellation easier could improve user agency; exposing only the easy acquisition path can deepen the imbalance. The extra questions must still be assessed for purpose rather than counting every confirmation as harmful friction.

These are design-review scenarios, not implemented companion features or reported incidents. They all ask the same question: does the agent interface preserve the material information, choices and prerequisites of the human interface?

## Watch the two lanes

The [companion repository](https://github.com/gfilardo/gf-blog-examples), in `webmcp-agent-ready-transaction/`, presents two lanes: **what the person sees** and **what the agent does**. Each lane has its own log and outcome.

Start with a fresh €85 quote. Leave the fare unaccepted. The human booking button remains disabled. Run the tool against the flawed API: it books anyway. Switch to the corrected API and start fresh. The same direct call is rejected because approval is missing.

Accept the displayed fare on the left and retry the corrected tool. Now the application has recorded the prerequisite, and the booking can proceed. The logs show the tool operation and API response; they are not a model’s reasoning trace.

All bookings are fictional and local. The comparison uses actual local HTTP routes and shared tool callbacks, without an AI model or real payment service.

## Hints support the flow; they do not enforce it

Both booking tools carry `consequentialHint: true`. That lets readers see that a hint does not establish price-specific approval. Its interpretation belongs to the agent host; enforcement belongs to the application’s booking operation. See [Chrome’s annotation guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools#use_annotation_hints).

There is also a separate trust question: recording a same-origin approval request does not prove that a human, rather than a script, made it. This example demonstrates a missing application check and its correction. It does not claim to establish human presence against a privileged browser agent. The next article examines authority and trust explicitly.

## References and further reading

- [CWE-602: Client-Side Enforcement of Server-Side Security](https://cwe.mitre.org/data/definitions/602.html) — the existing weakness behind UI-only enforcement; WebMCP changes the entry point, not the need for backend checks.
- [WebMCP: Misrepresentation of intent](https://webmachinelearning.github.io/webmcp/#misrepresentation-of-intent) — the draft’s closest discussion of mismatches between apparent and actual tool behavior.
- [WebMCP: Ambiguous finalization](https://webmachinelearning.github.io/webmcp/#scenario-ambiguous-finalization) — a specific scenario relevant to distinguishing preparation from commitment.
- [Chrome: Use annotation hints](https://developer.chrome.com/docs/ai/webmcp/secure-tools#use_annotation_hints) — guidance for read-only, consequential and untrusted-content signals.
- [WebMCP: Agent-level guardrails](https://webmachinelearning.github.io/webmcp/#mitigation-agent-level-guardrails) — why site-supplied descriptions and annotations are insufficient as a security boundary.
- [OWASP: Validate permissions on every request](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request) — the established enforcement principle, separate from the new interaction model.

*Documentation checked on 30 October 2026. WebMCP is evolving; specification text, browser implementation and agent-host behavior should be checked separately.*

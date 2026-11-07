---
title: "WebMCP: Who can confirm on the user’s behalf?"
slug: webmcp-delegated-authority
date: "2026-10-31"
description: "From a broad user request to a specific commitment: how applications can reason about delegated authority."
tags:
  - WebMCP
  - AI
  - API_design
  - architecture
series:
  id: webmcp-agent-ready-web
  title: "WebMCP and the agent-ready web"
  part: 3
draft: true
---

> When an AI assistant encounters an €85 surge fare, can it confirm the purchase on the user's behalf? If an agent must stop and prompt the user for every tool call, autonomy dies of prompt fatigue. But if the website accepts an agent's conversational claim of approval, it invites prompt injection and unauthorized spending. The answer to who can confirm on the user's behalf is never "the agent because it felt like it." In sound architecture, **only three entities can legitimately confirm**: the user directly, the application backend via stored policy envelopes, or a formally authorized delegate presenting cryptographic proof.

“Get me a ride home” is a clear statement of a desired outcome. It tells an assistant where the user wants to end up, but it says nothing about spending €85, accepting a non-refundable cancellation fee, or selecting a premium vehicle.

To carry out that instruction, an agent must translate high-level intent into concrete commitments. When those commitments involve real-world consequences—spending money, signing contracts, or altering persistent data—the application receiving the request faces a fundamental trust boundary: **who holds the legitimate authority to confirm on the user’s behalf?**

## The short answer: an agent cannot merely assert authority

The short answer is that **an AI agent cannot confirm on the user's behalf simply by claiming it has permission.**

An incoming payload containing `approved: true` or a conversational assertion (*“The user told me to book it”*) is not an authorization credential. An LLM is a probabilistic reasoning engine, not a security principal. It is vulnerable to prompt injection from untrusted web pages, model hallucinations, and misinterpretations of user intent. A website cannot outsource its fiduciary or contractual responsibility to an external model's conversational claims.

In traditional web development, applications collapsed identity, permissions, and transaction consent into a single check. If an HTTP request carried a valid session cookie, the backend assumed a human was sitting in front of the browser, had reviewed the form, and intended to submit it. 

With WebMCP, that assumption collapses. An in-browser agent shares the user's authenticated session, but its actions represent programmatic interpretations. Reasoning about delegation safely requires separating three distinct questions:

```mermaid Three distinct security questions: authentication, authorization, and transaction approval.
flowchart LR
    REQ[Request to book ride] --> AUTH[1. Authentication<br/>Who is the caller?]
    AUTH -->|Valid Identity| PERM[2. Authorization<br/>May this account book rides?]
    PERM -->|Allowed| TX[3. Transaction Approval<br/>Did user agree to this EUR 85 offer?]
    TX -->|Approved| COMMIT[Commit Booking]
    AUTH -.->|Invalid| REJ1[Reject: Unauthenticated]
    PERM -.->|Denied| REJ2[Reject: Forbidden]
    TX -.->|Missing| REJ3[Reject: Approval Required]
```

1. **Authentication** establishes *who* is operating the session (a valid account credential).
2. **Authorization** establishes *what* that identity is generally permitted to do (the account has an active card and is allowed to book rides).
3. **Transaction approval** establishes whether *this specific commitment*—with its exact price, version, and material conditions—was deliberately authorized.

As [OWASP’s Transaction Authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) emphasizes, transaction authorization is fundamentally distinct from login. A user may be securely logged in and authorized to hail rides, but neither fact establishes approval for an €85 transaction.

## Only three entities can legitimately confirm

If an AI agent cannot confirm by conversational assertion, who *can* confirm? 

In robust software architecture, **there are strictly three entities that can ever legitimately confirm a transaction**:

1. **The User Themselves (Direct Human Gating):**  
   The human confirms the transaction directly through an application-controlled channel—either an in-page UI action or a hardware-backed biometric prompt via **WebAuthn and Passkeys**. Here, strictly speaking, *no delegation takes place*: the human provides fresh, non-delegated proof of physical presence.
2. **The Application Backend (Pre-Delegated Policy Engine):**  
   The application itself confirms on the user's behalf, but only by evaluating the agent's request against **stored, user-defined policy envelopes** (e.g., *"Auto-approve rides home up to €40; escalate anything higher"*). The agent does not approve the ride; it merely proposes an offer that the backend validates against pre-authorized rules.
3. **A Formally Authorized Delegate (Cryptographic Proof, Not Assertion):**  
   An external agent *can* confirm on the user's behalf, but only if it presents a cryptographically signed capability grant minted by a trusted authorization server (such as **OAuth 2.0 Rich Authorization Requests / [RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396)**). The receiving service trusts the cryptographic signature and the explicit parameter bounds embedded in the token—never the agent's prose.

**There is no fourth option.** An AI assistant cannot manufacture authority on the fly, and a backend cannot accept conversational claims of consent. Every safe delegation architecture maps back to one of these three trust anchors.

## The delegation spectrum: four architectural patterns

Systems designers implement these three entities across four concrete architectural patterns, trading cognitive friction against implementation complexity:

### 1. Two-Phase Staging & Deferred Sign-Off (Draft $\rightarrow$ Commit)
The agent exercises full autonomy during search, filtering, and quote negotiation, but its capability is strictly non-committal: `stageBooking({ quoteId })`. The backend creates a reserved, uncommitted draft and returns an offer reference. The final commitment is handed back to the human for a single, focused review—either in the browser tab or via an out-of-band push notification. Pairing this review with **WebAuthn** provides cryptographic proof of human physical presence without repetitive passwords.

### 2. Standing Policy & Threshold Envelopes (Bounded Pre-Approval)
The user configures explicit spending envelopes in their account profile (*"Commutes up to €40 are pre-approved"*). When the agent submits a booking request, the backend policy engine evaluates the offer. A €32 ride proceeds autonomously without human interruption; an €85 surge fare triggers an immediate `APPROVAL_REQUIRED` rejection, prompting the agent to escalate the difference to the user. This enforces the principle of [least privilege](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#enforce-least-privileges) on server-side business logic.

### 3. Scoped Capability Delegation (OAuth RAR & Token Exchange)
When agents operate across independent services (e.g., an assistant coordinating across airlines, hotels, and ground transport), applications cannot rely on shared database flags. Instead, an authorization server issues fine-grained, cryptographically signed capability tokens using **OAuth 2.0 RAR ([RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396))** and **Token Exchange ([RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693))**. The token explicitly bounds the agent's authority (e.g., `type: "ride_booking"`, `max_amount: 40.00`, `currency: "EUR"`). The booking service independently validates the signature and verifies that the transaction parameters stay within bounds.

### 4. Cryptographic Intent Binding (Signed Offer Payloads)
For high-assurance, treasury, or legal workflows where tampering or non-repudiation is paramount, the server generates a canonical hash of the transaction parameters (offer ID, itemized fees, currency, expiration). The approving entity signs this payload with an asymmetric private key. The backend verifies the digital signature before execution, guaranteeing that neither an intermediate proxy nor a compromised agent runtime altered the offer terms.

---

### Architectural Trade-Off Matrix

| Pattern | Who Confirms | Trust Anchor | User Friction | Best Suited For |
| :--- | :--- | :--- | :--- | :--- |
| **1. Staged Preparation** | User | Human presence (UI or WebAuthn / Passkeys) | **Low–Medium** (1 tap at the end) | High-value, irreversible actions (flights, wire transfers) |
| **2. Threshold Envelopes** | Application Backend | Backend policy engine & stored rules | **Zero** (Interruption-free within bounds) | Frequent, routine consumer actions (daily rides, groceries) |
| **3. Capability Tokens** | Authorized Delegate | Authorization server (OAuth RAR / RFC 9396) | **Low** (Authorized once per session) | Cross-origin ecosystems and multi-service platforms |
| **4. Cryptographic Binding** | User or Authorized Delegate | Asymmetric cryptography (PKI / Keypairs) | **Medium** (Signing prompt per transaction) | High-assurance finance, contracts, non-repudiation |

*(Note: Technical authorization is often paired with operational risk backstops—such as spending velocity limits, temporary authorization holds, and automated dispute resolution. These operational buffers manage financial risk, but they do not replace authorization architecture.)*

## Consent must have an object

Whichever pattern an application adopts, delegation cannot exist as a floating abstraction. Approval must bind to an immutable, versioned **object**:

- **Offer Identity & Version:** Approval binds to a specific quote record. If network delays or dynamic pricing shift the fare from €85 to €95, prior approval cannot silently transfer to the higher price.
- **Explicit Material Terms:** Price caps, service classes, currency, and cancellation penalties must be explicitly enumerated.
- **Strict Temporal Expiry:** Approvals must carry a short time-to-live (TTL). Acceptance granted at 18:00 must not remain usable at 22:00.
- **Revocability:** A standing delegation or capability token must have an instant revocation path on the server.

As [OWASP transaction guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) notes, binding authorization to immutable transaction data is the only reliable defense against parameter manipulation.

## Looking ahead: building an agent-ready transaction

Deciding who can confirm on the user's behalf is ultimately a product decision. Add too much friction, and the assistant becomes an annoying toy. Infer too much authority, and the application creates accidental dark patterns and unauthorized commitments.

The engineering challenge is building a verifiable bridge between human intent and programmatic execution. In the final article of this series, we turn theory into code. We will build a complete reference architecture based on **Pattern 1 (Two-Phase Staged Preparation & Offer Binding)**, using WebMCP's `registerTool()` API, typed input schemas (`offerId`, `approvalId`, `attemptId`), and an idempotent backend capable of handling retries safely.

## References and further reading

- [OWASP: Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) — server-side enforcement and binding approval to significant transaction data.
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — least privilege and request-time validation.
- [RFC 9396: OAuth 2.0 Rich Authorization Requests (RAR)](https://datatracker.ietf.org/doc/html/rfc9396) — fine-grained, structured authorization for delegated capabilities.
- [RFC 8693: OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693) — delegating and transforming security tokens across autonomous systems.
- [W3C Web Authentication (WebAuthn)](https://www.w3.org/TR/webauthn-2/) — cryptographic proof of user presence.
- [WebMCP Specification: Agent Baseline Capabilities](https://webmachinelearning.github.io/webmcp/#agent-baseline-capabilities) — session inheritance and security boundaries.
- [Chrome: Secure WebMCP Tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — security guidelines for exposing tools to browser agents.
- [Working Example Repository](https://github.com/gfilardo/gf-notebook-examples) — runnable code contrasting naive tool shortcuts against verified transaction approval.

*Documentation checked on 30 October 2026. WebMCP is evolving; specification text, browser implementation, and agent-host behavior should be checked separately.*

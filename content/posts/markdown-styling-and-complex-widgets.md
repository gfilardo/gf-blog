---
title: "Markdown for the web: responsive layouts and complex widgets"
slug: markdown-styling-and-complex-widgets
date: "2026-11-08"
description: How this blog extends Markdown with quiet conventions—URL fragments, fenced containers, and progressive enhancement—for rich layouts and interactive widgets.
tags:
  - architecture
  - design
  - software
series:
  id: this-blog
  title: This blog
  part: 2
draft: true
---

Markdown was born with an elegant, focused mission: make plain-text writing easy to read, easy to write, and convertible into valid HTML. For linear essays composed of paragraphs, blockquotes, code snippets, and ordered lists, the original CommonMark syntax remains unbeatable.

The tension arrives when you attempt serious technical and architectural publishing on the modern web.

In real-world architectural essays, content is rarely strictly linear. You encounter:
- **Wide comparative matrices**: A 5-column architectural trade-off table comparing authentication, token delegation, and cryptographic intent suffocates when squeezed into a standard 730px reading column.
- **Expansive flowcharts & sequence diagrams**: A multi-step horizontal protocol diagram needs to stretch across the full width of the screen rather than being miniaturized to unreadable proportions.
- **Contextual side notes & mobile mockups**: Small screenshots or UI dialogs should be centered and capped at 380px or floated alongside prose, rather than needlessly ballooning to full article width.
- **Interactive widgets**: Token-bucket rate limiters, interactive pricing calculators, or simulation canvases that require initial state parameters and graceful non-JavaScript fallbacks.

Most modern publishing platforms react to this tension by abandoning Markdown's simplicity altogether. They reach for **MDX**, which embeds JSX components directly into Markdown documents, or they encourage authors to sprinkle raw `<div>` tags with Tailwind utility classes across their text.

Both of these approaches break down:
1. **MDX couples your prose to a specific JavaScript framework**: Your essays are no longer durable text files; they are source code files compiled by a specific React or Vue build pipeline. In five years, when the bundler or JSX runtime is obsolete, your documents will fail to build.
2. **Raw HTML destroys readability**: When an author has to write `<div class="max-w-4xl mx-auto my-8 overflow-x-auto">`, the tactile joy and distraction-free clarity of writing in plain text vanishes.

When designing this blog, I wanted an alternative: **first-class responsive layout control and widget integration using quiet, semantic conventions that preserve the integrity of plain Markdown.**

---

## Principle 1: Self-contained elements use `#fragment` hints

If a Markdown element already carries an identifier or URL—such as an image or a fenced code block—it should not require an outer wrapper tag simply to communicate layout intent.

### Responsive image figures

Standard CommonMark gives images an optional title string: `![Alt text](url "Title")`. In this blog's build pipeline, standalone block images are transformed into semantic HTML5 `<figure class="image-figure">` elements, where the title string becomes a typographic `<figcaption>`.

To control positioning and sizing, layout hints are appended directly to the URL as a hash fragment:

```markdown
![System Architecture](/assets/posts/architecture.png#wide "Figure 1: The staged execution pipeline.")
```

The fragment is parsed at compile time, validated against an allowlist, and automatically stripped from the final `src` attribute. It maps directly onto responsive CSS layout classes:

- `#wide` (`image-wide`): Breaks out of the 730px prose column to align symmetrically with the 1088px site shell.
- `#bleed` or `#full` (`image-bleed`): Spans edge-to-edge across the entire viewport (`100vw`) while keeping the caption aligned with the prose column.
- `#narrow` or `#center` (`image-narrow`): Centers and caps the figure at 380px, ideal for mobile mockups and dialog screenshots.
- `#float-left` / `#float-right` (`image-float-left` / `image-float-right`): Floats at 44% width with wrapped prose, automatically stacking back to 100% on mobile screens (`<= 760px`).
- Modifiers like `#frame` (hairline border) or `#pixelated` can be combined with `+` (e.g. `#narrow+frame`).

The authoring remains clean CommonMark. In an RSS reader or raw terminal preview, it remains a standard image reference without broken markup.

### Fenced Mermaid diagrams

Fenced code blocks provide an **info string**—the text immediately following the opening backticks. We extended this convention to Mermaid diagrams using the exact same `#fragment` vocabulary:

````markdown
```mermaid#wide Three distinct security questions: authentication, authorization, and approval.
flowchart LR
    REQ[Request to book ride] --> AUTH[1. Authentication]
    AUTH --> PERM[2. Authorization]
    PERM --> TX[3. Transaction Approval]
```
````

The generator extracts the `#wide` modifier, validates it, and renders an inline SVG wrapped in `<figure class="mermaid-diagram image-wide">`. It requires zero wrapper divs, honors dark-mode palette tokens, and automatically inherits progressive pan-and-zoom modal controls when viewed on desktop or touch screens.

---

## Principle 2: Multi-block figures and tables use fenced containers

While images and code blocks have URLs or fence headers, Markdown tables do not. A GFM table begins immediately with pipe characters:

```markdown
| Pattern | Who Confirms | Trust Anchor | User Friction | Best Suited For |
| :--- | :--- | :--- | :--- | :--- |
| **1. Staged Preparation** | User | Human presence | Low–Medium | High-value actions |
```

If an author needs a 5-column matrix table to break out to 1088px width—and needs to keep an explanatory note visually bound to that table—inline fragments are impossible.

Here, we adopt the semi-standard **fenced container** syntax (`:::`), popularized by Pandoc fenced divs, the CommonMark Generic Directives proposal, and modern documentation tools:

```markdown
::: wide

| Pattern | Who Confirms | Trust Anchor | User Friction | Best Suited For |
| :--- | :--- | :--- | :--- | :--- |
| **1. Staged Preparation** | User | Human presence | Low–Medium | High-value actions |
| **2. Threshold Envelopes** | Application Backend | Stored policy engine | Zero | Routine consumer actions |
| **3. Capability Tokens** | Authorized Delegate | OAuth RAR / RFC 9396 | Low | Cross-origin ecosystems |
| **4. Cryptographic Binding** | User or Delegate | Asymmetric cryptography | Medium | High-assurance finance |

*(Note: Technical authorization is often paired with operational risk backstops, such as velocity limits and temporary holds.)*

:::
```

### Why this design works

1. **Semantic HTML5**: The container compiles to `<figure class="component component-wide">` rather than generic `<div>` soup.
2. **Composite grouping**: The table and the italicized note live together inside the same wide figure. When the viewport expands, both elements span the 1088px layout as a unified editorial unit.
3. **Responsive table scrolling without brute force**: The build pipeline automatically encloses tables in `<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0">`. On narrow screens, the table scrolls horizontally with full keyboard focus support, while table cells use `overflow-wrap: normal` to prevent awkward mid-word breaks like *"Preparat-ion"*. Crucially, by letting the layout container dictate the available width, smaller 2-column tables elsewhere on the site remain compact and unencumbered by artificial minimum widths.

---

## Principle 3: Progressive enhancement for complex widgets

Technical essays frequently benefit from interactive exploration. In our series on *WebMCP and the agent-ready web*, for instance, an article might present an interactive simulation of token-bucket rate limiting under high agent traffic.

How should an interactive widget be authored?

There are two primary paradigms depending on whether the widget is **configuration-driven** or **content-driven**:

### 1. The data-driven widget (Fenced code block)

When a widget is an interactive visualization configured by typed parameters, it is authored as a fenced code block with a YAML or JSON payload:

````markdown
```rate-limiter#wide Token Bucket Simulator
capacity: 100
refill_rate: 10
burst_allowance: true
```
````

At build time:
- The compiler parses the YAML payload and validates it against a strict JSON schema.
- It emits a semantic figure with declarative data attributes:
  ```html
  <figure class="component component-wide" data-widget="rate-limiter" data-props='{"capacity":100,"refill_rate":10,"burst_allowance":true}'>
    <div class="widget-mount"></div>
    <figcaption>Token Bucket Simulator</figcaption>
  </figure>
  ```
- If JavaScript is active, a modular client script mounts the simulation. If JavaScript is disabled or viewed via RSS, a legible static fallback is presented.

### 2. The semantic fallback widget (Container fence)

When a widget can be expressed through human-readable initial state, we use the container syntax:

```markdown
::: rate-limiter wide

| Parameter | Initial Value | Range |
| :--- | :--- | :--- |
| Bucket Capacity | 100 tokens | 10 – 500 |
| Refill Rate | 10 tokens/sec | 1 – 50 |
| Initial Burst | 50 tokens | 0 – 100 |

*(Drag sliders to test token exhaustion under concurrent agent requests.)*

:::
```

The compiler produces:
```html
<figure class="component component-wide" data-widget="rate-limiter">
  <div class="table-scroll" role="region" tabindex="0">
    <table>...</table>
  </div>
  <p><em>(Drag sliders to test token exhaustion...)</em></p>
</figure>
```

This represents the purest form of **progressive enhancement**:
- **Zero-JS & Feed Readers**: The reader sees a clean, beautifully styled tabular breakdown. The document is 100% complete, accessible, and intelligible.
- **Enhanced Web Browser**: The client script reads the table values as its initial state and replaces or augments the display with live interactive sliders and canvas charts.

---

## Principle 4: Structured asides and callouts (Why two standards make sense)

Technical writing frequently demands visual interruptions: notes providing historical background, tips highlighting performance wins, warnings about double-spending or replay attacks, and high-consequence cautions against permanent key deletion.

In the Markdown ecosystem, two competing syntaxes have emerged for these callouts:
1. **Container fences** (`::: tip ... :::`), popularized by Confluence, VitePress, and Docusaurus.
2. **Blockquote alerts** (`> [!TIP]`), standardized by GitHub Flavored Markdown (GFM).

Does it make sense to support both? **Yes, because they optimize for two different authoring ergonomics:**

### Container callouts for rich, structured asides

When an aside requires multiple paragraphs, a numbered checklist, or a nested code snippet, container syntax is far more natural:

```markdown
::: warning Double-spending hazard
Nonce tracking must be atomic across distributed validator nodes:

1. Validate the transaction counter against the localized bloom filter.
2. Verify node consensus before releasing cryptographic escrow.

Replay attacks can exploit eventual-consistency windows if ordering is loose.
:::
```

Container fences avoid having to prefix every single line with `>` markers, making multi-line and multi-block drafting friction-free.

#### Designed for essays, not appliance manuals

Most documentation frameworks auto-inject loud, all-caps banners like **IMPORTANT** or **NOTE** at the top of every callout. In an architectural essay or reflective piece, those banners shatter the authorial voice—they patronize the reader and make the publication feel like a software user manual.

Furthermore, **callouts must be used with extreme restraint**. In reflective, long-form writing, prose and italics carry the argument. Boxing off paragraphs every few sections fragments the narrative continuum and devalues an essay into a software reference sheet. Callouts are reserved very sparingly—strictly for genuine, high-consequence operational hazards, breaking migration traps, or critical invariants that sit outside the narrative flow. (For lighter cues that avoid physical box barriers altogether, a planned enhancement explores paragraph run-in glyphs that prepend a monochrome mark directly to the text).

To preserve the contemplative rhythm of essay reading, **containers are title-less by default**. If you omit the title string:

```markdown
::: important
Safe and idempotent does not mean identical answers, zero incidental effects, or exactly-once execution.
:::
```

The compiler omits the title bar entirely, producing a quiet, bordered aside that flows naturally with the argument:

```html
<aside class="callout callout-important" role="note">
  <p>Safe and idempotent does not mean identical answers...</p>
</aside>
```

When an aside genuinely benefits from a micro-headline, you provide an explicit **editorial title** (such as `::: warning Double-spending hazard`), which renders the specific conceptual headline you wrote rather than a generic bureaucratic label.

### GitHub-style alerts for lightweight caveats

When an aside is a concise one- or two-sentence advisory, the blockquote syntax is terse, universally recognized across developer tools, and degrades gracefully in basic CommonMark viewers that know nothing of custom container fences:

```markdown
> [!NOTE]
> Standard RFC 9396 rich authorization details are used throughout this section.
```

Our pipeline extends GFM alerts with the same editorial flexibility: appending an editorial headline (e.g. `> [!WARNING Replay risk]`) renders a custom title, while appending `-` (e.g. `> [!NOTE -]`) suppresses the title bar entirely.

### Unified compilation and zero-JS accessibility

Rather than treating them as separate systems, our build pipeline compiles both syntaxes into the exact same semantic HTML5 output:

```html
<aside class="callout callout-warning" role="note">
  <div class="callout-title">
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">...</svg>
    Double-spending hazard
  </div>
  <p>Nonce tracking must be atomic...</p>
</aside>
```

- **Semantic landmarks**: Screen readers encounter an `<aside role="note">`, correctly identifying it as ancillary context.
- **Accessible iconography**: Inlined SVGs include `aria-hidden="true"`, preventing screen readers from reciting meaningless vector path coordinates.
- **Design token integration**: Callout borders and title labels tap directly into our Warm Alabaster and Bordeaux Noir palette tokens (`--muted` coffee slate for background tips and notes; `--accent` Bordeaux ruby and crimson for warnings, invariants, and cautions), preserving typographical restraint and avoiding the generic SaaS rainbow.
- **Full prose scale**: The body text inside callouts does not shrink into footnote fine print. It inherits the exact 19px Georgia prose scale and line rhythm, maintaining reading comfort across the entire essay.
- **Zero client JS**: Everything is rendered statically at build time.

---

## Architectural lessons

Extending Markdown without corrupting it requires discipline:

1. **Keep the sizing vocabulary unified**: Never invent separate layout terms for different media. Whether an element is a photograph, an SVG diagram, a table, or an interactive canvas, it uses the exact same geometry tokens: `default`, `wide`, `bleed`, `narrow`, `float-left`, and `float-right`.
2. **Fail early with descriptive diagnostics**: A typo like `#flaot-right` or an unclosed `:::` container must never render as silent visual corruption. The build pipeline should catch it immediately and report the source file and line number.
3. **Avoid the "Box Soup" trap**: Containers must earn their keep. Standalone figures do not need outer wrappers. Reserve container fences for multi-block composite figures and interactive tools.
4. **Never solve layout issues with global element hacks**: When a table feels too narrow, the temptation is to force global rules like `th, td { min-width: 9rem; }`. Doing so inevitably breaks simpler tables across the rest of the site. Sizing belongs to the layout container, while individual components should adapt naturally to their context.

By pairing quiet conventions with strict build-time validation and progressive enhancement, Markdown remains what it was always meant to be: a joyful, durable medium for focused writing.

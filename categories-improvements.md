# Article Categories & Strategic Pillars: Architecture and Improvement Notes

## Overview & Context

This document captures the taxonomy design, information architecture, and navigation strategy for segregating articles into strategic categories beyond tags.

**Current Status**: Deferred until the publication volume expands. Currently (with ~4 published articles), segregating into three distinct category archives would result in sparse 1-article ledgers. For now, the site uses an editorial `featured: true` frontmatter property to curate the home page, while `/articles/` serves the complete archive.

---

## 1. Persona & Strategic Positioning

The objective of the taxonomy is to portray Giovanni as a **deep thinker with an entrepreneurial mindset who thinks in terms of business transformation**, while preserving his identity as a domain architect and hands-on builder.

Most technical blogs conflate the **subject** (e.g. *WebMCP*, *HTTP*, *AI*) with the **cognitive altitude** of the essay. The proposed taxonomy decouples the two:
- **Categories (Pillars)** represent the **Cognitive Altitude / Perspective** (Why it matters to business, how the system is architected, or how the code is built).
- **Tags** represent the **Cross-Cutting Subject Matter** (The underlying protocol, technology, or standard).

---

## 2. The Three Strategic Pillars

Every article belongs to exactly **one** primary category:

| Pillar | Audience | Core Focus | Examples from Giovanni's Writing |
| :--- | :--- | :--- | :--- |
| **Transformation** | C-suite, founders, investors, enterprise leaders | Macro market shifts, platform economics, agentic disruption, business viability, operating models. | *WebMCP: Your website now has two audiences, people and agents*<br/>*WebMCP: Agent shortcuts and unintentional dark patterns* |
| **Architecture** | Principal architects, technical directors, engineering leadership | System boundaries, domain capability mapping, zero-trust protocols, security liability lines, cryptographic consent. | *WebMCP: The Zero-Trust UI: Binding Agent Reality to Cryptographic Consent*<br/>*WebMCP: Delegated authority in autonomous agent sessions* |
| **Craft** (The Proving Ground) | Senior practitioners, builders, technical evaluators | First-principles code mechanics, protocol implementations, performance benchmarks, and handcrafted systems. | *HTTP has QUERY now. Can I just use it?*<br/>*HTTP QUERY: Live results with SSE*<br/>*How this blog is built* |

---

## 3. Resolving the Tag Dilemma: Scoped vs. Orthogonal

### The Question
*Should tags be category-specific (e.g., `architecture -> webmcp` vs. `engineering -> webmcp`)?*

### The Evaluation
- **Scoped / Hierarchical Tags (Anti-pattern)**:
  - Scoping tags to categories (e.g., `/architecture/tags/webmcp/`) creates fragmented silos. A visitor interested in *WebMCP* must dig through three disjointed pages.
  - Generates dozens of 1-article tag archives, weakening discovery and search value.
- **Orthogonal Faceted Tags (Recommended)**:
  - Keep tags **global and cross-cutting** (`WebMCP`, `AI`, `API_design`).
  - When viewing a topic hub (e.g., `/tags/webmcp/`), group or badge articles by their **Category**:
    - **Transformation**: *Your website now has two audiences*
    - **Architecture**: *Zero-Trust UI & Cryptographic Consent*
    - **Craft**: *Live stream serialization & transaction hooks*
  - **Persona Benefit**: Demonstrates that Giovanni can examine the exact same technical breakthrough from board-level business transformation down to bare-metal protocol mechanics.

---

## 4. Navigation & Menu Considerations (Avoiding Clutter)

A core design principle of this blog is the **"anti-card typographic ledger"** with generous whitespace, avoiding SaaS clutter. Naively adding `Transformation`, `Architecture`, `Craft`, `Tags`, and `About` into the top header would overcrowd the navigation bar on mobile and desktop.

### Evaluated Patterns

#### Pattern A: Direct Pillars (4 items total) — *Recommended for Header*
The brand mark in the top-left (`g. Giovanni's notebook`) already links to the Home page (`/`). Removing redundant "Home" and "Articles" links allows the three pillars to become the primary menu:
```
[g. Giovanni's notebook]            Transformation · Architecture · Craft · About
```
- **Clutter**: Low (only 4 clean words).
- **Impact**: Instantly communicates Giovanni's three operational spheres before the visitor even scrolls.
- **Tags placement**: Accessible via topic pills on every article card, atop category archives ("Browse all topics ↗"), and in the footer navigation.

#### Pattern B: In-Ledger Segmented Filter Tabs — *Recommended for Articles Index*
Keep the top header lean (`Articles · Tags · About`), and place a clean typographic tab bar directly above the article ledger:
```markdown
Articles
[ All ]   Transformation   Architecture   Craft
─────────────────────────────────────────────────────────────
2026-11-08  [Transformation]  WebMCP: Your website now has two audiences
2026-11-08  [Architecture]    WebMCP: Zero-trust UI and cryptographic consent
```
- **Clutter**: Zero in the header.
- **User Experience**: Readers switch categories in-place right where they are browsing articles.

---

## 5. Homepage vs. Category Indices Strategy

- **Home Page (`/`)**: 
  - Retains the generative living systems artwork (flocking canvas).
  - Displays curated **Featured Articles** via frontmatter `featured: true`.
  - Omits total article counts to prevent ambiguity.
  - Provides a direct link at the bottom: `All articles →` pointing to `/articles/`.
- **Category Archive Pages**:
  - `/transformation/`: Archive of all Transformation essays.
  - `/architecture/`: Archive of all Architecture blueprints.
  - `/craft/`: Archive of all Craft & Proving Ground experiments.
- **Global Archive (`/articles/`)**:
  - Contains all published articles across all three pillars.

---

## 6. Implementation Blueprint (When Volume Demands)

When the blog reaches enough articles to warrant activation:

1. **Schema Update ([`schemas/post.schema.json`](file:///Users/giovanni/code/gf-blog/schemas/post.schema.json))**:
   ```json
   "category": {
     "type": "string",
     "enum": ["transformation", "architecture", "craft"],
     "description": "The cognitive altitude and strategic pillar of the essay."
   }
   ```
2. **Metadata Migration**:
   Add `category` to the frontmatter of each markdown file in `content/posts/`.
3. **Build & Render Logic ([`src/render.mjs`](file:///Users/giovanni/code/gf-blog/src/render.mjs))**:
   - Add routes: `/transformation/`, `/architecture/`, `/craft/`.
   - Reserve the three category names in page slug collision detection.
   - Pass category metadata and badges to article cards in listings and tag pages.
4. **Templates ([`templates/index.html`](file:///Users/giovanni/code/gf-blog/templates/index.html))**:
   - Render category badges on article cards.
   - Add category filter tabs to `/articles/`.

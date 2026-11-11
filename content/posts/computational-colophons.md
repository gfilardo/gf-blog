---
id: computational-colophons
title: "Computational colophons: generative article motifs and the digital ex-libris"
author: "Giovanni Filardo"
slug: computational-colophons
date: "2026-11-09"
description: "Reviving historical printer's marks with deterministic vector mathematics: seed stability, date-based epochs, inline SVG, and the physics of micro-scale optical sizing."
tags:
  - architecture
  - design
  - software
series:
  id: this-blog
  title: This blog
  part: 3
draft: false
unlisted: true
---

Modern web publishing has quietly succumbed to the **stock photo trap**.

Visit almost any technical blog or architectural essay, and the headline is invariably crowded out by an interchangeable visual cliché: a moody stock photograph of a developer typing on a laptop in a dimly lit coffee shop, an abstract neon 3D render of floating torus shapes, or a prompt-soup AI illustration displaying the unmistakable, greasy sheen of synthetic diffusion.

For serious technical writing, these decorative assets are actively counterproductive:

1. **They push the thesis below the fold**: Huge rectangular cover banners consume prime vertical screen real estate, displacing the title, abstract, and opening argument.
2. **They dilute typographic identity**: External photography injects arbitrary, uncurated color palettes that clash violently with carefully tuned design tokens and reading themes.
3. **They create "box soup" on article indexes**: Affixing a rectangular thumbnail to every post forces article listings into noisy card grids, destroying the calm scanning rhythm of an editorial ledger.

Yet leaving essays entirely unadorned feels sterile. In print, long-form publishing has possessed an elegant answer to this problem for more than five hundred years.

---

## The return of the printer's mark

In the fifteenth and sixteenth centuries, early European master printers did not paste arbitrary illustrations atop their treatises. Instead, they developed the tradition of the **printer’s mark** and the **architectural colophon**.

```mermaid#wide The tradition of the architectural threshold: from historical print to digital systems
flowchart LR
    A["Renaissance Colophon\n(Aldus Manutius, Christopher Plantin)"] --> B["Editorial Threshold\n(Pause between metadata & prose)"]
    B --> C["Computational Ex-Libris\n(Deterministic vector geometry)"]
    C --> D["Inline SVG Architecture\n(Zero-runtime, token-integrated)"]
```

Printers like **Aldus Manutius** in Venice (the anchor and dolphin), **Christopher Plantin** in Antwerp (the compass with the motto *Labore et Constantia*), and the **Elzevir family** in Leiden engraved small, finely detailed emblems on title pages and at the conclusion of texts. These devices served multiple purposes simultaneously:

* They certified provenance and intellectual craftsmanship.
* They established a recognizable graphic signature across an entire catalogue.
* They created an **editorial threshold**—a deliberate visual pause between the book’s administrative metadata and the beginning of the author’s prose.

On this blog, we revive this tradition in computational form. Under our tagline—*Software, systems, and art*—every essay receives an abstract, code-driven geometric emblem derived deterministically from its metadata. 

We call these **computational colophons** or **digital ex-libris**. They are not raster illustrations downloaded from external libraries; they are pure mathematical vector constructions generated during compilation.

---

## Deterministic vector generation

The generator runs inside the static build pipeline (`src/motif.mjs`) and during browser preview sessions (`static/js/motif.mjs`). It is built from first principles with zero external dependencies.

```mermaid#wide The deterministic generation pipeline: from article metadata to pure inline SVG
flowchart TD
    A["Article Metadata\n(slug, date, frontmatter)"] --> B["FNV-1a 32-bit Hash"]
    B --> C["Mulberry32 PRNG\n(Platform-independent stream)"]
    C --> D["Date-Based Algorithmic Epoch\n(Historical stability filter)"]
    D --> E["Mathematical Generator\n(truchet, guilloche, subdivision, etc.)"]
    E --> F["100% Inline SVG Element\n(Zero-runtime, token-inherited)"]
```

### 1. Stable hashing and reproducible randomness

Each article’s unique identifier is its URL slug (e.g., `computational-colophons`). The slug is hashed into a stable 32-bit unsigned integer using the non-cryptographic **FNV-1a** algorithm:

$$\text{hash} = \left( (\text{hash} \oplus \text{byte}) \times 16777619 \right) \pmod{2^{32}}$$

This integer acts as the seed for a **Mulberry32** pseudo-random number generator. Mulberry32 produces an identical, platform-independent stream of floating-point values in $[0, 1)$ across both Node.js build processes and browser JavaScript runtimes. Given the same slug, the generator executes identical mathematical decisions whether evaluated during static generation on macOS or dynamically inside a reader's browser.

### 2. Mathematical families

To prevent repetitive aesthetics while maintaining a coherent architectural language, motifs are divided into distinct mathematical families:

* **Truchet Tile Circuits (`truchet`)**: An $M \times N$ grid of Smith quarter-circle arcs and diagonal crossing tracks whose rotations are modulated by seed bits. Adjacent paths join across tile boundaries to form continuous electronic circuits and distribution networks.
* **Guilloché & Harmonograph Rosettes (`guilloche`)**: Coupled parametric harmonic oscillators evoking astronomical astrolabes, banknote security engravings, and physical pendulum harmonographs:
  $$\begin{aligned}
  x(t) &= A_1 \sin(f_1 t + p_1) + A_2 \sin(f_2 t + p_2) \\
  y(t) &= B_1 \cos(f_3 t + p_3) + B_2 \cos(f_4 t + p_4)
  \end{aligned}$$
  Coprime frequency pairs $\{ (2,3), (3,5), (3,7), (5,7) \}$ guarantee closed, non-degenerate petals without destructive cancellation.
* **Recursive Guillotine Subdivision (`subdivision`)**: Constructivist Binary Space Partitioning (BSP) recursively cutting rectangular canvases along alternating axes at harmonic split ratios ($0.382, 0.5, 0.618$). Evokes Bauhaus architectural floor plans and De Stijl elevation studies.
* **Polar Supershapes (`supershape`)**: Johan Gielis' superformula modulating polar radius via trigonometric symmetry powers, yielding organic yet strictly mathematical seal contours.
* **Elementary Cellular Automata (`automata`)**: Wolfram 1D binary automata (Rules 30, 90, 110, 150) evolved over multiple generations and reflected vertically to form woven heraldic seals. Only exposed cell edges are stroked, eliminating internal grid clutter.

```javascript
// A single architectural drafting stroke across all families:
// stroke-width="1" vector-effect="non-scaling-stroke"
```

### 3. Strict design token integration

In technical drafting, drawings are rendered with a precision technical pen. Every line in a motif honors this constraint:

* **Structural hairlines & coordinate rules**: `stroke="var(--line)"`
* **Primary figure paths**: `stroke="var(--muted)"`
* **Focal accent**: Exactly one resonant loop, circuit trace, or partition boundary per motif renders in bold `stroke="var(--accent)"`
* **Focal surface tint**: `fill="none"` or selective cell highlight in `fill="var(--surface)"`

Because colors are specified via CSS custom properties, every motif transitions between **Warm Alabaster** and **Velvet Bordeaux Noir** instantaneously when the reader changes themes—with zero re-rendering, no asset swaps, and no client script execution.

---

## The permanence problem: immutable date-based epochs

A subtle architectural pitfall in generative static sites is **hash instability over time**.

### The rehash catastrophe

Suppose an article's algorithm is determined via a naive modulo over the registry array:

$$\text{algorithm} = \text{hash}(\text{slug}) \pmod N$$

When the blog launches with three algorithms ($N = 3$), an article with seed 10 selects algorithm index $10 \pmod 3 = 1$ (`guilloche`).

A year later, you implement a fourth algorithm ($N = 4$). Suddenly, $10 \pmod 4 = 2$ (`subdivision`).

Without touching the original essay, its visual emblem has silently mutated. A static blog must guarantee **permanent visual provenance**. An essay published in October 2026 must look identical in October 2036.

### The solution: immutable date-based epochs

The engine solves this by assigning an immutable release timestamp (`since: 'YYYY-MM-DD'`) to each registered algorithm:

```javascript
export const ALGORITHMS = [
  // Epoch 1: Launch
  { id: 'truchet',     since: '2026-01-01', draw: renderTruchet },
  { id: 'guilloche',   since: '2026-01-01', draw: renderGuilloche },
  { id: 'subdivision', since: '2026-01-01', draw: renderSubdivision },
  // Epoch 2: Append-only
  { id: 'supershape',  since: '2026-10-03', draw: renderSupershape },
  { id: 'automata',    since: '2026-10-03', draw: renderAutomata },
  { id: 'flow-field',  since: '2026-10-03', draw: renderFlowField },
  { id: 'switchyard',  since: '2026-10-03', draw: renderSwitchyard },
];
```

When building an article:

1. The engine reads the article's publication date (`doc.date`).
2. It filters the registry to include only algorithms whose `since` timestamp is less than or equal to that date:
   $$\text{Eligible} = \{ A \in \text{ALGORITHMS} \mid A.\text{since} \le \text{doc.date} \}$$
3. It selects deterministically from that eligible historical subset:
   $$\text{selected} = \text{Eligible}[\text{hash}(\text{slug}) \pmod{|\text{Eligible}|}]$$

#### Architectural invariants

* **Monotonicity**: The registry is strictly append-only and ordered chronologically ($T_0 \le T_1 \le T_2 \dots$). Tests enforce this property during compilation.
* **Immutable Provenance**: An essay published in October 2026 evaluates against the exact same pool of algorithms forever. Adding fifty new algorithms in 2030 has zero impact on historical articles.
* **Draft Ergonomics**: Draft previews (`draft: true`) evaluate against a sentinel date `'9999-12-31'`, granting immediate access to the newest generators during drafting while deferring final epoch locking until publication.
* **Authorial Freedom**: Authors can override automatic selection by setting `motif: <algorithm>` or `motif: { algorithm, seed }` in Markdown frontmatter whenever a particular visual harmony is desired.

---

## The engineering case for 100% inline SVG

An initial instinct when designing a vector graphics pipeline is to write the generated SVG out to standalone static files (e.g., `/assets/motifs/<slug>.svg`) and reference them in HTML via `<svg><use href="...#motif"/></svg>` or `<img src="...">`.

Our architecture deliberately rejects external SVG files in favor of **100% pure inline SVG**.

### 1. Cross-browser CSS custom property cascades

The visual system depends entirely on inheriting CSS variables (`var(--line)`, `var(--accent)`, `var(--muted)`).

When SVG geometry resides in an external file referenced via `<use href="...">`, browsers render that graphic in an isolated Shadow DOM tree. In modern **WebKit (Safari)** and **Gecko (Firefox)**, dynamic theme shifts—such as toggling system dark mode or switching color schemes via media queries—frequently fail to invalidate custom property cascades across external `<use>` boundaries. Lines either fail to change color or vanish entirely.

Pure inline SVG lives directly in the document DOM. Theme variable inheritance is instantaneous, reliable, and universal across every rendering engine.

### 2. Byte economics and zero network waterfall

* A complete mathematical motif contains between 15 and 45 vector commands, totaling **800 bytes to 1.8 KB of raw markup** (<800 bytes gzipped).
* Inlining this markup directly into the static HTML adds negligible document weight while eliminating an entire external HTTP request, DNS lookup, TLS connection, and cache validation roundtrip.

### 3. Ex-libris uniqueness makes caching moot

Because every article slug generates a distinct seed and drawing, reuse across pages is practically non-existent. There is no shared asset pool to cache in the browser; each motif is authored specifically for that piece. Inlining matches the lifecycle of the document itself.

---

## When vector physics meets pixels: the scaling breakdown

The most fascinating engineering discovery of this implementation emerged when extending motifs from the article reading page to the article listing ledger.

### Multi-surface geometry and visual DNA

A motif expresses the same visual identity across three distinct surfaces:

1. **Hero Frieze ($360 \times 80\text{px}$)**: A wide panorama positioned beneath the headline on reading pages, marking the transition into prose.
2. **Compact Mark ($120 \times 120\text{px}$)**: A square nucleus displayed in the `/motifs/` gallery.
3. **List Mark ($44 \times 44\text{px}$)**: A miniature architectural seal embedded in the chronological article ledger adjacent to the publication date.

To preserve the feeling of a single technical drafting pen, all figures enforce:

```xml
stroke-width="1" vector-effect="non-scaling-stroke"
```

### The paradox of non-scaling strokes

Vectors are mathematically infinite in resolution, but computer screens are matrices of finite physical pixels.

When geometry authored in a $120 \times 120$ coordinate system is scaled down to a small micro-canvas:

* At **$120 \times 120\text{px}$**, a $1\text{px}$ stroke represents **$0.83\%$** of the canvas width. The line is delicate, and negative space dominates.
* At **$28 \times 28\text{px}$**, `vector-effect="non-scaling-stroke"` prevents the stroke from shrinking below $1\text{px}$. That $1\text{px}$ stroke now represents **$3.57\%$** of the canvas width per line—**over $4.3\times$ thicker proportionally**.

```
Coordinate Space (120x120)            Rasterized at 28x28px
┌─────────────────────────┐           ┌──────┐
│  ┌───┬───┐              │           │█▓████│  <-- Lines collide;
│  │   ├───┤   (Hairline  │    ==>    │██████│      negative space
│  └───┴───┘    pen: 1px) │           │██████│      vanishes into
│                         │           └──────┘      an "ink clot"
└─────────────────────────┘
```

### The "ink clot" failure mode

In geometrically dense algorithms, this proportional stroke growth causes catastrophic visual collapse:

* **Recursive subdivision**: At fixed BSP recursion depth 4, the generator calculates 15 internal divider lines. In a 28px square, 15 divider lines of $1\text{px}$ thickness consume 15 physical pixels of stroke. Only 13 pixels remain across all 16 sub-cells. Lines touch, gaps vanish, and the graphic degenerates into an illegible black smudge.
* **Cellular Automata (`automata`)**: With 8 to 11 generations reflected into a seal ($15\text{--}21$ cell rows), each row is barely $1.4\text{px}$ tall. A $1\text{px}$ contour edge completely smothers neighboring cells.

### Resolving the dilemma: bounding box and optical sizing

When micro-scale vector line work breaks down, three engineering remedies present themselves:

1. **Subpixel stroke attenuation ($< 1\text{px}$)**: One might attempt setting `stroke-width: 0.75px` in CSS. But on standard displays, subpixel vector lines cannot align with physical pixel boundaries. The rasterizer anti-aliases them into washed-out, blurry gray lines instead of crisp, dark hairlines.
2. **Bounding box expansion ($44 \times 44\text{px}$)**: In the site’s article ledger (`.article-card`), the left `.article-date` column has **$130\text{px}$** of horizontal width. Expanding the mark to **$44 \times 44\text{px}$** increases pixel surface area by **$2.5\times$** ($(44/28)^2 \approx 2.47$). That extra area immediately restores line separation, gives the mark the stately presence of an embossed ex-libris, and naturally satisfies the W3C and Apple $44\text{px}$ touch target guideline.
3. **Optical sizing (`form: 'micro'`)**: In metal typefounding, Renaissance punchcutters understood that you cannot simply scale a 72-point display font down to 6-point footnote text. At small sizes, delicate serifs break off and ink traps fill with wet ink. Typecutters hand-carved distinct punches for small sizes: opening counters, shortening serifs, and reducing stroke contrast.

Generative algorithms must adopt the same **optical sizing**:

* The generator receives `bounds.form = 'micro'`.
* It preserves the **exact same visual DNA** (same seed, same frequency ratios, same partition cuts, same cellular rule).
* But it actively prunes unresolvable sub-splinters:
  * In `subdivision`, early stopping and minimum room dimension thresholds preserve clean, readable rooms without microscopic cells.
  * In `automata`, evolving fewer generations yields a sharp, readable heraldic seal with distinct stepped contours.
  * In `guilloche`, the fine inner dashed astrolabe ring is omitted, focusing the eye on the primary resonant petal.

---

## The living laboratory: `/motifs/`

Architecture should be inspectable. Rather than burying generative logic inside opaque static build scripts, the site publishes an interactive gallery at [`/motifs/`](/motifs/).

::: wide

| Feature | Architectural Purpose | Implementation |
| :--- | :--- | :--- |
| **Chronological Audit Ledger** | Inspect every article's assigned algorithm, epoch, decimal seed, and hash | Rendered at build time from site manifest |
| **Zero-Framework Custom Element** | Autonomous interactive widget (`<motif-widget>`) | Vanilla Web Component with isolated shadow DOM |
| **Live Algorithm Switcher** | Test seeds and switch generators in real time | Dynamic client-side re-evaluation of `src/motif.mjs` |
| **Frontmatter Clipboard Serialization** | "Copy YAML" button transfers discovered aesthetics to Markdown | Generates valid `motif: { algorithm: ..., seed: ... }` block |

:::

Readers and authors can explore the mathematical space directly in the browser: rolling random seeds, switching algorithms, and observing how the Hero Frieze, Compact Mark, and List Mark respond in unison.

## The broader arc

A personal website is not merely a container for text; it is an integrated software system and a visual medium.

By rejecting off-the-shelf stock photography and ungrounded AI imagery in favor of deterministic, code-driven mathematical colophons, we create a quiet visual identity that honors the historical craft of fine printing—engineered with the rigor of modern static site architecture.

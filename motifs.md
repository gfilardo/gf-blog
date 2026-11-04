# Generative Article Motifs: Architectural Specification

A design specification and technical architecture for deterministic, code-driven geometric article identifiers ("computational colophons" / "digital ex-libris").

---

## 1. Vision & Core Philosophy

### Beyond the "Stock Photo Trap"
Most modern tech blogs default to decorative cover images: stock photos of laptops, abstract neon 3D renders, or generic AI-generated imagery. In deep-dive technical essays, these assets:
- Push the headline and opening thesis below the fold.
- Dilute visual identity by injecting arbitrary, uncurated color palettes.
- Introduce visual "box soup" and clutter to article indexes.

### The Computational Colophon
This blog embraces an alternative ethos rooted in its tagline: **Software, systems, and art**.

Rather than importing external raster images, each article receives an **abstract, deterministic geometric motif** generated from its slug, with independent overrides for the algorithm and seed. Each algorithm derives its own geometric parameters from that seed.

- **A Digital Ex-Libris**: Acts like historical printer’s marks, architectural vignettes, or engraved colophons found in classic typography and fine book design.
- **Architectural & Constructivist**: Constructed strictly from fine mathematical vector geometry (hairline coordinate grids, harmonic curves, algorithmic lattices).
- **Fully Integrated with the Palette**: Parameterized by the blog's CSS design tokens (`var(--ink)`, `var(--line)`, `var(--accent)`, `var(--muted)`, `var(--surface)`), seamlessly transitioning between **Warm Alabaster** and **Velvet Bordeaux Noir**.
- **Deterministic & Zero-Runtime**: Evaluated during static site generation (`src/motif.mjs`), outputting pure inline SVG with zero JavaScript required in the browser.

---

## 2. Spatial Rhythm & Layout Rules

### Where the Motif Belongs: The Article Reading Page
The primary motif lives on individual article reading pages (`templates/post.html`):
- **Position**: Sits directly beneath the article header (after the title and introductory synopsis), immediately before the body prose.
- **Role**: Serves as an architectural threshold—an editorial vignette marking the transition from metadata into long-form reading.
- **Dimensions**: Standardized canvas with an intentional, non-disruptive aspect ratio (a slim horizontal $360 \times 80\text{px}$ architectural frieze, or an optional centered $120 \times 120\text{px}$ square mark).

### Multi-Surface Geometry & Visual DNA
The generator is **canvas-aware** (`bounds: { width, height, form }`):
- **Same Seed, Same DNA**: An article's seed defines its core mathematical identity (frequency ratios, symmetry order, accent placement, branching style).
- **Adaptive Level-of-Detail (LoD)**:
  - In **Hero Frieze** ($360 \times 80$, `form: 'hero'`): The generator unfolds the full sequence (e.g. an $9 \times 2$ Truchet circuit, 3 interlocking harmonograph dials, or a wide constructivist elevation study).
  - In **Compact Mark** ($120 \times 120$, `form: 'mark'`): The generator renders the concentrated nucleus (e.g. a $3 \times 3$ Truchet block, a single radial rosette, or a centered square subdivision).
  - In **List Mark** ($44 \times 44$, embedded in article listings): The mark functions as a micro-colophon adjacent to publication dates, requiring careful management of line density and stroke physics.
- A reader observing all three scales can readily see that the compact mark and list mark are derived from the exact same mathematical seed and visual DNA as the hero banner.

### Where the Motif Belongs: The Article Index & Typographic Ledger
On article listing pages ([design.md: Section 2](design.md#2-layout-philosophy-the-anti-card-index)), motifs appear without breaking the calm, tabular ledger:
- **Placement**: Embedded in the $130\text{px}$ `.article-date` column on `/`, `/preview/`, and `/tags/[topic]/`.
- **Dimensions**: Sized at $44 \times 44\text{px}$ (`.article-motif-mark`), matching standard touch targets and balancing neatly below the monospace publication date.
- **Interactivity**: Serves as a tactile glyph linking directly to the article with subtle hover scaling (`scale(1.08)`).
- **Anti-Card Preservation**: It operates strictly as an architectural printer's mark, preserving the open ledger rhythm without boxing content into generic card containers.

---

## 3. Mathematical Families & Initial Algorithms

To ensure variety across the publication without sacrificing visual coherence, the generator supports distinct mathematical families. The three launch algorithm IDs and activation dates are preserved. Four additional families are registered in the `2026-10-03` epoch:

### Algorithm 1: Truchet Tile Circuits (`truchet`)
* **Mathematical Basis**: Smith's two orientations of a tile containing two quarter-circles centered at opposite corners. Endpoints meet at edge midpoints with matching tangents. There are no crossing tiles or decorative node dots.
* **Aesthetic**: Continuous meandering routes and closed loops, with subtle corner registration ticks.
* **DNA Adaptation**: A coordinate hash and PRNG choose each tile independently from `(seed, column, row)`. A canonical $15 \times 3$ field is traced into complete routes before rendering.
  - `form: 'hero'`: Shows the full $15 \times 3$ field.
  - `form: 'mark'`: Shows its central $3 \times 3$ tiles, preserving geometry and route colors exactly. Routes may leave and re-enter the crop.
* **Focal Accent**: A seeded arc in the central tile selects one complete connected route. That route is accented throughout the field; the mark displays its visible portions.


### Algorithm 2: Guilloché & Harmonograph Curves (`guilloche`)
* **Mathematical Basis**: Undamped Lissajous figures, with one sinusoid per axis: `x(t) = 0.85 R sin(fx t + phase)`, `y(t) = 0.85 R cos(fy t)`. Each dial's actual frequencies are distinct and coprime, including the pair assembled for the left dial. This prevents equal-frequency collapse into a line or ellipse.
* **Aesthetic**: Classical bank-note line engravings, astrolabes, and astronomical calculation dials. The existing `guilloche` ID and activation date are retained.
* **DNA Adaptation**:
  - `form: 'hero'`: Three phase-related dials with fine connecting axis rules.
  - `form: 'mark'`: An exact scaled version of the central dial: the same frequency order, phase, curve, ring, and relative dot size.
* **Curve Quality**: Cubic Bézier segments use analytic positions and tangents. Segment counts follow a fourth-derivative interpolation error bound and increase with frequency and radius, targeting less than 0.03 coordinate units of error before SVG rounding. Periodic endpoints and tangents join smoothly at the closed seam.
* **Focal Accent**: The central dial's curve and center dot use `var(--accent)` in both forms.
* **Reference**: [Paul Bourke, *Harmonograph*](https://paulbourke.net/geometry/harmonograph/index.html). The implementation uses the simpler undamped Lissajous case rather than the multi-oscillator or damped models discussed there.

### Algorithm 3: Recursive Guillotine Subdivision (`subdivision`)
* **Mathematical Basis**: Binary Space Partitioning (BSP) over one canonical 4.5:1 plan: a central square and two wings. Seeded ancestry-specific streams determine split bias, harmonic ratios, and early stopping. Cuts snap to a 1/24-unit drafting grid, with a minimum room dimension of 1/6 unit.
* **Aesthetic**: Bauhaus floorplans and structural elevations, with deliberately varied subdivision depth, broad quiet rooms, and a clear hierarchy of rules.
* **DNA Adaptation**:
  - `form: 'hero'`: Shows the complete plan, extending the central square with west and east wings.
  - `form: 'mark'`: Shows the exact central square with matching partitions, stroke hierarchy, and focal room. Geometry decisions are independent of output dimensions.
  - At the actual 44px list size, the minimum room dimension remains just over six pixels, preserving the full shared structure without crowded slivers.
* **Focal Accent**: One of the larger central rooms is tinted with `var(--surface)` and outlined with `var(--accent)`. The fill and boundary refer to the same room; unrelated coordinate dots are omitted. Shared edges are removed from ordinary rules so the accent is drawn once.
* **Identity**: The existing `subdivision` ID and `2026-01-01` epoch are retained. The revamp intentionally updates its generated geometry.

---

### Additional Families (2026-10-03)

- **Supershapes (`supershape`)**: Layered polar Gielis superformula studies. Seeded parameter families produce stars, rounded lobes, and alternating petals with different symmetry orders. Five central contours gradually change their exponents and twist as their outer extents shrink. Three-contour side studies use different exponent settings of the same seeded family. The compact mark reproduces all five central contours, including the single accented contour. Odd symmetry uses equal sine/cosine exponents to preserve closure over a full turn; alternating exponents use even symmetry. Each contour is normalized independently, and sample density follows symmetry order. Small axis ticks replace circular frames. The existing ID and `2026-10-03` epoch are retained. Reference: [Gielis, 2003, *A generic geometric transformation that unifies a wide range of natural and abstract shapes*](https://doi.org/10.3732/ajb.90.3.333).
- **Elementary cellular automata (`automata`)**: Selects rule 30, 90, 110, or 150 and evolves a seeded short run of live cells through 8–11 generations, using the three-cell binary neighborhood as the rule-bit index. A sufficient zero-valued halo keeps the displayed evolution independent of finite boundaries. The evolution is mirrored vertically into a woven seal. Only exposed cell edges are drawn, producing continuous stepped contours with no internal cell grid. The hero shows three growth stages with the complete central seal accented; the compact mark reproduces that same seal. Seeded initial cells, rule, generation count, and horizontal reflection define its identity. Reference: [Wolfram CellularAutomaton documentation](https://reference.wolfram.com/language/ref/CellularAutomaton).
- **Flow fields (`flow-field`)**: Traces streamlines through a smooth vector field combining a broad current, sinusoidal drift, and 2–4 seeded vortices. Seeded vortex locations, radii, strengths, and directions change the composition. Midpoint integration follows tight bends; a spatial hash separates neighboring curves, and loop checks stop self-intersections. The compact mark samples the central field while the hero extends it horizontally. One central streamline is accented. Gentle stretches are simplified and joined with quadratic Bézier segments. Output consists entirely of bounded SVG paths with no noise library or browser animation. Reference: [Tyler Hobbs, *Flow Fields*](https://www.tylerxhobbs.com/words/flow-fields).

All are zero-dependency SVG generators with one accent stroke, CSS color tokens, and non-scaling drafting strokes. Historical publication dates before `2026-10-03` still select only from the original three algorithms. Explicit overrides can use any registered family on any publication date. Every family appears automatically in the `/motifs/` algorithm selector.

---

### Switchyard (2026-10-03)

**Switchyard (`switchyard`)** modified version of the truchet algorithm with a mix of curved connectors, straight crossings, asymmetric inward/outward bends, decorative tile-center dots, and dashed centerline. Unlike classic Smith tiles, tangent continuity and coloring an entire connected route are not constraints of this design.

The wide banner shows a $15 \times 3$ field; the compact mark reproduces its central $3 \times 3$ tiles. Each tile's type, orientation, and dot are derived from its seed and integer coordinates, independently of canvas size. A seeded focal tile always lies within the central crop, keeping its accent segment and dot visible at both sizes. Dot radii scale with tile size; drafting strokes retain the shared non-scaling weight.

Switchyard shares the `2026-10-03` epoch with supershapes, automata, and flow fields. Select it on any article with `motif: switchyard`, or choose it in `/motifs/`.

---

### Contour Maps (2027-01-04)

**Contour maps (`contours`)** trace six elevation levels through a seeded scalar field of elliptical Gaussian hills and valleys. A zero-elevation boundary encloses the terrain in islands, distinguishing the map from open flow-field trajectories. Nearby central summits produce ridges and saddles within the compact crop. Small crosses identify up to four separated local maxima of the actual sampled field. Marching squares interpolates edge crossings and joins them into complete isolines; a bilinear asymptotic decider resolves saddle cells, with a deterministic choice for exact ties. Shared grid-edge identities prevent cracks between cells.

The field is sampled once on a canonical 4.5:1 terrain grid, independently of output size. The compact mark clips its central square, interpolating new endpoints at the crop boundary. Closed loops retain their closure; cropped paths remain open rather than gaining artificial closing chords. Both forms preserve elevation levels and accent membership. The accented contour is the middle-elevation component nearest the central hill.

Registration starts on **January 4, 2027**, two calendar months after implementation on November 4, 2026. Published articles dated before that epoch retain their existing automatic selection. Authors can preview it immediately in `/motifs/`, in undated draft selection, or with `motif: contours`.

Reference: [BorisTheBrave, marching squares tutorial](https://www.boristhebrave.com/docs/sylves/1/articles/tutorials/marching_squares.html).

---

### L-systems (2027-02-04)

**L-systems (`l-system`)** rewrite a symbol sequence using one of three curated grammar families: branching forks, asymmetric sprigs, and crystalline fans. The turtle interpreter draws `F`, turns on `+` and `-`, and saves/restores position, heading, step length, and ancestry with `[` and `]`. Branch steps shrink as the interpreter descends into the stack.

The seed chooses the grammar, rule alternatives, angles, branch proportions, and a small tilt. Each symbol has a stable ancestry ID. Random decisions depend on that ID and seed, so additional generations preserve existing branches exactly rather than shifting a sequential random stream.

The hero shows early, complete, and intermediate growth stages using the complete model's framing. The compact mark reproduces the complete central tree and its one accented root-to-tip branch. Both geometry and accent selection are resolved before applying canvas bounds. Expansions are limited to eight iterations and 8,192 symbols, with smaller curated depths used for the motif; oversized or unbalanced expressions are rejected rather than partially rendered.

Registration starts on **February 4, 2027**, one calendar month after contour maps. Earlier published articles retain their automatic selection. Preview immediately in `/motifs/` or with `motif: l-system`.

Reference: [Prusinkiewicz and Lindenmayer, *The Algorithmic Beauty of Plants*, chapter 1](https://algorithmicbotany.org/papers/#abop).

---

### Modular Chord Diagrams (2027-03-04)

**Modular chord diagrams (`chords`)** place 30–60 equally spaced points around a circle and connect each point `i` to `(i × multiplier + offset) mod N`. The seed chooses the point count, multiplication rule, optional offset, and rotational phase. Fixed points are omitted and undirected edges are deduplicated. Rules that yield mostly isolated pairs or lack a connected walk of at least three edges are excluded.

The hero compares three related valid multiplication rules with the same point count, offset, and phase. The compact mark reproduces the complete central graph, including its accented walk. The accent is a short connected cycle when available, otherwise a connected walk of up to eight edges. Its edges are removed from the muted geometry, avoiding double-stroking. Line counts and accent lengths are bounded to preserve negative space.

Registration starts on **March 4, 2027**, one month after L-systems. Preview immediately using `chords` in the `/motifs/` algorithm selector or `motif: chords` frontmatter; automatic selection for earlier published articles is unchanged.

Reference: [Modular multiplication circle explanation and demo](https://github.com/kathuman/multiplication-circle).

---

## 4. Visual Cohesion & Design System Integration

To prevent diverse algorithms from feeling like arbitrary clip art, all generators adhere to four system constraints:

1. **Standardized Coordinate Space (`viewBox`)**:
   - Hero frieze: `viewBox="0 0 360 80"`
   - Compact mark: `viewBox="0 0 120 120"`
   No generator emits its own outer margin or unconstrained canvas.
2. **Unified Drafting Weight**:
   All paths share `stroke-width="1"` and `vector-effect="non-scaling-stroke"`, giving all figures the uniform feel of a single architectural drafting pen.
3. **Strict Color Token Mapping**:
   - Structural hairlines: `stroke="var(--line)"`
   - Primary figure geometry: `stroke="var(--muted)"`
   - Focal accent: Exactly one focal path, node, or boundary per motif uses `stroke="var(--accent)"`
   - Background fills: `none` or selective `fill="var(--surface)"`
4. **Complexity Floors & Degenerate Seed Guardrails**:
   Every generator guarantees structural visual balance:
   - **Parameter Clamping**: Harmonic frequencies are chosen exclusively from coprime sets $\{ (2,3), (3,5), (3,7), (5,7) \}$ to prevent destructive cancellation into flat ellipses; BSP depth is bounded at 3–4 levels centrally and 2–3 in the wings, with early stopping and minimum room dimensions.
   - **Sanity Floors**: If total generated path length or vertex count falls below an aesthetic minimum, the seed is deterministically perturbed (`seed = (seed + 0x9e3779b9) >>> 0`) until structural sufficiency is satisfied.

---

## 5. Architectural Permanence: Date Epochs & Invariants

### The Rehash Problem
If the algorithm is selected via a naive modulo:
$$\text{algorithm} = \text{hash}(\text{slug}) \pmod N$$
Adding a new algorithm later ($N=3 \to 4$) alters the modulo calculation for almost every existing article. An essay published in 2026 would suddenly change its motif upon a 2027 build.

### The Solution: Date-Based Algorithm Epochs + Frontmatter Override

We combine **immutable date epochs** with **explicit frontmatter overrides**:

#### 1. Date-Based Epochs (Automatic & Stable)
Algorithms are registered with a release timestamp (`since: 'YYYY-MM-DD'`):

```javascript
const ALGORITHMS = [
  // Epoch 1: Initial Launch
  { id: 'truchet',     since: '2026-01-01', draw: renderTruchet },
  { id: 'guilloche',   since: '2026-01-01', draw: renderGuilloche },
  { id: 'subdivision', since: '2026-01-01', draw: renderSubdivision },

  // Epoch 2
  { id: 'supershape',  since: '2026-10-03', draw: renderSupershape },
  { id: 'automata',    since: '2026-10-03', draw: renderAutomata },
  { id: 'flow-field',  since: '2026-10-03', draw: renderFlowField },

  { id: 'switchyard', since: '2026-10-03', draw: renderSwitchyard },

  // Epoch 3
  { id: 'contours', since: '2027-01-04', draw: renderContours },

  // Epoch 4
  { id: 'l-system', since: '2027-02-04', draw: renderLSystem },

  // Epoch 5
  { id: 'chords', since: '2027-03-04', draw: renderChords },
];
```

When generating a motif for an article with publication date `doc.date`:
```javascript
// Filter only algorithms that existed on or before the publication date
const available = ALGORITHMS.filter(algo => algo.since <= effectiveDate);
const selectedAlgo = available[hash(doc.slug) % available.length];
```

#### 2. Epoch Invariants
The static build enforces the following invariants:
1. **Strict Monotonicity**: `ALGORITHMS` is strictly sorted by `since` date ($T_0 \le T_1 \le T_2 \dots$).
2. **Immutable Registration**: Existing entries retain their IDs, activation dates, and relative order forever. New algorithms are strictly appended.
3. **Draft Previews Policy**: If `doc.draft` is true and `doc.date` is missing or in the future, the effective date defaults to the latest available epoch (`'9999-12-31'`). Drafts can immediately preview new generators; once published (`draft: false`), the article's permanent `date` locks its epoch forever.
4. **Initial Coverage**: The earliest registered epoch (`2026-01-01`) precedes the blog's earliest article (`2026-10-23`), ensuring every published piece has an eligible algorithm set.

#### 3. Independent Algorithm and Seed Overrides
Algorithm selection follows this precedence:
1. Explicit `motif` frontmatter on the article.
2. Series-level algorithm override (if the article belongs to a series with a declared motif algorithm).
3. The slug-based selection from the dated registry.

Supported YAML frontmatter:
- String shorthand: `motif: guilloche`
- Full object override:
  ```yaml
  motif:
    algorithm: guilloche
    seed: 12345
  ```
- Unsigned 32-bit seeds (including `0`) are accepted. If `algorithm` is omitted, the date epoch selects the algorithm while using the explicit seed. If `seed` is omitted, the slug derives the seed.

---

## 6. Implementation Architecture

### Generator Module (`src/motif.mjs`)
`src/motif.mjs` re-exports the shared browser-compatible entry point, `static/js/motif.mjs`. That entry point owns the dated registry, selection, and SVG wrapper while importing each generator from its own file:

- `static/js/motif/truchet.mjs`
- `static/js/motif/guilloche.mjs`
- `static/js/motif/subdivision.mjs`
- `static/js/motif/supershape.mjs`
- `static/js/motif/automata.mjs`
- `static/js/motif/flow-field.mjs`
- `static/js/motif/switchyard.mjs`
- `static/js/motif/contours.mjs`
- `static/js/motif/l-system.mjs`
- `static/js/motif/chords.mjs`

Shared hashing, PRNG, numeric formatting, and selection helpers live in `static/js/motif/utils.mjs`. Algorithms import helpers directly, avoiding circular dependencies on the registry. The build copies the complete module tree for the browser widget; server and browser use identical implementations. Existing named exports remain supported.

Together these modules implement:
1. **FNV-1a Hash**: Derives a stable 32-bit unsigned integer from any string.
2. **Mulberry32 PRNG**: Produces a reproducible stream of pseudo-random numbers in $[0, 1)$.
3. **Registry**: Append-only list of algorithms with `id`, `since`, and `draw` function.
4. **Generators**: Pure functions taking `(seed, bounds)` and returning SVG geometry.
5. **Dispatcher**: Resolves algorithm and seed, enforces complexity floors, and renders the complete inline SVG element.

### Build Integration (`src/content.mjs`, `src/render.mjs`, `templates/post.html`)
1. In `schemas/post.schema.json`: Support `motif: { oneOf: [ { type: "string" }, { type: "object", ... } ] }`.
2. In `src/content.mjs`: Validate algorithm IDs against the registry when specified in frontmatter.
3. In `src/render.mjs`: For each post page, call `generateArticleMotif(post)` and supply it to `page.motif`.
4. In `templates/post.html`:
   ```html
   {% if page.motif %}
   <div class="article-motif-wrapper" aria-hidden="true">
     {{ page.motif | safe }}
   </div>
   {% endif %}
   ```
5. In `static/css/style.css`:
   ```css
   .article-motif-wrapper {
     display: flex;
     justify-content: center;
     margin: 28px 0 36px;
     padding: 12px 0;
     border-bottom: 1px solid var(--line);
   }
   .article-motif {
     width: 100%;
     max-width: 360px;
     height: auto;
   }
   ```

---

## 7. The Architectural Case for Pure Inline SVG

Rather than splitting output between inline SVG and external `<use href="...svg#id">` references, the generator outputs **100% inline SVG**.

### 1. Bulletproof CSS Custom Property Inheritance
The visual design depends on CSS tokens (`var(--line)`, `var(--muted)`, `var(--accent)`, `var(--surface)`).
- Inline SVGs inherit theme variables from `:root` and parent selectors across all web browsers without exception.
- External SVG `<use>` references across shadow DOM boundaries suffer from documented browser discrepancies in Safari (WebKit) and Firefox (Gecko), where host CSS variables fail to invalidate or cascade on dynamic `prefers-color-scheme` switching.

### 2. Byte Economy & Zero Latency
- Mathematical vector hairlines are exceptionally compact: typical outputs measure **800 bytes to 2.5 KB raw text** (<800 bytes gzipped).
- Inlining this into static HTML adds negligible payload while eliminating an extra HTTP connection, DNS/TLS handshake, and cache negotiation waterfall.

### 3. Unique Colophons
- Because seeds derive deterministically from unique article slugs, virtually every article produces a distinct visual composition. Reuse across multiple pages is virtually zero, making external asset caching moot.

### 4. Zero Build-Pipeline Complexity
- Inlining requires zero file-hash generation, zero external file routing in `src/build.mjs`, and no asset cleanup. It mirrors the reliable, zero-overhead pattern already established by `src/system-art.mjs`.

---

## 8. The Multi-Scale Dilemma: Stroke Physics, Resolution, and Optical Sizing

When translating an architectural visual system from a generous reading threshold ($360 \times 80\text{px}$) to an article index mark, vector mathematics collides with the physical reality of raster screens.

### The Physics of `vector-effect="non-scaling-stroke"`
To maintain the feeling of a fine architectural pen, every stroke specifies `stroke-width="1"` and `vector-effect="non-scaling-stroke"`. This works flawlessly at larger scales:
- At **$120 \times 120\text{px}$**, a $1\text{px}$ stroke occupies **$0.83\%$** of the canvas width. Lines breathe comfortably, and negative space dominates.
- When that identical coordinate geometry is rendered in a **$28 \times 28\text{px}$** container, the $1\text{px}$ physical stroke occupies **$3.57\%$** of the canvas per line—**over $4.3\times$ thicker proportionally**.

### The "Ink Clot" Failure Mode
In dense mathematical families, this proportional expansion causes visual collapse:
- **Original recursive subdivision** (before its revamp): At fixed BSP recursion depth 4, the generator placed 15 divider lines. Squeezed into $28\text{px}$, 15 lines of $1\text{px}$ stroke take up 15 pixels of solid ink, leaving only 13 pixels across all sub-cells.
- **Cellular Automata (`automata`)**: With 8–11 generations reflected into a seal ($15\text{--}21$ rows), each cell row is only $\sim 1.4\text{px}$ high. Hairline boundaries collide, and the mark collapses into an illegible ink blot.

### The Three Remediation Paths

| Strategy | Mechanism | Structural Rationale | Evaluation |
| :--- | :--- | :--- | :--- |
| **1. Subpixel Stroke Attenuation** | Set `stroke-width: 0.75px` in CSS. | Reduces total ink coverage. | **Rejected as sole fix**: On standard (1x) displays, subpixel strokes blur due to antialiasing. Does not relieve geometric crowding when 15 lines occupy 28 pixels. |
| **2. Bounding Box Expansion** | Increase mark to $44 \times 44\text{px}$. | Expands pixel surface area by **$2.5\times$**, restoring line separation. | **Adopted**: The $130\text{px}$ `.article-date` column easily accommodates $44\text{px}$. Matches Apple/W3C touch targets and gives the mark the presence of a classic printer’s colophon. |
| **3. Optical Sizing (`form: 'micro'`)** | Generator adapts internal density to canvas size. | Translates Renaissance punchcutting into code: preserves mathematical DNA (seed, frequencies, partition cuts) while culling sub-splinters. | **Partially addressed**: Subdivision now enforces readable minimum room dimensions without changing its shared tree. Algorithm-specific micro detail reduction remains a roadmap item for denser families. |

---

## 9. Interactive Gallery & Exploration Ledger (`/motifs/`)

To audit visual diversity and allow transparent inspection of the generative engine, the static generator publishes a dedicated recap route at `/motifs/`:
- **Comprehensive Ledger**: Lists every published article and draft preview, showing title, publication date, algorithmic epoch, active algorithm, and effective seed in both decimal and hexadecimal notation.
- **Autonomous Web Component (`<motif-widget>`)**: Each entry is instantiated as a custom element with zero-framework client-side ESM (`static/js/motif-widget.js`).
- **Interactive Exploration**: Dropdowns allow readers and authors to swap algorithms and seeds in real time. The widget dynamically re-evaluates `generateArticleMotif()` in the browser DOM across all three display tiers (**Hero Frieze**, **Compact Mark**, and **List Mark**).
- **Frontmatter Serialization**: Authors experimenting with alternative motifs can click **"Copy YAML"** to copy the exact frontmatter override (`motif: { algorithm: ..., seed: ... }`) directly to their clipboard.


To choose a flow-field motif explicitly:

```yaml
motif:
  algorithm: flow-field
  seed: 42
```

## 10. Implementation Backlog

Contour maps are implemented with a `2027-01-04` activation date; L-systems are implemented with a `2027-02-04` activation date. Modular chord diagrams are implemented with a `2027-03-04` activation date. **Circle packing** remains planned. **Subdivision has been revamped** with a shared canonical plan, variable partition hierarchy, readable room sizes, and one coherent focal room.

Implementation approaches, seed variation, references, and acceptance criteria are documented in [Motifs to Implement & Existing Motifs to Revamp](motif-improvements.md#9-motifs-to-implement--existing-motifs-to-revamp).

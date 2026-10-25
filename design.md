# Design System: Giovanni's Blog

A design specification and architectural rationale for the blog's visual identity, typography, color system, layout philosophy, and generative interactive art.

---

## 1. Aesthetic Philosophy: Bordeaux Noir & Warm Alabaster

Most technical and editorial blogs default to either:
1. **The Sepia Newsprint Editorial Archetype**: Grimy beige paper (`#f7f6f2`), terracotta or rust accents, and bookish serif typography. While polite, it evokes dusty print journals rather than living digital systems.
2. **The Sterile SaaS Framework**: Chilly blue-gray backgrounds (`#f4f6fa`), rounded cards in multi-column grids, drop shadows, and neutral blue buttons that make every portfolio look like a component library demo.

This blog embraces an alternative ethos: **Warm Alabaster, Velvet Bordeaux Noir, and Architectural Precision**.

- **Nocturnal Depth (Dark Theme)**: Anchored by deep velvet obsidian with subtle wine undertones (`#0e0a0d`), evoking atmospheric salon depths, cold starlight rose text (`#f7eef1`), and nocturnal boundary hairlines.
- **Warm Alabaster (Light Theme)**: Anchored by a rich, warm natural wove alabaster (`#f8f3ec`) and warm sandstone surfaces (`#eee7de`). It eliminates cold, clinical blue chills while avoiding murky, yellowed newsprint.
- **Bordeaux & Crimson Luminescence**: Bold, authoritative Bordeaux ruby (`#98122d`) in light mode and piercing electric crimson (`#f43f5e`) in dark mode, commanding attention with high contrast and confident character.
- **Text Selection**: Distinctly bold velvet bordeaux ribbon (`#881337`) with crisp white lettering (`#ffffff`), rejecting light pastel pinks for an authoritative, luxurious contrast.
- **Living Systems**: Rather than static hero banners or stock photography, the primary visual emblem on the home page is an autonomous particle field—a live simulation of flocking agents and visiting probes that models decentralized emergence.

---

## 2. Layout Philosophy: The Anti-Card Index

### The Problem with Cards
Cards (`border-radius`, background surface card, drop shadows, and isolated borders) are overused across the web:
- **Visual "Box Soup"**: Wrapping homogeneous content (such as blog posts with identical fields) inside individual boxes forces the eye to cross dozens of unnecessary borders and padding barriers.
- **Fragmented Scanning**: Vertical eye flow is disrupted. Instead of reading down a unified typographic column, the reader hops between discrete visual silos.
- **Truncation and Clutter**: Cards frequently enforce fixed heights or awkward line-wrapping to look tidy in a grid, sacrificing natural text rhythm for box geometry.

### Where Containers Earn Their Keep
Containers are reserved exclusively for:
1. **Self-contained interactive tools**: Embedded components with internal state, controls, or actions (e.g., audio players, interactive playgrounds).
2. **Technical enclosures**: Code snippets (`<pre>`), tables, and the collapsible series index (`<details class="series-nav">`).
3. **Draggable / spatial units**: Kanban cards or spatial canvas nodes where physical manipulation is the core interaction metaphor.

### The Typographic Ledger
On this site, articles and topics are displayed as **frameless ledgers**:
- Clean horizontal hairlines (`1px solid var(--line)`).
- Strict tabular grid alignment (`130px` metadata column for dates and tags, open content column for title and summary).
- Ample negative space that lets typography and whitespace define grouping naturally.

---

## 3. Color Tokens & Theme Architecture

The color system adapts to user environment preferences (`prefers-color-scheme`) with high contrast and WCAG AA/AAA compliance across all modes.

### Token Definitions

| Token | Light Theme (Warm Alabaster Bordeaux) | Dark Theme (Bordeaux Obsidian Noir) | Purpose |
| --- | --- | --- | --- |
| `--paper` | `#f8f3ec` (Warm natural wove alabaster) | `#0e0a0d` (Deep velvet obsidian noir) | Primary canvas background |
| `--ink` | `#171210` (Deep warm espresso-wine noir) | `#f7eef1` (Cold starlight rose-white) | Primary body text and headings |
| `--muted` | `#685952` (Warm roasted coffee slate) | `#937e89` (Misty rose-slate) | Eyebrows, timestamps, meta details |
| `--accent` | `#98122d` (Deep bold Bordeaux ruby) | `#f43f5e` (Electric crimson bordeaux) | Active links, highlights, interactive states |
| `--line` | `#dfd6cb` (Warm boundary hairline) | `#25171e` (Nocturnal wine rule) | Section dividers, header/footer borders |
| `--surface`| `#eee7de` (Warm sandstone surface) | `#181015` (Abyssal wine backdrop) | Code blocks, series panels, inline badges |
| `::selection` | `#881337` / `#ffffff` | `#881337` / `#ffffff` | Bold velvet bordeaux ribbon with white text |

### Contrast Ratios
- **Dark Mode**:
  - Ink (`#f7eef1`) on Paper (`#0e0a0d`): **17.8:1** (Exceeds WCAG AAA requirement of 7:1)
  - Muted (`#937e89`) on Paper (`#0e0a0d`): **5.0:1** (Meets WCAG AA requirement of 4.5:1 for body copy)
  - Accent (`#f43f5e`) on Paper (`#0e0a0d`): **6.7:1** (Meets WCAG AA)
  - Selection Ink (`#ffffff`) on Selection Background (`#881337`): **8.2:1** (Exceeds WCAG AAA)
- **Light Mode**:
  - Ink (`#171210`) on Paper (`#f8f3ec`): **15.8:1** (Exceeds WCAG AAA)
  - Muted (`#685952`) on Paper (`#f8f3ec`): **5.1:1** (Meets WCAG AA)
  - Accent (`#98122d`) on Paper (`#f8f3ec`): **7.5:1** (Exceeds WCAG AAA)
  - Selection Ink (`#ffffff`) on Selection Background (`#881337`): **8.2:1** (Exceeds WCAG AAA)

---

## 4. Typography & Spatial Rhythm

### Font Stacks
- **Interface & Headings (`--sans`)**: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  - Crisp, native rendering with zero layout shift or web font loading delay.
  - Optical kerning and tight letter-spacing (`-.02em` to `-.055em`) for monumental display titles.
- **Monospace (`--mono`)**: `"SFMono-Regular", Consolas, "Liberation Mono", monospace`
  - Code snippets, article dates, series part markers, and back navigation cues.
- **Prose Reading (`Georgia, serif` with modern line rhythm)**:
  - 19px base font size, `1.85` line-height, and `65ch` max line length for sustained reading comfort.

### Hierarchy & Scale
- **Display Heading (`h1`)**: `clamp(42px, 5.7vw, 72px)` — bold, compact leading (`1.12`).
- **Section Heading (`h2`)**: `20px` (or `16px` on notebook index) with strict upper-line border.
- **Article Item Title (`h3`)**: `23px` with negative tracking.
- **Metadata & Eyebrows**: `12px–13px`, uppercase or spaced regular text in `--muted`.

---

## 5. The System Field: Generative Art & Agent Dynamics

The hero section features an autonomous multi-agent simulation (`system-field`) operating in parallel with the site copy.

### 1. Emergent Murmuration (Boids Model)
110 individual autonomous entities navigate a two-dimensional vector space (`600 × 500`) according to three local steering forces:
- **Separation**: Steer away from crowded neighbors to avoid collisions.
- **Alignment**: Steer towards the average heading of local flock-mates.
- **Cohesion**: Steer towards the local center of mass, modulated by each agent's intrinsic sociability score.

### 2. Spectral Bordeaux Color Partitioning
The flock is split into three behavioral and chromatic sub-groups:
- `boid-0` (Majority flock, ~70%):
  - Dark: Luminous Rose-Slate (`#a8929e`)
  - Light: Warm Roasted Walnut (`#4d3935`)
- `boid-1` (Beacon / Scout agents, ~9%):
  - Dark: Radiant Crimson Beacon (`#f43f5e`)
  - Light: Bold Deep Bordeaux Ruby (`#98122d`)
- `boid-2` (Secondary cluster, ~21%):
  - Dark: Coral Rose Ember (`#fb7185`)
  - Light: Deep Crimson (`#b91c32`)

### 3. The Intermittent Visitor Agent
Every 28 simulation seconds, an external visitor agent enters the airspace along a sinusoidal trajectory.
- The visitor is rendered as an open chevron with an extended trailing wake in radiant bordeaux crimson (`palette[1]`).
- As it approaches flock members, it exerts an exponential avoidance impulse, scattering the flock before passing beyond the boundary.
- Once the visitor leaves, the flock slowly stabilizes and reorganizes through local self-organization.

### 4. Progressive Enhancement & Accessibility
- **Zero-JS Fallback**: At build time, `src/system-art.mjs` generates an inline SVG snapshot containing all 110 vector boids with their respective CSS color classes. The page is fully visually complete before any script runs.
- **Canvas Enhancement**: If JavaScript is active and supported, the HTML5 canvas takes over with smooth requestAnimationFrame rendering, multi-step substepping, and motion trails.
- **Pointer & Touch Interaction**: Hovering or tapping casts a repulsion pulse into the simulation field.
- **Respect for User Motion Preferences**: If `prefers-reduced-motion: reduce` is active, the simulation begins paused, and a dedicated "Play flock / Pause flock" control allows users to toggle animation on demand.

---

## 6. Component Guidelines

### Site Header & Brand Mark
- The brand mark features a lowercase serif `g` with an accent dot (`g.`) in `--accent`.
- Navigation items stay muted (`--muted`) until active (`aria-current="page"`), where they transition to bold `--ink`.
- The RSS feed link is separated by a subtle vertical border rule.

### Series Navigation (`.series-nav`)
- Utilizes semantic `<details>` and `<summary>` elements for progressive disclosure.
- Parts are listed using an ordered list with custom monospace counters (`SFMono-Regular`).
- Current reading location is explicitly announced with `You're here` in `--accent`.
- Unpublished parts are styled as `Coming soon` in `--muted`.

### Site Footer & Copyright
- Displays the brand title, site description, and configured copyright notice (`© {copyrightYear} {author}`) in `--muted` text.
- Keeps builds byte-deterministic by configuring `copyrightYear` explicitly in `site.config.json` rather than invoking runtime timestamps.
- Features a discrete RSS feed link aligned along the outer edge.

### Focus States & Keyboard Navigation
- All interactive controls (`<a>`, `<button>`, `<summary>`, `<input>`) provide a visible `2px solid var(--accent)` outline with `5px–6px` offset when focused via keyboard (`:focus-visible`).
- A skip-to-content link is the first tab stop on every page.

### Editorial Figures & Responsive Image Layouts (`.image-figure`)
- **Semantic Structure**: Block images are rendered as HTML5 `<figure class="image-figure ...">` containing `<img loading="lazy">` and optional `<figcaption>`.
- **Typographic Legends**: Legends originate from the CommonMark title string (`"..."`) and render in `13px var(--sans)` in `--muted`, ensuring they provide quiet editorial context without competing with body prose.
- **URL Fragment Mapping**:
  - `image-default`: Contained within the 730px prose column.
  - `image-float-left` (`#float-left`): Floats left at 44% width with 2rem right margin for wrapped prose; resets to stacked 100% on mobile (`<= 760px`).
  - `image-float-right` (`#float-right`): Floats right at 44% width with 2rem left margin for wrapped prose; resets to stacked 100% on mobile.
  - `image-wide` (`#wide`): Breaks out symmetrically to align with the 1184px site shell.
  - `image-bleed` (`#bleed` or `#full`): Spans `100vw` edge-to-edge across the viewport; its `<figcaption>` aligns with the 730px prose column.
  - `image-narrow` (`#narrow` or `#center`): Centers and caps width at 380px for UI dialogs and mobile mockups.
- **Modifiers**:
  - `image-frame` (`#frame` or `#border`): Adds `1px solid var(--line)` and `border-radius: 4px` for light/dark background contrast.
  - `image-invert-dark` (`#invert-dark`): Inverts line art in dark mode (`filter: invert(0.9) hue-rotate(180deg)`).
  - `image-pixelated` (`#pixelated`): Disables smoothing (`image-rendering: pixelated`) for crisp retro/pixel art.


# Markdown & Content Formatting: Analysis & Improvement Notes

## Overview & Context

This document captures reflections, typographic design choices, and planned improvements for Markdown authoring across the blog, specifically regarding:
1. Callouts, admonitions, and asides (`.callout`)
2. Essayistic voice vs. documentation manual antipatterns
3. Non-boxed inline glyphs for lightweight literary emphasis
4. Full prose typographic scale inheritance

---

## Architectural & Typographic Decisions

### 1. The Essay vs. The Appliance Manual
- **The Problem**: Standard Markdown documentation tools (Docusaurus, VitePress, GitHub) auto-inject all-caps badges like `IMPORTANT`, `NOTE`, or `WARNING`. In a reflective architectural essay, these bureaucratic banners shatter authorial tone, patronize the reader, and demote serious essays into software user manuals.
- **Decision**: 
  - Containers are **title-less by default** (`::: important` renders an aside with zero title bar).
  - Explicit **editorial micro-headlines** can be supplied when warranted (`::: warning Operational hazard: Cascading retry storms`).
  - GFM blockquote alerts support title suppression via `-` (`> [!NOTE -]`).

### 2. Strict Two-Tone Palette Discipline (No SaaS Rainbow)
- **The Problem**: Off-the-shelf Tailwind colors (emerald green, violet purple, amber orange) clash with Warm Alabaster (`#f8f3ec`) and Velvet Bordeaux Noir (`#0e0a0d`), creating a high-cardinality "traffic light" effect.
- **Decision**: 
  - Removed all hardcoded multi-hue overrides.
  - All callouts strictly map to the blog's two foundational semantic tokens:
    - **Informational tiers** (`note`, `info`, `tip`): `var(--muted)` (warm roasted coffee slate in light mode, misty rose-slate in dark mode).
    - **Critical & Actionable tiers** (`important`, `warning`, `caution`): `var(--accent)` (Bordeaux ruby in light mode, electric crimson in dark mode).
  - Visual differentiation between tiers is carried by typography, semantic SVG Octicons, and title text, not rainbow colors.

### 3. Full Prose Typographic Scale
- **The Problem**: Standard callouts often set `font-size: .95rem; line-height: 1.7;`, which dropped text from 19px down to ~15px. In long-form reading, this created an artificial "fine print / footnote" drop.
- **Decision**: Callout bodies directly inherit the full **19px Georgia prose scale and 1.85 line rhythm**, ensuring seamless optical continuum.

### 4. Extreme Editorial Restraint
- Callout boxes are devaluing when applied to narrative paragraphs or general reflections.
- They are reserved strictly for rare, high-consequence operational hazards, breaking version migrations, or external security boundaries.

---

## Planned Improvement: Paragraph Run-In Glyphs

As a lightweight alternative to boxed `<aside class="callout">` enclosures for long-form essays, introduce **Paragraph Run-In Glyphs**.

### Concept & Motivation
In fine book typography (Aldus Manutius, Edward Tufte, classical printers), authors avoided drawing heavy colored boxes around prose. Instead, they marked caveats or turns of argument with subtle, monochrome run-in marks (dingbats, pilcrows, or fleurons).

Run-in glyphs allow an author to provide a visual anchor for skimmers **without boxing off the paragraph or breaking reading flow**:
- No background fill (`--surface`).
- No border line (`border-left`).
- No vertical padding barriers.
- The paragraph remains 100% part of the continuous 19px Georgia column.

### Proposed Authoring Syntax
```markdown
::glyph warning *Safe and idempotent does not mean identical answers.* We are issuing a complete, new HTTP exchange to recover from a lost message at the application layer...
```
or inline attribute style:
```markdown
*Safe and idempotent does not mean identical answers.* We are issuing a complete, new HTTP exchange... {.glyph-warning}
```

### Compiled HTML Output
```html
<p class="glyph-lead glyph-warning">
  <span class="glyph-mark" aria-hidden="true">
    <svg viewBox="0 0 16 16" fill="currentColor">...</svg>
  </span>
  <em>Safe and idempotent does not mean identical answers.</em> We are issuing...
</p>
```

### CSS Styling
```css
.glyph-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: -0.15em;
  margin-right: 0.4em;
  width: 1em;
  height: 1em;
}
.glyph-mark svg {
  width: 0.9em;
  height: 0.9em;
}
.glyph-warning .glyph-mark,
.glyph-important .glyph-mark,
.glyph-caution .glyph-mark {
  color: var(--accent);
}
.glyph-note .glyph-mark,
.glyph-info .glyph-mark,
.glyph-tip .glyph-mark {
  color: var(--muted);
}
```

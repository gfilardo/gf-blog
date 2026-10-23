---
title: How this blog is built
slug: how-this-blog-is-built
date: "2026-10-23"
description: Architecture, deterministic builds, and design principles behind a handcrafted personal static site.
tags:
  - architecture
  - software
  - design
draft: false
---
Most personal websites eventually collapse under the weight of their own tooling. A framework updates, an ecosystem shifts, or a dynamic CMS accumulates database migrations and security patches for what is fundamentally a collection of static essays.

When I sat down to build this site, I wanted the opposite: an enduring, handcrafted system built from first principles that could run cleanly a decade from now without external intervention.

This article begins a short series called *This Blog*, dissecting the architecture, engineering decisions, and visual principles behind the site.

## The generator: small, fast, and deterministic

Rather than reaching for a bloated modern static site framework with thousands of transitive dependencies, the generator is a compact Node.js program. It has no build plugins, no complex hydration pipeline, and no runtime server.

The pipeline executes in five explicit stages:

1. **Schema validation**: Front matter for posts and pages is validated against strict JSON schemas using Ajv. Dates, routes, and tags are checked before any HTML is generated. Typos or duplicate URLs fail immediately with line-specific errors.
2. **Content loading**: Markdown files are parsed with `markdown-it` into structured document objects.
3. **Route planning & collision prevention**: A route manifest plans all output URLs (`/posts/<slug>/`, `/tags/<tag>/`, `/feed.xml`, `/sitemap.xml`). Collisions between static files and generated pages are detected in memory.
4. **Nunjucks rendering**: Explicit context objects are passed into templates with HTML auto-escaping. Only rendered Markdown is marked as safe HTML.
5. **Atomic staging**: Output is staged into a temporary sibling directory and swapped into `build/` only after every internal link, tag, and asset target has been verified. If any check fails, the previous build remains untouched.

Crucially, builds are **strictly deterministic**. Identical source files and dependencies produce byte-for-byte identical output. There are no timestamps injected from the system clock and no dynamic dates generated during compilation. Even the site's copyright year is explicitly configured so builds remain reproducible.

## Content and engine in unison

Software architects are trained to treat decoupling as an unassailable virtue. The standard instinct is to isolate the content from the presentation engine immediately—reaching for a headless CMS, managing an external API, or publishing the generator as an abstracted, versioned package.

For this blog, I chose the exact opposite: **the generator, the templates, the theme, and the content all live within the same repository as a single, unified project**.

This is very intentional. The templates and the visual theme are not external dependencies or interchangeable skins downloaded from a marketplace; they are integral parts of the site builder itself. In these early stages, I want the engine and its design system to evolve organically in direct response to the demands of the essays I write. When an article requires a new structural capability—whether that is a multi-part series navigation state machine, strict schema constraints on tags, or inline interactive simulations—the templates, styles, and build pipeline are extended alongside the prose in a single, atomic commit. There are no version mismatches, no artificial abstractions, and no coordination tax between authoring, styling, and building.

Decoupling is not free; doing so prematurely, before your long-term creative patterns have even formed, introduces unnecessary complexity. Co-locating content, theme, and code gives me an immediate, frictionless feedback loop while the publication takes shape.

Of course, this is a pragmatic architectural stance, not a permanent dogma. As my needs for content creation and distribution settle, I will gladly re-evaluate this boundary. But for now, keeping them together ensures the entire system remains a bespoke glove tailored to the writing, rather than a generic framework I have to fight against.

## Design principles: beyond generic cards and editorial sepia

Visually, many technical blogs gravitate toward two clichés:
- The **generic dashboard look**, where every post is trapped inside a rounded card with drop shadows and button chips ("box soup").
- The **dusty academic look**, characterized by beige newsprint backgrounds and muted terracotta accents.

This blog rejects both in favor of an architectural, high-contrast identity:

### 1. The Typographic Ledger
Instead of boxing articles into cards that fragment the reader's vertical eye scanning, articles are laid out as an open typographic ledger. Clean horizontal hairlines separate chronological entries, aligning dates, topic badges, and titles in a tabular rhythm. Boxes are reserved strictly for technical boundaries: code blocks, tables, and collapsible series navigation.

### 2. Warm Alabaster and Bordeaux Noir
The palette is tuned for focus and atmosphere:
- **Light Theme**: A warm natural wove alabaster (`#f8f3ec`) paired with deep espresso-wine ink (`#171210`) and an authoritative Bordeaux ruby accent (`#98122d`). It avoids both the clinical chill of pure blue-white and the murkiness of yellowed paper.
- **Dark Theme**: A deep velvet obsidian noir (`#0e0a0d`) illuminated by starlight rose text and electric crimson accents (`#f43f5e`).
- **Text Selection**: A bold, luxurious Bordeaux velvet ribbon with crisp white lettering, replacing generic pastel highlights.

## Living systems: autonomous agent art

On the home page, instead of a static stock hero image, the site features the **System Field**—an autonomous multi-agent simulation operating alongside the introduction.

The field runs a classic flocking simulation (Craig Reynolds' boids model) driven by three simple local steering forces: separation, alignment, and cohesion. Periodically, an external visitor agent sweeps across the field along a sinusoidal curve, scattering the flock before allowing it to reorganize through decentralized emergence.

Following the principle of progressive enhancement:
- At build time, an inline SVG snapshot of all 110 vector boids is rendered directly into the HTML. The page is visually complete and compelling before any client script executes.
- If JavaScript is enabled, an HTML5 canvas takes over smoothly, adding motion trails, touch and cursor repulsion, and pause controls that respect `prefers-reduced-motion`.

## What comes next

A personal website is never truly finished, but starting with a solid foundation makes evolution effortless. In the next parts of this series, we will dive deeper into the multi-agent mathematics of the flock, the series navigation state machine, and how tag archives are resolved deterministically.

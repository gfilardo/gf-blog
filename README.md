# Giovanni's blog

A small static blog built with Node.js. Articles are written in Markdown and
transformed into complete HTML pages during a build. An existing Node.js template engine
controls presentation. The generated `build/` directory is the deployable site,
with GitHub Pages as the intended host.

This README documents the implemented generator, its functional requirements,
and architecture.

## Getting started

Use Node.js 24 (`nvm use` if you use nvm), then run:

```sh
npm ci
npm test
npm run build
npm run preview
```

Open <http://localhost:8000>. Edit Markdown in `content/posts/` or
`content/pages/` and rebuild to see changes. `build/` is disposable output.
The included article and About page are starter content to replace.

Before publishing, set `origin` in `site.config.json` to your production origin
(currently `https://giovannifilardo.com`). Set `basePath` to your
repository path, such as `/my-blog`, or leave it empty for a domain-root site.
You can override these for a build using `SITE_ORIGIN` and `SITE_BASE_PATH`;
use the same `SITE_BASE_PATH` when previewing an overridden build.
`PORT` changes the preview port (default 8000).

To add a page, create a Markdown file with the metadata below. Add its logical
URL to `navigation` in `site.config.json` only if it should appear in the menu;
menu order follows the configuration. Articles automatically appear on the home
page and in their tag archives. Changing a title or filename preserves the URL
because the explicit slug controls the permalink. Keep published slugs stable;
redirect generation is not implemented.

For GitHub Pages, commit the source and lockfile, update the production settings,
and select **GitHub Actions** as the repository's Pages publishing source.
The included workflow validates pushes and pull requests and deploys successful
default-branch builds. No site has been published by this implementation.
For a custom domain, configure that domain and its DNS in GitHub Pages settings;
the `origin` setting controls generated URLs and does not configure hosting.

## Scope

The project uses Markdown posts and standalone pages, shared templates, copied
static assets, metadata, and a disposable output directory. All build and
development tooling runs on Node.js, with no Python dependency.

Rendering uses explicit template files and an existing Node.js template engine.
Articles have explicit metadata rather than dates embedded in filenames, and
generated pages use directory-based URLs. Analytics, external services, games,
image processing, and article-specific integrations are outside the initial scope.

The initial scope is a single-author blog: an article index, article pages,
standalone pages such as About, tag listings, an RSS feed, a sitemap, and a 404 page. Comments,
accounts, a CMS, server-side rendering, search, pagination, and live reload
are outside the initial scope. Readers need no JavaScript to read or navigate it.

## Functional requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-01 | Author articles and standalone pages in Markdown with YAML front matter. | A valid source file produces an HTML page with its title and rendered body; headings, links, lists, images, fenced code, and tables work. |
| FR-02 | Validate content before publication. | Missing required fields, invalid calendar dates, unknown metadata keys, invalid slugs, and duplicate routes stop the build with source-specific diagnostics. |
| FR-03 | Exclude drafts from publication. | Content marked `draft: true` appears in no generated page, index, feed, or sitemap. Future dates alone do not hide content. |
| FR-04 | Render shared layouts using an existing Node.js template engine. | Templates can interpolate escaped values, insert explicitly trusted HTML, branch on values, and iterate over collections; invalid syntax and missing required output values fail the build. |
| FR-05 | Generate a home page listing published articles newest first. | Each entry links to its article and shows title, publication date, and description. Equal dates sort by slug; zero articles produces a useful empty state. |
| FR-06 | Publish predictable URLs and navigation. | Articles use `/posts/<slug>/`, standalone pages use `/<slug>/`, and shared navigation links to the index and configured pages. |
| FR-07 | Include static files. | Contents of `static/` are copied unchanged into `build/`, preserving paths; local links and images resolve from both nested pages and the home page. Collisions with generated files fail the build. |
| FR-08 | Emit basic discovery metadata. | Pages contain a title, description, language, and canonical URL; published articles appear in valid RSS and sitemap XML. |
| FR-09 | Provide a repeatable local build and preview. | `npm run build` creates a complete `build/`; `npm run preview` serves it locally with directory URLs and a 404 fallback. Installed dependencies suffice for an offline build. |
| FR-10 | Support GitHub Pages deployment. | The same build supports a site at the domain root or under a repository path; the generated artifact contains `index.html`, `404.html`, and `.nojekyll`. |
| FR-11 | Fail safely and remove stale output on successful rebuilds. | Validation or rendering failure leaves the previous `build/` intact; success replaces it completely, removing pages for deleted or newly drafted articles. |
| FR-12 | Produce readable, accessible static pages. | Layouts use semantic landmarks, one page-level heading, a skip link, visible keyboard focus, and responsive styling; navigation and article content work with JavaScript disabled. |
| FR-13 | Group articles by optional tags. | `/tags/` lists published article tags; `/tags/<tag>/` lists matching articles newest first. Changing tags does not change article URLs. |

## Source and output layout

Source layout (media paths illustrate where to add your own files):

```text
content/
  posts/hello-world.md
  pages/about.md
templates/
  layout.html
  post.html
  page.html
  index.html
  404.html
  tags.html
schemas/
  post.schema.json
  page.schema.json
static/
  assets/
    posts/
      hello-world/
        photo.jpg
    pages/
      about/
        portrait.jpg
  css/
    style.css
  js/
  favicon.ico
  robots.txt
site.config.json
src/
  build.mjs
  content.mjs
  template.mjs
  urls.mjs
  render.mjs
  output.mjs
  preview.mjs
test/
package.json
package-lock.json
build/                    # Generated; ignored by version control
```

`static/` contains files copied unchanged into the output root. `static/assets/`
is reserved for media and downloads belonging to individual articles and pages,
organized by content kind and slug. For example, an article image at
`static/assets/posts/hello-world/photo.jpg` becomes
`build/assets/posts/hello-world/photo.jpg`. Site-wide styles, scripts, and fonts
live separately in `static/css/`, `static/js/`, and `static/fonts/` as needed.
Root-level files such as `static/favicon.ico` and
`static/robots.txt` become `build/favicon.ico` and `build/robots.txt`.
Copied files must not overwrite generated output; the route manifest checks both.
`.gitkeep` placeholders are ignored, and symbolic links are rejected.

Only Markdown files directly inside the two content directories are supported.
The required `slug` metadata controls the URL independently of the filename:
`hello-world` produces `/posts/hello-world/` for an article and `/hello-world/`
for a standalone page. Slugs must match `[a-z0-9]+(?:-[a-z0-9]+)*`.
Moving publication dates or renaming source files does not change article URLs.

Example article:

```markdown
---
title: Hello world
slug: hello-world
date: "2026-10-17"
description: Why I am starting this blog.
tags:
  - blogging
  - software
draft: false
---
My first article, written in **Markdown**.

## A first section

More text goes here.
```

`title`, `slug`, and `description` are required nonempty strings for all documents; `date`
is additionally required for articles. Dates use `YYYY-MM-DD` and are treated as
calendar dates in UTC. Optional `updated` must not precede `date`; optional
`draft` is a boolean, defaulting to false. Pages may omit dates. Unknown keys
are rejected to catch spelling errors. The template supplies the title as the
single `<h1>`; authored headings start at `##`. Raw HTML in Markdown is disabled.

Metadata is validated using the JSON schemas in `schemas/` with Ajv and
`ajv-formats`. Optional `tags` is a list of unique lowercase hyphenated names,
defaulting to an empty list. Published articles create `/tags/<tag>/` archives
and a `/tags/` index. Tags on standalone pages are accepted but do not create
article archives. Drafts contribute no pages or tag entries. Runtime defaults
are applied explicitly after schema validation.

## Architecture and requirement coverage

Use Node.js with ECMAScript modules and built-in filesystem, path, HTTP, and test
APIs. Node 24 is pinned in `.nvmrc` and CI; dependencies are locked in the npm lockfile. Use `markdown-it` for Markdown rendering
and `yaml` for front matter, with JSON Schema validation through Ajv. Use Nunjucks for templates rather than implementing a template language. These
are build dependencies; `template.mjs` only configures and wraps the engine. There is
no framework, application server, database, or browser runtime dependency.

### Build pipeline

1. **Read configuration.** Validate `site.config.json`: site title, author,
   description, language, production `origin`, `basePath`, and navigation.
   `origin` is an HTTPS origin without a path; `basePath` is empty or a leading
   slash path without a trailing slash, such as `/my-blog`.
2. **Load content once (FR-01–03).** Parse metadata and Markdown into document
   objects containing source path, kind, slug, title, description, dates, draft
   status, logical URL, and rendered body. Validate all sources, including drafts,
   then filter drafts out of the publication collection.
3. **Plan outputs (FR-05–08).** Sort articles and construct a route manifest for
   the home page, documents, 404 page, assets, feed, sitemap, and `.nojekyll`.
   Reject collisions, including reserved page slugs such as `posts` and `assets`.
   Check configured navigation targets against the published route manifest.
4. **Render (FR-04, FR-08, FR-12–13).** Render content templates with
   explicit context objects and shared layout inheritance. Mark only rendered
   Markdown as trusted HTML. Generate RSS and sitemap using separate XML escaping,
   and collect generated output and static files in memory.
5. **Verify and publish output (FR-07, FR-09–11).** Check generated local link and
   asset targets against the manifest, ignoring external URLs and fragment-only
   references. After all checks pass, write a temporary sibling directory and
   replace `build/` with the staged output.
   Use a backup-and-rename sequence with rollback on replacement failure, then
   clean temporary directories. Log generated page counts and failures; failures
   return a nonzero process exit code.

`content.mjs` owns parsing and validation; `template.mjs` configures Nunjucks and passes rendering contexts; `urls.mjs` owns route and deployment URL rules; `render.mjs` owns
page contexts and XML rendering; `output.mjs` owns staging, asset copying, and
replacement. `build.mjs` orchestrates these modules. Keep content loading and build logic in JavaScript; templates receive explicit
data contexts and use shared layouts. Overlapping builds are rejected with a build
lock. The rollback sequence protects normal failures; it is not a guarantee of
atomic replacement across a machine crash.

Build order is stable. Identical sources, configuration, and locked dependencies
produce byte-identical output: dates come from content, ordering is explicit, and
no generated timestamp or current year is injected. Builds perform no network
requests after dependency installation.

### Template engine (FR-04)

Use [Nunjucks](https://mozilla.github.io/nunjucks/) for shared layouts, includes,
interpolation, conditionals, and loops. Adopt its existing syntax without defining
or maintaining a custom language, tokenizer, parser, or evaluator.

Configure a filesystem loader rooted at `templates/`, enable HTML autoescaping,
and enable errors for undefined output values. Validate required context fields
before rendering and report template errors as build failures. See the
[Nunjucks API documentation](https://mozilla.github.io/nunjucks/api.html) for
configuration behavior.

Mark only generator-rendered Markdown and rendered content fragments as safe
HTML; metadata remains escaped. URL preparation stays in `urls.mjs`, and RSS
and sitemap output use separate XML escaping. Templates are trusted repository
files, with no user-submitted template execution.

### URLs, assets, and GitHub Pages (FR-06–10)

Keep logical routes independent from deployment. For example, the logical route
`/posts/hello-world/` becomes `/my-blog/posts/hello-world/` when
`basePath` is `/my-blog`; its file remains
`build/posts/hello-world/index.html`. `urls.mjs` applies the prefix exactly once
and creates absolute canonical, RSS, and sitemap URLs using `origin`.

In Markdown and configuration, site-local links start with `/` and use logical
routes: `/about/`, `/posts/hello-world/`, and `/assets/posts/hello-world/photo.jpg`.
The Markdown renderer rewrites local link and image URLs through the same URL
helper. Relative file links such as `../about.md` are rejected initially to avoid
source/output ambiguity. External URLs and fragments retain their meaning.
Templates consume prepared URLs from their contexts.

Only article tags generate archives; each archive uses the same ordering as the home page.

RSS lives at `/feed.xml`; the sitemap at `/sitemap.xml`. Both include published
content only and use escaped absolute URLs. RSS article dates use UTC midnight;
sitemap modification dates use `updated`, falling back to `date` when present.
The root `404.html` uses deployment-aware links and asks crawlers not to index it.

The GitHub Actions workflow installs locked dependencies with `npm ci`,
runs tests and the build, then uploads **only `build/`** as the Pages artifact.
Pull requests validate without deploying; a successful build on the chosen
default branch deploys through the GitHub Pages environment. Grant deployment
permissions only to the deployment job and serialize deployments. Repository
Pages settings must select GitHub Actions before the first deployment. The workflow
follows the [GitHub Pages custom workflow model](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### Development and verification (FR-09, FR-11–12)

Commands:

```sh
npm ci
npm test
npm run build
npm run preview
```

Preview serves the existing `build/` on localhost, honoring `basePath`, directory
index files, MIME types, and the generated 404 page with a 404 status. It rejects
path traversal and does not expose source files. Rebuild manually after editing.

The checks use Node's test runner for template integration, escaping, and shared layouts, content validation,
draft exclusion, stable ordering, route collisions, and URL prefix handling.
Integration fixtures check full root and repository-path builds, XML
validity, missing assets, removal of stale pages, identical repeated output, and
preservation of the last successful build after failure. A local browser review
checks phone-width layout, keyboard focus, headings, and reading/navigation with
JavaScript disabled. Automated checks run with `npm test`. Browser review complements these checks.

If a process is forcibly terminated, remove `.build.lock` only after confirming no
build is running. Abandoned `.build-stage-*` directories can then be removed; if
a crash occurred during replacement, recover the previous output from a
`.build-backup-*` directory or rebuild.

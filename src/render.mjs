import path from 'node:path';
import { tagLabel, tagSlug, validateTags } from './tags.mjs';
import { indexSeries } from './series.mjs';
import { systemArt } from './system-art.mjs';
import { generateArticleMotif, resolveMotifParameters, ALGORITHMS } from './motif.mjs';
import { urls } from './urls.mjs';
import { templates } from './template.mjs';
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function render(root, site, documents) {
  const env = templates(path.join(root, 'templates'));
  env.addFilter('tagLabel', tagLabel);
  const { local, absolute } = urls(site);
  validateTags(documents);
  const artwork = systemArt();
  const files = new Map();
  const add = (file, contents) => {
    if (files.has(file)) throw new Error(`Duplicate output: ${file}`);
    files.set(file, contents);
  };
  // Check duplicate slugs even for drafts, so publishing cannot silently change routes.
  const routes = new Set();
  for (const doc of documents) {
    if (routes.has(doc.route)) throw new Error(`${doc.source}: duplicate route ${doc.route}`);
    routes.add(doc.route);
    if (doc.kind === 'page' && ['posts', 'tags', 'assets', 'css', 'js', 'fonts', 'preview', 'motifs'].includes(doc.slug)) throw new Error(`${doc.source}: reserved page slug ${doc.slug}`);
  }
  const seriesByRoute = indexSeries(documents);
  const previewDocuments = documents.map(d => d.kind === 'post' && (d.draft || d.unlisted)
    ? { ...d, route: `/preview/${d.slug}/`, url: local(`/preview/${d.slug}/`) } : d);
  const previewSeriesByRoute = indexSeries(previewDocuments, true);
  const draftPosts = previewDocuments.filter(d => d.kind === 'post' && (d.draft || d.unlisted))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const published = documents.filter(d => !d.draft && !d.unlisted);
  const posts = published.filter(d => d.kind === 'post').sort((a, b) => a.date === b.date ? (a.slug < b.slug ? -1 : 1) : (a.date > b.date ? -1 : 1));
  const tags = [...new Set(posts.flatMap(d => d.tags))].sort().map(name => ({ name: tagLabel(name), slug: tagSlug(name), url: local(`/tags/${tagSlug(name)}/`), posts: posts.filter(d => d.tags.includes(name)) }));
  const toMotifItem = post => {
    const meta = resolveMotifParameters(post);
    return {
      ...post,
      motifMeta: {
        algorithmId: meta.algorithm.id,
        seed: meta.seed,
        seedHex: '0x' + meta.seed.toString(16).toUpperCase(),
        epoch: meta.algorithm.since,
        isOverride: Boolean(post.motif || post.series?.motif),
        overrideSource: post.motif ? 'article' : (post.series?.motif ? 'series' : null)
      },
      heroMotif: generateArticleMotif(post, { form: 'hero', width: 360, height: 80 }),
      markMotif: generateArticleMotif(post, { form: 'mark', width: 120, height: 120 })
    };
  };
  const allMotifPosts = [
    ...posts,
    ...draftPosts
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.slug.localeCompare(b.slug));
  const motifItems = allMotifPosts.map(toMotifItem);
  const pages = [
    { route: '/', title: site.title, description: site.description, template: 'index.html', posts },
    { route: '/preview/', title: 'Draft previews', description: 'Work in progress. Anyone with a direct link can read these drafts.', template: 'index.html', posts: draftPosts, preview: true, noindex: true },
    ...draftPosts.map(d => ({ ...d, template: 'post.html', preview: true, noindex: true })),
    ...published.map(d => ({ ...d, template: d.kind === 'post' ? 'post.html' : 'page.html', noindex: Boolean(d.noindex) })),
    { route: '/tags/', title: 'Tags', description: 'Browse articles by topic.', template: 'tags.html', tags },
    ...tags.map(tag => ({ route: `/tags/${tag.slug}/`, title: tag.name, description: `Articles tagged ${tag.name}.`, template: 'index.html', posts: tag.posts })),
    { route: '/motifs/', title: 'Article Motifs', description: 'Deterministic geometric identifiers generated for each article.', template: 'motifs.html', motifs: motifItems, algorithms: ALGORITHMS },
    { route: '/404.html', title: 'Page not found', description: 'This page could not be found.', template: '404.html', noindex: true }
  ];
  const available = new Set(pages.filter(p => !p.preview).map(p => p.route));
  const navigation = site.navigation.map(n => {
    if (!available.has(n.path)) throw new Error(`Navigation target does not exist: ${n.path}`);
    return { ...n, url: local(n.path) };
  });
  for (const page of pages) {
    const motifSvg = page.kind === 'post' ? generateArticleMotif(page) : null;
    const context = { site, artwork, navigation, home: local('/'), favicon: local('/favicon.svg'), stylesheet: local('/css/style.css'), diagramViewer: page.body?.includes('mermaid-diagram') ? local('/js/diagram-viewer.js') : null, feed: local('/feed.xml'), page: { motifSvg, motifs: page.motifs ?? [], draftMotifs: page.draftMotifs ?? [], algorithms: page.algorithms ?? ALGORITHMS, seriesNav: (page.preview ? previewSeriesByRoute : seriesByRoute).get(page.route) ?? null, previewIndex: local('/preview/'), preview: false, companion: null, date: null, updated: null, body: '', tags: [], noindex: false, ...page, canonical: absolute(page.route), tagLinks: (page.tags && page.kind ? page.tags : []).map(name => ({ name: tagLabel(name), url: local(`/tags/${tagSlug(name)}/`) })) } };
    // Standalone page tags are accepted as metadata; only articles join tag archives.
    if (page.kind === 'page' || page.preview) context.page.tagLinks = [];
    if (page.posts) {
      const seriesIndex = page.preview ? previewSeriesByRoute : seriesByRoute;
      context.page.posts = page.posts.map(post => ({
        ...post,
        motifMark: generateArticleMotif(post, { form: 'mark', width: 120, height: 120 }),
        seriesNav: seriesIndex.get(post.route) ?? null
      }));
    }
    add(page.route.endsWith('/') ? `${page.route.slice(1)}index.html` : page.route.slice(1), env.render(page.template, context));
  }
  add('.nojekyll', '');
  add('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xml(site.title)}</title><link>${xml(absolute('/'))}</link><description>${xml(site.description)}</description>${posts.map(p => `<item><title>${xml(p.title)}</title><link>${xml(absolute(p.route))}</link><guid isPermaLink="true">${xml(absolute(p.route))}</guid><pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate><description>${xml(p.description)}</description>${p.tags.map(t => `<category>${xml(tagLabel(t))}</category>`).join('')}</item>`).join('')}</channel></rss>\n`);
  add('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.filter(p => !p.noindex).map(p => `<url><loc>${xml(absolute(p.route))}</loc>${p.updated || p.date ? `<lastmod>${xml(p.updated || p.date)}</lastmod>` : ''}</url>`).join('')}</urlset>\n`);
  return files;
}

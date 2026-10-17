import path from 'node:path';
import { urls } from './urls.mjs';
import { templates } from './template.mjs';
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function render(root, site, documents) {
  const env = templates(path.join(root, 'templates'));
  const { local, absolute } = urls(site);
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
    if (doc.kind === 'page' && ['posts', 'tags', 'assets', 'css', 'js', 'fonts'].includes(doc.slug)) throw new Error(`${doc.source}: reserved page slug ${doc.slug}`);
  }
  const published = documents.filter(d => !d.draft);
  const posts = published.filter(d => d.kind === 'post').sort((a, b) => a.date === b.date ? (a.slug < b.slug ? -1 : 1) : (a.date > b.date ? -1 : 1));
  const tags = [...new Set(posts.flatMap(d => d.tags))].sort().map(name => ({ name, url: local(`/tags/${name}/`), posts: posts.filter(d => d.tags.includes(name)) }));
  const pages = [
    { route: '/', title: site.title, description: site.description, template: 'index.html', posts },
    ...published.map(d => ({ ...d, template: d.kind === 'post' ? 'post.html' : 'page.html' })),
    { route: '/tags/', title: 'Tags', description: 'Browse articles by topic.', template: 'tags.html', tags },
    ...tags.map(tag => ({ route: `/tags/${tag.name}/`, title: tag.name, description: `Articles tagged ${tag.name}.`, template: 'index.html', posts: tag.posts })),
    { route: '/404.html', title: 'Page not found', description: 'This page could not be found.', template: '404.html', noindex: true }
  ];
  const available = new Set(pages.map(p => p.route));
  const navigation = site.navigation.map(n => {
    if (!available.has(n.path)) throw new Error(`Navigation target does not exist: ${n.path}`);
    return { ...n, url: local(n.path) };
  });
  for (const page of pages) {
    const context = { site, navigation, home: local('/'), stylesheet: local('/css/style.css'), feed: local('/feed.xml'), page: { date: null, updated: null, body: '', tags: [], noindex: false, ...page, canonical: absolute(page.route), tagLinks: (page.tags && page.kind ? page.tags : []).map(name => ({ name, url: local(`/tags/${name}/`) })) } };
    // Standalone page tags are accepted as metadata; only articles join tag archives.
    if (page.kind === 'page') context.page.tagLinks = [];
    add(page.route.endsWith('/') ? `${page.route.slice(1)}index.html` : page.route.slice(1), env.render(page.template, context));
  }
  add('.nojekyll', '');
  add('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xml(site.title)}</title><link>${xml(absolute('/'))}</link><description>${xml(site.description)}</description>${posts.map(p => `<item><title>${xml(p.title)}</title><link>${xml(absolute(p.route))}</link><guid isPermaLink="true">${xml(absolute(p.route))}</guid><pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate><description>${xml(p.description)}</description>${p.tags.map(t => `<category>${xml(t)}</category>`).join('')}</item>`).join('')}</channel></rss>\n`);
  add('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.filter(p => !p.noindex).map(p => `<url><loc>${xml(absolute(p.route))}</loc>${p.updated || p.date ? `<lastmod>${xml(p.updated || p.date)}</lastmod>` : ''}</url>`).join('')}</urlset>\n`);
  return files;
}

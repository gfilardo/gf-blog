export function validateConfig(site) {
  const fields = ['title', 'author', 'description', 'language', 'origin', 'basePath', 'navigation'];
  if (!site || typeof site !== 'object' || Object.keys(site).some(k => !fields.includes(k))) throw new Error('Invalid configuration fields');
  for (const key of fields.filter(k => !['basePath', 'navigation'].includes(k))) {
    if (typeof site[key] !== 'string' || !site[key].trim()) throw new Error(`Invalid configuration: ${key}`);
  }
  const origin = new URL(site.origin);
  if (origin.protocol !== 'https:' || origin.origin !== site.origin) throw new Error('origin must be an HTTPS origin without a path');
  if (typeof site.basePath !== 'string' || !/^(?:\/[a-zA-Z0-9_-]+)*$/.test(site.basePath)) throw new Error('Invalid basePath');
  if (!Array.isArray(site.navigation)) throw new Error('navigation must be an array');
  for (const item of site.navigation) {
    if (!item || typeof item.title !== 'string' || !item.title.trim() || typeof item.path !== 'string' || !/^\/(?:[a-z0-9-]+\/)*$/.test(item.path)) throw new Error('Invalid navigation entry');
  }
  return site;
}
export function urls(site) {
  const local = route => `${site.basePath}${route}`;
  const absolute = route => `${site.origin}${local(route)}`;
  return { local, absolute };
}
export function contentUrl(value, site) {
  if (value.startsWith('#') || /^(?:https?:|mailto:|tel:)/i.test(value)) return value;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) throw new Error(`Use a logical root-relative URL: ${value}`);
  const parsed = new URL(value, site.origin);
  if (parsed.pathname !== value.split(/[?#]/)[0]) throw new Error(`Non-canonical local URL: ${value}`);
  return urls(site).local(value);
}

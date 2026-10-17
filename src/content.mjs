import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import MarkdownIt from 'markdown-it';
import { contentUrl, urls } from './urls.mjs';
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validators = {};
for (const kind of ['post', 'page']) {
  validators[kind] = ajv.compile(JSON.parse(await readFile(fileURLToPath(new URL(`../schemas/${kind}.schema.json`, import.meta.url)), 'utf8')));
}
export function parseContent(source, raw, kind, site) {
  try {
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(raw);
    if (!match) throw new Error('Expected YAML front matter between --- lines');
    const data = YAML.parse(match[1], { uniqueKeys: true, maxAliasCount: 0 });
    if (!validators[kind](data)) throw new Error(ajv.errorsText(validators[kind].errors, { separator: '; ' }));
    if (data.updated && (!data.date || data.updated < data.date)) throw new Error('updated requires date and must not precede it');
    const md = new MarkdownIt({ html: false });
    const tokens = md.parse(match[2], {});
    const visit = list => {
      for (const token of list) {
        if (token.type === 'heading_open' && token.tag === 'h1') throw new Error('Use ## or deeper headings; the template supplies the title');
        if (token.type === 'link_open' || token.type === 'image') {
          const attr = token.type === 'image' ? 'src' : 'href';
          token.attrSet(attr, contentUrl(token.attrGet(attr), site));
          if (token.type === 'image') token.attrSet('loading', 'lazy');
        }
        if (token.children) visit(token.children);
      }
    };
    visit(tokens);
    const route = kind === 'post' ? `/posts/${data.slug}/` : `/${data.slug}/`;
    return { date: null, updated: null, draft: false, tags: [], ...data, source, kind, route, url: urls(site).local(route), body: md.renderer.render(tokens, md.options, {}) };
  } catch (error) {
    throw new Error(`${source}: ${error.message}`, { cause: error });
  }
}
export async function loadContent(root, site) {
  const docs = [];
  for (const kind of ['post', 'page']) {
    const dir = path.join(root, 'content', `${kind}s`);
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (entry.isSymbolicLink() || entry.isDirectory()) throw new Error(`${dir}/${entry.name}: only direct Markdown files are supported`);
      if (!entry.name.endsWith('.md')) continue;
      const source = path.join(dir, entry.name);
      docs.push(parseContent(source, await readFile(source, 'utf8'), kind, site));
    }
  }
  return docs;
}

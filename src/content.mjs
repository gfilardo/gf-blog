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
const HINT_MAP = {
  'float-left': 'image-float-left',
  'float-right': 'image-float-right',
  'wide': 'image-wide',
  'bleed': 'image-bleed',
  'full': 'image-bleed',
  'narrow': 'image-narrow',
  'center': 'image-narrow',
  'frame': 'image-frame',
  'border': 'image-frame',
  'invert-dark': 'image-invert-dark',
  'pixelated': 'image-pixelated'
};
const PRIMARY_LAYOUTS = new Set(['float-left', 'float-right', 'wide', 'bleed', 'full', 'narrow', 'center']);

function parseImageHints(rawSrc) {
  const hashIdx = rawSrc.indexOf('#');
  if (hashIdx === -1) return { cleanSrc: rawSrc, hints: [] };
  const cleanSrc = rawSrc.slice(0, hashIdx);
  const fragment = rawSrc.slice(hashIdx + 1);
  if (!fragment) return { cleanSrc, hints: [] };
  const rawHints = fragment.split('+').map(h => h.trim()).filter(Boolean);
  const validatedHints = [];
  let primaryCount = 0;
  for (const h of rawHints) {
    if (!HINT_MAP[h]) {
      throw new Error(`Unknown image layout hint: "${h}". Supported hints: float-left, float-right, wide, bleed (or full), narrow (or center), frame (or border), invert-dark, pixelated`);
    }
    if (PRIMARY_LAYOUTS.has(h)) primaryCount++;
    if (primaryCount > 1) {
      throw new Error(`Conflicting image layout hints in "${rawSrc}": choose at most one primary layout (float-left, float-right, wide, bleed, narrow)`);
    }
    validatedHints.push(h);
  }
  return { cleanSrc, hints: validatedHints };
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

    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type !== 'paragraph_open') continue;
      const inline = tokens[i + 1];
      const pClose = tokens[i + 2];
      if (inline.type !== 'inline' || pClose.type !== 'paragraph_close') continue;

      const meaningful = inline.children.filter(c => c.type !== 'text' || c.content.trim() !== '');
      let imgToken = null;
      if (meaningful.length === 1 && meaningful[0].type === 'image') {
        imgToken = meaningful[0];
      } else if (
        meaningful.length === 3 &&
        meaningful[0].type === 'link_open' &&
        meaningful[1].type === 'image' &&
        meaningful[2].type === 'link_close'
      ) {
        imgToken = meaningful[1];
      }
      if (!imgToken) continue;

      const rawSrc = imgToken.attrGet('src') || '';
      const { cleanSrc, hints } = parseImageHints(rawSrc);
      imgToken.attrSet('src', cleanSrc);

      const classes = ['image-figure'];
      const mapped = hints.map(h => HINT_MAP[h]);
      if (!mapped.some(c => c.startsWith('image-float-') || c === 'image-wide' || c === 'image-bleed' || c === 'image-narrow')) {
        classes.push('image-default');
      }
      classes.push(...mapped);

      tokens[i].tag = 'figure';
      tokens[i].attrs = [['class', [...new Set(classes)].join(' ')]];
      pClose.tag = 'figure';

      const title = imgToken.attrGet('title');
      if (title) {
        imgToken.attrs = imgToken.attrs.filter(([k]) => k !== 'title');
        const figOpen = new inline.constructor('figcaption_open', 'figcaption', 1);
        const captionTokens = md.parseInline(title, {})[0]?.children || [];
        const figClose = new inline.constructor('figcaption_close', 'figcaption', -1);
        inline.children.push(figOpen, ...captionTokens, figClose);
      }
    }

    const visit = list => {
      for (const token of list) {
        if (token.type === 'heading_open' && token.tag === 'h1') throw new Error('Use ## or deeper headings; the template supplies the title');
        if (token.type === 'image') {
          const rawSrc = token.attrGet('src') || '';
          const { cleanSrc, hints } = parseImageHints(rawSrc);
          for (const h of hints) {
            if (PRIMARY_LAYOUTS.has(h)) {
              throw new Error(`Image with layout hint "${h}" cannot be inline with text; place it on its own line separated by blank lines`);
            }
          }
          token.attrSet('src', contentUrl(cleanSrc, site));
          token.attrSet('loading', 'lazy');
          if (hints.length > 0) {
            const existing = token.attrGet('class') || '';
            const newClasses = hints.map(h => HINT_MAP[h]);
            token.attrSet('class', (existing ? existing + ' ' : '') + newClasses.join(' '));
          }
        } else if (token.type === 'link_open') {
          token.attrSet('href', contentUrl(token.attrGet('href'), site));
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

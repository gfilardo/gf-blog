import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir, unlink, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from '../src/build.mjs';
import { parseContent } from '../src/content.mjs';
import { preview } from '../src/preview.mjs';
import { verify } from '../src/output.mjs';
import { templates } from '../src/template.mjs';
import { XMLValidator, XMLParser } from 'fast-xml-parser';
const root = path.resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const article = (extra = '', body = 'Some **text**.') => `---\ntitle: Example\nslug: example\ndate: "2026-10-17"\ndescription: Example article\n${extra}\n---\n${body}`;
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'blog-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ['content', 'static', 'templates', 'site.config.json']) await cp(path.join(root, name), path.join(dir, name), { recursive: true });
  await writeFile(path.join(dir, 'site.config.json'), JSON.stringify({ ...config, origin: 'https://example.com' }));
  return dir;
}
test('metadata schemas and source diagnostics', () => {
  for (const extra of ['date: "2026-02-30"', 'titel: typo', 'tags: [one, one]', 'draft: yes', 'slug: ../bad', 'updated: "2020-01-01"']) {
    assert.throws(() => parseContent('article.md', article(extra), 'post', config), /article.md:/);
  }
  assert.throws(() => parseContent('article.md', article().replace('2026-10-17', '2026-02-30'), 'post', config), /date/);
  assert.throws(() => parseContent('article.md', article('', '# Heading'), 'post', config), /##/);
  assert.throws(() => parseContent('article.md', article('', '[relative](other.md)'), 'post', config), /root-relative/);
  const parsed = parseContent('arbitrary-filename.md', article('tags: [node]'), 'post', config);
  assert.equal(parsed.route, '/posts/example/');
  assert.match(parsed.body, /<strong>text<\/strong>/);
});
test('template escaping, inheritance, and errors', () => {
  const env = templates(path.join(root, 'templates'));
  assert.equal(env.renderString('{{ title }}', { title: '<script>"&' }), '&lt;script&gt;&quot;&amp;');
  assert.throws(() => env.renderString('{{ missing }}', {}));
  assert.throws(() => env.renderString('{% if x %}', {}));
});
test('complete build, deterministic output, tags, stable permalinks and base paths', async t => {
  const dir = await fixture(t);
  const first = await build(dir);
  for (const name of ['feed.xml', 'sitemap.xml']) assert.equal(XMLValidator.validate(first.get(name)), true);
  const rss = new XMLParser().parse(first.get('feed.xml'));
  assert.equal(rss.rss.channel.title, config.title);
  const second = await build(dir);
  assert.deepEqual(first, second);
  assert.ok(first.has('tags/software/index.html'));
  assert.ok(first.has('404.html'));
  assert.ok(first.has('.nojekyll'));
  await rename(path.join(dir, 'content/posts/hello-world.md'), path.join(dir, 'content/posts/renamed.md'));
  assert.deepEqual(await build(dir), first);
  const prefixed = await build(dir, { basePath: '/my-blog' });
  assert.match(prefixed.get('index.html'), /href="\/my-blog\/posts\/hello-world\/"/);
  assert.match(prefixed.get('posts/hello-world/index.html'), /href="\/my-blog\/about\/"/);
  assert.match(prefixed.get('feed.xml'), /https:\/\/example.com\/my-blog\/posts\/hello-world\//);
  assert.match(prefixed.get('sitemap.xml'), /https:\/\/example.com\/my-blog\/tags\/software\//);
});
test('ordering, escaping, drafts, and automatic tag archives', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'content/posts/second.md'), article('tags: [node]'));
  const result = await build(dir);
  assert.ok(result.get('index.html').indexOf('/posts/example/') < result.get('index.html').indexOf('/posts/hello-world/'));
  assert.ok(result.has('tags/node/index.html'));
  await writeFile(path.join(dir, 'content/posts/second.md'), article('draft: true\ntags: [private]'));
  const hidden = await build(dir);
  assert.ok(!hidden.has('posts/example/index.html'));
  assert.ok(!hidden.has('tags/private/index.html'));
  for (const contents of hidden.values()) assert.ok(!String(contents).includes('/posts/example/'));
  await unlink(path.join(dir, 'content/posts/hello-world.md'));
  const empty = await build(dir);
  assert.match(empty.get('index.html'), /No articles published yet/);
});
test('failed builds preserve output; collisions and broken links are rejected', async t => {
  const dir = await fixture(t);
  await build(dir);
  const original = await readFile(path.join(dir, 'build/index.html'), 'utf8');
  await writeFile(path.join(dir, 'content/posts/broken.md'), article('', '[missing](/missing/)'));
  await assert.rejects(build(dir), /missing local target/);
  assert.equal(await readFile(path.join(dir, 'build/index.html'), 'utf8'), original);
  await unlink(path.join(dir, 'content/posts/broken.md'));
  await writeFile(path.join(dir, 'static/index.html'), 'collision');
  await assert.rejects(build(dir), /collision/);
  await unlink(path.join(dir, 'static/index.html'));
  await writeFile(path.join(dir, 'content/posts/duplicate.md'), (await readFile(path.join(dir, 'content/posts/hello-world.md'), 'utf8')));
  await assert.rejects(build(dir), /duplicate route/);
  await writeFile(path.join(dir, '.build.lock'), '');
  await assert.rejects(build(dir), /Another build/);
});
test('assets copy byte for byte and file/directory collisions fail', async t => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'static/assets/posts/example'), { recursive: true });
  const bytes = Buffer.from([0, 1, 2, 255]);
  await writeFile(path.join(dir, 'static/assets/posts/example/image.png'), bytes);
  await writeFile(path.join(dir, 'content/posts/example.md'), article('', '![Sample](/assets/posts/example/image.png)'));
  const result = await build(dir, { basePath: '/blog' });
  assert.deepEqual(result.get('assets/posts/example/image.png'), bytes);
  assert.throws(() => verify(new Map([['about', 'file'], ['about/index.html', 'page']]), config), /collision/);
});
test('preview serves directory URLs, correct MIME, 404 and traversal rejection', async t => {
  const dir = await fixture(t);
  await build(dir, { basePath: '/blog' });
  const server = preview(dir, '/blog');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [url, expected] of [['/blog/', 200], ['/blog/about/', 200], ['/blog/missing/', 404], ['/site.config.json', 404], ['/blog/%2e%2e%2fsite.config.json', 400]]) {
    const response = await fetch(origin + url);
    assert.equal(response.status, expected, url);
    await response.text();
  }
  const css = await fetch(`${origin}/blog/css/style.css`);
  assert.match(css.headers.get('content-type'), /text\/css/);
  await css.text();
});

test('invalid drafts are validated; pages can exist outside navigation', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'content/posts/draft.md'), article('draft: true').replace('slug: example', 'slug: INVALID'));
  await assert.rejects(build(dir), /draft.md/);
  await unlink(path.join(dir, 'content/posts/draft.md'));
  await writeFile(path.join(dir, 'content/pages/hidden.md'), '---\ntitle: Hidden\nslug: hidden\ndescription: Not in the menu\n---\nPage body');
  const result = await build(dir);
  assert.ok(result.has('hidden/index.html'));
  assert.ok(!result.get('index.html').includes('href="/hidden/"'));
  await writeFile(path.join(dir, 'content/posts/escape.md'), article().replace('title: Example', `title: '<script>alert("x")</script> & Example'`));
  const escaped = await build(dir);
  assert.ok(!escaped.get('posts/example/index.html').includes('<script>'));
  assert.equal(XMLValidator.validate(escaped.get('feed.xml')), true);
  await writeFile(path.join(dir, 'templates/post.html'), '{% broken %}');
  const previous = await readFile(path.join(dir, 'build/index.html'), 'utf8');
  await assert.rejects(build(dir));
  assert.equal(await readFile(path.join(dir, 'build/index.html'), 'utf8'), previous);
});

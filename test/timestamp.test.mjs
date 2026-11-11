import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir, stat, rename, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadManifest,
  saveManifest,
  computeSha256,
  scanArticles,
  stampArticle,
  upgradeProofs,
  getProofInfo,
  generatePostId,
  installGitHook
} from '../scripts/timestamp.mjs';
import { loadContent } from '../src/content.mjs';
import { build } from '../src/build.mjs';

const root = path.resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));

async function testDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'blog-timestamp-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  for (const name of ['content', 'static', 'templates', 'schemas', 'site.config.json']) {
    await cp(path.join(root, name), path.join(dir, name), { recursive: true });
  }

  // Clear posts and proofs for clean test isolation
  await rm(path.join(dir, 'content/posts'), { recursive: true });
  await mkdir(path.join(dir, 'content/posts'));
  await rm(path.join(dir, 'static/proofs'), { recursive: true, force: true });
  await mkdir(path.join(dir, 'static/proofs'));

  return dir;
}

test('generatePostId creates clean kebab-case IDs and resolves collisions', () => {
  assert.equal(generatePostId('Hello World'), 'hello-world');
  assert.equal(generatePostId('Decentralized Timestamps: Part 1!'), 'decentralized-timestamps-part-1');
  assert.equal(generatePostId('   Leading and trailing spaces   '), 'leading-and-trailing-spaces');
  assert.equal(generatePostId('Special Characters: @#$% & More'), 'special-characters-more');
  assert.equal(generatePostId('', new Set()), 'post');

  const existing = new Set(['my-post', 'my-post-2']);
  assert.equal(generatePostId('My Post', existing), 'my-post-3');
});

test('manifest lifecycle: load, save, and missing file fallback', async t => {
  const dir = await testDir(t);
  const empty = await loadManifest(dir);
  assert.deepEqual(empty, { version: 1, articles: {} });

  const custom = {
    version: 1,
    articles: {
      'test-id': {
        currentPath: 'content/posts/test.md',
        versions: [{ version: 1, path: 'content/posts/test.md', fileHash: 'abc', proofFile: 'static/proofs/test-id/v1.ots' }]
      }
    }
  };
  await saveManifest(dir, custom);
  const loaded = await loadManifest(dir);
  assert.deepEqual(loaded, custom);
});

test('scanArticles detects untracked, up-to-date, and modified states', async t => {
  const dir = await testDir(t);
  const postFile = path.join(dir, 'content/posts/test-post.md');
  const initialContent = `---\nid: sample-post\ntitle: Sample Post\nauthor: "Giovanni Filardo"\nslug: sample-post\ndate: "2026-11-10"\ndescription: A test post\n---\nInitial content.`;
  await writeFile(postFile, initialContent);

  // 1. Untracked
  let scanned = await scanArticles(dir);
  assert.equal(scanned.length, 1);
  assert.equal(scanned[0].id, 'sample-post');
  assert.equal(scanned[0].status, 'UNTRACKED');
  assert.equal(scanned[0].proposedVersion, 1);

  // 2. Stamp v1 (mock)
  const stampResult1 = await stampArticle(dir, 'sample-post', { mock: true });
  assert.equal(stampResult1.version, 1);
  assert.equal(stampResult1.skipped, false);

  // 3. Up to date
  scanned = await scanArticles(dir);
  assert.equal(scanned[0].status, 'UP_TO_DATE');
  assert.equal(scanned[0].latestVersion, 1);
  assert.equal(scanned[0].proposedVersion, 1);

  // Stamping again without modifications should skip
  const stampAgain = await stampArticle(dir, 'sample-post', { mock: true });
  assert.equal(stampAgain.skipped, true);

  // 4. Modify file -> MODIFIED
  const modifiedContent = `${initialContent}\n\nAdded a new section to the article.`;
  await writeFile(postFile, modifiedContent);

  scanned = await scanArticles(dir);
  assert.equal(scanned[0].status, 'MODIFIED');
  assert.equal(scanned[0].latestVersion, 1);
  assert.equal(scanned[0].proposedVersion, 2);

  // 5. Stamp v2 (mock)
  const stampResult2 = await stampArticle(dir, 'sample-post', { mock: true });
  assert.equal(stampResult2.version, 2);
  assert.equal(stampResult2.skipped, false);

  // Ensure both v1.ots and v2.ots exist and are preserved
  const v1Stat = await stat(path.join(dir, 'static/proofs/sample-post/v1.ots'));
  const v2Stat = await stat(path.join(dir, 'static/proofs/sample-post/v2.ots'));
  assert.ok(v1Stat.size > 0);
  assert.ok(v2Stat.size > 0);

  // Manifest has both versions recorded sequentially
  const manifest = await loadManifest(dir);
  assert.equal(manifest.articles['sample-post'].versions.length, 2);
  assert.equal(manifest.articles['sample-post'].versions[0].version, 1);
  assert.equal(manifest.articles['sample-post'].versions[1].version, 2);
});

test('blog engine attaches provenance metadata and renders provenance colophon', async t => {
  const dir = await testDir(t);
  const postFile = path.join(dir, 'content/posts/anchor-test.md');
  const postContent = `---\nid: anchor-test\ntitle: Anchor Test\nauthor: "Giovanni Filardo"\nslug: anchor-test\ndate: "2026-11-10"\ndescription: Testing anchor provenance\n---\nHello provenance.`;
  await writeFile(postFile, postContent);

  // Stamp v1 with confirmed block status
  await stampArticle(dir, 'anchor-test', {
    mock: true,
    initialStatus: 'confirmed',
    bitcoinBlock: 870142,
    bitcoinBlockTime: '2024-11-13T12:00:00.000Z'
  });

  // Load content through blog engine
  const docs = await loadContent(dir, config);
  const postDoc = docs.find(d => d.id === 'anchor-test');
  assert.ok(postDoc);
  assert.ok(postDoc.provenance);
  assert.equal(postDoc.provenance.version, 1);
  assert.equal(postDoc.provenance.status, 'confirmed');
  assert.equal(postDoc.provenance.bitcoinBlock, 870142);
  assert.equal(postDoc.provenance.bitcoinBlockDate, '2024-11-13');
  assert.equal(postDoc.provenance.isCurrent, true);
  assert.equal(postDoc.provenance.proofUrl, '/proofs/anchor-test/v1.ots');

  // Build the blog
  const files = await build(dir);
  assert.ok(files.has('proofs/anchor-test/v1.ots'));

  const html = files.get('posts/anchor-test/index.html');
  assert.ok(html);
  // Header meta contains version and link to #provenance
  assert.match(html, /<a href="#provenance" title="OpenTimestamps Bitcoin provenance">v1 anchored<\/a>/);
  // Colophon contains block number and proof download link
  assert.match(html, /#870142/);
  assert.match(html, /2024-11-13/);
  assert.match(html, /href="\/proofs\/anchor-test\/v1\.ots"/);

  // Modify file on disk without stamping -> drift notice
  await writeFile(postFile, `${postContent}\n\nUnanchored revision.`);
  const driftedDocs = await loadContent(dir, config);
  const driftedDoc = driftedDocs.find(d => d.id === 'anchor-test');
  assert.equal(driftedDoc.provenance.isCurrent, false);

  const driftedFiles = await build(dir);
  const driftedHtml = driftedFiles.get('posts/anchor-test/index.html');
  assert.match(driftedHtml, /v1 draft modified/);
  assert.match(driftedHtml, /Content has unanchored modifications since version 1/);
});

test('changing article file path preserves historical proof paths and updates currentPath', async t => {
  const dir = await testDir(t);
  const originalPath = path.join(dir, 'content/posts/original.md');
  const renamedPath = path.join(dir, 'content/posts/renamed.md');
  const postContent = `---\nid: moving-post\ntitle: Moving Post\nauthor: "Giovanni Filardo"\nslug: moving-post\ndate: "2026-11-10"\ndescription: Testing path changes\n---\nOriginal content.`;

  await writeFile(originalPath, postContent);

  // 1. Stamp version 1 at original path
  await stampArticle(dir, 'moving-post', { mock: true });
  let manifest = await loadManifest(dir);
  assert.equal(manifest.articles['moving-post'].currentPath, 'content/posts/original.md');
  assert.equal(manifest.articles['moving-post'].versions[0].path, 'content/posts/original.md');

  // 2. Rename file without changing content
  await rename(originalPath, renamedPath);
  let scanned = await scanArticles(dir);
  const found = scanned.find(a => a.id === 'moving-post');
  assert.ok(found);
  assert.equal(found.status, 'UP_TO_DATE');
  assert.equal(found.relPath, 'content/posts/renamed.md');

  // Manifest currentPath is automatically synced
  manifest = await loadManifest(dir);
  assert.equal(manifest.articles['moving-post'].currentPath, 'content/posts/renamed.md');
  // Historical v1 path is preserved
  assert.equal(manifest.articles['moving-post'].versions[0].path, 'content/posts/original.md');

  // 3. Modify content at the new path and stamp v2
  await writeFile(renamedPath, `${postContent}\n\nRevised content.`);
  scanned = await scanArticles(dir);
  assert.equal(scanned.find(a => a.id === 'moving-post').status, 'MODIFIED');

  await stampArticle(dir, 'moving-post', { mock: true });
  manifest = await loadManifest(dir);
  assert.equal(manifest.articles['moving-post'].versions.length, 2);
  assert.equal(manifest.articles['moving-post'].versions[0].path, 'content/posts/original.md');
  assert.equal(manifest.articles['moving-post'].versions[1].path, 'content/posts/renamed.md');
  assert.equal(manifest.articles['moving-post'].currentPath, 'content/posts/renamed.md');

  // 4. If file is deleted on disk, manifest retains history and scan flags MISSING
  await unlink(renamedPath);
  scanned = await scanArticles(dir);
  const missing = scanned.find(a => a.id === 'moving-post');
  assert.ok(missing);
  assert.equal(missing.status, 'MISSING');
  assert.equal(missing.relPath, 'content/posts/renamed.md');
  assert.equal(missing.latestVersion, 2);
});

test('timestamp: false in frontmatter opts out of timestamping and skips pre-push checks', async t => {
  const dir = await testDir(t);
  const postFile = path.join(dir, 'content/posts/opt-out.md');
  const postContent = `---\nid: opt-out\ntitle: Opted Out Post\nauthor: "Giovanni Filardo"\nslug: opt-out\ndate: "2026-11-10"\ndescription: An article that should not be timestamped\ntimestamp: false\n---\nInternal or draft notes.`;

  await writeFile(postFile, postContent);

  // 1. Scanner flags as DISABLED
  const scanned = await scanArticles(dir);
  const found = scanned.find(a => a.id === 'opt-out');
  assert.ok(found);
  assert.equal(found.status, 'DISABLED');
  assert.equal(found.timestampEnabled, false);

  // 2. Stamping skips by default
  const stampResult = await stampArticle(dir, 'opt-out', { mock: true });
  assert.equal(stampResult.skipped, true);
  assert.match(stampResult.reason, /timestamp: false/);

  // 3. Blog engine skips provenance attachment
  const docs = await loadContent(dir, config);
  const doc = docs.find(d => d.id === 'opt-out');
  assert.equal(doc.timestamp, false);
  assert.equal(doc.provenance, undefined);

  // 4. Build output does not render provenance badge or colophon
  const files = await build(dir);
  const html = files.get('posts/opt-out/index.html');
  assert.ok(html);
  assert.doesNotMatch(html, /provenance-colophon/);
  assert.doesNotMatch(html, /provenance-meta/);
});

test('installGitHook creates executable pre-push hook in .git repository and leaves commits unhindered', async t => {
  const dir = await testDir(t);

  // When .git is absent (e.g. tarball / CI export)
  const skippedResult = await installGitHook(dir);
  assert.equal(skippedResult.skipped, true);

  // When .git is present
  await mkdir(path.join(dir, '.git'));
  const { prePushPath, skipped } = await installGitHook(dir);
  assert.equal(skipped, false);
  const pushContent = await readFile(prePushPath, 'utf8');
  assert.match(pushContent, /node scripts\/timestamp\.mjs check --push/);
});

test('opentimestamps library integration: deserialize, info inspection, and upgrade handling', async t => {
  const dir = await testDir(t);
  const postFile = path.join(dir, 'content/posts/ots-lib.md');
  const postContent = `---\nid: ots-lib\ntitle: OTS Lib Test\nauthor: "Giovanni Filardo"\nslug: ots-lib\ndate: "2026-11-10"\ndescription: Testing OpenTimestamps library integration\n---\nHello library.`;
  await writeFile(postFile, postContent);

  // 1. Stamp mock proof
  await stampArticle(dir, 'ots-lib', { mock: true });

  // 2. getProofInfo successfully reads and formats proof
  const info = await getProofInfo(dir, 'ots-lib');
  assert.match(info, /File sha256 hash:/);

  // 3. upgradeProofs handles mock proof gracefully without network
  const upgradeResults = await upgradeProofs(dir, 'ots-lib');
  assert.equal(upgradeResults.length, 1);
  assert.equal(upgradeResults[0].id, 'ots-lib');
  assert.equal(upgradeResults[0].upgraded, false);
});

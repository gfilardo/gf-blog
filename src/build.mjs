import { readFile, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig } from './urls.mjs';
import { loadContent } from './content.mjs';
import { render } from './render.mjs';
import { staticFiles, verify, publish } from './output.mjs';
export async function build(root = process.cwd(), overrides = {}) {
  const lockPath = path.join(root, '.build.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Another build is running (.build.lock exists)'); throw error; }
  try {
    const site = validateConfig({ ...JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8')), ...overrides });
    const documents = await loadContent(root, site);
    const files = render(root, site, documents);
    for (const [file, contents] of await staticFiles(path.join(root, 'static'))) {
      if (files.has(file)) throw new Error(`Static/generated output collision: ${file}`);
      files.set(file, contents);
    }
    verify(files, site);
    await publish(root, files);
    return files;
  } finally { await lock.close(); await unlink(lockPath); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const files = await build(process.cwd(), {
      ...(process.env.SITE_ORIGIN !== undefined ? { origin: process.env.SITE_ORIGIN } : {}),
      ...(process.env.SITE_BASE_PATH !== undefined ? { basePath: process.env.SITE_BASE_PATH } : {})
    });
    console.log(`Built ${[...files.keys()].filter(f => f.endsWith('.html')).length} pages (${files.size} files) in build/`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

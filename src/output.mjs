import { readdir, readFile, mkdir, writeFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
export async function staticFiles(root, prefix = '') {
  const result = new Map();
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
    if (entry.name === '.gitkeep') continue;
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Static symlinks are unsupported: ${name}`);
    if (entry.isDirectory()) {
      for (const pair of await staticFiles(path.join(root, entry.name), `${name}/`)) result.set(...pair);
    } else result.set(name, await readFile(path.join(root, entry.name)));
  }
  return result;
}
export function verify(files, site) {
  for (const name of files.keys()) {
    const parts = name.split('/');
    for (let i = 1; i < parts.length; i++) {
      if (files.has(parts.slice(0, i).join('/'))) throw new Error(`File/directory collision: ${name}`);
    }
  }
  for (const [file, contents] of files) {
    if (!file.endsWith('.html')) continue;
    const base = new URL(`${site.basePath}/${file}`, site.origin);
    const walk = node => {
      for (const attr of node.attrs ?? []) {
        if (!['href', 'src', 'poster'].includes(attr.name) || !attr.value || attr.value.startsWith('#')) continue;
        const url = new URL(attr.value, base);
        if (url.origin !== site.origin) continue;
        let target = decodeURIComponent(url.pathname);
        if (!target.startsWith(`${site.basePath}/`)) throw new Error(`${file}: URL outside basePath: ${attr.value}`);
        target = target.slice(site.basePath.length + 1);
        if (target.endsWith('/') || !target) target += 'index.html';
        if (!files.has(target)) throw new Error(`${file}: missing local target ${attr.value}`);
      }
      for (const child of node.childNodes ?? []) walk(child);
    };
    walk(parse(String(contents)));
  }
}
export async function publish(root, files) {
  const staging = path.join(root, `.build-stage-${process.pid}`);
  const backup = path.join(root, `.build-backup-${process.pid}`);
  const output = path.join(root, 'build');
  await mkdir(staging);
  let backedUp = false;
  try {
    for (const [name, contents] of files) {
      const target = path.join(staging, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
    try { await stat(output); backedUp = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (backedUp) await rename(output, backup);
    try { await rename(staging, output); }
    catch (error) { if (backedUp) await rename(backup, output); throw error; }
    if (backedUp) await rm(backup, { recursive: true });
  } finally { await rm(staging, { recursive: true, force: true }); }
}

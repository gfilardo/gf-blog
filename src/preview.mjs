import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, realpath, stat } from 'node:fs/promises';
import { validateConfig } from './urls.mjs';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
export function preview(root, basePath = '') {
  const directory = path.join(root, 'build');
  return http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const raw = decodeURIComponent(req.url.split('?')[0]);
      if (raw.includes('\\') || raw.includes('\0') || raw.split('/').includes('..')) { res.writeHead(400); res.end('Invalid path'); return; }
      if (basePath && raw === basePath) { res.writeHead(302, { Location: `${basePath}/` }); res.end(); return; }
      let status = 200;
      let target;
      if (!raw.startsWith(`${basePath}/`)) status = 404;
      else {
        target = path.join(directory, raw.slice(basePath.length));
        try {
          if ((await stat(target)).isDirectory()) {
            if (!raw.endsWith('/')) { res.writeHead(302, { Location: `${raw}/` }); res.end(); return; }
            target = path.join(target, 'index.html');
          }
          const resolved = await realpath(target);
          if (!resolved.startsWith(`${await realpath(directory)}${path.sep}`)) status = 404;
        } catch (e) { if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw e; status = 404; }
      }
      if (status === 404) target = path.join(directory, '404.html');
      const contents = await readFile(target);
      res.writeHead(status, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch { res.writeHead(500); res.end('Build the site before previewing.'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const site = validateConfig(JSON.parse(await readFile('site.config.json', 'utf8')));
  const basePath = process.env.SITE_BASE_PATH ?? site.basePath;
  const port = Number(process.env.PORT ?? 8000);
  preview(process.cwd(), basePath).listen(port, '127.0.0.1', () => console.log(`Preview: http://localhost:${port}${basePath}/`));
}

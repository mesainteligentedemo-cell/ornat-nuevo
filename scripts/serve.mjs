// Servidor local que imita el hosting estático de Vercel:
// sirve index.html por carpeta, devuelve /404.html en rutas inexistentes
// y reenvía /api/* a producción (las funciones del servidor no están en este repo).
import http from 'node:http';
import https from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 4173);
const API_ORIGIN = process.env.API_ORIGIN || 'https://ornat-nuevo.vercel.app';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.pdf': 'application/pdf',
};

async function findFile(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const base = join(ROOT, safe);
  if (!base.startsWith(ROOT)) return null;
  for (const candidate of [base, join(base, 'index.html'), `${base}.html`]) {
    try { if ((await stat(candidate)).isFile()) return candidate; } catch {}
  }
  return null;
}

function proxyApi(req, res) {
  const upstream = https.request(new URL(req.url, API_ORIGIN), { method: req.method, headers: { ...req.headers, host: new URL(API_ORIGIN).host } }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":"api_unreachable"}'); });
  req.pipe(upstream);
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname.startsWith('/api/')) return proxyApi(req, res);
  // Igual que vercel.json: /sitios/<id> muestra el sitio publicado desde el CMS.
  if (/^\/sitios\/[^/]+\/?$/.test(pathname)) {
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    return res.end(await readFile(join(ROOT, 'cms/sitio.html')));
  }
  // Igual que Vercel: /carpeta sin diagonal final redirige a /carpeta/
  if (!pathname.endsWith('/') && !extname(pathname)) {
    const dir = await findFile(`${pathname}/`);
    if (dir) { res.writeHead(308, { location: `${pathname}/` }); return res.end(); }
  }
  const file = await findFile(pathname);
  if (!file) {
    const notFound = await findFile('/404.html');
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    return res.end(notFound ? await readFile(notFound) : 'Not found');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`ORNAT local en http://localhost:${PORT}`));

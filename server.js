/**
 * DISETECH dev/preview server. Static files plus the one endpoint the landing
 * needs. Zero dependencies on purpose — the site is static HTML and ES modules,
 * and a framework would be more moving parts than the job has.
 *
 *   node server.js                    # http://localhost:4321
 *   node --env-file=.env server.js    # with mail config from .env
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleContact } from './server/contact.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Never serve the source frames, the local inbox, or anything dot-prefixed. */
const BLOCKED = [`frames${sep}`, `server${sep}`, `data${sep}`, `source-images${sep}`];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/api/contact') {
    const ip = req.socket.remoteAddress ?? 'unknown';
    try {
      await handleContact(req, res, ip);
    } catch (error) {
      console.error('[server]', error);
      if (!res.headersSent) res.writeHead(500).end();
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }

  await serveStatic(url.pathname, res, req);
});

async function serveStatic(pathname, res, req) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');

  if (relative.split(sep).some((part) => part.startsWith('.'))) {
    return notFound(res);
  }
  if (BLOCKED.some((prefix) => relative.startsWith(prefix))) {
    return notFound(res);
  }

  const file = join(ROOT, relative === '' ? 'index.html' : relative);
  if (!file.startsWith(ROOT + sep) && file !== join(ROOT, 'index.html')) {
    return notFound(res);
  }

  let info;
  try {
    info = await stat(file);
  } catch {
    return notFound(res);
  }
  if (info.isDirectory()) return notFound(res);

  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  // Only the frame sequence is genuinely immutable — those filenames never
  // point at different bytes. Other assets get edited, so they must revalidate
  // or a stale copy sticks around for a year.
  const immutable = relative.startsWith(`assets${sep}frames${sep}`);
  const lastModified = info.mtime.toUTCString();

  // `no-cache` means "revalidate first", which needs a validator to revalidate
  // against — without one the browser is free to serve a stale copy instead.
  if (!immutable && req.headers['if-modified-since'] === lastModified) {
    res.writeHead(304, { 'Cache-Control': 'no-cache', 'Last-Modified': lastModified }).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': info.size,
    'Last-Modified': lastModified,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
}

server.listen(PORT, () => {
  console.log(`DISETECH → http://localhost:${PORT}`);
});

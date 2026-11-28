// Serves static/dist with a CSP header approximating Forge Custom UI, so S1 can run in plain Chromium.
// Override with SPIKE_CSP=... to replay the exact header captured from a real Forge deployment.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 4455);
const ROOT = new URL('../static/dist/', import.meta.url).pathname;

export const FORGE_LIKE_CSP =
  process.env.SPIKE_CSP ||
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

export function start(port = PORT) {
  const server = createServer(async (req, res) => {
    const path = normalize(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, {
        'content-type': TYPES[extname(path)] || 'application/octet-stream',
        'content-security-policy': FORGE_LIKE_CSP,
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await start();
  console.log(`http://localhost:${PORT}/  CSP: ${FORGE_LIKE_CSP}`);
}

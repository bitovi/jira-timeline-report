// S8 check: run the built report.html in the S1 sandbox, under the real Forge CSP, with the
// host-injected SDK runtime, and count CSP violations inside the report frame.
// Usage: npm run build && npm run build:sdk && node harness/run.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url).pathname;
const repo = new URL('../../../', import.meta.url).pathname;
const forgeCsp = (await readFile(`${repo}spikes/vibe-reports-forge/findings/forge-csp-header.txt`, 'utf8')).trim();

const files = {
  '/host.html': [`${root}harness/host.html`, 'text/html'],
  '/host.js': [`${root}harness/host.js`, 'text/javascript'],
  '/sandbox.js': [`${repo}spikes/vibe-reports-forge/static/src/sandbox.js`, 'text/javascript'],
  '/report.html': [`${root}dist/index.html`, 'text/html'],
  '/runtime.js': [`${root}dist-sdk/report-sdk-runtime.js`, 'text/javascript'],
  '/sample.json': [`${repo}src/examples/bitovi-training.json`, 'application/json'],
};
const server = createServer(async (req, res) => {
  const f = files[new URL(req.url, 'http://x').pathname];
  if (!f) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': f[1], 'content-security-policy': forgeCsp });
  res.end(await readFile(f[0]));
}).listen(4457);

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
await page.goto('http://localhost:4457/host.html');

const end = Date.now() + 30000;
let r;
while (Date.now() < end) {
  r = await page.evaluate(() => window.__s8);
  if (r && r.done) break;
  await new Promise((res) => setTimeout(res, 250));
}
const frame = page.frames().find((f) => f !== page.mainFrame());
const rendered = frame
  ? await frame.evaluate(() => ({
      rendered: document.body.dataset.rendered,
      bars: document.querySelectorAll('.recharts-bar-rectangle').length,
      rows: document.querySelectorAll('tr').length,
      manifest: document.getElementById('report-manifest')?.textContent.trim().slice(0, 80),
    }))
  : null;
await page.screenshot({ path: `${repo}spikes/vibe-reports-forge/findings/s8-report.png`, fullPage: true });

console.log(JSON.stringify({ ...r, rendered, consoleErrors }, null, 1));
const pass =
  r?.done && rendered?.rendered && rendered.rendered !== 'error' && rendered.bars > 0 && r.violations.length === 0;
console.log(pass ? 'S8 PASS' : 'S8 FAIL');
await browser.close();
server.close();
process.exit(pass ? 0 : 1);

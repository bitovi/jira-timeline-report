// S9: run the S1 attack suite, navigation attacks, sample report and S2 allowlist tests through the
// web sandbox origin. App = http://localhost:4470 (no CSP, holds tokens). Sandbox domain =
// http://127.0.0.1:4471 (different site; loader served with LOADER_CSP).
// Usage: node spikes/web-sandbox/run.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const here = new URL('./', import.meta.url).pathname;
const forge = new URL('../vibe-reports-forge/', import.meta.url).pathname;
const APP = 'http://localhost:4470';
const SANDBOX = 'http://127.0.0.1:4471';

export const LOADER_CSP = [
  "default-src 'none'",
  // 'unsafe-inline' is for the report's inline scripts: srcdoc children inherit this policy.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  // Blocks the report frame from navigating itself anywhere (external URL or a blob: document).
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  `frame-ancestors ${APP}`,
].join('; ');

const type = (p) => (p.endsWith('.js') ? 'text/javascript' : 'text/html');
function serve(port, routes, headers = {}) {
  return createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    const file = routes(path);
    if (!file) return res.writeHead(404).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': type(file), ...headers });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  }).listen(port);
}

const shared = { '/sandbox.js': `${forge}static/src/sandbox.js`, '/mock-jira.js': `${forge}static/src/mock-jira.js` };
const appServer = serve(4470, (p) =>
  p.startsWith('/reports/')
    ? `${forge}reports/${p.slice(9).replace(/[^a-z0-9.-]/gi, '')}`
    : { '/': `${here}app/app.html`, '/app.js': `${here}app/app.js`, ...shared }[p],
);
const sandboxServer = serve(
  4471,
  (p) =>
    ({
      '/loader.html': `${here}sandbox-domain/loader.html`,
      '/loader.js': `${here}sandbox-domain/loader.js`,
      '/sandbox.js': shared['/sandbox.js'],
    })[p],
  { 'content-security-policy': LOADER_CSP, 'cross-origin-resource-policy': 'same-origin' },
);

let failures = 0;
const fail = (m) => (failures++, console.log('  FAIL', m));

const browser = await chromium.launch();
const page = await browser.newPage();
const isExternal = (u) => !u.startsWith(APP) && !u.startsWith(SANDBOX) && !/^(data|blob|about):/.test(u);
const leaked = [];
page.on('response', (r) => isExternal(r.url()) && leaked.push(`${r.status()} ${r.url()}`));
page.on('pageerror', (e) => console.log('  pageerror', e.message));
await page.goto(`${APP}/`);
const mount = (name, ms) => page.evaluate(([n, w]) => window.__mount(n, w), [name, ms]);

console.log('Loader CSP:', LOADER_CSP);

// 1. Attack suite
let r = await mount('attack.html', 30000);
const attack = r.tests.find((t) => t.kind === 'attack-results');
if (!attack) fail('attack suite never reported: ' + JSON.stringify(r));
else {
  for (const a of attack.results) if (!a.blocked) fail(`attack ${a.name}: ${a.detail}`);
  console.log(`  attack suite: ${attack.results.filter((a) => a.blocked).length}/${attack.results.length} blocked`);
  for (const name of [
    'origin is "null"',
    'top.localStorage (app token)',
    'top.document',
    'parent.localStorage',
    'WebRTC STUN (egress)',
  ])
    console.log(`    ${name}: ${attack.results.find((a) => a.name === name)?.detail}`);
}
if (r.jiraCalls) fail('attack suite caused Jira calls');

// 2. Self-navigation to an external URL
r = await mount('attack-navigate.html', 4000);
const navStill = r.tests.some((t) => t.kind === 'nav-still-here');
console.log('  navigate external:', JSON.stringify({ stillHere: navStill, loaderViolations: r.loaderViolations }));
if (!navStill && r.loaderViolations.length === 0) fail('external self-navigation not blocked');

// 3. Self-navigation to a blob: document (the S1 WebRTC bypass)
r = await mount('attack-navigate-blob.html', 7000);
const rtc = r.tests.find((t) => t.kind === 'nav-blob-webrtc')?.result;
console.log(
  '  navigate blob:',
  JSON.stringify({ loaderViolations: r.loaderViolations, webrtcAfterNav: rtc ?? 'never ran' }),
);
if (/srflx/.test(rtc || '')) fail('blob navigation reopened WebRTC egress');

// 4. Sample report renders through the relay
r = await mount('report.html', 5000);
const frames = page.frames().filter((f) => f.url() === 'about:srcdoc');
const rendered = await Promise.all(
  frames.map((f) => f.evaluate(() => document.title + ' ' + document.body.dataset.rendered).catch(() => null)),
);
console.log(
  '  sample report:',
  JSON.stringify({ bridge: r.bridge, rendered: rendered.filter((x) => x && x.startsWith('Issues')) }),
);
if (!r.bridge.some((b) => b.answered)) fail('sample report got no data');

// 5. S2 allowlist tests through the relay
r = await mount('bridge-tests.html', 10000);
const bridge = r.tests.find((t) => t.kind === 'bridge-results');
if (!bridge) fail('bridge tests never reported');
else {
  for (const b of bridge.results) if (!b.pass) fail(`bridge ${b.name}: ${b.detail}`);
  console.log(
    `  bridge allowlist through relay: ${bridge.results.filter((b) => b.pass).length}/${bridge.results.length} pass`,
  );
}

// 6. Only the app may embed the loader (frame-ancestors).
const third = await browser.newPage();
const ancestorViolations = [];
third.on(
  'console',
  (m) => /frame-ancestors|Refused to frame/i.test(m.text()) && ancestorViolations.push(m.text().slice(0, 120)),
);
await third.setContent(`<iframe src="${SANDBOX}/loader.html"></iframe>`);
await third.waitForTimeout(1500);
console.log(
  '  loader embedded by a non-app page:',
  ancestorViolations.length ? 'refused (frame-ancestors)' : 'NOT refused',
);
if (!ancestorViolations.length) fail('loader can be framed by a non-app page');
await third.close();

console.log('  external responses:', leaked.length ? leaked : 'none');
if (leaked.length) fail('requests left the page');

await browser.close();
appServer.close();
sandboxServer.close();
console.log(failures ? `\n${failures} failure(s)` : '\nS9 PASS');
process.exit(failures ? 1 : 0);

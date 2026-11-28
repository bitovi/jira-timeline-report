// Drives the host page in Chromium (and optionally Firefox/WebKit) and prints a pass/fail summary.
// Usage: node local/run-sandbox-tests.mjs [chromium|firefox|webkit ...]
import { chromium, firefox, webkit } from 'playwright';
import { start } from './serve.mjs';

const engines = { chromium, firefox, webkit };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['chromium'];
const server = await start(4456);
const url = 'http://localhost:4456/';

// Attacks that are expected to remain open and are tracked as findings rather than failures.
const KNOWN_OPEN = new Set([]);

// page.waitForFunction evals a string, which the page's CSP (correctly) refuses; poll instead.
async function until(page, pred, arg, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await page.evaluate(pred, arg)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('timed out waiting for ' + pred.toString());
}

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log('  FAIL', msg);
};

for (const name of wanted) {
  console.log(`\n=== ${name} ===`);
  const browser = await engines[name].launch();
  const page = await browser.newPage();
  // 'request' fires even for requests CSP later refuses; only responses prove a request left the page.
  const isExternal = (u) => !u.startsWith(url) && !u.startsWith('data:') && !u.startsWith('blob:');
  const external = [];
  const blockedReasons = {};
  page.on('response', (r) => isExternal(r.url()) && external.push(`${r.status()} ${r.url()}`));
  page.on('requestfailed', (r) => {
    if (!isExternal(r.url())) return;
    const why = r.failure()?.errorText;
    blockedReasons[why] = (blockedReasons[why] || 0) + 1;
  });
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await page.goto(url);
  const results = () => page.evaluate(() => window.__spikeResults);

  for (const mode of (process.env.MODES || 'srcdoc,blob').split(',')) {
    await page.click(`#attack-${mode}`);
    await until(page, (m) => window.__spikeResults[`attack_${m}`], mode, 60000);
    const r = (await results())[`attack_${mode}`];
    for (const a of r) {
      if (!a.blocked)
        KNOWN_OPEN.has(a.name)
          ? console.log('  OPEN (known)', mode, a.name, a.detail)
          : fail(`${mode} ${a.name}: ${a.detail}`);
    }
    console.log(`  attack suite ${mode}: ${r.filter((a) => a.blocked).length}/${r.length} blocked`);

    for (const variant of ['external', 'blob']) {
      await page.click(`#nav-${variant}-${mode}`);
      await until(page, (k) => window.__spikeResults[k], `nav_${variant}_${mode}`, 20000);
      const nav = (await results())[`nav_${variant}_${mode}`];
      console.log(`  navigation ${variant} via ${mode}:`, JSON.stringify(nav));
      if (!nav.blocked) fail(`${mode} self-navigation (${variant}) not blocked`);
    }

    await page.click(`#report-${mode}`);
    const frame = page.frameLocator(`iframe[title="report-${mode}"]`);
    await frame.locator('body[data-rendered]').waitFor({ timeout: 20000 });
    const rendered = await frame.locator('body').getAttribute('data-rendered');
    const bars = await frame.locator('svg rect').count();
    console.log(`  sample report ${mode}: rendered=${rendered}, bars=${bars}`);
    if (rendered === 'error' || bars === 0) fail(`${mode} sample report did not render`);
  }

  await page.click('#bridge-tests');
  await until(page, () => window.__spikeResults.bridge, null, 60000);
  for (const b of (await results()).bridge) if (!b.pass) fail(`bridge ${b.name}: ${b.detail}`);
  console.log(
    `  bridge allowlist: ${(await results()).bridge.filter((b) => b.pass).length}/${(await results()).bridge.length} pass`,
  );
  const log = (await results()).log;
  const nonObject = log.filter((l) => !l.accepted && l.reason === 'message must be an object');
  if (nonObject.length < 2) fail('non-object messages were not rejected');

  await page.click('#source-tests');
  await until(page, () => window.__spikeResults.sourceTests, null, 20000);
  const src = (await results()).sourceTests;
  console.log('  other sources:', JSON.stringify(src));
  if (!src.pass) fail('messages from other sources were answered');

  await page.click('#perf');
  await until(page, () => window.__spikeResults.perf, null, 120000);
  console.log('  perf (mock Jira):', JSON.stringify((await results()).perf));

  // S4 with the mock store.
  await page.fill('#issue-key', 'REP-1');
  await page.click('#upload-sample');
  await page.waitForSelector('tr[data-attachment]');
  let s4 = (await results()).s4;
  if (s4.attachments[0].state !== 'pending approval') fail('new upload should be pending');
  await page.click('button.approve');
  await until(page, () => window.__spikeResults.s4.attachments[0].state === 'approved');
  await page.click('#upload-modified');
  await until(page, () => window.__spikeResults.s4.attachments.length === 2);
  s4 = (await results()).s4;
  const states = s4.attachments.map((a) => a.state);
  console.log('  S4 states (newest first):', states.join(', '));
  if (states[0] !== 'pending approval' || states[1] !== 'approved')
    fail('modified upload should be pending, original approved');
  if ((await page.locator('tr[data-attachment] button.run').count()) !== 1)
    fail('exactly one runnable bundle expected');
  await page.locator('tr[data-attachment] button.run').click();
  await page.frameLocator('iframe[title^="bundle-"]').locator('body[data-rendered]').waitFor({ timeout: 20000 });
  console.log('  S4 approved bundle rendered in sandbox');

  // Browser-generated CSP violation reports go to the host policy's report-uri (Atlassian), not to a
  // report-controlled server. Counted separately: the blocked URL is in the report body.
  const isCspReport = (u) => u.includes('web-security-reports.services.atlassian.com/csp-report');
  const leaked = external.filter((u) => !isCspReport(u));
  console.log('  CSP violation reports sent to Atlassian report-uri:', external.filter(isCspReport).length);
  console.log('  external requests that got a response:', leaked.length ? leaked : 'none');
  console.log('  external requests that failed, by reason:', JSON.stringify(blockedReasons));
  if (leaked.length) fail('requests left the page: ' + leaked.join(', '));
  await browser.close();
}

server.close();
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

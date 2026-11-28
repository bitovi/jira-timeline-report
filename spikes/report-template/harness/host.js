import { injectCsp } from './sandbox.js';

const state = (window.__s8 = { violations: [], timings: {}, done: false });
const t0 = performance.now();
const mark = (k) => (state.timings[k] = Math.round(performance.now() - t0));

// Code and data load in parallel; the manifest (normally read from the approval record) says what
// data to fetch, so the host never waits for the bundle to know what to load.
const [reportHtml, runtime, sample] = await Promise.all([
  fetch('./report.html')
    .then((r) => r.text())
    .finally(() => mark('bundle')),
  fetch('./runtime.js')
    .then((r) => r.text())
    .finally(() => mark('runtime')),
  fetch('./sample.json')
    .then((r) => r.json())
    .finally(() => mark('data')),
]);

const manifest = JSON.parse(reportHtml.match(/<script type="application\/json" id="report-manifest">([^<]*)/)[1]);
state.manifest = manifest;

const reporter = `<script>addEventListener('securitypolicyviolation', (e) => parent.postMessage({ __csp: e.effectiveDirective + ' ' + e.blockedURI }, '*'));</script>`;
const inject = manifest.sdk?.provide === 'host' ? `<script>${runtime}</script>` : '';
const doc = injectCsp(reportHtml.replace(/<head>/i, () => `<head>${reporter}${inject}`));

const iframe = document.createElement('iframe');
iframe.setAttribute('sandbox', 'allow-scripts');
iframe.style.cssText = 'width:700px;height:700px;border:1px solid #ccc';
iframe.srcdoc = doc;

const context = {
  rollupLevels: [
    { type: 'Initiative', hierarchyLevel: 2, calculation: 'childrenOnly' },
    { type: 'Epic', hierarchyLevel: 1, calculation: 'widestRange' },
    { type: 'Story', hierarchyLevel: 0, calculation: 'parentOnly' },
  ],
  normalizeConfig: {},
  compareTo: new Date(Date.now() - 14 * 864e5).toISOString(),
};

addEventListener('message', (e) => {
  if (e.source !== iframe.contentWindow) return;
  const m = e.data;
  if (m && m.__csp) return state.violations.push(m.__csp);
  const reply = (body) => iframe.contentWindow.postMessage({ id: m.id, ...body }, '*');
  if (m?.type === 'getData' && manifest.data?.[m.name]) {
    mark('getData-requested');
    reply({ ok: true, data: { issues: sample } });
  } else if (m?.type === 'getContext') {
    reply({ ok: true, data: context });
  } else {
    reply({ ok: false, error: { message: 'not allowed' } });
  }
});

document.getElementById('frames').append(iframe);
mark('mounted');
// The frame has an opaque origin, so the host can't read it; the harness inspects it from outside.
setTimeout(() => {
  mark('done');
  state.done = true;
}, 4000);

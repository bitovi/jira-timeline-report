import { mountReport, sha256Hex } from './sandbox.js';
import reportHtml from '../../reports/report.html';
import attackHtml from '../../reports/attack.html';
import navHtml from '../../reports/attack-navigate.html';
import navBlobHtml from '../../reports/attack-navigate-blob.html';
import bridgeTestsHtml from '../../reports/bridge-tests.html';
import perfHtml from '../../reports/perf.html';
import { createMockJira, mockInvoke } from './mock-jira.js';

const isForge = typeof globalThis.__bridge?.callBridge === 'function';
// @forge/bridge throws at import time outside Forge, so only load it inside Forge.
const forge = isForge ? await import('@forge/bridge') : null;

let jiraCalls = 0;
const baseJira = isForge ? { request: (path, init) => forge.requestJira(path, init) } : createMockJira();
const jira = {
  request(path, init) {
    jiraCalls++;
    return baseJira.request(path, init);
  },
};
const call = isForge ? forge.invoke : mockInvoke;

const results = (window.__spikeResults = { env: isForge ? 'forge' : 'local', log: [] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const frameSrcViolations = [];
document.addEventListener('securitypolicyviolation', (e) => {
  frameSrcViolations.push({ directive: e.effectiveDirective, uri: e.blockedURI, at: Date.now() });
});

// ---------- tiny DOM helpers ----------
const h = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined) node.setAttribute(k, v);
  }
  node.append(...children.flat().filter((c) => c != null));
  return node;
};
const table = (rows, cols) =>
  h(
    'table',
    {},
    h(
      'tr',
      {},
      cols.map((c) => h('th', {}, c)),
    ),
    rows.map((r) =>
      h(
        'tr',
        {},
        cols.map((c) => h('td', {}, typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c] ?? ''))),
      ),
    ),
  );

// ---------- layout ----------
const app = document.getElementById('app');
app.textContent = '';
const who = h('span', {}, '…');
app.append(h('h1', { style: 'font-size:18px' }, `Vibe Reports Spike (${results.env}) — `, who));

const s1 = section('S1 — Nested sandbox');
const s2 = section('S2 — Bridge and allowlist');
const s4 = section('S4 — Bundle storage and hash check');

function section(title) {
  const controls = h('div');
  const output = h('div');
  const frames = h('div', { class: 'frames' });
  app.append(h('section', {}, h('h2', {}, title), controls, output, frames));
  return { controls, output, frames };
}

const logToResults = (entry) => {
  results.log.push(entry);
  renderBridgeLog();
};

// ---------- S1 ----------
function runAttack(mode) {
  return new Promise((resolve) => {
    const m = mountReport(s1.frames, attackHtml, {
      mode,
      jira,
      onLog: logToResults,
      onTestMessage(msg) {
        if (msg.kind !== 'attack-results') return;
        results[`attack_${mode}`] = msg.results;
        s1.output.append(
          h('h3', {}, `Attack suite via ${mode}: ${msg.results.filter((r) => !r.blocked).length} not blocked`),
          table(
            msg.results.map((r) => ({ ...r, blocked: r.blocked ? 'BLOCKED' : 'NOT BLOCKED' })),
            ['name', 'blocked', 'detail'],
          ),
        );
        resolve(msg.results);
      },
    });
    m.iframe.title = `attack-${mode}`;
  });
}

async function runNav(mode, variant = 'external') {
  const before = frameSrcViolations.length;
  const seen = [];
  // Raw listener: after a navigation the bridge is closed, but we still want to see what the new
  // document manages to do (it can still postMessage to its parent).
  const raw = (e) => e.data && e.data.__spikeTest && seen.push(e.data);
  window.addEventListener('message', raw);
  const m = mountReport(s1.frames, variant === 'blob' ? navBlobHtml : navHtml, { mode, jira, onLog: logToResults });
  m.iframe.title = `nav-${variant}-${mode}`;
  let loads = 0;
  m.iframe.addEventListener('load', () => loads++);
  await wait(variant === 'blob' ? 6000 : 4000);
  window.removeEventListener('message', raw);
  const rtc = seen.find((s) => s.kind === 'nav-blob-webrtc')?.result;
  const r = {
    mode,
    variant,
    stillHere: seen.some((s) => s.kind === 'nav-still-here'),
    threw: seen.find((s) => s.kind === 'nav-threw')?.message,
    hostViolations: frameSrcViolations.slice(before),
    loads,
    webrtcAfterNav: rtc,
  };
  r.blocked = (r.stillHere || r.hostViolations.length > 0) && !/srflx/.test(rtc || '');
  results[`nav_${variant}_${mode}`] = r;
  s1.output.append(
    h('p', { class: r.blocked ? 'pass' : 'fail' }, `Self-navigation (${variant}) via ${mode}: ${JSON.stringify(r)}`),
  );
  return r;
}

function renderSample(mode) {
  const m = mountReport(s1.frames, reportHtml, { mode, jira, onLog: logToResults });
  m.iframe.title = `report-${mode}`;
}

s1.controls.append(
  h('button', { id: 'attack-srcdoc', onclick: () => runAttack('srcdoc') }, 'Attack suite (srcdoc)'),
  h('button', { id: 'attack-blob', onclick: () => runAttack('blob') }, 'Attack suite (blob)'),
  h('button', { id: 'nav-external-srcdoc', onclick: () => runNav('srcdoc') }, 'Navigate to external (srcdoc)'),
  h('button', { id: 'nav-external-blob', onclick: () => runNav('blob') }, 'Navigate to external (blob)'),
  h('button', { id: 'nav-blob-srcdoc', onclick: () => runNav('srcdoc', 'blob') }, 'Navigate to own blob: (srcdoc)'),
  h('button', { id: 'nav-blob-blob', onclick: () => runNav('blob', 'blob') }, 'Navigate to own blob: (blob)'),
  h('button', { id: 'report-srcdoc', onclick: () => renderSample('srcdoc') }, 'Render sample report (srcdoc)'),
  h('button', { id: 'report-blob', onclick: () => renderSample('blob') }, 'Render sample report (blob)'),
  h('button', { id: 'clear-s1', onclick: () => (s1.frames.textContent = s1.output.textContent = '') }, 'Clear'),
);

// ---------- S2 ----------
const bridgeLog = h('div');
function renderBridgeLog() {
  bridgeLog.textContent = '';
  bridgeLog.append(
    h('h3', {}, `Host bridge log (jira calls so far: ${jiraCalls})`),
    table(results.log.slice(-40), [
      'frameId',
      'accepted',
      'reason',
      'jiraCalls',
      'count',
      'bytes',
      'jiraMs',
      'postMs',
      'jiraError',
      'msg',
    ]),
  );
}

function runBridgeTests() {
  return new Promise((resolve) => {
    const m = mountReport(s2.frames, bridgeTestsHtml, {
      jira,
      onLog: logToResults,
      onTestMessage(msg) {
        if (msg.kind !== 'bridge-results') return;
        results.bridge = msg.results;
        s2.output.append(
          h('h3', {}, 'Allowlist tests'),
          table(
            msg.results.map((r) => ({ ...r, pass: r.pass ? 'PASS' : 'FAIL' })),
            ['name', 'pass', 'detail'],
          ),
        );
        resolve(msg.results);
      },
    });
    m.iframe.title = 'bridge-tests';
  });
}

async function runSourceTests() {
  const valid = { id: 'spoof', type: 'getIssues', jql: 'created >= -3650d ORDER BY created DESC', limit: 1 };
  const msg = JSON.stringify(valid);
  // Script that, once loaded, creates a child frame which posts `valid` to its grandparent (the host).
  const nestedPoster = `<script>
    const f = document.createElement('iframe');
    f.srcdoc = '<script>parent.parent.postMessage(${msg.replace(/'/g, "\\'")}, "*")<' + '/script>';
    document.documentElement.append(f);
  </script>`;

  // A registered report whose NESTED child frame posts a valid request to the host.
  const m = mountReport(s2.frames, `<p>registered report with a nested poster</p>${nestedPoster}`, {
    jira,
    onLog: logToResults,
  });
  m.iframe.title = 'registered-with-nested';
  await wait(300);
  const before = jiraCalls;
  const logBefore = results.log.length;

  // The host window itself.
  window.postMessage(valid, '*');

  // An unregistered sandboxed frame (and its child) post the same valid request.
  const rogue = h('iframe', { sandbox: 'allow-scripts', title: 'rogue' });
  rogue.srcdoc = `<script>parent.postMessage(${msg}, '*');</script>${nestedPoster}`;
  s2.frames.append(rogue);

  await wait(2000);
  const r = {
    jiraCallsMade: jiraCalls - before,
    logEntries: results.log.length - logBefore,
  };
  r.pass = r.jiraCallsMade === 0 && r.logEntries === 0;
  results.sourceTests = r;
  s2.output.append(
    h(
      'p',
      { class: r.pass ? 'pass' : 'fail' },
      `Messages from other sources (host window, rogue frame, rogue nested frame): ${JSON.stringify(r)}`,
    ),
  );
  m.destroy();
  rogue.remove();
  return r;
}

function runPerf() {
  return new Promise((resolve) => {
    const m = mountReport(s2.frames, perfHtml, {
      jira,
      onLog: logToResults,
      onTestMessage(msg) {
        if (msg.kind !== 'perf-results') return;
        const hostRows = results.log.filter((l) => l.frameId === m.iframe.dataset.frameId && l.accepted);
        results.perf = msg.results.map((r, i) => ({ ...r, ...pick(hostRows[i], ['jiraCalls', 'jiraMs', 'postMs']) }));
        s2.output.append(
          h('h3', {}, 'Performance'),
          table(results.perf, ['limit', 'count', 'roundTripMs', 'jiraMs', 'postMs', 'jiraCalls', 'bytes', 'error']),
        );
        resolve(results.perf);
      },
    });
    m.iframe.title = 'perf';
  });
}
const pick = (o = {}, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

s2.controls.append(
  h('button', { id: 'bridge-tests', onclick: runBridgeTests }, 'Allowlist tests'),
  h('button', { id: 'source-tests', onclick: runSourceTests }, 'Other-source tests'),
  h('button', { id: 'perf', onclick: runPerf }, 'Perf 100/1000/5000'),
  h('button', { id: 'clear-s2', onclick: () => (s2.frames.textContent = s2.output.textContent = '') }, 'Clear'),
);
s2.output.after(bridgeLog);

// ---------- S4 ----------
const issueInput = h('input', { id: 'issue-key', placeholder: 'Report work item key, e.g. REP-1', size: 20 });
const status = h('span', { id: 's4-status' });
let me = { isApprover: false };

async function fetchAttachment(id) {
  const attempts = [];
  for (const path of [`/rest/api/3/attachment/content/${id}`, `/rest/api/3/attachment/content/${id}?redirect=false`]) {
    const t = performance.now();
    try {
      const res = await jira.request(path, { headers: { Accept: '*/*' } });
      const buffer = await res.arrayBuffer();
      attempts.push({
        path,
        status: res.status,
        bytes: buffer.byteLength,
        ms: Math.round(performance.now() - t),
        type: res.headers.get('content-type'),
      });
      if (res.ok) return { buffer, attempts };
    } catch (e) {
      attempts.push({ path, error: e.message, ms: Math.round(performance.now() - t) });
    }
  }
  return { buffer: null, attempts };
}

async function loadAttachments() {
  const key = issueInput.value.trim();
  s4.output.textContent = '';
  s4.frames.textContent = '';
  status.textContent = 'Loading…';
  const res = await jira.request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=attachment,description`);
  const issue = await res.json();
  if (!res.ok) {
    status.textContent = `Could not load ${key}: ${JSON.stringify(issue)}`;
    return;
  }
  const approved = await call('getApproved', { issueId: issue.id });
  const attachments = (issue.fields.attachment || [])
    .filter((a) => /\.html?$/i.test(a.filename))
    .sort((a, b) => new Date(b.created) - new Date(a.created));

  const rows = [];
  for (const a of attachments) {
    const { buffer, attempts } = await fetchAttachment(a.id);
    const sha256 = buffer ? await sha256Hex(buffer) : null;
    rows.push({
      ...a,
      buffer,
      attempts,
      sha256,
      state: sha256 && approved?.sha256 === sha256 ? 'approved' : 'pending approval',
    });
  }
  results.s4 = {
    issueId: issue.id,
    approved,
    attachments: rows.map(({ buffer, author, self, content, thumbnail, ...r }) => r),
  };
  status.textContent = `${key} (id ${issue.id}) — approved hash: ${approved?.sha256 ?? 'none'}`;

  s4.output.append(
    h(
      'table',
      {},
      h(
        'tr',
        {},
        ['id', 'filename', 'created', 'size', 'sha256', 'state', 'fetch', ''].map((c) => h('th', {}, c)),
      ),
      rows.map((r) =>
        h(
          'tr',
          { 'data-attachment': r.id },
          h('td', {}, r.id),
          h('td', {}, r.filename),
          h('td', {}, r.created),
          h('td', {}, String(r.size)),
          h('td', {}, h('code', {}, r.sha256 ?? 'fetch failed')),
          h('td', { class: r.state === 'approved' ? 'pass' : 'fail' }, r.state),
          h('td', {}, h('code', {}, JSON.stringify(r.attempts))),
          h(
            'td',
            {},
            r.state === 'approved'
              ? h('button', { class: 'run', onclick: () => runBundle(r) }, 'Run')
              : h('span', {}, 'does not run'),
            me.isApprover && r.sha256 && r.state !== 'approved'
              ? h('button', { class: 'approve', onclick: () => approve(issue.id, r) }, 'Approve')
              : null,
          ),
        ),
      ),
    ),
  );
}

// Size spike: fetch one attachment through requestJira, hash it, render it, and time each step.
window.__spikeMeasure = async (id) => {
  const out = { id };
  try {
    const t0 = performance.now();
    const res = await jira.request(`/rest/api/3/attachment/content/${id}`, { headers: { Accept: '*/*' } });
    const buffer = await res.arrayBuffer();
    const t1 = performance.now();
    Object.assign(out, { status: res.status, bytes: buffer.byteLength, fetchMs: Math.round(t1 - t0) });
    out.sha256 = await sha256Hex(buffer);
    const t2 = performance.now();
    out.hashMs = Math.round(t2 - t1);
    const html = new TextDecoder().decode(buffer);
    let m;
    const r = await new Promise((resolve) => {
      m = mountReport(s4.frames, html, {
        jira,
        onLog: logToResults,
        onTestMessage: (msg) => msg.kind === 'size-rendered' && resolve(msg),
      });
      setTimeout(() => resolve({ timeout: true }), 120000);
    });
    out.renderMs = Math.round(performance.now() - t2);
    out.reportedLength = r.length;
    out.timeout = !!r.timeout;
    m.destroy();
  } catch (e) {
    out.error = e.message;
  }
  return out;
};

function runBundle(row) {
  // Run exactly the bytes that were hashed — never re-fetch between check and run.
  s4.frames.textContent = '';
  const html = new TextDecoder().decode(row.buffer);
  const m = mountReport(s4.frames, html, { jira, onLog: logToResults });
  m.iframe.title = `bundle-${row.id}`;
}

async function approve(issueId, row) {
  await call('approve', { issueId, attachmentId: row.id, sha256: row.sha256 });
  await loadAttachments();
}

async function upload(html, filename) {
  const key = issueInput.value.trim();
  const form = new FormData();
  form.append('file', new File([html], filename, { type: 'text/html' }));
  const res = await jira.request(`/rest/api/3/issue/${encodeURIComponent(key)}/attachments`, {
    method: 'POST',
    headers: { 'X-Atlassian-Token': 'no-check' },
    body: form,
  });
  status.textContent = `Upload ${filename}: ${res.status}`;
  await loadAttachments();
}

s4.controls.append(
  issueInput,
  h('button', { id: 'load', onclick: loadAttachments }, 'Load attachments'),
  h('button', { id: 'upload-sample', onclick: () => upload(reportHtml, 'report.html') }, 'Upload sample report.html'),
  h(
    'button',
    {
      id: 'upload-modified',
      onclick: () =>
        upload(reportHtml.replace('Issues by status', `Issues by status (modified ${Date.now()})`), 'report.html'),
    },
    'Upload modified report.html',
  ),
  h(
    'button',
    { id: 'revoke', onclick: async () => (await call('revoke', { issueId: results.s4?.issueId }), loadAttachments()) },
    'Revoke approval',
  ),
  h('div', {}, status),
);

call('whoami')
  .then((w) => {
    me = w;
    results.whoami = w;
    who.textContent = `${w.accountId} ${w.isApprover ? '(approver)' : '(not approver)'}`;
  })
  .catch((e) => (who.textContent = 'whoami failed: ' + e.message));

renderBridgeLog();

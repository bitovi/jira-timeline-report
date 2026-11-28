// Stands in for the hosted web app: holds the Jira tokens (as src/jira-oidc-helpers/storage.ts does)
// and answers the bridge. Report code reaches it only through the loader's relay.
import { validateRequest, getIssues } from './sandbox.js';
import { createMockJira } from './mock-jira.js';

const SANDBOX_ORIGIN = 'http://127.0.0.1:4471';
localStorage.setItem('accessToken', 'SECRET-ACCESS-TOKEN');
localStorage.setItem('refreshToken', 'SECRET-REFRESH-TOKEN');
document.cookie = 'session=SECRET-COOKIE';

const jira = createMockJira();
let jiraCalls = 0;
const countingJira = { request: (p, i) => (jiraCalls++, jira.request(p, i)) };

/** Mounts `html` through a fresh loader; resolves with everything observed after `waitMs`. */
window.__mount = (name, waitMs) =>
  new Promise(async (resolve) => {
    const html = await fetch(`./reports/${name}`).then((r) => r.text());
    const seen = { tests: [], loaderViolations: [], bridge: [], jiraCallsBefore: jiraCalls };
    const loader = document.createElement('iframe');
    loader.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    loader.style.cssText = 'width:700px;height:420px;border:1px solid #ccc';
    loader.title = name;
    loader.src = `${SANDBOX_ORIGIN}/loader.html`;

    async function onMessage(event) {
      if (event.source !== loader.contentWindow || event.origin !== SANDBOX_ORIGIN) return;
      const m = event.data;
      if (m.loaderReady) return loader.contentWindow.postMessage({ type: 'mount', html }, SANDBOX_ORIGIN);
      if (m.loaderViolation) return seen.loaderViolations.push(m.loaderViolation);
      if (!('relay' in m)) return;
      const req = m.relay;
      if (req && req.__spikeTest) return seen.tests.push(req);
      if (!m.alive) return seen.bridge.push({ refused: 'report navigated' });
      const toReport = (reply) => loader.contentWindow.postMessage({ toReport: reply }, SANDBOX_ORIGIN);
      const error = validateRequest(req);
      const id = req && (typeof req.id === 'string' || typeof req.id === 'number') ? req.id : null;
      if (error) {
        seen.bridge.push({ rejected: error });
        return toReport({ id, ok: false, error: { message: error } });
      }
      try {
        const { issues } = await getIssues(countingJira, req);
        seen.bridge.push({ answered: issues.length });
        toReport({ id, ok: true, data: { issues } });
      } catch (e) {
        seen.bridge.push({ jiraError: e.message });
        toReport({ id, ok: false, error: { message: e.message, status: e.status } });
      }
    }
    addEventListener('message', onMessage);
    document.getElementById('frames').append(loader);
    setTimeout(() => {
      removeEventListener('message', onMessage);
      seen.jiraCalls = jiraCalls - seen.jiraCallsBefore;
      resolve(seen);
    }, waitMs);
  });

window.__ready = true;

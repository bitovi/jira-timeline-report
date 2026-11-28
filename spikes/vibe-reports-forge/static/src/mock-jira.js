// Local-only stand-in for requestJira + resolver, so the sandbox can be tested in plain Chromium.
const TOTAL = 6000;
const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
const attachments = [];
const approved = new Map();
let nextAttachmentId = 10000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function createMockJira() {
  return {
    async request(path, init = {}) {
      const url = new URL(path, 'https://mock.invalid');
      if (url.pathname === '/rest/api/3/search/jql') {
        const body = JSON.parse(init.body);
        if (/=\s*=/.test(body.jql)) return json({ errorMessages: ["Error in the JQL Query: '=' unexpected."] }, 400);
        const start = Number(body.nextPageToken || 0);
        const end = Math.min(TOTAL, start + body.maxResults);
        const issues = [];
        for (let i = start; i < end; i++) {
          issues.push({
            id: String(i + 1),
            key: `MOCK-${i + 1}`,
            fields: { summary: `Mock issue ${i + 1}`, status: { name: STATUSES[i % STATUSES.length] } },
          });
        }
        return json({ issues, isLast: end >= TOTAL, nextPageToken: end >= TOTAL ? undefined : String(end) });
      }
      let m = url.pathname.match(/^\/rest\/api\/3\/issue\/([^/]+)$/);
      if (m) {
        return json({
          id: '424242',
          key: decodeURIComponent(m[1]),
          fields: { description: null, attachment: attachments.map(({ bytes, ...a }) => a) },
        });
      }
      m = url.pathname.match(/^\/rest\/api\/3\/issue\/([^/]+)\/attachments$/);
      if (m && init.method === 'POST') {
        const file = init.body.get('file');
        const a = {
          id: String(nextAttachmentId++),
          filename: file.name,
          created: new Date().toISOString(),
          size: file.size,
          mimeType: file.type,
          bytes: await file.arrayBuffer(),
        };
        attachments.push(a);
        return json([a]);
      }
      m = url.pathname.match(/^\/rest\/api\/3\/attachment\/content\/(\d+)$/);
      if (m) {
        const a = attachments.find((x) => x.id === m[1]);
        return a ? new Response(a.bytes, { headers: { 'content-type': 'text/html' } }) : json({}, 404);
      }
      return json({ errorMessages: ['mock: not found ' + path] }, 404);
    },
  };
}

export async function mockInvoke(fn, payload) {
  switch (fn) {
    case 'whoami':
      return { accountId: 'local-user', isApprover: true };
    case 'getApproved':
      return approved.get(payload.issueId) ?? null;
    case 'approve':
      approved.set(payload.issueId, { ...payload, approvedBy: 'local-user', approvedAt: new Date().toISOString() });
      return approved.get(payload.issueId);
    case 'revoke':
      approved.delete(payload.issueId);
      return null;
  }
  throw new Error('unknown resolver function ' + fn);
}

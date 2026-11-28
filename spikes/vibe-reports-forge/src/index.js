import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();

const SHA256 = /^[0-9a-f]{64}$/;
const ISSUE_ID = /^\d+$/;
const ATTACHMENT_ID = /^\d+$/;

// Spike-only approval policy: a comma-separated list of account IDs in a Forge variable.
// `forge variables set -e development APPROVER_ACCOUNT_IDS <id>[,<id>]`
function approvers() {
  return (process.env.APPROVER_ACCOUNT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

resolver.define('whoami', ({ context }) => ({
  accountId: context.accountId,
  isApprover: approvers().includes(context.accountId),
}));

resolver.define('getApproved', async ({ payload }) => {
  if (!ISSUE_ID.test(String(payload?.issueId))) throw new Error('issueId must be a numeric string');
  return (await kvs.get(`approved:${payload.issueId}`)) ?? null;
});

resolver.define('approve', async ({ payload, context }) => {
  if (!approvers().includes(context.accountId)) throw new Error('Not an approver');
  const { issueId, attachmentId, sha256 } = payload ?? {};
  if (!ISSUE_ID.test(String(issueId))) throw new Error('issueId must be a numeric string');
  if (!ATTACHMENT_ID.test(String(attachmentId))) throw new Error('attachmentId must be a numeric string');
  if (!SHA256.test(String(sha256))) throw new Error('sha256 must be 64 lowercase hex chars');
  const record = {
    attachmentId: String(attachmentId),
    sha256,
    approvedBy: context.accountId,
    approvedAt: new Date().toISOString(),
  };
  await kvs.set(`approved:${issueId}`, record);
  return record;
});

resolver.define('revoke', async ({ payload, context }) => {
  if (!approvers().includes(context.accountId)) throw new Error('Not an approver');
  if (!ISSUE_ID.test(String(payload?.issueId))) throw new Error('issueId must be a numeric string');
  await kvs.delete(`approved:${payload.issueId}`);
  return null;
});

export const handler = resolver.getDefinitions();

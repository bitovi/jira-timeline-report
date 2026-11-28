// `npm run dev` only: a mock runtime backed by the app's logged-out sample data, so a report can be
// previewed with no Jira, no bridge and no publishing.
import { normalizeIssue } from '../../../src/jira/normalized/normalize';
import { deriveIssue } from '../../../src/jira/derived/derive';
import { rollupAndRollback } from '../../../src/jira/rolledup-and-rolledback/rollup-and-rollback';
import { MOCK_CONTEXT } from './mock-context';
import type { ReportSDKRuntime } from './index';

const runtime: ReportSDKRuntime = {
  version: '1-dev',
  getData: async () => ({ issues: (await import('../../../src/examples/bitovi-training.json')).default as never }),
  getContext: async () => MOCK_CONTEXT,
  normalizeIssue,
  deriveIssue,
  rollupAndRollback,
};
(globalThis as { ReportSDK?: ReportSDKRuntime }).ReportSDK = runtime;

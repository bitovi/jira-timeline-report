// The runtime the HOST injects into the report frame (manifest `sdk.provide: "host"`). Built to an
// IIFE by build-runtime.mjs. Pipeline code runs here, inside the sandbox; only the data request goes
// through the bridge.
import { normalizeIssue } from '../../../src/jira/normalized/normalize';
import { deriveIssue } from '../../../src/jira/derived/derive';
import { rollupAndRollback } from '../../../src/jira/rolledup-and-rolledback/rollup-and-rollback';
import type { ReportSDKRuntime } from './index';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
const pending = new Map<string, Pending>();
let next = 0;

addEventListener('message', (e: MessageEvent) => {
  if (e.source !== parent) return;
  const p = pending.get(e.data?.id);
  if (!p) return;
  pending.delete(e.data.id);
  if (e.data.ok) p.resolve(e.data.data);
  else p.reject(new Error(e.data.error?.message ?? 'bridge error'));
});

function call<T>(msg: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `sdk${++next}`;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    parent.postMessage({ id, ...msg }, '*');
  });
}

const runtime: ReportSDKRuntime = {
  version: '1',
  getData: (name) => call({ type: 'getData', name }),
  getContext: () => call({ type: 'getContext' }),
  normalizeIssue,
  deriveIssue,
  rollupAndRollback,
};
(globalThis as { ReportSDK?: ReportSDKRuntime }).ReportSDK = runtime;

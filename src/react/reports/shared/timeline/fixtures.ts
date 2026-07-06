/**
 * Minimal mock issues for shared timeline helper/component tests and stories.
 */
import type { IssueOrRelease } from './types';

interface MakeIssueOptions {
  key: string;
  summary?: string;
  status?: string;
  due?: Date | null;
  start?: Date | null;
  team?: { name: string } | null;
  parentKey?: string | null;
  projectKey?: string;
  rank?: string | null;
}

/** Build a minimal issue/release with the fields shared timeline helpers/components read. */
export const makeIssue = ({
  key,
  summary = key,
  status = 'ontrack',
  due = null,
  start = null,
  team = null,
  parentKey = null,
  projectKey = undefined,
  rank = null,
}: MakeIssueOptions): IssueOrRelease => ({
  key,
  summary,
  rollupStatuses: { rollup: { status, due, start } },
  team,
  parentKey,
  projectKey,
  rank,
});

import { describe, it, expect } from 'vitest';
import { normalizeIssue } from './normalize';
import type { JiraIssue } from '../shared/types';

const baseFields = {
  Summary: 'A title',
  'Issue Type': { hierarchyLevel: 1, name: 'Epic' },
  Status: { name: 'To Do', statusCategory: { name: 'To Do' } },
} as unknown as JiraIssue['fields'];

const makeIssue = (fields: Partial<JiraIssue['fields']>): JiraIssue =>
  ({ key: 'X-1', fields: { ...baseFields, ...fields } }) as unknown as JiraIssue;

describe('normalizeIssue statusSummary', () => {
  it('defaults to null when no getStatusSummary is configured', () => {
    expect(normalizeIssue(makeIssue({})).statusSummary).toBeNull();
  });

  it('uses the configured getStatusSummary extractor', () => {
    const issue = makeIssue({ 'Status Summary': 'On track for Q3' } as Partial<JiraIssue['fields']>);
    const normalized = normalizeIssue(issue, {
      getStatusSummary: (i) => (i.fields as Record<string, unknown>)['Status Summary'] ?? null,
    });
    expect(normalized.statusSummary).toBe('On track for Q3');
  });
});

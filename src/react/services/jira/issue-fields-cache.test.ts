import type { UseJiraIssueFields } from './useJiraIssueFields';

import { describe, test, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { jiraKeys } from './key-factory';
import { readCachedIssueFields } from './useJiraIssueFields';

type IssueFields = ReturnType<UseJiraIssueFields>;

const fields = [{ name: 'Start date', id: 'customfield_10325' }] as unknown as IssueFields;

describe('readCachedIssueFields', () => {
  // The regression: `useJiraIssueFields` keys on `issueFields(mode)`, but the save hook used to read
  // `getQueryData(allIssueFields())`. `getQueryData` matches EXACTLY, so it always missed — the save
  // then reported "no jira fields", pushed an empty config, and wedged the report. spec/015.
  test('the prefix key does not exact-match the real key', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(jiraKeys.issueFields('auth'), fields);

    expect(queryClient.getQueryData(jiraKeys.allIssueFields())).toBeUndefined();
  });

  test('finds the catalog cached under the authenticated mode', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(jiraKeys.issueFields('auth'), fields);

    expect(readCachedIssueFields(queryClient)).toEqual(fields);
  });

  test('finds the catalog cached under the sample mode', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(jiraKeys.issueFields('sample'), fields);

    expect(readCachedIssueFields(queryClient)).toEqual(fields);
  });

  test('returns undefined when nothing is cached', () => {
    expect(readCachedIssueFields(new QueryClient())).toBeUndefined();
  });

  test('skips an empty cached catalog in favour of a populated one', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(jiraKeys.issueFields('sample'), [] as unknown as IssueFields);
    queryClient.setQueryData(jiraKeys.issueFields('auth'), fields);

    expect(readCachedIssueFields(queryClient)).toEqual(fields);
  });
});

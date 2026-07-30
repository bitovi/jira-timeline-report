import type { ResolvedField, JiraFieldLike } from '../model/resolveField';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useJira, useJiraIssueFields, jiraKeys } from '../../../services/jira';
import { parseExpression, isExpressionError } from '../model/expression';
import { resolveField, isFieldError } from '../model/resolveField';

export type InlineExpressionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; value: unknown; field: ResolvedField };

/** The shape `fetchJiraIssuesWithJQLWithNamedFields` returns: fields keyed by display name. */
interface NamedFieldIssue {
  key?: string;
  fields: Record<string, unknown>;
}

/**
 * Resolves one inline-value expression to a single field value.
 *
 * The expression decomposes into the arguments of a call the app already makes — `{ jql, fields }` —
 * so the whole hook is parse → resolve the field → search. See
 * spec/016-report-of-reports/003-self-reports Phase 3.
 *
 * `useQuery`, deliberately not `useSuspenseQuery`: a bad expression has to fail in place with a
 * message beside it, not suspend and blank the document around it.
 */
export const useInlineExpression = (expression: string): InlineExpressionState => {
  const jira = useJira();
  const fields = useJiraIssueFields() as unknown as JiraFieldLike[];

  const parsed = useMemo(() => parseExpression(expression), [expression]);
  const field = useMemo(
    () => (isExpressionError(parsed) ? undefined : resolveField(parsed.field, fields)),
    [parsed, fields],
  );

  const jql = isExpressionError(parsed) ? null : parsed.jql;
  const resolved = field && !isFieldError(field) ? field : null;

  const { data, error, isPending } = useQuery({
    queryKey: jiraKeys.inlineExpression(jql ?? '', resolved?.id ?? ''),
    // Request by **id**, not display name: `nameMap` collapses two identically-named fields onto one
    // id, so passing the name would silently resolve to the wrong one of the pair.
    queryFn: () =>
      jira.fetchJiraIssuesWithJQLWithNamedFields({
        jql: jql as string,
        fields: [(resolved as ResolvedField).id],
        // Two rows is all it takes to tell "exactly one" from "more than one".
        maxResults: 2,
      }) as Promise<NamedFieldIssue[]>,
    enabled: jql !== null && resolved !== null,
  });

  if (isExpressionError(parsed)) {
    return { status: 'error', message: parsed.error };
  }

  if (field && isFieldError(field)) {
    return { status: 'error', message: field.error };
  }

  if (error) {
    return { status: 'error', message: `Jira rejected this query: ${error.message}` };
  }

  // Both error branches above have returned by here, so `resolved` is set — the guard is what tells
  // TypeScript that, and it doubles as the disabled-query case.
  if (!resolved || isPending || !data) {
    return { status: 'loading' };
  }

  if (data.length === 0) {
    return { status: 'error', message: 'No work item matched.' };
  }

  if (data.length > 1) {
    // The `/search/jql` endpoint reports no total, and `maxResults: 2` caps what we asked for, so the
    // honest message is "more than one" — not a count we don't have.
    return { status: 'error', message: 'More than one work item matched — narrow the query.' };
  }

  const issueFields = data[0].fields ?? {};
  // `mapIdsToNames` keys the response by display name, but keeps the raw id key for fields whose name
  // collides with another's — hence the fallback.
  const value = resolved.name in issueFields ? issueFields[resolved.name] : issueFields[resolved.id];

  return { status: 'ok', value, field: resolved };
};

import type { FC, ReactNode } from 'react';
import type { InlineExpressionState } from '../hooks/useInlineExpression';

import React from 'react';

import { formatFieldValue } from '../model/formatFieldValue';
import { LATEST_COMMENT_ACCESSOR, STATUS_UPDATE_ACCESSOR } from '../model/accessors';

export interface InlineValueProps {
  /** The stored expression. Named in error states so the document stays diagnosable. */
  expression: string;
  /** Everything already resolved — see `useInlineExpression`. */
  state: InlineExpressionState;
}

/**
 * One live Jira field value in a document. Pure and prop-driven — the resolved state arrives as a
 * prop, so this stories and unit-tests with no Jira behind it.
 * See spec/016-report-of-reports/003-self-reports Phase 4.
 *
 * It renders the label of a row and nothing else: the row itself, and the controls on it, belong to
 * `NodeRow`. The row carries the field's name beside its value, because a document holding three bare
 * strings gives a reader no way to tell what any of them is.
 *
 * **Read-only.** Both halves of a value — the work item and the field — are chosen in the Add Report
 * modal, which validates them; a raw expression field here would be a second, worse authoring path for
 * the same node, and it is what forced the stored expression to be readable rather than merely correct.
 * A wrong node is deleted and re-added.
 * See spec/016-report-of-reports/009-value-report-modal § The node stops being editable.
 */
export const InlineValue: FC<InlineValueProps> = ({ expression, state }) => {
  if (!expression.trim()) {
    // Nothing to say. A blank value renders as an empty row rather than instructions — the height keeps
    // the row hoverable so its delete control stays reachable, since a zero-height row would be an
    // undeletable one. Unreachable from the modal, which won't add without both halves; it only arises
    // in a hand-edited or previously-saved document.
    return <p className="min-h-5 min-w-0 grow" />;
  }

  if (state.status === 'loading') {
    return <p className="min-w-0 grow text-slate-500">Loading…</p>;
  }

  if (state.status === 'error') {
    return <Problem expression={expression}>{state.message}</Problem>;
  }

  const text = formatFieldValue(state.value, state.field.schema);

  if (text === null) {
    // `.comment` resolves — it's a real Jira field — and then dead-ends here, because a page of
    // comments is not a value. Rather than leave that as a dead end, point at the accessors that do
    // what someone typing `.comment` almost certainly wanted. It is the only signpost to the
    // pseudo-accessors, which by definition can't be found in Jira's field list — and it names both,
    // because which one they meant depends on what they're writing.
    // See spec/016-report-of-reports/007-latest-comment-report Phase 4 and spec/027-status-updates.
    return (
      <Problem expression={expression}>
        {state.field.id === 'comment'
          ? `Comments can't show as a value — use .${LATEST_COMMENT_ACCESSOR} for the newest one, ` +
            `or .${STATUS_UPDATE_ACCESSOR} for this week's update.`
          : `"${state.field.name}" holds a ${state.field.schema.type ?? 'value'} this can't show as text yet.`}
      </Problem>
    );
  }

  // A value row sits below sections and reports in the type hierarchy, so the label stays light and
  // the value itself is what carries weight — a small neutral pill rather than bold text.
  return (
    <p data-testid="inline-value" className="flex min-w-0 grow items-baseline gap-2 text-sm">
      <span className="shrink-0 text-slate-500">{state.field.name}</span>
      <span className="truncate rounded bg-neutral-201 px-1.5 py-0.5 text-neutral-800">{text || '—'}</span>
    </p>
  );
};

/**
 * A value that couldn't resolve. It states the problem and shows the expression that caused it, so the
 * document stays diagnosable — the same choice `MissingReportNote` makes for a deleted report.
 */
const Problem: FC<{ expression: string; children: ReactNode }> = ({ expression, children }) => (
  <p data-testid="inline-value-error" className="min-w-0 grow text-slate-500">
    <span>{children}</span> <code className="font-mono text-sm">{expression}</code>
  </p>
);

export default InlineValue;

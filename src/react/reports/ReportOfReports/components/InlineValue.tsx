import type { FC, ReactNode } from 'react';
import type { InlineExpressionState } from '../hooks/useInlineExpression';

import React from 'react';

import { AdfDocument, WikiAdfDocument } from '../../../components/AdfDocument';
import { classifyFieldValue } from '../model/formatFieldValue';
import { LATEST_COMMENT_ACCESSOR, STATUS_UPDATE_ACCESSOR } from '../model/accessors';
import { reportTitleClassName, reportTitleColorClassName } from './NodeRow';
import { RICH_TEXT_BODY_CLASSNAME, RICH_TEXT_PROSE_CLASSNAME, RICH_TEXT_TABLE_STYLES } from './richTextStyles';

export interface InlineValueProps {
  /** The stored expression. Named in error states so the document stays diagnosable. */
  expression: string;
  /** Everything already resolved — see `useInlineExpression`. */
  state: InlineExpressionState;
  /** `path.length` — the field name plays the same "row title" role every other report row's does. */
  depth?: number;
  /** Whether the row this belongs to is hovered — darkens the field name, the row-scope hover signal. */
  isRowHovered?: boolean;
}

/**
 * One live Jira field value in a document. Pure and prop-driven — the resolved state arrives as a
 * prop, so this stories and unit-tests with no Jira behind it.
 * See spec/016-report-of-reports/003-self-reports Phase 4.
 *
 * For a plain value it renders the label of a row and nothing else: the row itself, and the controls on
 * it, belong to `NodeRow`. The row carries the field's name beside its value, because a document holding
 * three bare strings gives a reader no way to tell what any of them is.
 *
 * **Rich content (ADF/wiki markup) is the one case that doesn't fit that shape** — it renders only the
 * content block, with no title of its own. `InlineValueView` (`ReportOfReports.tsx`) is what notices a
 * value classifies as rich and switches the surrounding layout to match: a one-line title inside
 * `NodeRow`, this block as a sibling beneath it. See spec/030-inline-custom-field-report.
 *
 * **Read-only.** Both halves of a value — the work item and the field — are chosen in the Add Report
 * modal, which validates them; a raw expression field here would be a second, worse authoring path for
 * the same node, and it is what forced the stored expression to be readable rather than merely correct.
 * A wrong node is deleted and re-added.
 * See spec/016-report-of-reports/009-value-report-modal § The node stops being editable.
 */
export const InlineValue: FC<InlineValueProps> = ({ expression, state, depth = 1, isRowHovered }) => {
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

  const display = classifyFieldValue(state.value, state.field.schema);

  if (display.kind === 'unsupported') {
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

  if (display.kind === 'adf' || display.kind === 'wiki') {
    // Rich content — a heading, list, or table — can't fit a single-line truncated pill. Unlike the pill
    // below, this doesn't carry its own row title: the caller (`InlineValueView`) switches to the
    // row-plus-block layout `CommentRow`/`CommentBody` established for Latest Comment/Status Update,
    // putting a one-line title in `NodeRow` itself and rendering this block beneath it, at the same
    // indent, exactly like `CommentBody` does.
    // See spec/030-inline-custom-field-report § InlineValue: row + block for rich content.
    return (
      <div data-testid="inline-value" className={RICH_TEXT_BODY_CLASSNAME}>
        <style>{RICH_TEXT_TABLE_STYLES}</style>
        {display.kind === 'adf' ? (
          <AdfDocument document={display.document} fallbackClassName={RICH_TEXT_PROSE_CLASSNAME} />
        ) : (
          <WikiAdfDocument markup={display.markup} fallbackClassName={RICH_TEXT_PROSE_CLASSNAME} />
        )}
      </div>
    );
  }

  const text = display.kind === 'text' ? display.text : '';

  // A value row sits below sections and reports in the type hierarchy, so the label stays light and
  // the value itself is what carries weight — a small neutral pill rather than bold text. The label
  // uses the same report-title scale every other row-owning node's title does.
  return (
    <p data-testid="inline-value" className="flex min-w-0 grow items-baseline gap-2">
      <span className={`shrink-0 ${reportTitleClassName(depth)} ${reportTitleColorClassName(isRowHovered)}`}>
        {state.field.name}
      </span>
      <span className="truncate rounded bg-neutral-201 px-1.5 py-0.5 text-sm text-neutral-800">{text || '—'}</span>
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

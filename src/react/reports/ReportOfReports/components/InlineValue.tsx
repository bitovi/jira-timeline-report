import type { FC, ReactNode } from 'react';
import type { InlineExpressionState } from '../hooks/useInlineExpression';

import React from 'react';
import InlineEdit from '@atlaskit/inline-edit';
import Textfield from '@atlaskit/textfield';

import { formatFieldValue } from '../model/formatFieldValue';

export const EXPRESSION_PLACEHOLDER = '(issue = ABC-1).summary';

export interface InlineValueProps {
  /** The source text the user typed. Shown while editing, and named in error states. */
  expression: string;
  /** Everything already resolved — see `useInlineExpression`. */
  state: InlineExpressionState;
  isEditing: boolean;
  onEdit: () => void;
  onConfirm: (expression: string) => void;
  onCancel: () => void;
}

/**
 * One live Jira field value in a document. Pure and prop-driven — the resolved state arrives as a
 * prop, so this stories and unit-tests with no Jira behind it.
 * See spec/016-report-of-reports/003-self-reports Phase 4.
 *
 * It renders the label of a row and nothing else: the row itself, and the controls on it, belong to
 * `NodeRow`. The read view carries the field's name beside its value, because a document holding
 * three bare strings gives a reader no way to tell what any of them is.
 */
export const InlineValue: FC<InlineValueProps> = ({ expression, state, isEditing, onEdit, onConfirm, onCancel }) => (
  // InlineEdit's internal styles can't be reached through props; this drops its outer margin, and
  // makes the resting hit area read as editable text rather than as a button.
  <div className="[&>form>div]:!m-0 [&_button]:!cursor-text min-w-0 grow">
    <InlineEdit
      isEditing={isEditing}
      onEdit={onEdit}
      defaultValue={expression}
      onConfirm={onConfirm}
      onCancel={onCancel}
      editButtonLabel={expression || 'inline value'}
      editView={({ errorMessage, ...fieldProps }) => (
        <Textfield
          {...fieldProps}
          autoFocus
          autoComplete="new-password"
          placeholder={EXPRESSION_PLACEHOLDER}
          className="[&>input]:!font-mono [&>input]:!text-sm"
        />
      )}
      readView={() => <ReadView expression={expression} state={state} />}
    />
  </div>
);

const ReadView: FC<Pick<InlineValueProps, 'expression' | 'state'>> = ({ expression, state }) => {
  if (!expression.trim()) {
    return <p className="text-slate-500 italic">{`Write an expression — for example ${EXPRESSION_PLACEHOLDER}`}</p>;
  }

  if (state.status === 'loading') {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (state.status === 'error') {
    return <Problem expression={expression}>{state.message}</Problem>;
  }

  const text = formatFieldValue(state.value, state.field.schema);

  if (text === null) {
    return (
      <Problem expression={expression}>
        {`"${state.field.name}" holds a ${state.field.schema.type ?? 'value'} this can't show as text yet.`}
      </Problem>
    );
  }

  // A value row sits below sections and reports in the type hierarchy, so the label stays light and
  // the value itself is what carries weight — a small neutral pill rather than bold text.
  return (
    <p data-testid="inline-value" className="flex items-baseline gap-2 text-sm">
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
  <p data-testid="inline-value-error" className="text-slate-500">
    <span>{children}</span> <code className="font-mono text-sm">{expression}</code>
  </p>
);

export default InlineValue;

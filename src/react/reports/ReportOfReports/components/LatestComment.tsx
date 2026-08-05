import type { FC, ReactNode } from 'react';
import type { LatestCommentState } from '../hooks/useLatestComment';

import React from 'react';
import InlineEdit from '@atlaskit/inline-edit';
import Textfield from '@atlaskit/textfield';

import { AdfDocument } from '../../../components/AdfDocument';
import { LATEST_COMMENT_ACCESSOR } from '../model/accessors';

export const KEY_PLACEHOLDER = 'ABC-1';
export const EXPRESSION_PLACEHOLDER = `(issue = ABC-1).${LATEST_COMMENT_ACCESSOR}`;

/**
 * What the row's one editable field holds.
 *
 * `key` is the shape the Add button writes and what practically every comment node is: the JQL is a
 * single equality, so the user edits a work item key and never sees the expression. `expression` is
 * the escape hatch for a hand-written query — a key field cannot represent `project = A AND …`, so
 * the whole expression is edited instead, the way an ordinary inline value is.
 */
export type TargetKind = 'key' | 'expression';

export interface LatestCommentProps {
  /** The work item key, or the whole expression when {@link targetKind} is `expression`. */
  target: string;
  targetKind: TargetKind;
  // No `state`: the row is the key, and every fetched thing — author, comment, timestamp — is
  // `LatestCommentBody`'s. The row used to take one and never read it.
  isEditing: boolean;
  onEdit: () => void;
  /** Receives the raw field text; the container turns it back into an expression. */
  onConfirm: (target: string) => void;
  onCancel: () => void;
}

// Local time, deliberately: a comment's timestamp is read by a person wondering how recent it is, and
// 'en-CA' keeps the date half at the YYYY-MM-DD convention the rest of the app uses for Jira data.
const timestampFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const formatCommentTime = (timestamp: string): string => {
  const time = Date.parse(timestamp);

  // An unparseable timestamp shows Jira's own string rather than "Invalid Date" — it is at least the
  // truth about what came back.
  return Number.isNaN(time) ? timestamp : timestampFormatter.format(new Date(time));
};

/**
 * The newest comment on one work item, in a document.
 *
 * Pure and prop-driven — the fetched state arrives as a prop, so every branch stories and unit-tests
 * with no Jira behind it. The split `InlineValue` established.
 *
 * Structurally a report rather than a value: **the row is the work item key and nothing else**, then the
 * comment beneath it at the same indent. The caret, the controls, and the collapse belong to the
 * container, which is why this renders the key and the body and nothing else.
 *
 * **There is no "Latest comment" label.** It was a muted prefix on the row, which spent the node's
 * heading on saying what kind of node it is, and read as chrome above content that already announces
 * itself — an author, a comment, a timestamp. So the key gets the row and the `text-base font-semibold`
 * every other row-owning node uses (`ReportOfReports.tsx:369`), and the node reads as *the work item*
 * with its latest comment under it.
 *
 * **What that costs, stated plainly:** collapsed, the node is a bare `▸ ABC-1` and nothing says it is a
 * comment. That is the same trade a collapsed report card makes — its row is `▸ Alpha` — and the
 * accessible names follow the same convention (`ABC-1, edit`, like `Alpha, edit`), so the node is
 * consistent with its neighbours rather than self-describing.
 *
 * It's content, not chrome, so nothing here is `print-hidden`.
 * See spec/016-report-of-reports/007-latest-comment-report § The row is the key.
 */
export const LatestComment: FC<LatestCommentProps> = ({
  target,
  targetKind,
  isEditing,
  onEdit,
  onConfirm,
  onCancel,
}) => (
  // InlineEdit's internal styles can't be reached through props; this drops its outer margin, and makes
  // the resting hit area read as editable text rather than as a button.
  //
  // `grow` only while editing, copied from `SectionTitle` and for its reason: the field wants the width
  // of the row, but at rest the hit area has to end where the key ends. A full-width one would swallow
  // clicks on the rest of the row — which is what pins it — turning "click the row" into "retarget the
  // comment".
  <div className={`[&>form>div]:!m-0 [&_button]:!cursor-text min-w-0 ${isEditing ? 'grow' : ''}`}>
    <InlineEdit
      isEditing={isEditing}
      onEdit={onEdit}
      defaultValue={target}
      onConfirm={onConfirm}
      onCancel={onCancel}
      editButtonLabel={target || 'latest comment'}
      editView={({ errorMessage, ...fieldProps }) => (
        <Textfield
          {...fieldProps}
          autoFocus
          autoComplete="new-password"
          placeholder={targetKind === 'key' ? KEY_PLACEHOLDER : EXPRESSION_PLACEHOLDER}
          className={targetKind === 'key' ? '' : '[&>input]:!font-mono [&>input]:!text-sm'}
        />
      )}
      // An untargeted node shows the placeholder key in the muted italic `SectionTitle` gives an
      // untitled section, so "not filled in yet" doesn't read as "a work item called ABC-1".
      readView={() => (
        <h3
          className={`truncate text-base font-semibold ${target ? '' : 'font-normal italic text-slate-500'} ${
            targetKind === 'key' ? '' : 'font-mono text-sm'
          }`}
        >
          {target || KEY_PLACEHOLDER}
        </h3>
      )}
    />
  </div>
);

export interface LatestCommentBodyProps {
  /** `''` while nothing is targeted yet — checked before `state`, which can't tell that from loading. */
  target: string;
  state: LatestCommentState;
}

/**
 * The comment itself, rendered beneath the row at the same indent.
 *
 * Separate from the row because the container has to be able to collapse this and not that, and
 * because the row is a label while this is a block of content.
 *
 * **The blank target is checked here, not in the hook.** A disabled `useQuery` reports `isPending`,
 * so "nothing typed yet" and "loading" are indistinguishable from the state alone — exactly the check
 * `InlineValue`'s read view makes before consulting its own state.
 */
export const LatestCommentBody: FC<LatestCommentBodyProps> = ({ target, state }) => {
  if (!target.trim()) {
    return <Note>{`Enter a work item key — for example ${KEY_PLACEHOLDER}.`}</Note>;
  }

  if (state.status === 'loading') {
    return <Note>Loading…</Note>;
  }

  if (state.status === 'error') {
    return (
      <Note testId="latest-comment-error">
        <span>{state.message}</span> <code className="font-mono text-sm">{target}</code>
      </Note>
    );
  }

  if (state.status === 'empty') {
    // "No updates found.", matching the `Add Work Item Update` button rather than naming the Jira object
    // behind it — the reader never sees the word "comment" anywhere in this node.
    return <Note>No updates found.</Note>;
  }

  if (isEmptyDocument(state.body)) {
    return <Note>This comment has no content.</Note>;
  }

  // **The comment first, its provenance after.** Who wrote it and when are attribution, not the point —
  // so they sit under the text as one muted two-line footer rather than as a byline above it. The reader
  // arrives at the comment immediately and finds out whose and how stale it is on the way out.
  return (
    <div data-testid="latest-comment" className="flex flex-col gap-1">
      {/* The body goes to `AdfDocument` whole, rather than through the local walker first: a comment
          that is only a table or only an emoji produces no walker blocks but is not empty, and gating
          on the walker's output would have hidden exactly the content the real renderer was added for. */}
      <AdfDocument
        document={state.body}
        fallbackClassName="prose prose-sm prose-neutral max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0"
      />
      <div className="text-xs text-slate-500">
        {/* One template string per line, not `Updated by: {author}` — a split text node would make the
            line unfindable by its own text, which is how these are asserted and how a reader reads it. */}
        <p className="truncate">{`Updated by: ${state.author}`}</p>
        {/* Absent rather than blank when Jira sends no timestamp: "Last updated:" with nothing after it
            is worse than no line. */}
        {state.updated ? <p>{`Last updated: ${formatCommentTime(state.updated)}`}</p> : null}
      </div>
    </div>
  );
};

/**
 * A document with nothing in it at all — not "nothing this renderer handles". Jira can return one for a
 * comment whose content was removed, and an author line over an empty box reads as a bug.
 */
const isEmptyDocument = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return true;
  }

  return !(body as { content?: unknown[] }).content?.length;
};

/**
 * A muted line where the comment would be. Every non-`ok` state uses one, so the document keeps
 * rendering around a comment that can't resolve — the choice `MissingReportNote` makes for a deleted
 * report.
 */
const Note: FC<{ children: ReactNode; testId?: string }> = ({ children, testId }) => (
  <p data-testid={testId} className="text-sm text-slate-500">
    {children}
  </p>
);

export default LatestComment;

import type { FC, ReactNode } from 'react';
import type { LatestCommentState } from '../hooks/useLatestComment';

import React from 'react';

import { AdfDocument } from '../../../components/AdfDocument';

/** What an untargeted node shows in place of a key — see the read view below. */
export const KEY_PLACEHOLDER = 'ABC-1';

export interface CommentRowProps {
  /** The work item key, or the whole JQL when the query is one a key can't represent. */
  target: string;
  // No `state`: the row is the key, and every fetched thing — author, comment, timestamp — is
  // `CommentBody`'s. The row used to take one and never read it.
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
 * The row of a comment report — Latest Comment or Status Update — in a document.
 *
 * Pure and prop-driven — the fetched state arrives as a prop, so every branch stories and unit-tests
 * with no Jira behind it. The split `InlineValue` established.
 *
 * Structurally a report rather than a value: **the row is the work item key and nothing else**, then the
 * comment beneath it at the same indent. The caret, the controls, and the collapse belong to the
 * container, which is why this renders the key and the body and nothing else.
 *
 * **There is no kind label on the row.** It was a muted "Latest comment" prefix, which spent the node's
 * heading on saying what kind of node it is, and read as chrome above content that already announces
 * itself — an author, a comment, a timestamp. So the key gets the row and the `text-base font-semibold`
 * every other row-owning node uses (`ReportOfReports.tsx:369`), and the node reads as *the work item*
 * with its comment under it. Both presets share that, which is why nothing here names either of them.
 *
 * **What that costs, stated plainly:** collapsed, the node is a bare `▸ ABC-1` and nothing says it is a
 * comment. That is the same trade a collapsed report card makes — its row is `▸ Alpha` — so the node is
 * consistent with its neighbours rather than self-describing.
 *
 * **Read-only.** The work item and the field are chosen in the Add Report modal; a wrong node is
 * deleted and re-added rather than corrected in place.
 * See spec/016-report-of-reports/009-value-report-modal § The node stops being editable.
 *
 * It's content, not chrome, so nothing here is `print-hidden`.
 * See spec/016-report-of-reports/007-latest-comment-report § The row is the key, and
 * spec/027-status-updates § The view for the rename that made it serve both presets.
 */
export const CommentRow: FC<CommentRowProps> = ({ target }) => (
  // An untargeted node shows the placeholder key in the muted italic `SectionTitle` gives an untitled
  // section, so "not filled in yet" doesn't read as "a work item called ABC-1". Only a document saved
  // before the modal existed can be in that state.
  //
  // A hand-written query, also only reachable from such a document, titles the row as-is in the same
  // style. It used to be monospaced, but that branch existed to match the edit field's mode; with no
  // field to match, one row style is the honest simplification.
  <h3 className={`min-w-0 grow truncate text-base font-semibold ${target ? '' : 'font-normal italic text-slate-500'}`}>
    {target || KEY_PLACEHOLDER}
  </h3>
);

export interface CommentBodyProps {
  /** `''` while nothing is targeted yet — checked before `state`, which can't tell that from loading. */
  target: string;
  state: LatestCommentState;
  /**
   * What the `empty` state says. The one piece of copy the two presets don't share: Latest Comment
   * reports that there is no comment at all, Status Update that nobody has posted *this week's*.
   */
  emptyNote: string;
  /** `latest-comment` or `status-update` — this and `${testId}-error` are what a test finds. */
  testId: string;
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
 *
 * Shared by both comment presets, which differ only in `emptyNote` and `testId` — everything else about
 * rendering a comment is the same question with the same answer.
 */
export const CommentBody: FC<CommentBodyProps> = ({ target, state, emptyNote, testId }) => {
  if (!target.trim()) {
    // A statement of fact, not an instruction: there is no longer a field to enter a key into. Only a
    // document saved before the Add Report modal took over authoring can reach this.
    return <Note>No work item set.</Note>;
  }

  if (state.status === 'loading') {
    return <Note>Loading…</Note>;
  }

  if (state.status === 'error') {
    return (
      <Note testId={`${testId}-error`}>
        <span>{state.message}</span> <code className="font-mono text-sm">{target}</code>
      </Note>
    );
  }

  if (state.status === 'empty') {
    // The caller's copy, and in both presets it avoids the word "comment": the reader never sees the
    // Jira object's name anywhere in this node, which is named for what they get — the current word on a
    // work item, or this week's status update — rather than for where it came from.
    return <Note>{emptyNote}</Note>;
  }

  if (isEmptyDocument(state.body)) {
    return <Note>This comment has no content.</Note>;
  }

  // **The comment first, its provenance after.** Who wrote it and when are attribution, not the point —
  // so they sit under the text as one muted two-line footer rather than as a byline above it. The reader
  // arrives at the comment immediately and finds out whose and how stale it is on the way out.
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
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

export default CommentRow;

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CommentReportState } from '../hooks/useCommentReport';

import React, { useState } from 'react';

import { CommentBody, CommentRow } from './CommentReport';
import { CollapseToggle } from './CollapseToggle';
import { NodeRow } from './NodeRow';

const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });
const text = (value: string) => [{ type: 'text', text: value }];

const plain = doc({ type: 'paragraph', content: text('Blocked on the SSO cert rotation. See JIRA-412.') });

const marked = (value: string, ...marks: unknown[]) => ({ type: 'text', text: value, marks });

/** Bold, underline, a link, and a hard break — the formatting a real comment carries. */
const formatted = doc({
  type: 'paragraph',
  content: [
    marked('Blocked', { type: 'strong' }),
    { type: 'text', text: ' on the ' },
    marked('SSO cert rotation', { type: 'underline' }),
    { type: 'text', text: ' — see ' },
    marked('JIRA-412', { type: 'link', attrs: { href: 'https://example.atlassian.net/browse/JIRA-412' } }),
    { type: 'text', text: '.' },
    { type: 'hardBreak' },
    { type: 'text', text: 'Chasing IT for a date. ' },
    marked('Not a blocker for the beta.', { type: 'em' }),
  ],
});

const rich = doc(
  { type: 'heading', attrs: { level: 3 }, content: text('Where this stands') },
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Two things are still ' },
      marked('open', { type: 'strong' }),
      { type: 'text', text: ' before we can ship:' },
    ],
  },
  {
    type: 'bulletList',
    content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: text('The cert rotation, waiting on IT.') }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: text('Backfilling the audit table.') }] },
    ],
  },
  { type: 'codeBlock', content: text('kubectl rollout restart deploy/auth') },
  { type: 'blockquote', content: [{ type: 'paragraph', content: text('Ship it Thursday or slip a week.') }] },
);

const ok = (body: unknown): CommentReportState => ({
  status: 'ok',
  body,
  author: 'Dana Ruiz',
  updated: '2026-08-04T14:22:00.000Z',
});

/**
 * The whole node as a document renders it — row, caret, and body — so a story shows what a reviewer
 * actually sees. `CommentRow` on its own is only the row.
 *
 * The editing stories are gone with the edit field: the node is read-only, and a wrong one is deleted
 * and re-added from the Add Report modal.
 * See spec/016-report-of-reports/009-value-report-modal § The node stops being editable.
 */
const Node = ({
  target,
  state,
  startCollapsed = false,
  // The three strings a preset owns, defaulted to Latest Comment's — the stories below are about
  // rendering a comment, which is the same for both, until the two that aren't.
  fallbackLabel = 'latest comment',
  emptyNote = 'No updates found.',
  testId = 'latest-comment',
}: {
  target: string;
  state: CommentReportState;
  startCollapsed?: boolean;
  fallbackLabel?: string;
  emptyNote?: string;
  testId?: string;
}) => {
  const [collapsed, setCollapsed] = useState(startCollapsed);

  return (
    <div className="flex flex-col">
      <NodeRow
        isHovered
        caret={
          <CollapseToggle
            isCollapsed={collapsed}
            label={target || fallbackLabel}
            onToggle={() => setCollapsed(!collapsed)}
          />
        }
      >
        <CommentRow target={target} />
      </NodeRow>
      <div className={`pb-2 ${collapsed ? 'collapsed-content' : ''}`} hidden={collapsed}>
        <CommentBody target={target} state={state} emptyNote={emptyNote} testId={testId} />
      </div>
    </div>
  );
};

/** Everything a Status Update node passes that a Latest Comment one doesn't. */
const statusUpdate = {
  fallbackLabel: 'status update',
  emptyNote: 'No status update has been posted yet.',
  testId: 'status-update',
};

const meta: Meta<typeof Node> = {
  title: 'Reports/ReportOfReports/CommentReport',
  component: Node,
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  args: { target: 'ABC-1', state: ok(plain) },
};
export default meta;

type Story = StoryObj<typeof Node>;

export const Resolved: Story = {};

/** Bold, underline, italic, a link, and a hard break — the marks a comment usually carries. */
export const Formatted: Story = {
  args: { state: ok(formatted) },
};

/** Everything the walker handles: headings, lists, marks, code, and a quote. */
export const RichText: Story = {
  args: { state: ok(rich) },
};

/** No work item set — only reachable from a document saved before the modal took over authoring. */
export const BlankKey: Story = {
  args: { target: '', state: { status: 'loading' } },
};

export const Loading: Story = {
  args: { state: { status: 'loading' } },
};

export const NoComments: Story = {
  args: { state: { status: 'empty' } },
};

export const NoMatch: Story = {
  args: { target: 'NOPE-1', state: { status: 'error', message: 'No work item matched.' } },
};

export const SeveralMatched: Story = {
  args: {
    target: 'project = ABC',
    state: { status: 'error', message: 'More than one work item matched — narrow the query.' },
  },
};

/** Collapsed: the row stays, the comment hides — and print puts it back. */
export const Collapsed: Story = {
  args: { state: ok(rich), startCollapsed: true },
};

/** A comment that is only a screenshot. The walker produces no blocks, so the node says so. */
export const NoRenderableContent: Story = {
  args: { state: ok(doc({ type: 'mediaSingle', content: [{ type: 'media', attrs: { type: 'file' } }] })) },
};

/** A hand-written query rather than a key — the row is titled with the query, since it names no one
 * work item. Only a document saved before the modal existed can hold one. */
export const QueryTarget: Story = {
  args: { target: 'assignee = currentUser() AND updated > -1d', state: ok(plain) },
};

/**
 * This week's status update. The `Status Update` prefix stays in the rendered body — stripping it would
 * mean cloning the ADF tree and trimming its first text node, and the right trim differs depending on
 * whether the prefix is its own paragraph, a heading, bolded, or inline before a colon.
 * See spec/027-status-updates § Decisions.
 */
export const StatusUpdate: Story = {
  args: {
    ...statusUpdate,
    state: ok(
      doc(
        { type: 'paragraph', content: [marked('Status Update:', { type: 'strong' })] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: text('Cert rotation lands Thursday.') }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: text('Audit backfill is running.') }] },
          ],
        },
      ),
    ),
  },
};

/**
 * **The state the preset exists for.** Nobody has posted an update this week, and the node says exactly
 * that — where Latest Comment would either show a three-week-old comment as though it were current, or
 * say only "No updates found." See spec/027-status-updates § Context.
 */
export const NoStatusUpdateYet: Story = {
  args: { ...statusUpdate, state: { status: 'empty' } },
};

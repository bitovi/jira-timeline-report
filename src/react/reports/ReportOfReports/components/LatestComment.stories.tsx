import type { Meta, StoryObj } from '@storybook/react-vite';
import type { LatestCommentState } from '../hooks/useLatestComment';

import React, { useState } from 'react';

import { LatestComment, LatestCommentBody } from './LatestComment';
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

const ok = (body: unknown): LatestCommentState => ({
  status: 'ok',
  body,
  author: 'Dana Ruiz',
  updated: '2026-08-04T14:22:00.000Z',
});

/**
 * The whole node as a document renders it — row, caret, and body — so a story shows what a reviewer
 * actually sees. `LatestComment` on its own is only the row's editable key.
 */
const Node = ({
  target,
  state,
  targetKind = 'key',
  startCollapsed = false,
  startEditing = false,
}: {
  target: string;
  state: LatestCommentState;
  targetKind?: 'key' | 'expression';
  startCollapsed?: boolean;
  startEditing?: boolean;
}) => {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [isEditing, setIsEditing] = useState(startEditing);
  const [value, setValue] = useState(target);

  return (
    <div className="flex flex-col">
      <NodeRow
        isHovered
        caret={
          <CollapseToggle
            isCollapsed={collapsed}
            label={value || 'latest comment'}
            onToggle={() => setCollapsed(!collapsed)}
          />
        }
      >
        <LatestComment
          target={value}
          targetKind={targetKind}
          isEditing={isEditing}
          onEdit={() => setIsEditing(true)}
          onConfirm={(next) => {
            setIsEditing(false);
            setValue(next);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </NodeRow>
      <div className={`pb-2 ${collapsed ? 'collapsed-content' : ''}`} hidden={collapsed}>
        <LatestCommentBody target={value} state={state} />
      </div>
    </div>
  );
};

const meta: Meta<typeof Node> = {
  title: 'Reports/ReportOfReports/LatestComment',
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

/** A freshly added node — the key isn't typed yet, so it asks Jira nothing and says what to do. */
export const BlankKey: Story = {
  args: { target: '', state: { status: 'loading' } },
};

/** With its key field open and focused, as the Add button leaves it. */
export const Editing: Story = {
  args: { target: '', state: { status: 'loading' }, startEditing: true },
};

/**
 * **Retargeting a resolved node — the case worth reviewing.** The row is only the key, so opening the
 * field replaces the heading in place and the comment below does not move; the field takes the row's
 * width because `grow` applies only while editing.
 */
export const EditingResolved: Story = {
  args: { target: 'ABC-1', state: ok(plain), startEditing: true },
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
    target: '(project = ABC).latestComment',
    targetKind: 'expression',
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

/** A hand-written query rather than a key — the field then edits the whole expression. */
export const ExpressionTarget: Story = {
  args: {
    target: '(assignee = currentUser() AND updated > -1d).latestComment',
    targetKind: 'expression',
    state: ok(plain),
  },
};

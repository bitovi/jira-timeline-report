import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { InlineValue } from './InlineValue';

const summary = { id: 'summary', name: 'Summary', schema: { type: 'string' } };

const meta: Meta<typeof InlineValue> = {
  title: 'Reports/ReportOfReports/InlineValue',
  component: InlineValue,
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  args: {
    expression: '(issue = ABC-1).summary',
    state: { status: 'ok', value: 'Migrate auth to OIDC', field: summary },
  },
};
export default meta;

type Story = StoryObj<typeof InlineValue>;

export const Resolved: Story = {};

export const Loading: Story = {
  args: { state: { status: 'loading' } },
};

/**
 * A blank node — how one saved with no expression at all renders. It keeps its height so the row stays
 * hoverable and its delete control reachable; a zero-height row would be an undeletable one.
 */
export const Empty: Story = {
  args: { expression: '', state: { status: 'loading' } },
};

/** An empty field is not an error — it renders an em dash rather than nothing at all. */
export const EmptyValue: Story = {
  args: { state: { status: 'ok', value: null, field: summary } },
};

export const ParseError: Story = {
  args: {
    expression: 'issue = ABC-1',
    state: { status: 'error', message: 'An expression starts with "(" — for example (issue = ABC-1).summary' },
  },
};

export const NoMatch: Story = {
  args: {
    expression: '(issue = NOPE-1).summary',
    state: { status: 'error', message: 'No work item matched.' },
  },
};

export const AmbiguousField: Story = {
  args: {
    expression: '(issue = ABC-1).Story points',
    state: {
      status: 'error',
      message: '2 fields are named "Story points" (customfield_10014, customfield_10032). Use the field id instead.',
    },
  },
};

/** A rich-text field, which has no text rendering yet. */
export const UnsupportedType: Story = {
  args: {
    expression: '(issue = ABC-1).description',
    state: {
      status: 'ok',
      value: { type: 'doc', version: 1, content: [] },
      field: { id: 'description', name: 'Description', schema: { type: 'string' } },
    },
  },
};

/**
 * `.comment` is a real field, so it resolves — and then dead-ends, because a page of comments isn't a
 * value. The message is the only signpost to `.latestComment` and `.statusUpdate`, neither of which can
 * be found in Jira's fields.
 */
export const CommentsPage: Story = {
  args: {
    expression: '(issue = ABC-1).comment',
    state: {
      status: 'ok',
      value: { comments: [], total: 0, startAt: 0, maxResults: 1 },
      field: { id: 'comment', name: 'Comment', schema: { type: 'comments-page' } },
    },
  },
};

/**
 * A long value, to review the truncation. There is no interactive story any more: the node is
 * read-only, so a story with state in it would have nothing to demonstrate — authoring lives in
 * `ValueReportForm`, which has its own.
 * See spec/016-report-of-reports/009-value-report-modal § The node stops being editable.
 */
export const LongValue: Story = {
  args: {
    state: {
      status: 'ok',
      value: 'Migrate the authentication stack to OIDC and retire the legacy token exchange entirely',
      field: summary,
    },
  },
};

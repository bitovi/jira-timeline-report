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

/** An object shape `formatFieldValue` still refuses — no ADF `doc`, no recognizable label. */
export const UnsupportedType: Story = {
  args: {
    expression: '(issue = ABC-1).customfield_99999',
    state: {
      status: 'ok',
      value: { shape: 'unexpected' },
      field: { id: 'customfield_99999', name: 'Mystery Field', schema: { type: 'string' } },
    },
  },
};

/**
 * An ADF-bearing field — `description`, or any other rich-text field — rendered through `AdfDocument`,
 * the generic fix that isn't specific to wiki markup. See spec/030-inline-custom-field-report.
 */
export const AdfValue: Story = {
  args: {
    expression: '(issue = ABC-1).description',
    state: {
      status: 'ok',
      value: {
        type: 'doc',
        version: 1,
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollout plan' }] },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ship behind a flag' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remove the flag' }] }],
              },
            ],
          },
        ],
      },
      field: { id: 'description', name: 'Description', schema: { type: 'string' } },
    },
  },
};

/**
 * A wiki-markup field — e.g. the "Status Update" custom field (`customfield_10844`) the bug report was
 * filed against — converted to ADF and rendered the same way. `schema.custom` is what marks it as such;
 * `schema.type` alone (`"string"`) can't tell it apart from a plain text field.
 * See spec/030-inline-custom-field-report.
 */
export const WikiMarkupValue: Story = {
  args: {
    expression: '(issue = SUNNYSUSHI-54).customfield_10844',
    state: {
      status: 'ok',
      value: 'h1. Status\n\n* Shipped the migration\n* Rolled back the old endpoint\n\n||Env||State||\n|prod|green|\n',
      field: {
        id: 'customfield_10844',
        name: 'Status Update',
        schema: { type: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textarea' },
      },
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

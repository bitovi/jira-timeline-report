import React, { useState } from 'react';
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
    isEditing: false,
    state: { status: 'ok', value: 'Migrate auth to OIDC', field: summary },
  },
};
export default meta;

type Story = StoryObj<typeof InlineValue>;

export const Resolved: Story = {};

export const Loading: Story = {
  args: { state: { status: 'loading' } },
};

/** A blank node — how one saved with no expression at all renders. */
export const Empty: Story = {
  args: { expression: '', state: { status: 'loading' } },
};

/** With its field open and focused, as clicking the value opens it. */
export const Editing: Story = {
  args: { expression: '', isEditing: true, state: { status: 'loading' } },
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

/** Wired the way a document wires it — editing state and the expression belong to the caller. */
export const Interactive: Story = {
  render: () => {
    const [expression, setExpression] = useState('(issue = ABC-1).summary');
    const [isEditing, setIsEditing] = useState(false);

    return (
      <InlineValue
        expression={expression}
        state={{ status: 'ok', value: `resolved from "${expression}"`, field: summary }}
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        onConfirm={(next) => {
          setIsEditing(false);
          setExpression(next);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  },
};

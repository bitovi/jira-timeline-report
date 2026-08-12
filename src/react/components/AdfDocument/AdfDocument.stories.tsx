import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';

import { AdfDocument } from './AdfDocument';

const text = (value: string, ...marks: unknown[]) => ({ type: 'text', text: value, marks });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const cell = (kind: 'tableHeader' | 'tableCell', value: string) => ({
  type: kind,
  attrs: {},
  content: [p(text(value))],
});
const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });

const meta: Meta<typeof AdfDocument> = {
  title: 'Components/AdfDocument',
  component: AdfDocument,
  decorators: [
    (Story) => (
      <div className="w-[42rem]">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof AdfDocument>;

/**
 * **This is the design-review surface for rich rendering.** jsdom has no stylesheet and no layout, so
 * whether a table looks right — borders, column widths, overflow in a container much narrower than a
 * Jira issue view — can only be judged here.
 */
export const Table: Story = {
  args: {
    document: doc(p(text('Environment status as of this morning:')), {
      type: 'table',
      attrs: {},
      content: [
        {
          type: 'tableRow',
          content: [cell('tableHeader', 'Env'), cell('tableHeader', 'Version'), cell('tableHeader', 'State')],
        },
        {
          type: 'tableRow',
          content: [cell('tableCell', 'prod'), cell('tableCell', '4.12.1'), cell('tableCell', 'green')],
        },
        {
          type: 'tableRow',
          content: [cell('tableCell', 'staging'), cell('tableCell', '4.13.0-rc2'), cell('tableCell', 'degraded')],
        },
      ],
    }),
  },
};

/** A wide table in a narrow container — the case the walker never had to face. */
export const WideTable: Story = {
  args: {
    document: doc({
      type: 'table',
      attrs: {},
      content: [
        {
          type: 'tableRow',
          content: ['Service', 'Owner', 'Last deploy', 'Error rate', 'p99 latency', 'On call'].map((h) =>
            cell('tableHeader', h),
          ),
        },
        {
          type: 'tableRow',
          content: ['auth-gateway', 'Platform', '2026-08-04 09:12', '0.04%', '820ms', 'Dana Ruiz'].map((c) =>
            cell('tableCell', c),
          ),
        },
      ],
    }),
  },
};

export const Marks: Story = {
  args: {
    document: doc(
      p(
        text('Blocked', { type: 'strong' }),
        text(' on the '),
        text('SSO cert rotation', { type: 'underline' }),
        text(' — see '),
        text('JIRA-412', { type: 'link', attrs: { href: 'https://example.atlassian.net/browse/JIRA-412' } }),
        text('.'),
        { type: 'hardBreak' },
        text('Chasing IT for a date. '),
        text('Not a blocker for the beta.', { type: 'em' }),
        text(' '),
        text('deploy.sh', { type: 'code' }),
      ),
    ),
  },
};

/** Panels, code blocks, and quotes — none of which the local walker renders as anything but text. */
export const Panels: Story = {
  args: {
    document: doc(
      { type: 'panel', attrs: { panelType: 'warning' }, content: [p(text('Do not deploy over the weekend.'))] },
      { type: 'panel', attrs: { panelType: 'info' }, content: [p(text('Runbook is in Confluence.'))] },
      { type: 'codeBlock', attrs: { language: 'bash' }, content: [text('kubectl rollout restart deploy/auth')] },
      { type: 'blockquote', content: [p(text('Ship it Thursday or slip a week.'))] },
    ),
  },
};

/** Emoji, a mention, a status lozenge, and a date. Mentions render the name but not an avatar. */
export const InlineAtoms: Story = {
  args: {
    document: doc(
      p(
        text('Ship it '),
        { type: 'emoji', attrs: { shortName: ':rocket:', id: '1f680', text: '🚀' } },
        text(' — '),
        { type: 'mention', attrs: { id: 'u1', text: '@Dana Ruiz' } },
        text(' is on it, currently '),
        { type: 'status', attrs: { text: 'IN PROGRESS', color: 'blue' } },
        text(' due '),
        { type: 'date', attrs: { timestamp: '1780272000000' } },
      ),
    ),
  },
};

/** Lists, headings, and nesting — the overlap where walker and renderer should look the same. */
export const Structure: Story = {
  args: {
    document: doc(
      { type: 'heading', attrs: { level: 3 }, content: [text('Where this stands')] },
      p(text('Two things are still '), text('open', { type: 'strong' }), text(':')),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [p(text('The cert rotation, waiting on IT.'))] },
          {
            type: 'listItem',
            content: [
              p(text('Backfilling the audit table.')),
              {
                type: 'bulletList',
                content: [{ type: 'listItem', content: [p(text('Script written, not reviewed.'))] }],
              },
            ],
          },
        ],
      },
      { type: 'rule' },
    ),
  },
};

/**
 * Media does **not** load — no `mediaProvider` and no media token. This story is here so the empty
 * result is a known, reviewed state rather than a surprise in a real document.
 */
export const MediaDoesNotLoad: Story = {
  args: {
    document: doc(p(text('Screenshot of the failure:')), {
      type: 'mediaSingle',
      attrs: { layout: 'center' },
      content: [{ type: 'media', attrs: { type: 'file', id: 'not-a-real-id', collection: 'none' } }],
    }),
  },
};

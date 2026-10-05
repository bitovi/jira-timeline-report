import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';

import { IssueSummaryLabel } from './IssueSummaryLabel';

const SUMMARY = 'Apply referral reward in order flow';

/**
 * The label is a grid item in the report, so it is placed in a one-column grid here. `width` stands
 * in for the `fit-content(40%)` track — the thing that actually squeezes when a sidebar panel opens.
 */
const Cell = ({ width, summary, url }: { width: number; summary: string; url?: string }) => (
  <div className="grid border border-neutral-30" style={{ gridTemplateColumns: `[what] ${width}px` }}>
    <IssueSummaryLabel summary={summary} url={url} openInNewTab gridRowStart={1} />
  </div>
);

const meta: Meta<typeof Cell> = {
  title: 'reports/AutoScheduler/IssueSummaryLabel',
  component: Cell,
  args: { width: 360, summary: SUMMARY, url: 'https://jira.example/browse/ORDER-1' },
};

export default meta;

/** Wide enough for the whole summary: no ellipsis, and hovering shows nothing. */
export const Full: StoryObj<typeof Cell> = {};

/** The squeezed case: the summary ends in an ellipsis, and hovering shows it in full. */
export const Clipped: StoryObj<typeof Cell> = { args: { width: 200 } };

/** An issue with no Jira link still clips and still gets the hover. */
export const ClippedWithoutLink: StoryObj<typeof Cell> = { args: { width: 200, url: undefined } };

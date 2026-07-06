import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateRangeKey } from './DateRangeKey';
import { undatedIssues } from '../../fixtures';

const meta: Meta<typeof DateRangeKey> = {
  title: 'Reports/ScatterTimeline/DateRangeKey',
  component: DateRangeKey,
};
export default meta;

type Story = StoryObj<typeof DateRangeKey>;

/** A range is active and excludes some issues — click the key to open the modal list. */
export const RangeActiveWithExclusions: Story = {
  args: { issues: undatedIssues, hasDateRange: true },
};

/** A range is active but nothing is excluded — shows a "0 outside date range" count. */
export const RangeActiveNoExclusions: Story = {
  args: { issues: [], hasDateRange: true },
};

/** No range is active — the key renders nothing, regardless of the issues passed in. */
export const NoRangeActive: Story = {
  args: { issues: undatedIssues, hasDateRange: false },
};

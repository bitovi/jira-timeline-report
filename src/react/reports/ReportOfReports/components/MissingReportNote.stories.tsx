import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MissingReportNote } from './MissingReportNote';
import { NodeRow } from './NodeRow';

const meta: Meta<typeof MissingReportNote> = {
  title: 'Reports/ReportOfReports/MissingReportNote',
  component: MissingReportNote,
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  args: { reportId: 'e3a1c7f0-4b2d-4f6a-9c11-8d5b2e7a0f33' },
};
export default meta;

type Story = StoryObj<typeof MissingReportNote>;

export const Default: Story = {};

/** In place: the row names the problem, the note explains it. */
export const InARow: Story = {
  render: (args) => (
    <div className="flex flex-col">
      <NodeRow>
        <h3 className="truncate text-base font-semibold text-slate-500">Report not found</h3>
      </NodeRow>
      <MissingReportNote {...args} />
    </div>
  ),
};

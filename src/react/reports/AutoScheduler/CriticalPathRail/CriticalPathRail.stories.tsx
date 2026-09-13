import type { Meta, StoryObj } from '@storybook/react-vite';

import React, { useState } from 'react';
import { CriticalPathRail } from './CriticalPathRail';

const meta: Meta<typeof CriticalPathRail> = {
  title: 'reports/AutoScheduler/CriticalPathRail',
  component: CriticalPathRail,
};

export default meta;

type Story = StoryObj<typeof CriticalPathRail>;

const Filler: React.FC<{ label: string; rows: number }> = ({ label, rows }) => (
  <div className="rounded border border-neutral-30 bg-white p-2 text-xs">
    <div className="font-bold">{label}</div>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="py-1 text-neutral-500">
        row {i + 1}
      </div>
    ))}
  </div>
);

/** Mirrors the real mount: the caller owns the flex row and the grid beside the rail. */
const Shell: React.FC<{
  initiallyOpen: boolean;
  queueingDays: number | null;
  heightBudget?: string;
}> = ({ initiallyOpen, queueingDays, heightBudget = '600px' }) => {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div style={{ ['--fullish-document-top' as string]: `calc(100vh - ${heightBudget})` }}>
      <div className="flex items-stretch border border-neutral-30" style={{ height: heightBudget }}>
        <div className="min-w-0 flex-1 overflow-y-auto bg-white p-2 text-xs">
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} className="border-b border-neutral-20 py-2">
              Gantt row {i + 1}
            </div>
          ))}
        </div>
        <CriticalPathRail floor={{ floorDays: 53.8, queueingDays }} open={open} onOpenChange={setOpen}>
          <Filler label="Most common critical paths" rows={6} />
          <Filler label="Epics on the critical path" rows={11} />
        </CriticalPathRail>
      </div>
    </div>
  );
};

export const Closed: Story = {
  render: () => <Shell initiallyOpen={false} queueingDays={37.2} />,
};

export const Open: Story = {
  render: () => <Shell initiallyOpen queueingDays={37.2} />,
};

/** At any percentile the plan finish is a range, so the gap is not a quantity and is omitted. */
export const OpenWithoutQueueingGap: Story = {
  render: () => <Shell initiallyOpen queueingDays={null} />,
};

export const OpenOnAShortViewport: Story = {
  render: () => <Shell initiallyOpen queueingDays={37.2} heightBudget="300px" />,
};

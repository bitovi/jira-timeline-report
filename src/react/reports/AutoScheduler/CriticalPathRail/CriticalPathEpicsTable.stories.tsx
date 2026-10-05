import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PathFrequency } from '../scheduler/critical-path-accumulator';
import type { CriticalPathEpicRow } from './build-critical-path-epics';

import React from 'react';
import { CriticalPathEpicsTable } from './CriticalPathEpicsTable';
import { routeId } from './criticalPathSelection';

const meta: Meta<typeof CriticalPathEpicsTable> = {
  title: 'reports/AutoScheduler/CriticalPathEpicsTable',
  component: CriticalPathEpicsTable,
  decorators: [
    (Story) => (
      <div className="w-[340px] bg-neutral-10 p-2">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CriticalPathEpicsTable>;

const SUMMARIES = [
  'Add promotion to cart',
  'Wrong promotion entered',
  'Promotion end-date error handling',
  'Create a promotion',
  'Verify promotion is available',
  'Create and publish ad',
  'Campaign landing page',
  'Split a shipment',
  'Refund a split shipment',
  'Cart totals rounding',
  'Retire a promotion',
  'Email blast',
  'Promotion audit log',
  'Bulk promotion import',
  'Promotion analytics export',
  'Legacy coupon migration',
];

const ROWS: CriticalPathEpicRow[] = SUMMARIES.map((summary, i) => ({
  key: `EPIC-${i}`,
  summary,
  url: `https://example.test/EPIC-${i}`,
  teamName: i % 3 === 0 ? 'ORDER' : 'STORE',
  daysAdded: Math.max(0, 35.4 / (i + 1) - i * 0.2),
  onPathIndex: Math.max(0, 0.83 - i * 0.05),
}));

const ROUTE: PathFrequency = { keys: ['EPIC-3', 'EPIC-4', 'EPIC-0', 'EPIC-1'], count: 6500 };

const args = { rows: ROWS, routes: [ROUTE], selection: null, onSelectEpic: () => {}, disabled: false };

export const NoSelection: Story = { args };

export const ResidualExpanded: Story = {
  args,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('[aria-expanded="false"]')?.click();
  },
};

/** A route selection dims every epic off that chain — the one case this table dims at all. */
export const RouteSelected: Story = {
  args: { ...args, selection: { kind: 'route', id: routeId(ROUTE.keys) } },
};

export const EpicSelected: Story = {
  args: { ...args, selection: { kind: 'epic', key: 'EPIC-1' } },
};

/** A plan with no dependencies at all: nothing is on a critical path, so nothing adds days. */
export const NothingOnThePath: Story = {
  args: { ...args, rows: ROWS.map((row) => ({ ...row, daysAdded: 0, onPathIndex: 0 })), routes: [] },
};

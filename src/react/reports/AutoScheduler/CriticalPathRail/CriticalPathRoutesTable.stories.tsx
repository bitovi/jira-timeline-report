import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PathFrequency } from '../scheduler/critical-path-accumulator';

import React from 'react';
import { CriticalPathRoutesTable } from './CriticalPathRoutesTable';
import { routeId } from './criticalPathSelection';

const meta: Meta<typeof CriticalPathRoutesTable> = {
  title: 'reports/AutoScheduler/CriticalPathRoutesTable',
  component: CriticalPathRoutesTable,
  decorators: [
    (Story) => (
      <div className="w-[340px] bg-neutral-10 p-2">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CriticalPathRoutesTable>;

const ROUTES: PathFrequency[] = [
  { keys: ['STORE-17', 'STORE-18', 'ORDER-23', 'ORDER-24'], count: 6500 },
  { keys: ['STORE-17', 'STORE-18', 'ORDER-23'], count: 1600 },
  { keys: ['STORE-99', 'MARKETING-5'], count: 400 },
  { keys: ['STORE-17', 'MARKETING-5'], count: 400 },
  { keys: ['MARKETING-6'], count: 300 },
  { keys: ['ORDER-31', 'ORDER-32'], count: 300 },
  { keys: ['ORDER-40'], count: 250 },
  { keys: ['STORE-17', 'ORDER-50'], count: 150 },
  { keys: ['MARKETING-9'], count: 100 },
];

const SUMMARIES: Record<string, string> = {
  'STORE-17': 'Create a promotion',
  'STORE-18': 'Verify promotion is available',
  'STORE-99': 'Retire a promotion',
  'ORDER-23': 'Add promotion to cart',
  'ORDER-24': 'Wrong promotion entered',
  'ORDER-31': 'Split a shipment',
  'ORDER-32': 'Refund a split shipment',
  'ORDER-40': 'Promotion end-date error handling',
  'ORDER-50': 'Cart totals rounding',
  'MARKETING-5': 'Create and publish ad',
  'MARKETING-6': 'Campaign landing page',
  'MARKETING-9': 'Email blast',
};

const args = {
  routes: ROUTES,
  iterations: 10_000,
  labelFor: (keys: string[]) => keys.map((key) => SUMMARIES[key] ?? key).join(' → '),
  selection: null,
  onSelectRoute: () => {},
  disabled: false,
};

export const NoSelection: Story = { args };

export const ResidualExpanded: Story = {
  args,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('[aria-expanded="false"]')?.click();
  },
};

/** An epic selection lights every chain it sits on, however rare. */
export const EpicSelected: Story = {
  args: { ...args, selection: { kind: 'epic', key: 'MARKETING-5' } },
};

export const RouteSelected: Story = {
  args: { ...args, selection: { kind: 'route', id: routeId(ROUTES[1].keys) } },
};

export const SingleRoute: Story = {
  args: { ...args, routes: [ROUTES[0]] },
};

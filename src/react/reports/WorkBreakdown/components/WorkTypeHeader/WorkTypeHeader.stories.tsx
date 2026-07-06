import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { WorkTypeColumn } from '../../types';
import { WorkTypeHeader } from './WorkTypeHeader';

const columns: WorkTypeColumn[] = [
  { type: 'design', symbol: 'd', status: 'complete', due: new Date('2025-02-12'), slip: { kind: 'none' } },
  { type: 'dev', symbol: 'D', status: 'ontrack', due: new Date('2025-03-09'), slip: { kind: 'none' } },
  {
    type: 'qa',
    symbol: 'Q',
    status: 'behind',
    due: new Date('2025-07-24'),
    slip: { kind: 'slipped', label: 'Jun 19' },
  },
  {
    type: 'uat',
    symbol: 'U',
    status: 'ahead',
    due: new Date('2025-10-03'),
    slip: { kind: 'improved', label: 'Oct 10' },
  },
];

const meta: Meta<typeof WorkTypeHeader> = {
  title: 'Reports/WorkBreakdown/WorkTypeHeader',
  component: WorkTypeHeader,
  decorators: [
    (Story) => (
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, auto)', width: 'fit-content' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof WorkTypeHeader>;

export const AllColumns: Story = { args: { columns } };

export const Tight: Story = { args: { columns, size: 'sm' } };

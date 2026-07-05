import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GridLines } from './GridLines';

const GridWrapper: React.FC<{ monthCount: number; rowCount: number }> = ({ monthCount, rowCount }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${monthCount}, 1fr)`,
      gridTemplateRows: `auto auto repeat(${rowCount}, 40px)`,
      width: 800,
    }}
  >
    <GridLines monthCount={monthCount} rowCount={rowCount} />
  </div>
);

const meta: Meta<typeof GridLines> = {
  title: 'Reports/ScatterTimeline/GridLines',
  component: GridLines,
};
export default meta;

type Story = StoryObj<typeof GridLines>;

export const FewMonths: Story = {
  render: () => <GridWrapper monthCount={3} rowCount={2} />,
};

export const ManyMonths: Story = {
  render: () => <GridWrapper monthCount={12} rowCount={3} />,
};

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TodayLine } from './TodayLine';

const GridWrapper: React.FC<{ marginLeftPercent: number }> = ({ marginLeftPercent }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'auto 120px',
      width: 600,
      border: '1px solid #ddd',
    }}
  >
    <div style={{ gridColumn: 'span 3', textAlign: 'center' }}>Q1</div>
    <TodayLine marginLeftPercent={marginLeftPercent} monthCount={3} rowCount={1} />
  </div>
);

const meta: Meta<typeof TodayLine> = {
  title: 'Reports/ScatterTimeline/TodayLine',
  component: TodayLine,
};
export default meta;

type Story = StoryObj<typeof TodayLine>;

export const InsideRange: Story = {
  render: () => <GridWrapper marginLeftPercent={50} />,
};

export const NearStart: Story = {
  render: () => <GridWrapper marginLeftPercent={5} />,
};

export const BeforeRange: Story = {
  render: () => <GridWrapper marginLeftPercent={-10} />,
};

export const AfterRange: Story = {
  render: () => <GridWrapper marginLeftPercent={110} />,
};

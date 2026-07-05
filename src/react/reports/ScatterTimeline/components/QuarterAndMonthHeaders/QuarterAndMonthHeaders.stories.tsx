import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuarterAndMonthHeaders } from './QuarterAndMonthHeaders';
import { computeQuartersAndMonths } from '../../../../../utils/date/compute-quarters-and-months';
import { computeGridColumnCSS } from '../../helpers';

const GridWrapper: React.FC<{ start: Date; end: Date }> = ({ start, end }) => {
  const { quarters, months } = computeQuartersAndMonths(start, end);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: computeGridColumnCSS(months), width: 900 }}>
      <QuarterAndMonthHeaders quarters={quarters} months={months} />
    </div>
  );
};

const meta: Meta<typeof QuarterAndMonthHeaders> = {
  title: 'Reports/ScatterTimeline/QuarterAndMonthHeaders',
  component: QuarterAndMonthHeaders,
};
export default meta;

type Story = StoryObj<typeof QuarterAndMonthHeaders>;

export const SingleQuarter: Story = {
  render: () => <GridWrapper start={new Date('2025-01-15')} end={new Date('2025-01-20')} />,
};

export const MultiQuarter: Story = {
  render: () => <GridWrapper start={new Date('2025-02-01')} end={new Date('2025-08-31')} />,
};

export const LeapYearFebruary: Story = {
  render: () => <GridWrapper start={new Date('2024-01-01')} end={new Date('2024-03-31')} />,
};

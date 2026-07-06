import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TargetDeliveryDate } from './TargetDeliveryDate';

const meta: Meta<typeof TargetDeliveryDate> = {
  title: 'Reports/WorkBreakdown/TargetDeliveryDate',
  component: TargetDeliveryDate,
};
export default meta;

type Story = StoryObj<typeof TargetDeliveryDate>;

export const OnTrack: Story = {
  args: { due: new Date('2025-03-09'), slip: { kind: 'none' } },
};

export const Slipped: Story = {
  args: { due: new Date('2025-07-24'), slip: { kind: 'slipped', label: 'Jun 19' } },
};

export const Improved: Story = {
  args: { due: new Date('2025-10-03'), slip: { kind: 'improved', label: 'Oct 10' } },
};

export const NoDate: Story = {
  args: { slip: { kind: 'none' } },
};

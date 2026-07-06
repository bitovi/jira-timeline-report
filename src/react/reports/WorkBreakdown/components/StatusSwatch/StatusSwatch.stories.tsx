import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusSwatch } from './StatusSwatch';

const meta: Meta<typeof StatusSwatch> = {
  title: 'Reports/WorkBreakdown/StatusSwatch',
  component: StatusSwatch,
};
export default meta;

type Story = StoryObj<typeof StatusSwatch>;

/** All three cell states side by side. */
export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {(['complete', 'ontrack', 'ahead', 'behind', 'warning', 'blocked', 'notstarted', 'nodate', 'na'] as const).map(
        (state) => (
          <div key={state} className="flex flex-col items-center gap-1">
            <StatusSwatch state={state} />
            <span className="text-[10px] text-neutral-300">{state}</span>
          </div>
        ),
      )}
    </div>
  ),
};

/** Size variants. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <StatusSwatch key={size} state="behind" size={size} />
      ))}
    </div>
  ),
};

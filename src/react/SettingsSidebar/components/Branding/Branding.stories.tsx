import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';

import Branding from './Branding';

/**
 * The sidebar's logo block. The web host never shows it and always reports a license, so this is
 * the only place to see the unlicensed Eggbert without an unpaid Forge site. Hover him for the
 * tooltip.
 */
const meta: Meta<typeof Branding> = {
  title: 'Settings/Branding',
  component: Branding,
  decorators: [
    (Story) => (
      <div className="w-80 p-6">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Branding>;

export const Licensed: Story = {};

export const Unlicensed: Story = {
  args: { unlicensed: true },
};

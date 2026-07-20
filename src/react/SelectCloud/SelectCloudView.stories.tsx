import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';

import SelectCloudView from './SelectCloudView';

const siteA = { id: 'A', name: 'Bitovi' };
const siteB = { id: 'B', name: 'Acme Corp' };
const siteC = { id: 'C', name: 'Sandbox' };

const noop = (id: string) => console.log('onSelectCloud', id);

const meta: Meta<typeof SelectCloudView> = {
  title: 'Shared/SelectCloud',
  component: SelectCloudView,
};
export default meta;

type Story = StoryObj<typeof SelectCloudView>;

/** Resources request in flight — shows the `...` pill. */
export const Loading: Story = {
  render: () => <SelectCloudView isLoading current={undefined} alternates={[]} onSelectCloud={noop} />,
};

/** Multiple sites — a clickable pill opening a dropdown of the others. */
export const Switchable: Story = {
  render: () => <SelectCloudView isLoading={false} current={siteA} alternates={[siteB, siteC]} onSelectCloud={noop} />,
};

/** Only one accessible site — a static, non-interactive pill. */
export const Single: Story = {
  render: () => <SelectCloudView isLoading={false} current={siteA} alternates={[]} onSelectCloud={noop} />,
};

/** Nothing to show (logged out / no resources) — renders nothing. */
export const Empty: Story = {
  render: () => <SelectCloudView isLoading={false} current={undefined} alternates={[]} onSelectCloud={noop} />,
};

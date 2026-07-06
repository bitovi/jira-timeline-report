import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NoDatesKey } from './NoDatesKey';
import { undatedIssues } from '../../fixtures';

const meta: Meta<typeof NoDatesKey> = {
  title: 'Reports/ScatterTimeline/NoDatesKey',
  component: NoDatesKey,
};
export default meta;

type Story = StoryObj<typeof NoDatesKey>;

/** Several undated issues across statuses — click the key to open the modal list. */
export const WithUndatedIssues: Story = {
  args: { issues: undatedIssues },
};

/** No undated issues — the key renders nothing. */
export const NoUndatedIssues: Story = {
  args: { issues: [] },
};

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '@atlaskit/button/new';
import DeleteIcon from '@atlaskit/icon/core/delete';

import { MissingReportCard } from './MissingReportCard';

const meta: Meta<typeof MissingReportCard> = {
  title: 'Reports/ReportOfReports/MissingReportCard',
  component: MissingReportCard,
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof MissingReportCard>;

export const Default: Story = {
  args: { reportId: 'e3a1c7f0-4b2d-4f6a-9c11-8d5b2e7a0f33' },
};

/**
 * With controls, as it renders in a document. The real `NodeControls` reads the layout context, so
 * this stands in with just the button it shares.
 */
export const WithControls: Story = {
  args: {
    reportId: 'e3a1c7f0-4b2d-4f6a-9c11-8d5b2e7a0f33',
    controls: <IconButton icon={DeleteIcon} label="Remove" appearance="subtle" spacing="compact" />,
  },
};

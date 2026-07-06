import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlanningCard } from './PlanningCard';
import { planningIssues } from '../../fixtures';

const rows = planningIssues.map((issue) => ({ key: issue.key, name: issue.summary, issue }));

const meta: Meta<typeof PlanningCard> = {
  title: 'Reports/WorkBreakdown/PlanningCard',
  component: PlanningCard,
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof PlanningCard>;

export const WithIssues: Story = { args: { planning: rows } };

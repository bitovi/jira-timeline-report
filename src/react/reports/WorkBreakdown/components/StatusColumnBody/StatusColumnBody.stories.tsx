import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildBoard } from '../../helpers';
import { primaryIssues, allIssues } from '../../fixtures';
import { StatusColumnBody } from './StatusColumnBody';

const [card1, card2, card3] = buildBoard(primaryIssues, allIssues, 'status').cards;

const meta: Meta<typeof StatusColumnBody> = {
  title: 'Reports/WorkBreakdown/StatusColumnBody',
  component: StatusColumnBody,
  decorators: [
    (Story) => (
      <div className="w-56 border border-neutral-40 rounded overflow-hidden">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof StatusColumnBody>;

export const OnTrackCard: Story = { args: { card: card1 } };

export const CompleteCard: Story = { args: { card: card2 } };

/** Card whose rollup date slipped from a prior period. */
export const SlippedCard: Story = { args: { card: card3 } };

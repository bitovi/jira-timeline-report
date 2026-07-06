import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildBoard } from '../../helpers';
import { primaryIssues, allIssues } from '../../fixtures';
import { StatusMatrixBody } from './StatusMatrixBody';

const [card1, card2, card3] = buildBoard(primaryIssues, allIssues, 'breakdown').cards;

const meta: Meta<typeof StatusMatrixBody> = {
  title: 'Reports/WorkBreakdown/StatusMatrixBody',
  component: StatusMatrixBody,
  decorators: [
    (Story) => (
      <div className="w-64 border border-neutral-40 rounded overflow-hidden">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof StatusMatrixBody>;

export const OnTrackCard: Story = { args: { card: card1 } };

/** Card with an "ahead" (pulled-earlier) QA date in the header. */
export const AheadCard: Story = { args: { card: card2 } };

/** Card with a slipped dev date in the header. */
export const SlippedCard: Story = { args: { card: card3 } };

export const Tight: Story = { args: { card: card1, size: 'sm', fontSize: 'text-xs' } };

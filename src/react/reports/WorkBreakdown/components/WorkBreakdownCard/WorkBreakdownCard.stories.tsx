import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Density, SecondaryReportMode } from '../../types';
import { buildBoard } from '../../helpers';
import { primaryIssues, allIssues } from '../../fixtures';
import { WorkBreakdownCard } from './WorkBreakdownCard';

interface Args {
  mode: SecondaryReportMode;
  density: Density;
  cardIndex: number;
}

const meta: Meta<Args> = {
  title: 'Reports/WorkBreakdown/WorkBreakdownCard',
  render: ({ mode, density, cardIndex }) => {
    const board = buildBoard(primaryIssues, allIssues, mode);
    return (
      <div className="flex" style={{ width: 280 }}>
        <WorkBreakdownCard card={board.cards[cardIndex]} mode={mode} density={density} />
      </div>
    );
  },
  args: { mode: 'breakdown', density: 'light', cardIndex: 0 },
  argTypes: {
    mode: { control: 'inline-radio', options: ['status', 'breakdown'] },
    density: { control: 'inline-radio', options: ['light', 'medium', 'high', 'absurd'] },
    cardIndex: { control: { type: 'number', min: 0, max: 2 } },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Breakdown: Story = { args: { mode: 'breakdown', cardIndex: 0 } };

export const Status: Story = { args: { mode: 'status', cardIndex: 0 } };

export const Tight: Story = { args: { mode: 'breakdown', density: 'high', cardIndex: 1 } };

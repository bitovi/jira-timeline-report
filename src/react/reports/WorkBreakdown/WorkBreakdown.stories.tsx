import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease } from './types';
import { WorkBreakdown } from './WorkBreakdown';
import { primaryIssues, allIssues, planningIssues, densePrimaryIssues, denseAllIssues } from './fixtures';

/** A minimal static observable stub for stories (no reactive updates needed). */
const obs = <T,>(value: T): CanObservable<T> =>
  ({
    value,
    getData: () => value,
    get: () => value,
    set: () => undefined,
    on: () => undefined,
    off: () => undefined,
  }) as unknown as CanObservable<T>;

interface Args {
  primary: IssueOrRelease[];
  all: IssueOrRelease[];
  planning: IssueOrRelease[];
  cardsMode: string;
}

const meta: Meta<Args> = {
  title: 'Reports/WorkBreakdown/WorkBreakdown',
  render: ({ primary, all, planning, cardsMode }) => (
    <WorkBreakdown
      primaryIssuesOrReleasesObs={obs(primary)}
      allIssuesOrReleasesObs={obs(all)}
      planningIssuesObs={obs(planning)}
      cardsModeObs={obs(cardsMode)}
    />
  ),
  args: { primary: primaryIssues, all: allIssues, planning: [], cardsMode: 'breakdown' },
  argTypes: {
    cardsMode: { control: 'inline-radio', options: ['status', 'breakdown'] },
  },
};
export default meta;

type Story = StoryObj<Args>;

/** Status mode — a single rollup-status column + Target Delivery date per card. */
export const StatusMode: Story = { args: { cardsMode: 'status' } };

/** Work-breakdown mode — the full work-type status matrix. */
export const WorkBreakdownMode: Story = { args: { cardsMode: 'breakdown' } };

/** Slipped (red) and ahead/improved (teal) header dates across cards. */
export const SlippedAndAheadDates: Story = { args: { cardsMode: 'breakdown' } };

/** A large board that trips the `absurd` density tier (tight swatches + small text). */
export const DenseBoard: Story = {
  args: { primary: densePrimaryIssues, all: denseAllIssues, cardsMode: 'breakdown' },
};

/** With a "Planning" fallback card of unscheduled issues. */
export const WithPlanning: Story = { args: { planning: planningIssues, cardsMode: 'breakdown' } };

/** Empty state — no issues found. */
export const Empty: Story = { args: { primary: [], all: [], planning: [] } };

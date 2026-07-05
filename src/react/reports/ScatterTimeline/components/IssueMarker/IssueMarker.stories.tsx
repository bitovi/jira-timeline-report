import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IssueMarker } from './IssueMarker';
import { makePlottedIssue } from '../../fixtures';

/**
 * A relative-positioned track so the absolutely-positioned marker has a bounding box.
 */
const TrackDecorator = (Story: React.FC) => (
  <div style={{ position: 'relative', width: 800, height: 48, border: '1px dashed #ccc' }}>
    <Story />
  </div>
);

const meta: Meta<typeof IssueMarker> = {
  title: 'Reports/ScatterTimeline/IssueMarker',
  component: IssueMarker,
  decorators: [TrackDecorator],
};
export default meta;

type Story = StoryObj<typeof IssueMarker>;

export const OnTrack: Story = {
  args: { item: makePlottedIssue({ status: 'ontrack', summary: 'On track work', endPercentFromRight: 40 }) },
};

export const Complete: Story = {
  args: { item: makePlottedIssue({ status: 'complete', summary: 'Completed work', endPercentFromRight: 40 }) },
};

export const Behind: Story = {
  args: { item: makePlottedIssue({ status: 'behind', summary: 'Behind schedule', endPercentFromRight: 40 }) },
};

export const Blocked: Story = {
  args: { item: makePlottedIssue({ status: 'blocked', summary: 'Blocked work', endPercentFromRight: 40 }) },
};

export const Warning: Story = {
  args: { item: makePlottedIssue({ status: 'warning', summary: 'At-risk work', endPercentFromRight: 40 }) },
};

export const LongLabelTruncates: Story = {
  args: {
    item: makePlottedIssue({
      summary: 'This is an extremely long issue summary that should be truncated by the label',
      endPercentFromRight: 30,
    }),
  },
};

export const SmallRadiusDense: Story = {
  args: {
    item: makePlottedIssue({ summary: 'Dense marker', markerRadius: 6, textSize: 'text-xs', endPercentFromRight: 40 }),
  },
};

export const LabelSideRightFlip: Story = {
  name: 'labelSide="right" (off-left-edge flip)',
  args: {
    item: makePlottedIssue({
      summary: 'Early due, long label flips right',
      rightPercentEnd: 2,
      overflowsLeft: true,
    }),
    labelSide: 'right',
  },
};

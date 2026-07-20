import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';

import { LoadingProgress } from './LoadingProgress';

// Credential-free coverage of the three-step report loader (concept B — see spec/013-loader). The
// presentational component is driven entirely by props, so every phase of the load is documented here
// without a backend. `primaryRequested`/`primaryReceived` are the primary snapshot the container
// captures at the primary→children transition.
const meta: Meta<typeof LoadingProgress> = {
  title: 'TimelineReport/LoadingProgress',
  component: LoadingProgress,
};
export default meta;

type Story = StoryObj<typeof LoadingProgress>;

/** Root JQL count is still being estimated — primary bar is an empty gray track until the count arrives. */
export const Estimating: Story = {
  args: { status: 'pending', phase: 'primary' },
};

/** Primary work items streaming in; history has started fetching concurrently. */
export const LoadingPrimary: Story = {
  args: {
    status: 'pending',
    phase: 'primary',
    issuesRequested: 342,
    issuesReceived: 120,
    changeLogsRequested: 100,
    changeLogsReceived: 40,
  },
};

/** Children discovery — the total grows, scoped to the children step; history fills alongside. */
export const LoadingChildren: Story = {
  args: {
    status: 'pending',
    phase: 'children',
    primaryRequested: 342,
    primaryReceived: 342,
    issuesRequested: 822,
    issuesReceived: 474,
    changeLogsRequested: 660,
    changeLogsReceived: 512,
  },
};

/** Children discovery with the container's smoothed projection: the bar + a projected "~total". */
export const LoadingChildrenSmoothed: Story = {
  args: {
    status: 'pending',
    phase: 'children',
    primaryRequested: 342,
    primaryReceived: 342,
    issuesRequested: 822,
    issuesReceived: 474,
    changeLogsRequested: 660,
    changeLogsReceived: 512,
    childrenBarValue: 55,
    childrenProjectedTotal: 600,
  },
};

/** Later in discovery: the child total has jumped up again (never rewinds the primary step). */
export const ChildrenTotalGrew: Story = {
  args: {
    status: 'pending',
    phase: 'children',
    primaryRequested: 342,
    primaryReceived: 342,
    issuesRequested: 1282,
    issuesReceived: 940,
    changeLogsRequested: 1132,
    changeLogsReceived: 900,
  },
};

/** No "Load all children" — phase never reaches 'children', so only two steps show. */
export const NoChildren: Story = {
  args: {
    status: 'pending',
    phase: 'primary',
    issuesRequested: 342,
    issuesReceived: 342,
    changeLogsRequested: 342,
    changeLogsReceived: 210,
  },
};

/** Everything loaded (with children) — all three steps checked off. */
export const AllDone: Story = {
  args: {
    status: 'resolved',
    phase: 'children',
    primaryRequested: 342,
    primaryReceived: 342,
    issuesRequested: 1282,
    issuesReceived: 1282,
    changeLogsRequested: 1282,
    changeLogsReceived: 1282,
  },
};

/** Everything loaded (no children) — two steps checked off. */
export const AllDoneNoChildren: Story = {
  args: {
    status: 'resolved',
    issuesRequested: 342,
    issuesReceived: 342,
    changeLogsRequested: 342,
    changeLogsReceived: 342,
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';

import { NoJqlMessage, LoadingMessage, EmptyResultMessage, ErrorMessage } from './ReportMessages';

// Credential-free coverage of the report shell's non-report view states. The live app can't easily
// be driven into the error/licensing states, so they're documented here.
const meta: Meta = {
  title: 'TimelineReport/View States',
};
export default meta;

type Story = StoryObj;

/** Logged in, no JQL configured yet. */
export const NoJql: Story = {
  render: () => <NoJqlMessage />,
};

/** Request pending, progress not yet known. */
export const Loading: Story = {
  render: () => <LoadingMessage />,
};

/** Request pending, with progress counts. */
export const LoadingWithProgress: Story = {
  render: () => <LoadingMessage issuesRequested={120} issuesReceived={45} />,
};

/** Request resolved, but nothing matched. */
export const EmptyResult: Story = {
  render: () => <EmptyResultMessage count={0} primaryIssueType="Initiative" />,
};

/** Request rejected with a generic Jira error. */
export const ErrorGeneric: Story = {
  render: () => <ErrorMessage noLicense={false} errorMessage="Field 'foo' does not exist or is not searchable." />,
};

/** Request rejected because the account has no license. */
export const ErrorNoLicense: Story = {
  render: () => <ErrorMessage noLicense={true} />,
};

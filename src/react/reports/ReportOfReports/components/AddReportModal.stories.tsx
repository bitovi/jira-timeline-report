import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Report } from '../../../../jira/reports';
import type { Jira } from '../../../../jira-oidc-helpers';
import { JiraProvider } from '../../../services/jira/JiraProvider';
import { jiraKeys } from '../../../services/jira/key-factory';
import { AddReportModal } from './AddReportModal';

// The Value Report half fetches; the saved-report half doesn't. Same seeding as
// `ValueReportForm.stories.tsx` — catalog pre-seeded into the cache (it's a suspense query), picker
// suggestions through a stub.
const mockFields = [
  { name: 'Summary', key: 'summary', schema: { type: 'string' }, id: 'summary', custom: false },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Story points', key: 'customfield_10014', schema: { type: 'number' }, id: 'customfield_10014', custom: true },
];

const jira = {
  fetchJiraFields: async () => mockFields,
  fetchIssuePickerSuggestions: async (query: string) => ({
    sections: [{ id: 'cs', issues: [{ key: `${query.toUpperCase()}-1`, summaryText: 'Migrate auth to OIDC' }] }],
  }),
} as unknown as Jira;

const TYPES = ['start-due', 'due', 'table', 'scatter-plot'];

/** Enough rows that the list scrolls — which is the whole point of the restructure. */
const many = (count: number): Report[] =>
  Array.from({ length: count }, (_, at) => ({
    id: `r${at}`,
    name: `${['Q3 Delivery', 'Auth Migration', 'Platform Health', 'Billing Rollout'][at % 4]} ${at + 1}`,
    queryParams: `primaryReportType=${TYPES[at % TYPES.length]}&jql=${encodeURIComponent(
      `project = ECOM AND fixVersion in (releasedVersions()) AND status != Done ORDER BY rank`,
    )}`,
  }));

const withJira = (Story: React.FC) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(jiraKeys.issueFields('auth'), mockFields);
  client.setQueryData(jiraKeys.issueFields('sample'), mockFields);

  return (
    <QueryClientProvider client={client}>
      <JiraProvider jira={jira}>
        <Story />
      </JiraProvider>
    </QueryClientProvider>
  );
};

const meta: Meta<typeof AddReportModal> = {
  title: 'Reports/ReportOfReports/AddReportModal',
  component: AddReportModal,
  decorators: [withJira],
  args: {
    isOpen: true,
    reports: many(24),
    onSelect: () => {},
    onAddValue: () => {},
    onClose: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof AddReportModal>;

/**
 * **The case the restructure is for.** Scroll the list: the header, the Value Report band, the Saved
 * Report label and its search field all stay put, and the fade at the bottom edge says there is more.
 * Before, the whole body scrolled and the search field you were typing into left the dialog.
 */
export const LongList: Story = {};

/** Opened from inside a section, so the header names where the node will land. */
export const FromASection: Story = {
  args: { destination: 'Q3 Initiative' },
};

/** A section that exists but hasn't been named — still a destination, and still worth saying. */
export const FromAnUntitledSection: Story = {
  args: { destination: '' },
};

/** Short enough not to scroll: the dialog shrinks to fit rather than holding a fixed height. */
export const FewReports: Story = {
  args: { reports: many(2) },
};

/**
 * The Value Report half has to stay usable when there is nothing to embed — the two halves are
 * independent, and this is the state a brand-new install is in.
 */
export const NoSavedReports: Story = {
  args: { reports: [] },
};

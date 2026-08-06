import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Jira } from '../../../../jira-oidc-helpers';
import type { JiraIssuePickerResponse } from '../../../../jira-oidc-helpers/jira';
import { JiraProvider } from '../../../services/jira/JiraProvider';
import { jiraKeys } from '../../../services/jira/key-factory';
import { ValueReportForm } from './ValueReportForm';

// ---------------------------------------------------------------------------------------------------
// Both of this component's fetches, faked — Storybook has no credentials and can't `vi.mock`.
//
// The field catalog is a `useSuspenseQuery`, so it is PRE-SEEDED into the cache under its exact key
// with `staleTime: Infinity`; the query function never runs. The suggestion list is an ordinary
// `useQuery`, so it just goes through a stub `fetchIssuePickerSuggestions` — which is also where the
// loading and empty states come from, by making that stub slow or barren.
// The pattern is `TableReport.stories.tsx`'s.
// ---------------------------------------------------------------------------------------------------

const mockFields = [
  { name: 'Summary', key: 'summary', schema: { type: 'string' }, id: 'summary', custom: false },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Assignee', key: 'assignee', schema: { type: 'user' }, id: 'assignee', custom: false },
  { name: 'Story points', key: 'customfield_10014', schema: { type: 'number' }, id: 'customfield_10014', custom: true },
  { name: 'Epic Link', key: 'customfield_10008', schema: { type: 'string' }, id: 'customfield_10008', custom: true },
];

const suggestions: JiraIssuePickerResponse = {
  sections: [
    {
      id: 'cs',
      label: 'Current Search',
      issues: [
        { key: 'ABC-1', summaryText: 'Migrate auth to OIDC' },
        { key: 'ABC-14', summaryText: 'Retire the legacy token exchange' },
      ],
    },
    { id: 'hs', label: 'History Search', issues: [{ key: 'OPS-92', summaryText: 'Rotate the signing key' }] },
  ],
};

const makeJira = (respond: () => Promise<JiraIssuePickerResponse>): Jira =>
  ({ fetchJiraFields: async () => mockFields, fetchIssuePickerSuggestions: respond }) as unknown as Jira;

const withJira = (jira: Jira) => (Story: React.FC) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  // Both modes: the catalog hook keys on login state, which Storybook doesn't control.
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

const meta: Meta<typeof ValueReportForm> = {
  title: 'Reports/ReportOfReports/ValueReportForm',
  component: ValueReportForm,
  decorators: [
    (Story) => (
      <div className="w-[40rem] p-4">
        <Story />
      </div>
    ),
  ],
  args: { onAdd: () => {} },
};
export default meta;

type Story = StoryObj<typeof ValueReportForm>;

/**
 * At rest, before anything is typed — `+` is disabled and both selects show their placeholders. The
 * work-item list stays empty until two characters are typed, so there is nothing to show here yet.
 */
export const Resting: Story = {
  decorators: [withJira(makeJira(async () => suggestions))],
};

/** A suggestion lookup that never lands, so the select holds its spinner. Type two characters. */
export const Loading: Story = {
  decorators: [withJira(makeJira(() => new Promise(() => {})))],
};

export const NoResults: Story = {
  decorators: [withJira(makeJira(async () => ({ sections: [] })))],
};

/**
 * **Both menus have to paint above a modal.** These stories render the form on a bare page, where a
 * clipped or under-layered menu still looks right — so review this one inside the real Add Report modal
 * too. See the `menuAboveModal` styles for what goes wrong without them.
 */
export const InAModal: Story = {
  decorators: [
    withJira(makeJira(async () => suggestions)),
    (Story) => (
      <div className="rounded border border-neutral-301 bg-neutral-100 p-4 shadow-lg">
        <h2 className="pb-3 text-lg font-semibold">Add Report</h2>
        <Story />
      </div>
    ),
  ],
};

/** A failed lookup must leave the form usable — the field half and `+` still work. */
export const SuggestionsFailed: Story = {
  decorators: [
    withJira(
      makeJira(async () => {
        throw new Error('Jira said no');
      }),
    ),
  ],
};

/** Wired the way the modal wires it, so the enabled `+` and the reset-after-add are both reviewable. */
export const Interactive: Story = {
  decorators: [withJira(makeJira(async () => suggestions))],
  render: () => {
    const [added, setAdded] = useState<string[]>([]);

    return (
      <div className="flex flex-col gap-3">
        <ValueReportForm onAdd={(expression) => setAdded((all) => [...all, expression])} />
        <ul className="flex flex-col gap-1 text-sm">
          {added.map((expression, at) => (
            <li key={at} className="font-mono text-slate-600">
              {expression}
            </li>
          ))}
        </ul>
      </div>
    );
  },
};

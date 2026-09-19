import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Jira } from '../../../../../jira-oidc-helpers';
import type { AppStorage } from '../../../../../jira/storage/common';

import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { JiraProvider, jiraKeys } from '../../../../services/jira';
import { StorageProvider } from '../../../../services/storage';
import { updateTeamConfigurationKeys } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';
import { TeamCapacityInputs, TeamCapacityOutputs } from './TeamCapacityControls';

const Row = () => (
  <div className="flex max-w-[1080px] items-center justify-between bg-neutral-20 px-2 py-1.5 text-xs text-slate-600">
    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
      ORDER
      <TeamCapacityInputs teamName="ORDER" hierarchyLevel={7} savedVelocityPerSprint={21} savedTracks={1} />
    </span>
    <TeamCapacityOutputs pointsPerDay={2.1} totalWorkingDays={38} />
  </div>
);

// `useTeamCommit` reads team settings through suspense queries. Seeding the cache keeps the story
// self-contained: the query functions never run, so the stubs below only satisfy the context guards.
const buildQueryClient = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  queryClient.setQueryData(jiraKeys.issueFields('auth'), []);
  queryClient.setQueryData(updateTeamConfigurationKeys.allTeamData, {
    issueHeirarchy: [],
    savedUserData: { ORDER: { defaults: { velocityPerSprint: 21, tracks: 1 } } },
  });

  return queryClient;
};

const jira = { fetchJiraFields: () => Promise.resolve([]) } as unknown as Jira;

const storage: AppStorage = {
  get: () => Promise.resolve(null),
  update: () => Promise.resolve(),
  storageInitialized: () => Promise.resolve(true),
};

const meta: Meta<typeof Row> = {
  title: 'reports/AutoScheduler/TeamCapacityControls',
  component: Row,
  decorators: [
    (Story) => (
      <FlagsProvider>
        <JiraProvider jira={jira}>
          <StorageProvider storage={storage}>
            <QueryClientProvider client={buildQueryClient()}>
              <CapacityOverridesProvider>
                <Suspense fallback="loading">
                  <Story />
                </Suspense>
              </CapacityOverridesProvider>
            </QueryClientProvider>
          </StorageProvider>
        </JiraProvider>
      </FlagsProvider>
    ),
  ],
};

export default meta;

/** At rest: no commit controls, capacity reads as plain text until hovered. */
export const Clean: StoryObj<typeof Row> = {};

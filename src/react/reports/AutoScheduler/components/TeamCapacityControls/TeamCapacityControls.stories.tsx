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

/**
 * A stand-in for `TeamHeaderRow`'s controls row in `AutoScheduler.tsx` — the real one is a grid item,
 * which there is no way to render here. Its classes are kept in step with the real row so the wrap
 * behaviour the stories demonstrate is the behaviour the report has; `width` stands in for the grid
 * track, which is what actually squeezes in the app.
 */
const Row = ({ width }: { width: number }) => (
  <div className="bg-neutral-20" style={{ maxWidth: width }}>
    <div className="pl-0 pt-1.5 pb-1 pr-3 text-xs flex flex-wrap items-center justify-between gap-x-4 gap-y-1 relative">
      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
        ORDER
        <TeamCapacityInputs teamName="ORDER" hierarchyLevel={7} savedVelocityPerSprint={21} savedTracks={1} />
      </span>
      <TeamCapacityOutputs pointsPerDay={2.1} totalWorkingDays={38} />
    </div>
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
  args: { width: 1080 },
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

/** The squeezed case: the outputs drop to a second line instead of painting over the inputs. */
export const Narrow: StoryObj<typeof Row> = { args: { width: 420 } };

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Jira } from '../../../../../jira-oidc-helpers';
import type { AppStorage } from '../../../../../jira/storage/common';
import type { EstimateUnit } from '../../../../../jira/shared/types';

import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { JiraProvider, jiraKeys } from '../../../../services/jira';
import { StorageProvider } from '../../../../services/storage';
import { updateTeamConfigurationKeys } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';
import { TeamCapacityInputs, TeamCapacityOutputs } from './TeamCapacityControls';
import { itemLabelFor } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

/**
 * A stand-in for `TeamHeaderRow`'s controls row in `AutoScheduler.tsx` — the real one is a grid item,
 * which there is no way to render here. Its classes are kept in step with the real row so the wrap
 * behaviour the stories demonstrate is the behaviour the report has; `width` stands in for the grid
 * track, which is what actually squeezes in the app.
 */
type RowProps = {
  width: number;
  estimateUnit?: EstimateUnit;
  /** X: estimate units one person finishes per working day — see `shared/estimation.ts`. */
  pointsPerPersonDay?: number;
  teamMembers?: number;
  periodDays?: number;
};

const Row = ({ width, estimateUnit, pointsPerPersonDay = 0.21, teamMembers = 10, periodDays = 10 }: RowProps) => (
  <div className="bg-neutral-20" style={{ maxWidth: width }}>
    <div className="pl-0 pt-1.5 pb-1 pr-3 text-xs flex flex-wrap items-center justify-between gap-x-4 gap-y-1 relative">
      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
        ORDER
        <TeamCapacityInputs
          teamName="ORDER"
          hierarchyLevel={7}
          itemLabel={itemLabelFor('Epic')}
          periodDays={periodDays}
          estimateUnit={estimateUnit}
          savedPointsPerPersonDay={pointsPerPersonDay}
          savedTracks={1}
          savedTeamMembers={teamMembers}
        />
      </span>
      <TeamCapacityOutputs totalWorkingDays={38} />
    </div>
  </div>
);

// `useTeamCommit` reads team settings through suspense queries. Seeding the cache keeps the story
// self-contained: the query functions never run, so the stubs below only satisfy the context guards.
const buildQueryClient = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  queryClient.setQueryData(jiraKeys.issueFields('auth'), [{ id: 'customfield_10016', name: 'Story Points' }]);
  queryClient.setQueryData(updateTeamConfigurationKeys.allTeamData, {
    issueHeirarchy: [],
    savedUserData: {
      __GLOBAL__: { defaults: {} },
      ORDER: { defaults: { estimateField: 'customfield_10016', teamMembers: 10, tracks: 1 } },
    },
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

/** Dev Days: one per developer per day, so the team total is the headcount. */
export const DevDays: StoryObj<typeof Row> = {
  args: { estimateUnit: 'devDays', pointsPerPersonDay: 1 },
};

/** Team Weeks, 5 people per estimate: X = 1 / (5 × 5) = 0.04, so 10 developers do 0.4 a day. */
export const TeamWeeks: StoryObj<typeof Row> = {
  args: { estimateUnit: 'teamWeeks', pointsPerPersonDay: 0.04 },
};

/** Team Sprints, 5 people per estimate and 2-week sprints: X = 1 / (5 × 10) = 0.02. */
export const TeamSprints: StoryObj<typeof Row> = {
  args: { estimateUnit: 'teamSprints', pointsPerPersonDay: 0.02 },
};

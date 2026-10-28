import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FiltersPanelView } from './FiltersPanel';
import { FilterTabBodyView } from './FilterTabBody';
import { pluralize } from '../Filters/hooks/useFilterTabs';
import type { FilterTab } from '../Filters/hooks/useFilterTabs';
import {
  ALL_LEVELS,
  countActiveFilters,
  RELEASE_LEVEL,
  type LevelFilters,
} from '../../../../jira/rollup/filter-rows/level-filters';

// The stories drive the presentation-only views with local state, since the connected panel reads
// the route-data singleton, which resolves from loaded Jira issues.

const statusOptions = [
  { label: 'To Do (12)', value: 'To Do' },
  { label: 'In Progress (7)', value: 'In Progress' },
  { label: 'Done (21)', value: 'Done' },
];
const rollupStatusOptions = [
  { label: 'On track (9)', value: 'ontrack' },
  { label: 'Behind (3)', value: 'behind' },
  { label: 'Blocked (1)', value: 'blocked' },
  { label: 'Newly started (2)', value: 'newlyStarted' },
];
const releaseOptions = ['1.0.0', '1.1.0', '2.0.0', 'Spring launch'].map((name) => ({ label: name, value: name }));

interface Args {
  levels: string[];
  /** Level names above Report on, which offer no Rollup Status. */
  above: string[];
  isRelease: boolean;
  initialFilters: LevelFilters;
  initialExcludedStatuses: string[];
}

const Harness = ({ levels, above, isRelease, initialFilters, initialExcludedStatuses }: Args) => {
  const [levelFilters, setLevelFilters] = useState<LevelFilters>(initialFilters);
  const [excludedStatuses, setExcludedStatuses] = useState(initialExcludedStatuses);
  const keys = [ALL_LEVELS, ...(isRelease ? [RELEASE_LEVEL] : []), ...levels];
  const tabs: FilterTab[] = keys.map((key) => ({
    key,
    label: key === ALL_LEVELS ? 'All items' : pluralize(key),
    count: countActiveFilters(levelFilters[key]) + (key === ALL_LEVELS && excludedStatuses.length ? 1 : 0),
  }));

  return (
    <FiltersPanelView
      defaultOpen
      tabs={tabs}
      onClearAll={() => {
        setLevelFilters({});
        setExcludedStatuses([]);
      }}
      renderTab={(tab) => (
        <FilterTabBodyView
          tab={tab}
          filter={levelFilters[tab.key] ?? { rows: [] }}
          onChange={(filter) => setLevelFilters({ ...levelFilters, [tab.key]: filter })}
          statusOptions={statusOptions}
          rollupStatusOptions={above.includes(tab.key) ? [] : rollupStatusOptions}
          issueTypeOptions={
            tab.key === ALL_LEVELS
              ? levels.map((level) => ({ label: `${level} (4)`, value: level }))
              : [{ label: `${tab.key} (4)`, value: tab.key }]
          }
          releaseOptions={releaseOptions}
          excludedStatuses={excludedStatuses}
          excludableStatusOptions={statusOptions}
          onExcludedStatusesChange={setExcludedStatuses}
        />
      )}
    />
  );
};

const meta: Meta<Args> = {
  title: 'ReportControls/FiltersPanel',
  component: Harness,
  args: {
    levels: ['Initiative', 'Epic', 'Story'],
    above: ['Initiative'],
    isRelease: false,
    initialFilters: {},
    initialExcludedStatuses: [],
  },
};

export default meta;
type Story = StoryObj<Args>;

export const AllItems: Story = {
  args: {
    initialFilters: {
      all: { rows: [{ id: 'r1', field: 'issueType', operator: 'is not', value: ['Story'] }] },
    },
    initialExcludedStatuses: ['Done'],
  },
};

/** Select the Epics tab: Report on with a legacy-style status row, a date range and the toggle on. */
export const MidLevelTab: Story = {
  args: {
    initialFilters: {
      Epic: {
        rows: [{ id: 'r1', field: 'jiraStatus', operator: 'is', value: ['In Progress'] }],
        hideWithoutDates: true,
        dueDateStart: '2026-10-01',
        dueDateEnd: '2026-12-31',
      },
      Initiative: { rows: [{ id: 'r2', field: 'jiraStatus', operator: 'is not', value: ['Done'] }] },
    },
  },
};

/** Select the Releases tab to see the release picker and the SemVer toggle. */
export const ReleasesTab: Story = {
  args: {
    isRelease: true,
    levels: ['Epic', 'Story'],
    above: [],
    initialFilters: { Release: { rows: [], releasesToShow: ['1.0.0'], showOnlySemverReleases: true } },
  },
};

export const ManyTabs: Story = {
  args: {
    levels: ['Outcome', 'Objective', 'Initiative', 'Feature', 'Epic', 'Story', 'Sub-task'],
    above: ['Outcome', 'Objective', 'Initiative', 'Feature'],
    initialFilters: { Story: { rows: [], hideWithoutDates: true } },
  },
};

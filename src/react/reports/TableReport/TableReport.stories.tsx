import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueFields } from './model/buildColumnCatalog';
import type { TableColumnEntry } from './model/persistence';
import type { FilterState } from './model/applyView';
import type { Jira } from '../../../jira-oidc-helpers';
import { JiraProvider } from '../../services/jira/JiraProvider';
import { jiraKeys } from '../../services/jira/key-factory';
import { TableReport } from './TableReport';

// ---------------------------------------------------------------------------------------------------
// Seeding the Jira fields WITHOUT credentials.
//
// TableReport calls `useJiraIssueFields()`, which is a `useSuspenseQuery` keyed on
// `jiraKeys.allIssueFields()` whose `queryFn` calls `useJira().fetchJiraFields()`. Storybook can't use
// `vi.mock` (that's the test's approach), so instead we PRE-SEED a QueryClient's cache with the field
// list under that exact query key and give it `staleTime: Infinity`. Because the data is already in
// the cache and never goes stale, `useSuspenseQuery` resolves synchronously and the `queryFn` (which
// would need real OAuth) never runs. A stub `JiraProvider` is still required only because the hook
// calls `useJira()` unconditionally at the top — the stub is never actually invoked.
// ---------------------------------------------------------------------------------------------------

/** The three Jira fields the stories reference: Story Points (number), Status + Priority (string). */
const mockFields: IssueFields = [
  { name: 'Story Points', key: 'customfield_1', schema: { type: 'number' }, id: 'customfield_1', custom: true },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Priority', key: 'priority', schema: { type: 'string' }, id: 'priority', custom: false },
  // Object-valued / derived concepts (issues-plan.md #3/#4): Parent is object-valued in raw Jira,
  // Team isn't a raw field at all — both are sourced from the normalized issue.
  { name: 'Parent', key: 'parent', schema: { type: 'string' }, id: 'parent', custom: false },
  { name: 'Team', key: 'customfield_team', schema: { type: 'string' }, id: 'customfield_team', custom: true },
  // Date-bucket grouping demo (spec/012-table-and-grouper/date-bucket-grouping.md).
  { name: 'Due date', key: 'duedate', schema: { type: 'date' }, id: 'duedate', custom: false },
];

/** Fresh QueryClient with the field list pre-seeded so the suspense query resolves without a network call. */
const makeSeededClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(jiraKeys.allIssueFields(), mockFields);
  return client;
};

/** Stub Jira service — only needed so `useJira()` doesn't throw; its methods are never called. */
const stubJira = { fetchJiraFields: async () => mockFields } as unknown as Jira;

const SeedDecorator = (Story: React.FC) => (
  <QueryClientProvider client={makeSeededClient()}>
    <JiraProvider jira={stubJira}>
      <Story />
    </JiraProvider>
  </QueryClientProvider>
);

// ---------------------------------------------------------------------------------------------------
// Observable stub — mirrors the writable CanObservable stub in TableReport.test.tsx so the report can
// both read (`.value` / `.get`) and write persisted state back (`obs.value = next`) and re-render.
// ---------------------------------------------------------------------------------------------------
const makeObs = <T,>(value: T): CanObservable<T> => {
  let current = value;
  const handlers = new Set<() => void>();
  const notify = () => handlers.forEach((h) => h());
  return {
    get value() {
      return current;
    },
    set value(v: T) {
      current = v;
      notify();
    },
    get: () => current,
    getData: () => current,
    set: (v: T) => {
      current = v;
      notify();
    },
    on: (h: () => void) => handlers.add(h),
    off: (h: () => void) => handlers.delete(h),
  } as unknown as CanObservable<T>;
};

// ---------------------------------------------------------------------------------------------------
// Sample data. Flat issues carry Status/Priority/Story Points fields (keyed by DISPLAY NAME, as the
// pipeline hands them to reports) plus `derivedTiming` so the Estimation columns paint values.
// ---------------------------------------------------------------------------------------------------

/** A flat (top-level) issue with fields + timing so field & estimation columns render real values. */
const makeFlatIssue = (
  key: string,
  summary: string,
  status: string,
  priority: string,
  points: number,
  estimatedDays: number,
  dueDate: string,
) =>
  ({
    key,
    summary,
    url: `https://example.test/browse/${key}`,
    hierarchyLevel: 1,
    // Normalized top-level properties the field columns read (prefer-normalized, issues-plan.md #4).
    parentKey: Number(key.slice(-1)) % 2 === 0 ? 'PROJ-1 (Platform)' : 'PROJ-2 (Growth)',
    team: { name: Number(key.slice(-1)) % 2 === 0 ? 'Cloud Squad' : 'Mobile Squad' },
    derivedTiming: {
      isStoryPointsMedianValid: true,
      deterministicTotalDaysOfWork: estimatedDays,
      datesDaysOfWork: estimatedDays,
      due: dueDate,
    },
    completionRollup: { totalWorkingDays: estimatedDays },
    issue: {
      fields: {
        'Issue Type': { iconUrl: '' },
        Status: status,
        Priority: priority,
        'Story Points': points,
        'Due date': dueDate,
      },
    },
  }) as any;

const STATUSES = ['To Do', 'In Progress', 'Done'];
const PRIORITIES = ['High', 'Medium', 'Low'];

/** 15 flat issues spread across statuses/priorities with varied points, estimates and due dates. */
const flatIssues = Array.from({ length: 15 }, (_, i) => {
  const n = i + 1;
  return makeFlatIssue(
    `PROJ-${100 + n}`,
    `Deliverable ${n}: ${['Login', 'Search', 'Checkout', 'Profile', 'Reports'][i % 5]} work`,
    STATUSES[i % 3],
    PRIORITIES[i % 3],
    [1, 2, 3, 5, 8][i % 5],
    [1, 2, 3, 5, 8][i % 5] * 1.5,
    `2026-0${(i % 6) + 1}-15`,
  );
});

// --- Hierarchy sample: 3 epics, each with 2-3 child stories (a rolled-up tree) --------------------

/** A rolled-up issue for hierarchy mode (childKeys + rollup timing, keyed like the pipeline). */
const makeRollup = (
  key: string,
  summary: string,
  status: string,
  points: number,
  estimatedDays: number,
  childKeys: string[] = [],
  parentKey: string | null = null,
  teamName = 'Unassigned',
) =>
  ({
    key,
    summary,
    url: `https://example.test/browse/${key}`,
    reportingHierarchy: { childKeys },
    // Normalized top-level properties for object/derived field columns (issues-plan.md #3/#4).
    parentKey,
    team: { name: teamName },
    derivedTiming: {
      isStoryPointsMedianValid: true,
      deterministicTotalDaysOfWork: estimatedDays,
      datesDaysOfWork: estimatedDays,
    },
    completionRollup: { totalWorkingDays: estimatedDays },
    issue: {
      fields: {
        'Issue Type': { iconUrl: '' },
        Status: status,
        'Story Points': points,
      },
    },
  }) as any;

const epics = [
  { key: 'EPIC-1', title: 'Authentication', children: ['STORY-1', 'STORY-2', 'STORY-3'] },
  { key: 'EPIC-2', title: 'Search & Discovery', children: ['STORY-4', 'STORY-5'] },
  { key: 'EPIC-3', title: 'Checkout', children: ['STORY-6', 'STORY-7', 'STORY-8'] },
];

const TEAMS = ['Platform Team', 'Growth Team', 'Data Team'];

const hierarchyRoots = epics.map((e, i) =>
  makeRollup(e.key, e.title, STATUSES[i % 3], (i + 2) * 5, (i + 2) * 8, e.children, null, TEAMS[i % 3]),
);

const hierarchyChildren = epics.flatMap((e, ei) =>
  e.children.map((childKey, ci) =>
    makeRollup(
      childKey,
      `${e.title} — task ${ci + 1}`,
      STATUSES[(ei + ci) % 3],
      [2, 3, 5][ci % 3],
      [3, 4, 6][ci % 3],
      [],
      e.key,
      TEAMS[ei % 3],
    ),
  ),
);

const hierarchyAll = [...hierarchyRoots, ...hierarchyChildren];

// ---------------------------------------------------------------------------------------------------
// Story args + render. Each story supplies its own persisted-state observables so the report renders
// in the desired mode (flat / hierarchy / grouped / cross-tab) directly, no clicks required.
// ---------------------------------------------------------------------------------------------------
interface Args {
  columns: TableColumnEntry[];
  sortColumn: string;
  sortDir: string;
  filters: FilterState;
  groupBy: string;
  groupByCol: string;
  groupByGranularity: string;
  groupByColGranularity: string;
  fieldAxis: string;
  showRowTotals: boolean;
  showColTotals: boolean;
  /** Flat-mode derived issues. */
  derived: any[];
  /** Hierarchy roots + full set. */
  primary: any[];
  all: any[];
}

const meta: Meta<Args> = {
  title: 'Reports/TableReport/TableReport',
  decorators: [SeedDecorator],
  render: (args) => (
    <TableReport
      filteredDerivedIssuesObs={makeObs(args.derived)}
      rollupTimingLevelsAndCalculationsObs={makeObs([{ hierarchyLevel: 1 }])}
      primaryIssuesOrReleasesObs={makeObs(args.primary)}
      allIssuesOrReleasesObs={makeObs(args.all)}
      tableColumnsObs={makeObs(args.columns)}
      tableSortColumnObs={makeObs(args.sortColumn)}
      tableSortDirObs={makeObs(args.sortDir)}
      tableFiltersObs={makeObs(args.filters)}
      tableGroupByObs={makeObs(args.groupBy)}
      tableGroupByColObs={makeObs(args.groupByCol)}
      tableGroupByGranularityObs={makeObs(args.groupByGranularity)}
      tableGroupByColGranularityObs={makeObs(args.groupByColGranularity)}
      tableFieldAxisObs={makeObs(args.fieldAxis)}
      tableShowRowTotalsObs={makeObs(args.showRowTotals)}
      tableShowColTotalsObs={makeObs(args.showColTotals)}
    />
  ),
  args: {
    columns: [{ sourceId: 'identity:key' }, { sourceId: 'identity:summary' }, { sourceId: 'identity:issueType' }],
    sortColumn: '',
    sortDir: 'asc',
    filters: {},
    groupBy: '',
    groupByCol: '',
    groupByGranularity: '',
    groupByColGranularity: '',
    fieldAxis: 'rows',
    // Both default OFF app-wide (spec: totals are opt-in), but the cross-tab stories below turn them
    // ON so they keep demonstrating the fuller cross-tab shape (Total column/row) they were built to
    // show off.
    showRowTotals: true,
    showColTotals: true,
    derived: flatIssues,
    primary: hierarchyRoots,
    all: hierarchyAll,
  },
};
export default meta;

type Story = StoryObj<Args>;

/** Flat table: default identity columns + Status/Priority/Story Points field columns, sorted by points desc. */
export const Flat: Story = {
  args: {
    columns: [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'identity:issueType' },
      { sourceId: 'field:status' },
      { sourceId: 'field:priority' },
      { sourceId: 'field:customfield_1' },
    ],
    sortColumn: 'field:customfield_1',
    sortDir: 'desc',
  },
};

/**
 * Object/normalized field columns (issues-plan.md #3/#4): Parent (object-valued in raw Jira) and
 * Team (not a raw field at all) render real values from the normalized issue and group into
 * distinct buckets instead of "[object Object]".
 */
export const ObjectFields: Story = {
  args: {
    columns: [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'field:parent' },
      { sourceId: 'field:customfield_team' },
      { sourceId: 'field:status' },
    ],
  },
};

/** Same object fields, grouped by Team — proves normalized grouping produces sane group keys. */
export const GroupedByTeam: Story = {
  args: {
    groupBy: 'field:customfield_team',
    columns: [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'field:customfield_team' },
      { sourceId: 'field:parent' },
      { sourceId: 'field:customfield_1' },
    ],
  },
};

/**
 * Date-bucket grouping (spec/012-table-and-grouper/date-bucket-grouping.md): grouped by Due Date at
 * Quarter granularity, so issues bucket into calendar quarters ("2026-Q1", "2026-Q2", …) instead of
 * one group per exact due-date timestamp.
 */
export const GroupedByDueDateQuarter: Story = {
  args: {
    groupBy: 'field:duedate',
    groupByGranularity: 'quarter',
    columns: [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'field:duedate' },
      { sourceId: 'field:status' },
      { sourceId: 'field:customfield_1' },
    ],
  },
};

/** Hierarchy: rolled-up tree with indent + expand/collapse carets, plus the Estimation columns. */
export const Hierarchy: Story = {
  args: {
    sortColumn: 'identity:summary',
    sortDir: 'tree',
    columns: [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'field:status' },
      { sourceId: 'estimation:estimatedDays' },
      { sourceId: 'estimation:timedDays' },
      { sourceId: 'estimation:rolledUpDays' },
    ],
  },
};

/** 1D grouping: grouped by Status with collapsed group headers showing counts + summed Story Points. */
export const Grouped1D: Story = {
  args: {
    groupBy: 'builtin:status:name',
    columns: [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'identity:issueType' },
      { sourceId: 'field:priority' },
      { sourceId: 'field:customfield_1' },
    ],
  },
};

/** 2D cross-tab (Down rows): Status down the rows, Priority across the columns, Story Points aggregated per cell. */
export const CrossTab2D: Story = {
  args: {
    groupBy: 'builtin:status:name',
    groupByCol: 'field:priority',
    fieldAxis: 'rows',
    columns: [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'builtin:status:name' },
      { sourceId: 'field:priority' },
      { sourceId: 'field:customfield_1' },
    ],
  },
};

/** 2D cross-tab (Across cols): the same pivot with the merged two-row header layout. */
export const CrossTab2DAcrossCols: Story = {
  args: {
    ...CrossTab2D.args,
    fieldAxis: 'cols',
  },
};

/**
 * 2D cross-tab (Hidden): only one measure (Story Points) is shown, so the "Field" column that would
 * otherwise just repeat "Story Points [Sum]" on every row is dropped — that label moves up into the
 * corner header instead.
 */
export const CrossTab2DHiddenField: Story = {
  args: {
    groupBy: 'builtin:status:name',
    groupByCol: 'field:priority',
    fieldAxis: 'hidden',
    columns: [{ sourceId: 'builtin:status:name' }, { sourceId: 'field:priority' }, { sourceId: 'field:customfield_1' }],
  },
};

/** 2D cross-tab with totals off (the app-wide default) — no "Total" column or row at all. */
export const CrossTab2DTotalsOff: Story = {
  args: {
    ...CrossTab2D.args,
    showRowTotals: false,
    showColTotals: false,
  },
};

/** 2D cross-tab with ONLY row totals on — the right-edge "Total" column, no bottom "Total" row. */
export const CrossTab2DRowTotalsOnly: Story = {
  args: {
    ...CrossTab2D.args,
    showRowTotals: true,
    showColTotals: false,
  },
};

/** 2D cross-tab with ONLY column totals on — the bottom "Total" row, no right-edge "Total" column. */
export const CrossTab2DColTotalsOnly: Story = {
  args: {
    ...CrossTab2D.args,
    showRowTotals: false,
    showColTotals: true,
  },
};

// ---------------------------------------------------------------------------------------------------
// Controls bar — renders the shared-row control component (Rows / Group by / Add column …) that lives
// next to the Report-type selector in ReportControls. Uses the same seeded-fields decorator; reads
// persisted config from the real route-data singleton (defaults).
// ---------------------------------------------------------------------------------------------------
import { TableReportControls } from './components/TableReportControls';

export const ControlsBar: StoryObj = {
  render: () => (
    <div className="p-4">
      {/* Mimic the real #report-controls row (flex gap-1) with sibling controls for alignment context. */}
      <div className="flex gap-1">
        <div className="pt-1 flex flex-col items-start">
          <span className="text-sm font-semibold text-neutral-801">Report type</span>
          <button className="border border-neutral-301 rounded px-2 py-1 text-sm bg-neutral-201">Table (beta) ▾</button>
        </div>
        <TableReportControls />
      </div>
    </div>
  ),
  decorators: [SeedDecorator],
};

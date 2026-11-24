import type { DerivedIssue } from '../../derived/derive';
import { normalizeAndDeriveIssues } from '../../derived/derive';
import type { JiraIssue } from '../../shared/types';
import { EPIC_HIERARCHY_LEVEL } from './work-settings';

/**
 * "Include the team's other overlapping work" (spec/046 § The team's other work): for each team in
 * the report, load its other epics whose dates overlap the loaded epics, so team time can split days
 * with them. Only epics: team time only sizes epics (spec § Scope: epics only). They are never shown
 * in the report.
 */

export type DateFields = { startDateField?: string | null; dueDateField?: string | null };

export type OtherWorkQuery = {
  /** Team name, as `issue.team.name`. */
  team: string;
  levels: number[];
  jql: string;
};

export type BuildOtherWorkQueryOptions = {
  /** The team's configured start/due date fields (names) at a hierarchy level. */
  dateFieldsFor: (team: string, hierarchyLevel: number) => DateFields;
  /** Field name → id (`fieldMaps.nameMap`), so the JQL doesn't depend on display names being unique. */
  nameToId?: Record<string, string>;
  /**
   * The Sources tab's optional filter, a plain JQL condition (e.g. `labels != report-ignore`) added to
   * each query as `AND (…)`. A leading `AND` is tolerated, for people used to the children filter.
   */
  filterJql?: string;
};

const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** A field reference for JQL: `cf[123]` for a custom field, the id for a system field, else the quoted name. */
export function jqlField(name: string, nameToId: Record<string, string> = {}): string {
  const id = nameToId[name];
  const custom = id && /^customfield_(\d+)$/.exec(id);
  if (custom) return `cf[${custom[1]}]`;
  if (id) return id;
  return quote(name);
}

function isoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** How to find the team's work in Jira: the Team field by id, or its project when it falls back to the project key. */
function teamClause(issues: DerivedIssue[], team: string, nameToId?: Record<string, string>): string | null {
  const teamField = issues.map((issue) => issue.issue?.fields?.Team).find((value) => value?.name === team);
  if (teamField?.id) {
    return `${jqlField('Team', nameToId)} = ${quote(teamField.id)}`;
  }
  if (issues.some((issue) => issue.projectKey === team)) {
    return `project = ${quote(team)}`;
  }
  return null;
}

/**
 * One query per team: its items at each level it has loaded items with dates, of the same issue
 * types, whose dates overlap the loaded items' date range at that level. Teams that can't be found
 * by Team field or project are skipped.
 */
export function buildOtherWorkQueries(issues: DerivedIssue[], options: BuildOtherWorkQueryOptions): OtherWorkQuery[] {
  const byTeam = new Map<string, Map<number, DerivedIssue[]>>();
  for (const issue of issues) {
    const { start, due } = issue.derivedTiming ?? {};
    if (issue.hierarchyLevel !== EPIC_HIERARCHY_LEVEL || !start || !due || !issue.team?.name) continue;
    const levels = byTeam.get(issue.team.name) ?? new Map<number, DerivedIssue[]>();
    const list = levels.get(issue.hierarchyLevel) ?? [];
    list.push(issue);
    levels.set(issue.hierarchyLevel, list);
    byTeam.set(issue.team.name, levels);
  }

  const queries: OtherWorkQuery[] = [];
  for (const [team, levels] of byTeam) {
    const teamIssues = [...levels.values()].flat();
    const teamJql = teamClause(teamIssues, team, options.nameToId);
    if (!teamJql) continue;

    const levelClauses: string[] = [];
    const usedLevels: number[] = [];
    for (const [level, levelIssues] of levels) {
      const { startDateField, dueDateField } = options.dateFieldsFor(team, level);
      if (!startDateField || !dueDateField) continue;
      const earliest = new Date(Math.min(...levelIssues.map((i) => i.derivedTiming.start!.getTime())));
      const latest = new Date(Math.max(...levelIssues.map((i) => i.derivedTiming.due!.getTime())));
      const types = [...new Set(levelIssues.map((i) => i.type))].map(quote).join(', ');
      levelClauses.push(
        `(issuetype in (${types}) AND ${jqlField(startDateField, options.nameToId)} <= ${quote(isoDate(latest))}` +
          ` AND ${jqlField(dueDateField, options.nameToId)} >= ${quote(isoDate(earliest))})`,
      );
      usedLevels.push(level);
    }
    if (levelClauses.length) {
      const filter = options.filterJql?.trim().replace(/^and\s+/i, '');
      queries.push({
        team,
        levels: usedLevels,
        jql: `${teamJql} AND (${levelClauses.join(' OR ')})${filter ? ` AND (${filter})` : ''}`,
      });
    }
  }
  return queries;
}

export type TeamOtherWorkResult = {
  /** The team's items at the same levels, overlapping the loaded ones, that aren't in the report. */
  issues: DerivedIssue[];
  /** Teams that were queried. */
  teamCount: number;
  /** Teams whose query failed. */
  failedTeams: string[];
};

export type LoadTeamOtherWorkOptions = BuildOtherWorkQueryOptions & {
  fetchIssues: (params: { jql: string; fields: string[] }) => Promise<JiraIssue[]>;
  /** Fields to load: the report's own, so the items normalize the same way. */
  fields: string[];
  /** The report's normalize configuration (with server defaults), as `derivedIssuesRequestData` uses. */
  configuration: Parameters<typeof normalizeAndDeriveIssues>[1];
  onProgress?: (progress: { done: number; total: number }) => void;
};

export async function loadTeamOtherWork(
  loadedIssues: DerivedIssue[],
  { fetchIssues, fields, configuration, onProgress, ...queryOptions }: LoadTeamOtherWorkOptions,
): Promise<TeamOtherWorkResult> {
  const queries = buildOtherWorkQueries(loadedIssues, queryOptions);
  const loadedKeys = new Set(loadedIssues.map((issue) => issue.key));
  const found = new Map<string, DerivedIssue>();
  const failedTeams: string[] = [];

  onProgress?.({ done: 0, total: queries.length });
  for (const [index, query] of queries.entries()) {
    try {
      const rawIssues = await fetchIssues({ jql: query.jql, fields });
      for (const raw of rawIssues) {
        if (loadedKeys.has(raw.key) || found.has(raw.key)) continue;
        const [derived] = normalizeAndDeriveIssues([raw], configuration);
        // JQL can't express "the same team as normalize decides", so check after normalizing
        if (derived.team?.name === query.team && query.levels.includes(derived.hierarchyLevel)) {
          found.set(raw.key, derived);
        }
      }
    } catch (error) {
      console.warn(`Could not load other work for team ${query.team}`, error);
      failedTeams.push(query.team);
    }
    onProgress?.({ done: index + 1, total: queries.length });
  }

  return { issues: [...found.values()], teamCount: queries.length, failedTeams };
}

/** What route data exposes while loading other work, for the sidebar's progress and result line. */
export type OtherWorkStatus =
  | { status: 'off' }
  | { status: 'unavailable'; reason: string }
  | { status: 'loading'; done: number; total: number }
  | ({ status: 'done' } & TeamOtherWorkResult);

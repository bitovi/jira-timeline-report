import { describe, expect, it, vi } from 'vitest';
import { buildOtherWorkQueries, jqlField, loadTeamOtherWork } from './other-work';
import type { DerivedIssue } from '../../derived/derive';
import type { JiraIssue } from '../../shared/types';

/** spec/046 § The team's other work. */

type Fixture = {
  key: string;
  team?: string;
  teamId?: string | null;
  level?: number;
  type?: string;
  start?: Date;
  due?: Date;
};

function loaded({ key, team = 'Atlas', teamId = 'team-uuid', level = 1, type = 'Epic', start, due }: Fixture) {
  return {
    key,
    type,
    hierarchyLevel: level,
    projectKey: key.replace(/-.*/, ''),
    team: { name: team },
    issue: { fields: { Team: teamId ? { name: team, id: teamId } : null } },
    derivedTiming: { start, due },
  } as unknown as DerivedIssue;
}

const DEFAULT_FIELDS = () => ({ startDateField: 'Start date', dueDateField: 'Due date' });
const NAME_TO_ID = { 'Start date': 'customfield_10015', 'Due date': 'duedate', Team: 'customfield_10001' };

describe('jqlField', () => {
  it('uses cf[n] for custom fields, the id for system fields, else the quoted name', () => {
    expect(jqlField('Start date', NAME_TO_ID)).toBe('cf[10015]');
    expect(jqlField('Due date', NAME_TO_ID)).toBe('duedate');
    expect(jqlField('My "odd" field', NAME_TO_ID)).toBe('"My \\"odd\\" field"');
  });
});

describe('buildOtherWorkQueries', () => {
  it('one query per team: Team field by id, epic types and overlapping date range (only epics)', () => {
    const queries = buildOtherWorkQueries(
      [
        loaded({ key: 'A-1', start: new Date(2024, 0, 8), due: new Date(2024, 1, 2) }),
        loaded({ key: 'A-2', start: new Date(2024, 0, 1), due: new Date(2024, 0, 19) }),
        loaded({ key: 'A-3', level: 2, type: 'Initiative', start: new Date(2024, 0, 1), due: new Date(2024, 2, 29) }),
      ],
      { dateFieldsFor: DEFAULT_FIELDS, nameToId: NAME_TO_ID },
    );
    expect(queries).toEqual([
      {
        team: 'Atlas',
        levels: [1],
        jql: 'cf[10001] = "team-uuid" AND ((issuetype in ("Epic") AND cf[10015] <= "2024-02-02" AND duedate >= "2024-01-01"))',
      },
    ]);
  });

  it('uses the project when the team falls back to its project key', () => {
    const [query] = buildOtherWorkQueries(
      [loaded({ key: 'ORDER-1', team: 'ORDER', teamId: null, start: new Date(2024, 0, 1), due: new Date(2024, 0, 5) })],
      { dateFieldsFor: DEFAULT_FIELDS },
    );
    expect(query.jql).toMatch(/^project = "ORDER" AND /);
    expect(query.jql).toContain('"Start date" <= "2024-01-05"');
  });

  it.each(['labels != report-ignore', ' AND labels != report-ignore '])(
    'adds the optional JQL filter to each query as AND (…) (%j)',
    (filterJql) => {
      const [query] = buildOtherWorkQueries(
        [loaded({ key: 'A-1', start: new Date(2024, 0, 1), due: new Date(2024, 0, 5) })],
        { dateFieldsFor: DEFAULT_FIELDS, filterJql },
      );
      expect(query.jql).toMatch(/\) AND \(labels != report-ignore\)$/);
    },
  );

  it('uses each team’s own date fields', () => {
    const [query] = buildOtherWorkQueries(
      [loaded({ key: 'A-1', start: new Date(2024, 0, 1), due: new Date(2024, 0, 5) })],
      { dateFieldsFor: () => ({ startDateField: 'Target start', dueDateField: 'Target end' }) },
    );
    expect(query.jql).toContain('"Target start" <= "2024-01-05" AND "Target end" >= "2024-01-01"');
  });

  it('skips items without both dates, and teams it can’t find', () => {
    expect(
      buildOtherWorkQueries(
        [
          loaded({ key: 'A-1', start: new Date(2024, 0, 1) }),
          // team named neither by a Team field nor by its project
          loaded({ key: 'B-1', team: 'Custom', teamId: null, start: new Date(2024, 0, 1), due: new Date(2024, 0, 5) }),
        ],
        { dateFieldsFor: DEFAULT_FIELDS },
      ),
    ).toEqual([]);
  });
});

describe('loadTeamOtherWork', () => {
  function raw(key: string, { team = 'Atlas', level = 1 } = {}): JiraIssue {
    return {
      id: key,
      key,
      fields: {
        Team: { name: team, id: 'team-uuid' },
        Summary: key,
        'Issue Type': { hierarchyLevel: level, name: level === 1 ? 'Epic' : 'Story' },
        'Start date': '2024-01-02',
        'Due date': '2024-01-12',
        Status: { id: '1', name: 'In Progress', statusCategory: { name: 'In Progress' } },
        Labels: [],
        'Fix versions': [],
        Sprint: null,
      },
    } as unknown as JiraIssue;
  }

  const report = [loaded({ key: 'A-1', start: new Date(2024, 0, 1), due: new Date(2024, 0, 31) })];

  it('derives the team’s other items and drops loaded ones and other teams or levels', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([
      raw('A-1'), // already in the report
      raw('A-2'),
      raw('A-3', { team: 'Someone else' }),
      raw('A-4', { level: 0 }),
    ]);
    const onProgress = vi.fn();
    const result = await loadTeamOtherWork(report, {
      dateFieldsFor: DEFAULT_FIELDS,
      fetchIssues,
      fields: ['Summary'],
      configuration: {},
      onProgress,
    });
    expect(fetchIssues).toHaveBeenCalledTimes(1);
    expect(fetchIssues.mock.calls[0][0].fields).toEqual(['Summary']);
    expect(result.issues.map((i) => i.key)).toEqual(['A-2']);
    expect(result.issues[0].derivedTiming.datesDaysOfWork).toBe(9);
    expect(result.teamCount).toBe(1);
    expect(onProgress).toHaveBeenLastCalledWith({ done: 1, total: 1 });
  });

  it('reports teams whose query failed and keeps going', async () => {
    const result = await loadTeamOtherWork(report, {
      dateFieldsFor: DEFAULT_FIELDS,
      fetchIssues: vi.fn().mockRejectedValue(new Error('400')),
      fields: [],
      configuration: {},
    });
    expect(result).toEqual({ issues: [], teamCount: 1, failedTeams: ['Atlas'] });
  });
});

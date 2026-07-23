import { describe, expect, test } from 'vitest';

import { buildColumnCatalog } from './buildColumnCatalog';

import type { IssueFields } from './buildColumnCatalog';
import type { TableIssue } from './columns';

const fields: IssueFields = [
  { name: 'Story Points', key: 'customfield_1', schema: { type: 'number' }, id: 'customfield_1', custom: true },
  { name: 'Due date', key: 'duedate', schema: { type: 'date' }, id: 'duedate', custom: false },
  { name: 'Description', key: 'description', schema: { type: 'string' }, id: 'description', custom: false },
  // `Components` is an unclaimed array field (unlike `Labels`, which is now a curated Common facet).
  {
    name: 'Components',
    key: 'components',
    schema: { type: 'array', items: 'string' },
    id: 'components',
    custom: false,
  },
  { name: 'Weird', key: 'weird', schema: { type: 'mystery' }, id: 'weird', custom: true },
];

describe('buildColumnCatalog', () => {
  const catalog = buildColumnCatalog(fields);

  test('produces identity + common + report-field + field columns (estimation under Report Fields)', () => {
    const groups = new Set(catalog.map((c) => c.group));
    expect(groups).toEqual(new Set(['Common', 'Identity', 'Report Fields', 'Fields']));

    const identity = catalog.filter((c) => c.group === 'Identity').map((c) => c.id);
    expect(identity).toEqual(['identity:treeSummary', 'identity:key', 'identity:summary', 'identity:issueType']);

    // Estimation parity columns now live under the Report Fields group.
    const estimation = catalog.filter((c) => c.id.startsWith('estimation:')).map((c) => c.id);
    expect(estimation).toEqual(['estimation:estimatedDays', 'estimation:timedDays', 'estimation:rolledUpDays']);
    expect(catalog.filter((c) => c.id.startsWith('estimation:')).every((c) => c.group === 'Report Fields')).toBe(true);

    // Curated built-in facets live in the `Common` group. Project Key is always available;
    // Project Name needs a `project` field, absent here.
    const common = catalog.filter((c) => c.group === 'Common').map((c) => c.id);
    expect(common).toContain('builtin:project:key');
    expect(common).not.toContain('builtin:project:name');
    // Derived Common facets (require nothing) are always offered.
    expect(common).toEqual(
      expect.arrayContaining([
        'builtin:issueType:name',
        'builtin:issueType:icon',
        'builtin:status:name',
        'builtin:status:category',
        'builtin:parent:key',
        'builtin:parent:summary',
        'builtin:parent:type',
        'builtin:team:name',
        'builtin:sprint:names',
        'builtin:release:names',
        'builtin:labels:list',
        'builtin:created:date',
        'builtin:rank:value',
      ]),
    );

    // Report Fields group: canonical per-issue normalized values (then the estimation parity
    // columns), always offered.
    const reportFields = catalog.filter((c) => c.group === 'Report Fields').map((c) => c.id);
    expect(reportFields).toEqual([
      'report:startDate',
      'report:dueDate',
      'report:storyPoints',
      'report:storyPointsMedian',
      'report:confidence',
      'estimation:estimatedDays',
      'estimation:timedDays',
      'estimation:rolledUpDays',
      'report:percentComplete',
    ]);

    // Report Fields sit between the Common facets and the generic field columns.
    const order = catalog.map((c) => c.group);
    expect(order.lastIndexOf('Common')).toBeLessThan(order.indexOf('Report Fields'));
    expect(order.lastIndexOf('Report Fields')).toBeLessThan(order.indexOf('Fields'));

    // Generic field columns: one per (unclaimed) Jira field — all 5 here are unclaimed.
    expect(catalog.filter((c) => c.group === 'Fields')).toHaveLength(fields.length);
  });

  test('field columns derive filter kind + defaultAggregate from schema.type', () => {
    const byId = new Map(catalog.map((c) => [c.id, c]));

    const points = byId.get('field:customfield_1')!;
    expect(points.filter).toEqual({ kind: 'number' });
    expect(points.defaultAggregate).toBe('sum');
    expect(points.aggregate).toBe('sum');
    expect(points.source).toEqual({
      kind: 'field',
      fieldKey: 'customfield_1',
      schemaType: 'number',
      schemaItems: undefined,
    });

    const due = byId.get('field:duedate')!;
    expect(due.filter).toEqual({ kind: 'date' });
    expect(due.defaultAggregate).toBe('range');

    const desc = byId.get('field:description')!;
    expect(desc.filter).toEqual({ kind: 'text' });
    expect(desc.defaultAggregate).toBe('distinct');

    // array keys off items
    const components = byId.get('field:components')!;
    expect(components.filter).toEqual({ kind: 'text' });
    expect(components.source).toMatchObject({ schemaType: 'array', schemaItems: 'string' });

    // unknown -> string fallback + count
    const weird = byId.get('field:weird')!;
    expect(weird.filter).toEqual({ kind: 'text' });
    expect(weird.defaultAggregate).toBe('count');
  });

  test('field column getValue reads from issue.fields by field name', () => {
    const points = buildColumnCatalog(fields).find((c) => c.id === 'field:customfield_1')!;
    const issue: TableIssue = { fields: { 'Story Points': 8 } };
    expect(points.getValue(issue)).toBe(8);
    expect(points.getValue({})).toBeUndefined();
  });

  test('estimation columns read derived timing (parity with cells.ts) and default to sum', () => {
    const byId = new Map(buildColumnCatalog(fields).map((c) => [c.id, c]));

    const estimated = byId.get('estimation:estimatedDays')!;
    expect(estimated.defaultAggregate).toBe('sum');
    expect(
      estimated.getValue({ derivedTiming: { isStoryPointsMedianValid: true, deterministicTotalDaysOfWork: 5 } }),
    ).toBe(5);
    expect(estimated.getValue({ derivedTiming: { isStoryPointsValid: true, storyPointsDaysOfWork: 3 } })).toBe(3);
    expect(estimated.getValue({ derivedTiming: {} })).toBeUndefined();

    const timed = byId.get('estimation:timedDays')!;
    expect(timed.getValue({ derivedTiming: { datesDaysOfWork: 7 } })).toBe(7);

    const rolled = byId.get('estimation:rolledUpDays')!;
    expect(rolled.getValue({ completionRollup: { totalWorkingDays: 12 } })).toBe(12);

    // render shows the "last ➡ current" diff (Phase 2 parity with the Estimation Table)
    const issue: TableIssue = { derivedTiming: { isStoryPointsMedianValid: true, deterministicTotalDaysOfWork: 4.6 } };
    expect(estimated.render(5, { issue })).toBe('🚫 ➡ 5');
    // no issue context → falls back to rounding the precomputed value
    expect(estimated.render(4.6, {} as unknown as Parameters<typeof estimated.render>[1])).toBe('5');
    expect(estimated.render(undefined, {} as unknown as Parameters<typeof estimated.render>[1])).toBe('');
  });

  test('percent complete column computes NN% from completionRollup and is clickable', () => {
    const percent = buildColumnCatalog(fields).find((c) => c.id === 'report:percentComplete')!;
    expect(percent.group).toBe('Report Fields');
    expect(percent.filter).toEqual({ kind: 'number' });
    expect(percent.defaultAggregate).toBe('avg');

    // getValue: completed / total working days, rounded; null when there's no work.
    expect(percent.getValue({ completionRollup: { completedWorkingDays: 3, totalWorkingDays: 4 } })).toBe(75);
    expect(percent.getValue({ completionRollup: { completedWorkingDays: 0, totalWorkingDays: 0 } })).toBeNull();
    expect(percent.getValue({})).toBeNull();

    // render: `NN%` / `—`, plain text when no callback is supplied.
    const issue: TableIssue = { completionRollup: { completedWorkingDays: 3, totalWorkingDays: 4 } };
    expect(percent.render(75, { issue })).toBe('75%');
    expect(percent.render(null, { issue })).toBe('—');

    // render: clickable element wired to onPercentBreakdown when supplied.
    let clicked: TableIssue | null = null;
    const rendered = percent.render(75, { issue, onPercentBreakdown: (i) => (clicked = i) }) as {
      props: { role: string; onClick: () => void };
    };
    expect(rendered.props.role).toBe('button');
    rendered.props.onClick();
    expect(clicked).toBe(issue);
  });

  test('field columns prefer the normalized value, falling back to raw issue.fields (#3/#4)', () => {
    const withObjects: IssueFields = [
      // A custom Team field (key doesn't match the `Team` claim, so it still gets a field column).
      { name: 'Team', key: 'customfield_9', schema: { type: 'string' }, id: 'customfield_9', custom: true },
      { name: 'Description', key: 'description', schema: { type: 'string' }, id: 'description', custom: false },
    ];
    const byId = new Map(buildColumnCatalog(withObjects).map((c) => [c.id, c]));

    // Team isn't in raw fields at all — it comes off the derived issue.team.name.
    const team = byId.get('field:customfield_9')!;
    expect(team.getValue({ team: { name: 'Falcons' } } as unknown as TableIssue)).toBe('Falcons');

    // A field with no normalized equivalent keeps the plain raw lookup.
    const desc = byId.get('field:description')!;
    expect(desc.getValue({ fields: { Description: 'hello' } })).toBe('hello');
  });

  test('Common facets read the intended piece of each object-valued concept (not the whole object)', () => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const issue = {
      type: 'Story',
      status: 'In Progress',
      statusCategory: 'In Progress',
      parentKey: 'PROJ-9',
      team: { name: 'Falcons' },
      sprints: [{ name: 'S1' }, { name: 'S2' }],
      releases: [{ name: 'R1' }, { name: 'R2' }],
      labels: ['a', 'b'],
      rank: '0|abc',
      fields: {
        'Issue Type': { iconUrl: 'https://x/icon.png' },
        Created: '2026-01-02',
        Parent: { key: 'PROJ-9', fields: { summary: 'Parent summary', issuetype: { name: 'Epic' } } },
      },
    } as unknown as TableIssue;

    expect(byId.get('builtin:issueType:name')!.getValue(issue)).toBe('Story');
    expect(byId.get('builtin:issueType:icon')!.getValue(issue)).toBe('https://x/icon.png');
    expect(byId.get('builtin:status:name')!.getValue(issue)).toBe('In Progress');
    expect(byId.get('builtin:status:category')!.getValue(issue)).toBe('In Progress');
    expect(byId.get('builtin:parent:key')!.getValue(issue)).toBe('PROJ-9');
    expect(byId.get('builtin:parent:summary')!.getValue(issue)).toBe('Parent summary');
    expect(byId.get('builtin:parent:type')!.getValue(issue)).toBe('Epic');
    expect(byId.get('builtin:team:name')!.getValue(issue)).toBe('Falcons');
    expect(byId.get('builtin:created:date')!.getValue(issue)).toBe('2026-01-02');
    expect(byId.get('builtin:rank:value')!.getValue(issue)).toBe('0|abc');
  });

  test('Sprint/Release join multiple names; empty arrays render blank; Labels reads the array', () => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const sprint = byId.get('builtin:sprint:names')!;
    const release = byId.get('builtin:release:names')!;
    const labels = byId.get('builtin:labels:list')!;

    expect(sprint.getValue({ sprints: [{ name: 'S1' }, { name: 'S2' }] } as unknown as TableIssue)).toBe('S1, S2');
    expect(release.getValue({ releases: [{ name: 'R1' }, { name: 'R2' }] } as unknown as TableIssue)).toBe('R1, R2');
    expect(sprint.getValue({ sprints: [] } as unknown as TableIssue)).toBeUndefined();
    expect(release.getValue({ releases: [] } as unknown as TableIssue)).toBeUndefined();
    expect(sprint.getValue({ sprints: null } as unknown as TableIssue)).toBeUndefined();
    expect(labels.getValue({ labels: ['a', 'b'] } as unknown as TableIssue)).toEqual(['a', 'b']);
  });

  test('Report Field columns read normalized per-issue values and require no field loads', () => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const issue = {
      startDate: new Date('2026-01-01'),
      dueDate: new Date('2026-02-01'),
      storyPoints: 8,
      storyPointsMedian: 5,
      confidence: 80,
    } as unknown as TableIssue;

    expect(byId.get('report:startDate')!.getValue(issue)).toEqual(new Date('2026-01-01'));
    expect(byId.get('report:dueDate')!.getValue(issue)).toEqual(new Date('2026-02-01'));
    expect(byId.get('report:storyPoints')!.getValue(issue)).toBe(8);
    expect(byId.get('report:storyPointsMedian')!.getValue(issue)).toBe(5);
    expect(byId.get('report:confidence')!.getValue(issue)).toBe(80);

    // number/date type-aware aggregation is derived from the facet schemaType.
    expect(byId.get('report:storyPoints')!.defaultAggregate).toBe('sum');
    expect(byId.get('report:startDate')!.defaultAggregate).toBe('range');
  });

  test('concept claims suppress the bare field:* duplicate (Labels, Parent, Status, ...)', () => {
    const withClaimed: IssueFields = [
      { name: 'Labels', key: 'labels', schema: { type: 'array', items: 'string' }, id: 'labels', custom: false },
      { name: 'Parent', key: 'parent', schema: { type: 'string' }, id: 'parent', custom: false },
      { name: 'Status', key: 'status', schema: { type: 'status' }, id: 'status', custom: false },
    ];
    const ids = buildColumnCatalog(withClaimed).map((c) => c.id);
    expect(ids).not.toContain('field:labels');
    expect(ids).not.toContain('field:parent');
    expect(ids).not.toContain('field:status');
    expect(ids).toContain('builtin:labels:list');
    expect(ids).toContain('builtin:parent:key');
    expect(ids).toContain('builtin:status:name');
  });

  test('built-in Project facets: Project Name appears only when the `project` field is loadable, and it removes the bare raw "Project"', () => {
    // Project Key is always offered (derived from the issue key — needs no field).
    const base = buildColumnCatalog(fields).map((c) => c.id);
    expect(base).toContain('builtin:project:key');
    // Project Name needs the `project` field → absent when it isn't in the catalog.
    expect(base).not.toContain('builtin:project:name');

    // With a `project` field present: Project Name appears AND the bare raw "Project" is dropped
    // (claimed by the registry → no duplicate).
    const withProject: IssueFields = [
      ...fields,
      { name: 'Project', key: 'project', schema: { type: 'project' }, id: 'project', custom: false },
    ];
    const ids = buildColumnCatalog(withProject).map((c) => c.id);
    expect(ids).toContain('builtin:project:key');
    expect(ids).toContain('builtin:project:name');
    expect(ids).not.toContain('field:project');
  });

  test('built-in facet getValue reads derived (Project Key) vs raw object (Project Name)', () => {
    const withProject: IssueFields = [
      { name: 'Project', key: 'project', schema: { type: 'project' }, id: 'project', custom: false },
    ];
    const byId = new Map(buildColumnCatalog(withProject).map((c) => [c.id, c]));

    const key = byId.get('builtin:project:key')!;
    expect(key.getValue({ projectKey: 'ORD' } as unknown as TableIssue)).toBe('ORD');

    const name = byId.get('builtin:project:name')!;
    expect(name.getValue({ fields: { project: { name: 'Ordering' } } } as unknown as TableIssue)).toBe('Ordering');
    expect(name.getValue({ fields: {} } as unknown as TableIssue)).toBeUndefined();
  });

  test('catalog columns can be typed with a ComputedSource (Phase 8 readiness)', () => {
    // estimation columns already use computed sources
    const computed = buildColumnCatalog(fields).filter((c) => c.source.kind === 'computed');
    expect(computed.length).toBeGreaterThan(0);
  });
});

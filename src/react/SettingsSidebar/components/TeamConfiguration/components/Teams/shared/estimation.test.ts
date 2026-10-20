import { describe, expect, it } from 'vitest';

import type { EstimationInputs } from './estimation';

import {
  DEFAULT_FIELD_LABEL,
  describeEstimateUnit,
  describeEstimation,
  describeShareOfTeam,
  describeUnestimated,
  fieldLabelFor,
  formatCapacity,
  formatRate,
  getDefaultTracks,
  getEffectiveVelocity,
  getPeoplePerEstimate,
  getPointsPerPersonDay,
  getSchedulingPeriodDays,
  getTeamMembers,
  getVelocityPerSprint,
  itemLabelFor,
  pluralize,
  pointsPerPersonDayFor,
  pointsPerPersonDayForHeadcount,
  pointsPerPersonDayForSprintLength,
  pointsPerPersonDayForUnit,
  SHARE,
  sprintWeeks,
  UNESTIMATED_WORKING_DAYS,
  WORK_ITEMS_LABEL,
} from './estimation';

const inputs = (overrides: Partial<EstimationInputs>): EstimationInputs => ({
  estimateUnit: null,
  estimateTeamShare: null,
  velocityPerSprint: 21,
  pointsPerPersonDay: null,
  teamMembers: null,
  sprintLength: 10,
  tracks: 1,
  ...overrides,
});

/** What `normalize.ts` and `work-timing.ts` do with the three numbers. */
const daysOfWork = (estimate: number, config: EstimationInputs) => {
  const pointsPerDayPerTrack = getEffectiveVelocity(config) / getSchedulingPeriodDays(config) / Number(config.tracks);

  return estimate / pointsPerDayPerTrack;
};

/** The default estimate for an unestimated item, converted to days. */
const unestimatedDays = (config: EstimationInputs) =>
  daysOfWork(getEffectiveVelocity(config) / Number(config.tracks), config);

describe('getSchedulingPeriodDays', () => {
  it.each(['storyPoints', 'teamSprints'] as const)('%s uses its sprint length', (unit) => {
    expect(getSchedulingPeriodDays(inputs({ estimateUnit: unit, sprintLength: 15 }))).toBe(15);
  });

  it.each(['devDays', 'teamDays', 'teamWeeks'] as const)('%s ignores the hidden sprint length', (unit) => {
    expect(getSchedulingPeriodDays(inputs({ estimateUnit: unit, sprintLength: 15 }))).toBe(10);
  });

  it('a config with no unit is story points, so it uses its sprint length', () => {
    expect(getSchedulingPeriodDays(inputs({ sprintLength: 15 }))).toBe(15);
  });

  it('the fixed defaults are 10 working days', () => {
    expect(UNESTIMATED_WORKING_DAYS).toEqual({ devDays: 10, teamDays: 10, teamWeeks: 10 });
  });
});

// Configs saved before plan2 have no X: their velocity is the legacy formula, exactly.
describe('getEffectiveVelocity (legacy configs)', () => {
  it('falls back to velocityPerSprint when no unit is saved', () => {
    expect(getEffectiveVelocity(inputs({ velocityPerSprint: 40 }))).toBe(40);
  });

  it('reads a velocity saved as a string by the text field', () => {
    expect(getEffectiveVelocity(inputs({ velocityPerSprint: '40' as never, estimateUnit: 'storyPoints' }))).toBe(40);
  });

  it('Dev Days: one dev-day per member per working day of the 10-day period', () => {
    expect(getEffectiveVelocity(inputs({ estimateUnit: 'devDays', teamMembers: 10 }))).toBe(100);
  });

  it('Dev Days with no saved headcount uses the default of 5', () => {
    expect(getEffectiveVelocity(inputs({ estimateUnit: 'devDays' }))).toBe(50);
  });

  it('a config whose period does not resolve still returns its story points', () => {
    expect(getEffectiveVelocity(inputs({ sprintLength: null, velocityPerSprint: 42 }))).toBe(42);
  });

  it.each([
    ['full', 10],
    ['half', 20],
    ['third', 30],
    ['quarter', 40],
  ] as const)('Team Working Days with a %s share', (share, velocity) => {
    expect(getEffectiveVelocity(inputs({ estimateUnit: 'teamDays', estimateTeamShare: share }))).toBeCloseTo(velocity);
  });

  it.each([
    ['full', 2],
    ['half', 4],
    ['third', 6],
    ['quarter', 8],
  ] as const)('Team Weeks with a %s share', (share, velocity) => {
    expect(getEffectiveVelocity(inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: share }))).toBeCloseTo(velocity);
  });

  it.each([
    ['full', 1],
    ['half', 2],
    ['third', 3],
    ['quarter', 4],
  ] as const)('Team Sprints with a %s share', (share, velocity) => {
    expect(getEffectiveVelocity(inputs({ estimateUnit: 'teamSprints', estimateTeamShare: share }))).toBeCloseTo(
      velocity,
    );
  });

  it('treats a missing share as the full team', () => {
    expect(getEffectiveVelocity(inputs({ estimateUnit: 'teamDays' }))).toBe(10);
  });

  describe('end to end through pointsPerDayPerTrack', () => {
    it('half team, 10 team-days, 2 in parallel: each item gets half the team, so 10 days', () => {
      const config = inputs({ estimateUnit: 'teamDays', estimateTeamShare: 'half', tracks: 2 });

      expect(daysOfWork(10, config)).toBeCloseTo(10);
    });

    it('Dev Days, 10 members, 2 in parallel, 20 dev-days: 5 devs per item, so 4 days', () => {
      const config = inputs({ estimateUnit: 'devDays', teamMembers: 10, tracks: 2 });

      expect(daysOfWork(20, config)).toBeCloseTo(4);
    });

    it.each([
      [inputs({ estimateUnit: 'storyPoints', velocityPerSprint: 40, tracks: 3 }), 10],
      [inputs({ estimateUnit: 'teamSprints', estimateTeamShare: 'quarter', tracks: 1 }), 10],
      [inputs({ estimateUnit: 'devDays', teamMembers: 7, tracks: 2 }), 10],
      [inputs({ estimateUnit: 'teamDays', estimateTeamShare: 'third', tracks: 4 }), 10],
      [inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', tracks: 2 }), 10],
    ])('an unestimated item takes one scheduling period (%o → %i days)', (config, days) => {
      expect(unestimatedDays(config)).toBeCloseTo(days);
    });

    // The bug this guards: a sprint length saved under Story Points, then hidden by switching unit.
    it.each([
      inputs({ estimateUnit: 'devDays', teamMembers: 5, tracks: 2 }),
      inputs({ estimateUnit: 'teamDays', estimateTeamShare: 'half', tracks: 3 }),
      inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'quarter', tracks: 2 }),
    ])('a hidden sprint length changes nothing (%o)', (config) => {
      const withHiddenSprintLength = { ...config, sprintLength: 15 };

      expect(daysOfWork(20, withHiddenSprintLength)).toBeCloseTo(daysOfWork(20, config));
      expect(unestimatedDays(withHiddenSprintLength)).toBeCloseTo(10);
    });

    it('a full-team week is 5 working days', () => {
      expect(daysOfWork(1, inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'full' }))).toBeCloseTo(5);
    });

    it('a full-team sprint is one sprint', () => {
      expect(daysOfWork(1, inputs({ estimateUnit: 'teamSprints', sprintLength: 15 }))).toBeCloseTo(15);
    });
  });
});

/** A config saved after plan2: X stored. Two-week sprints. */
const withX = (unit: EstimationInputs['estimateUnit'], pointsPerPersonDay: number, teamMembers: number, tracks = 1) =>
  inputs({ estimateUnit: unit, pointsPerPersonDay, teamMembers, tracks, velocityPerSprint: null });

describe('getTeamMembers', () => {
  it.each([
    [10, 10],
    [5.5, 5.5],
    ['4', 4],
    [null, 5],
    [0, 5],
    [-1, 5],
  ])('%s → %d', (members, expected) => {
    expect(getTeamMembers({ teamMembers: members as number })).toBe(expected);
  });
});

describe('pointsPerPersonDayFor (the formula table)', () => {
  // 10 developers, 2-week sprints, 5 people per estimate.
  const answers = { velocityPerSprint: 30, teamMembers: 10, sprintLength: 10, peoplePerEstimate: 5 };

  it.each([
    ['storyPoints', 0.3],
    ['devDays', 1],
    ['teamDays', 0.2],
    ['teamWeeks', 0.04],
    ['teamSprints', 0.02],
  ] as const)('%s → %d', (unit, x) => {
    expect(pointsPerPersonDayFor(unit, answers)).toBeCloseTo(x);
  });

  it('Story Points at 21 per sprint → 0.21', () => {
    expect(pointsPerPersonDayFor('storyPoints', { ...answers, velocityPerSprint: 21 })).toBeCloseTo(0.21);
  });

  it.each([1, 2.5, 5, 10])('Team Weeks with %d people round-trips through getPeoplePerEstimate', (people) => {
    const x = pointsPerPersonDayFor('teamWeeks', { ...answers, peoplePerEstimate: people });

    expect(getPeoplePerEstimate(withX('teamWeeks', x, 10))).toBeCloseTo(people);
  });
});

describe('getPointsPerPersonDay', () => {
  it('reads a stored X', () => {
    expect(getPointsPerPersonDay(withX('teamWeeks', 0.04, 10))).toBe(0.04);
  });

  it('Dev Days is always 1, whatever is stored', () => {
    expect(getPointsPerPersonDay(withX('devDays', 0.3, 10))).toBe(1);
  });

  it('derives Story Points from the legacy velocity at the saved headcount', () => {
    expect(getPointsPerPersonDay(inputs({ velocityPerSprint: 30, teamMembers: 10 }))).toBeCloseTo(0.3);
  });

  it('derives against the default headcount of 5 when none is saved', () => {
    expect(getPointsPerPersonDay(inputs({ velocityPerSprint: 30 }))).toBeCloseTo(0.6);
  });

  it.each([
    ['full', 10, 10],
    ['half', 10, 5],
    ['third', 9, 3],
    ['quarter', 8, 2],
  ] as const)('migrates a %s share at %i developers to %d people per estimate', (share, members, people) => {
    const legacy = inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: share, teamMembers: members });

    expect(getPeoplePerEstimate(legacy)).toBeCloseTo(people);
    expect(getPointsPerPersonDay(legacy)).toBeCloseTo(
      pointsPerPersonDayFor('teamWeeks', {
        teamMembers: members,
        sprintLength: 10,
        peoplePerEstimate: SHARE[share] * members,
      }),
    );
  });

  it('half of 10 developers on Team Weeks is X = 0.04', () => {
    expect(
      getPointsPerPersonDay(inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', teamMembers: 10 })),
    ).toBeCloseTo(0.04);
  });

  it.each([
    inputs({ velocityPerSprint: 21, teamMembers: 10 }),
    inputs({ velocityPerSprint: 40, sprintLength: 15 }),
    inputs({ estimateUnit: 'devDays', teamMembers: 7 }),
    inputs({ estimateUnit: 'teamDays', estimateTeamShare: 'third', teamMembers: 9 }),
    inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', teamMembers: 10 }),
    inputs({ estimateUnit: 'teamSprints', estimateTeamShare: 'quarter', teamMembers: 4, sprintLength: 15 }),
  ])('X × N × P reproduces the legacy velocity at the saved headcount (%o)', (legacy) => {
    const pinned = { ...legacy, pointsPerPersonDay: getPointsPerPersonDay(legacy) };

    expect(getEffectiveVelocity(pinned)).toBeCloseTo(getEffectiveVelocity(legacy));
  });
});

describe('getEffectiveVelocity (X × N × P)', () => {
  it('scales with headcount for every unit', () => {
    for (const unit of ['storyPoints', 'devDays', 'teamDays', 'teamWeeks', 'teamSprints'] as const) {
      const ten = getEffectiveVelocity(withX(unit, 0.3, 10));
      const eleven = getEffectiveVelocity(withX(unit, 0.3, 11));

      expect(eleven / ten).toBeCloseTo(1.1);
    }
  });

  it('getVelocityPerSprint is X × N × sprint length', () => {
    expect(getVelocityPerSprint(withX('storyPoints', 0.21, 10))).toBeCloseTo(21);
    expect(getVelocityPerSprint(withX('storyPoints', 0.21, 11))).toBeCloseTo(23.1);
  });
});

// spec/040 plan2 "Worked tables": 2-week sprints; per track / day and points / day (team).
describe('worked tables through pointsPerDayPerTrack', () => {
  const perTrackPerDay = (config: EstimationInputs) =>
    getEffectiveVelocity(config) / getSchedulingPeriodDays(config) / Number(config.tracks);
  const teamPerDay = (config: EstimationInputs) => getEffectiveVelocity(config) / getSchedulingPeriodDays(config);

  const rows = (tracks: number[], team10: number, team11: number) => [
    ...tracks.map((t) => [10, t, team10 / t, team10] as const),
    ...tracks.map((t) => [11, t, team11 / t, team11] as const),
  ];

  describe.each([
    ['Team Weeks, 5 people', 'teamWeeks', 0.04, 0.4, 0.44],
    ['Story Points, 21 / sprint', 'storyPoints', 0.21, 2.1, 2.31],
    ['Story Points, 30 / sprint', 'storyPoints', 0.3, 3, 3.3],
    ['Dev Days', 'devDays', 1, 10, 11],
    ['Team Sprints, 5 people', 'teamSprints', 0.02, 0.2, 0.22],
  ] as const)('%s', (_name, unit, x, team10, team11) => {
    it.each(rows([1, 2, 3], team10, team11))(
      '%i developers, %i tracks → %d per track / day, %d / day',
      (members, tracks, perTrack, team) => {
        const config = withX(unit, x, members, tracks);

        expect(perTrackPerDay(config)).toBeCloseTo(perTrack, 5);
        expect(teamPerDay(config)).toBeCloseTo(team, 5);
        expect(getPointsPerPersonDay(config)).toBeCloseTo(x);
      },
    );
  });

  it('matches the old velocity at 10 developers (Team Weeks, half team)', () => {
    const legacy = inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', teamMembers: 10, tracks: 2 });

    expect(getEffectiveVelocity(legacy)).toBeCloseTo(4);
    expect(getEffectiveVelocity(withX('teamWeeks', 0.04, 10, 2))).toBeCloseTo(4);
  });

  it('a week of work for 5 people with 11 developers on 2 tracks takes 25 / 5.5 days', () => {
    const config = withX('teamWeeks', 0.04, 11, 2);

    expect(1 / perTrackPerDay(config)).toBeCloseTo(25 / 5.5);
  });

  it('an unestimated item still takes one period, whatever the headcount', () => {
    for (const members of [5, 10, 20]) {
      const config = withX('teamWeeks', 0.04, members, 2);
      const defaultEstimate = getEffectiveVelocity(config) / Number(config.tracks);

      expect(defaultEstimate / perTrackPerDay(config)).toBeCloseTo(10);
    }
  });
});

describe('pointsPerPersonDayForHeadcount', () => {
  const legacy = inputs({ velocityPerSprint: 30, teamMembers: 5 });

  it('re-anchors the first headcount, so capacity does not change', () => {
    const x = pointsPerPersonDayForHeadcount(legacy, 10, false)!;

    expect(x).toBeCloseTo(0.3);
    expect(getEffectiveVelocity({ ...legacy, teamMembers: 10, pointsPerPersonDay: x })).toBeCloseTo(30);
  });

  it('every headcount after that scales capacity', () => {
    const anchored = { ...legacy, teamMembers: 10, pointsPerPersonDay: 0.3 };

    expect(pointsPerPersonDayForHeadcount(anchored, 11, true)).toBeUndefined();
    expect(getEffectiveVelocity({ ...anchored, teamMembers: 11 })).toBeCloseTo(33);
  });

  it('pins a derived X when the headcount was already saved, so the new one counts', () => {
    const derived = inputs({ velocityPerSprint: 30, teamMembers: 10 });
    const x = pointsPerPersonDayForHeadcount(derived, 11, true)!;

    expect(x).toBeCloseTo(0.3);
    expect(getEffectiveVelocity({ ...derived, teamMembers: 11, pointsPerPersonDay: x })).toBeCloseTo(33);
  });

  it('re-anchors a team-time unit: half of the default 5 becomes half of 10', () => {
    const share = inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half' });
    const x = pointsPerPersonDayForHeadcount(share, 10, false)!;

    expect(getPeoplePerEstimate({ ...share, teamMembers: 10, pointsPerPersonDay: x })).toBeCloseTo(5);
  });

  it('Dev Days never writes X', () => {
    expect(pointsPerPersonDayForHeadcount(inputs({ estimateUnit: 'devDays' }), 10, false)).toBeUndefined();
    expect(
      pointsPerPersonDayForHeadcount(inputs({ estimateUnit: 'devDays', teamMembers: 4 }), 10, true),
    ).toBeUndefined();
  });
});

describe('pointsPerPersonDayForUnit', () => {
  const storyPoints = withX('storyPoints', 0.3, 10);

  it('a team-time unit coming from Story Points starts at the full team', () => {
    const x = pointsPerPersonDayForUnit(storyPoints, 'teamWeeks');

    expect(x).toBeCloseTo(1 / (10 * 5));
    expect(getPeoplePerEstimate(withX('teamWeeks', x, 10))).toBeCloseTo(10);
  });

  it('a team-time unit keeps its people per estimate', () => {
    expect(pointsPerPersonDayForUnit(withX('teamWeeks', 0.04, 10), 'teamDays')).toBeCloseTo(0.2);
    expect(pointsPerPersonDayForUnit(withX('teamWeeks', 0.04, 10), 'teamSprints')).toBeCloseTo(0.02);
  });

  it('Story Points to Story Points keeps points per sprint', () => {
    expect(pointsPerPersonDayForUnit(storyPoints, 'storyPoints')).toBeCloseTo(0.3);
  });

  it('Story Points from another unit uses the saved legacy velocity', () => {
    const teamWeeks = { ...withX('teamWeeks', 0.04, 10), velocityPerSprint: 21 };

    expect(pointsPerPersonDayForUnit(teamWeeks, 'storyPoints')).toBeCloseTo(0.21);
  });

  it('Dev Days is 1', () => {
    expect(pointsPerPersonDayForUnit(storyPoints, 'devDays')).toBe(1);
  });
});

describe('pointsPerPersonDayForSprintLength', () => {
  it('Story Points keeps its points per sprint', () => {
    const config = withX('storyPoints', 0.3, 10);
    const x = pointsPerPersonDayForSprintLength(config, 15);

    expect(x).toBeCloseTo(0.2);
    expect(getVelocityPerSprint({ ...config, sprintLength: 15, pointsPerPersonDay: x })).toBeCloseTo(30);
  });

  it('Team Sprints keeps its people per estimate', () => {
    const config = withX('teamSprints', 0.02, 10);
    const x = pointsPerPersonDayForSprintLength(config, 15);

    expect(getPeoplePerEstimate({ ...config, sprintLength: 15, pointsPerPersonDay: x })).toBeCloseTo(5);
  });
});

describe('getPeoplePerEstimate', () => {
  it.each([
    ['teamDays', 0.2, 5],
    ['teamWeeks', 0.04, 5],
    ['teamSprints', 0.02, 5],
  ] as const)('%s at X = %d → %i people', (unit, x, people) => {
    expect(getPeoplePerEstimate(withX(unit, x, 10))).toBeCloseTo(people);
  });

  it.each(['storyPoints', 'devDays'] as const)('%s has none', (unit) => {
    expect(getPeoplePerEstimate(withX(unit, 0.3, 10))).toBeNull();
  });

  it('does not change with headcount', () => {
    expect(getPeoplePerEstimate(withX('teamWeeks', 0.04, 11))).toBeCloseTo(5);
  });
});

describe('fieldLabelFor', () => {
  it.each([
    ['Story Points', 'Story Point', 'Story Points'],
    ['Story points median', 'Story points median', 'Story points median'],
    ['Days estimate', 'Days estimate', 'Days estimate'],
    ['Class', 'Class', 'Class'],
  ])('%s', (name, singular, plural) => {
    expect(fieldLabelFor(name)).toEqual({ singular, plural });
  });

  it.each([null, undefined, ''])('falls back to "estimate" for %s', (name) => {
    expect(fieldLabelFor(name)).toBe(DEFAULT_FIELD_LABEL);
  });
});

describe('formatRate', () => {
  it.each([
    [2.333, 2.33],
    [0.0667, 0.067],
    [0.04, 0.04],
    [21.000000000000004, 21],
    [0, 0],
  ])('%d → %d', (value, rounded) => {
    expect(formatRate(value)).toBe(rounded);
  });
});

describe('describeShareOfTeam', () => {
  it.each([
    [5, 10, '50% of the team'],
    [5, 11, '45% of the team'],
    [10, 10, '100% of the team'],
  ])('%i of %i', (people, members, text) => {
    expect(describeShareOfTeam(people, members)).toBe(text);
  });
});

const STORY_POINTS = fieldLabelFor('Story Points');

describe('describeEstimateUnit', () => {
  it('Story Points', () => {
    expect(describeEstimateUnit(withX('storyPoints', 0.21, 10), STORY_POINTS)).toBe(
      '21 Story Points per 2-week sprint with 10 developers',
    );
  });

  it('Dev Days', () => {
    expect(describeEstimateUnit(withX('devDays', 1, 10), STORY_POINTS, '=')).toBe(
      '1 Story Point = 1 day of work for 1 developer',
    );
  });

  it('Team Working Days', () => {
    expect(describeEstimateUnit(withX('teamDays', 0.2, 10), STORY_POINTS)).toBe(
      '1 Story Point is 1 day of work for 5 people (50% of the team)',
    );
  });

  it('Team Weeks, share following the headcount', () => {
    expect(describeEstimateUnit(withX('teamWeeks', 0.04, 11), STORY_POINTS, '=')).toBe(
      '1 Story Point = 1 week of work for 5 people (45% of the team)',
    );
  });

  it('Team Sprints', () => {
    expect(describeEstimateUnit(withX('teamSprints', 0.02, 10), STORY_POINTS)).toBe(
      '1 Story Point is one 2-week sprint of work for 5 people (50% of the team)',
    );
  });

  it('one person', () => {
    expect(describeEstimateUnit(withX('teamDays', 1, 10), STORY_POINTS)).toBe(
      '1 Story Point is 1 day of work for 1 person (10% of the team)',
    );
  });
});

describe('describeEstimation', () => {
  it('Story Points', () => {
    expect(describeEstimation(withX('storyPoints', 0.21, 10, 2), WORK_ITEMS_LABEL, STORY_POINTS)).toBe(
      '21 Story Points per 2-week sprint with 10 developers. With 2 work items in parallel.',
    );
  });

  it('a legacy config with no field reads "estimates"', () => {
    expect(describeEstimation(inputs({ sprintLength: 5, teamMembers: 1 }), WORK_ITEMS_LABEL)).toBe(
      '21 estimates per 1-week sprint with 1 developer. One work item at a time.',
    );
  });

  it('Dev Days', () => {
    expect(describeEstimation(withX('devDays', 1, 10, 3), WORK_ITEMS_LABEL, STORY_POINTS)).toBe(
      '1 Story Point is 1 day of work for 1 developer. 10 developers. With 3 work items in parallel.',
    );
  });

  it('Team Weeks', () => {
    expect(describeEstimation(withX('teamWeeks', 0.04, 10, 2), WORK_ITEMS_LABEL, STORY_POINTS)).toBe(
      '1 Story Point is 1 week of work for 5 people (50% of the team). 10 developers. With 2 work items in parallel.',
    );
  });

  it('a migrated half-team share', () => {
    expect(
      describeEstimation(
        inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', teamMembers: 10, tracks: 2 }),
        WORK_ITEMS_LABEL,
        STORY_POINTS,
      ),
    ).toBe(
      '1 Story Point is 1 week of work for 5 people (50% of the team). 10 developers. With 2 work items in parallel.',
    );
  });

  it('decimal headcount', () => {
    expect(describeEstimation(withX('devDays', 1, 5.5), WORK_ITEMS_LABEL)).toBe(
      '1 estimate is 1 day of work for 1 developer. 5.5 developers. One work item at a time.',
    );
  });

  it('names the work item type on a per-type form', () => {
    expect(describeEstimation(withX('storyPoints', 0.21, 10, 2), itemLabelFor('Epic'), STORY_POINTS)).toBe(
      '21 Story Points per 2-week sprint with 10 developers. With 2 Epics in parallel.',
    );
    expect(describeEstimation(withX('storyPoints', 0.21, 10, 1), itemLabelFor('Epic'), STORY_POINTS)).toBe(
      '21 Story Points per 2-week sprint with 10 developers. One Epic at a time.',
    );
  });
});

describe('formatCapacity', () => {
  const readout = (unit: EstimationInputs['estimateUnit'] & string, x: number, members: number) =>
    formatCapacity({ unit, pointsPerPersonDay: x, teamMembers: members, sprintLength: 10 });

  const expectRate = (actual: { perDay: number; perPeriod?: number }, perDay: number, perPeriod?: number) => {
    expect(actual.perDay).toBeCloseTo(perDay);
    if (perPeriod === undefined) expect(actual.perPeriod).toBeUndefined();
    else expect(actual.perPeriod).toBeCloseTo(perPeriod);
  };

  // spec/040 plan2 "AutoScheduler team bar" readout table.
  it.each([
    ['storyPoints', 0.21, 'sprint', [0.21, 2.1], [2.1, 21], [2.31, 23.1]],
    ['devDays', 1, undefined, [1], [10], [11]],
    ['teamDays', 0.2, undefined, [0.2], [2], [2.2]],
    ['teamWeeks', 0.04, 'week', [0.04, 0.2], [0.4, 2], [0.44, 2.2]],
    ['teamSprints', 0.02, 'sprint', [0.02, 0.2], [0.2, 2], [0.22, 2.2]],
  ] as const)('%s', (unit, x, period, perPerson, team10, team11) => {
    const ten = readout(unit, x, 10);
    const eleven = readout(unit, x, 11);

    expect(ten.period).toBe(period);
    expectRate(ten.perPerson, perPerson[0], perPerson[1]);
    expectRate(eleven.perPerson, perPerson[0], perPerson[1]);
    expectRate(ten.team, team10[0], team10[1]);
    expectRate(eleven.team, team11[0], team11[1]);
  });

  it('a sprint unit reads its sprint length', () => {
    expect(
      formatCapacity({ unit: 'storyPoints', pointsPerPersonDay: 0.2, teamMembers: 10, sprintLength: 15 }).team
        .perPeriod,
    ).toBeCloseTo(30);
  });
});

describe('pluralize', () => {
  it.each([
    ['Epic', 'Epics'],
    ['Story', 'Stories'],
    ['Initiative', 'Initiatives'],
    ['Sub-task', 'Sub-tasks'],
    ['Day', 'Days'],
  ])('%s → %s', (name, plural) => {
    expect(pluralize(name)).toBe(plural);
  });
});

describe('getDefaultTracks', () => {
  it.each([
    [10, 5, 2],
    [11, 5, 2],
    [10, 10, 1],
    [12, 3, 4],
    [10, 30, 1],
  ])('team-time units: %d developers / %d people per estimate → %i', (members, people, tracks) => {
    for (const unit of ['teamDays', 'teamWeeks', 'teamSprints'] as const) {
      const x = pointsPerPersonDayFor(unit, { teamMembers: members, sprintLength: 10, peoplePerEstimate: people });

      expect(getDefaultTracks(withX(unit, x, members))).toBe(tracks);
    }
  });

  it('a migrated half-team share at 10 developers → 2', () => {
    expect(getDefaultTracks(inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', teamMembers: 10 }))).toBe(2);
  });

  it.each([
    [6, 6],
    ['4', 4],
    [2.5, 2],
    [0.5, 1],
    [null, 5],
  ])('Dev Days with %s members → %i', (members, tracks) => {
    expect(getDefaultTracks(inputs({ estimateUnit: 'devDays', teamMembers: members as number }))).toBe(tracks);
  });

  it.each([null, 'storyPoints'] as const)('Story Points implies nothing (unit %s)', (unit) => {
    expect(getDefaultTracks(inputs({ estimateUnit: unit, estimateTeamShare: 'half', teamMembers: 6 }))).toBeNull();
  });
});

describe('sprintWeeks', () => {
  it.each([
    [10, 2],
    [5, 1],
    [15, 3],
    [7, 1.4],
  ])('%i working days is %d weeks', (days, weeks) => {
    expect(sprintWeeks(days)).toBe(weeks);
  });
});

describe('describeUnestimated', () => {
  const unestimatedSentence = (...args: Parameters<typeof describeUnestimated>) => {
    const { items, period } = describeUnestimated(...args);

    return `${items} without estimates default to ${period}.`;
  };

  it.each([
    ['storyPoints', 10],
    ['teamSprints', 10],
    ['devDays', 10],
    ['teamDays', 10],
    ['teamWeeks', 10],
  ] as const)('%s: one scheduling period', (unit, days) => {
    expect(unestimatedSentence(inputs({ estimateUnit: unit }), WORK_ITEMS_LABEL)).toBe(
      `Work items without estimates default to ${days} working days.`,
    );
  });

  it('follows the sprint length for a sprint unit', () => {
    expect(unestimatedSentence(inputs({ sprintLength: 15 }), WORK_ITEMS_LABEL)).toBe(
      'Work items without estimates default to 15 working days.',
    );
  });

  it('a hidden sprint length does not leak in', () => {
    expect(unestimatedSentence(inputs({ estimateUnit: 'devDays', sprintLength: 15 }), WORK_ITEMS_LABEL)).toBe(
      'Work items without estimates default to 10 working days.',
    );
  });

  it('names the work item type on a per-type form', () => {
    expect(unestimatedSentence(inputs({}), itemLabelFor('Epic'))).toBe(
      'Epics without estimates default to 10 working days.',
    );
  });

  it('a one-day sprint reads "1 working day"', () => {
    expect(unestimatedSentence(inputs({ sprintLength: 1 }), WORK_ITEMS_LABEL)).toBe(
      'Work items without estimates default to 1 working day.',
    );
  });
});

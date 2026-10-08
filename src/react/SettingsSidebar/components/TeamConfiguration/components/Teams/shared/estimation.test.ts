import { describe, expect, it } from 'vitest';

import type { EstimationInputs } from './estimation';

import {
  describeEstimation,
  formatCapacity,
  getEffectiveVelocity,
  itemLabelFor,
  pluralize,
  WORK_ITEMS_LABEL,
} from './estimation';

const inputs = (overrides: Partial<EstimationInputs>): EstimationInputs => ({
  estimateUnit: null,
  estimateTeamShare: null,
  velocityPerSprint: 21,
  teamMembers: null,
  sprintLength: 10,
  tracks: 1,
  ...overrides,
});

/** What `normalize.ts` and `work-timing.ts` do with the three numbers. */
const daysOfWork = (estimate: number, config: EstimationInputs) => {
  const pointsPerDayPerTrack = getEffectiveVelocity(config) / Number(config.sprintLength) / Number(config.tracks);

  return estimate / pointsPerDayPerTrack;
};

/** The default estimate for an unestimated item, converted to days. */
const unestimatedDays = (config: EstimationInputs) =>
  daysOfWork(getEffectiveVelocity(config) / Number(config.tracks), config);

describe('getEffectiveVelocity', () => {
  it('falls back to velocityPerSprint when no unit is saved', () => {
    expect(getEffectiveVelocity(inputs({ velocityPerSprint: 40 }))).toBe(40);
  });

  it('reads a velocity saved as a string by the text field', () => {
    expect(getEffectiveVelocity(inputs({ velocityPerSprint: '40' as never, estimateUnit: 'storyPoints' }))).toBe(40);
  });

  it('Dev Days: one dev-day per member per working day', () => {
    expect(getEffectiveVelocity(inputs({ estimateUnit: 'devDays', teamMembers: 10, sprintLength: 10 }))).toBe(100);
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
      inputs({ estimateUnit: 'storyPoints', velocityPerSprint: 40, tracks: 3 }),
      inputs({ estimateUnit: 'devDays', teamMembers: 7, tracks: 2 }),
      inputs({ estimateUnit: 'teamDays', estimateTeamShare: 'third', tracks: 4 }),
      inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', tracks: 2 }),
      inputs({ estimateUnit: 'teamSprints', estimateTeamShare: 'quarter', tracks: 1 }),
    ])('an unestimated item always takes one sprint (%o)', (config) => {
      expect(unestimatedDays(config)).toBeCloseTo(Number(config.sprintLength));
    });

    it('a full-team week is 5 working days', () => {
      expect(daysOfWork(1, inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'full' }))).toBeCloseTo(5);
    });

    it('a full-team sprint is one sprint', () => {
      expect(daysOfWork(1, inputs({ estimateUnit: 'teamSprints', sprintLength: 15 }))).toBeCloseTo(15);
    });
  });
});

describe('describeEstimation', () => {
  it('Story Points', () => {
    expect(
      describeEstimation(inputs({ estimateUnit: 'storyPoints', velocityPerSprint: 40, tracks: 2 }), WORK_ITEMS_LABEL),
    ).toBe('40 story points per 10-day sprint. Up to 2 work items in parallel.');
  });

  it('Dev Days', () => {
    expect(describeEstimation(inputs({ estimateUnit: 'devDays', teamMembers: 10, tracks: 3 }), WORK_ITEMS_LABEL)).toBe(
      '10 full-time team members. Up to 3 work items in parallel.',
    );
  });

  it('Team Working Days', () => {
    expect(
      describeEstimation(inputs({ estimateUnit: 'teamDays', estimateTeamShare: 'full', tracks: 2 }), WORK_ITEMS_LABEL),
    ).toBe('Estimates are based on working days and assume the full team. Up to 2 work items in parallel.');
  });

  it('Team Weeks', () => {
    expect(
      describeEstimation(
        inputs({ estimateUnit: 'teamWeeks', estimateTeamShare: 'third', tracks: 4 }),
        WORK_ITEMS_LABEL,
      ),
    ).toBe('Estimates are based on weeks and assume one-third of the team. Up to 4 work items in parallel.');
  });

  it('Team Sprints', () => {
    expect(
      describeEstimation(
        inputs({ estimateUnit: 'teamSprints', estimateTeamShare: 'half', tracks: 2 }),
        WORK_ITEMS_LABEL,
      ),
    ).toBe('Estimates are based on 10-day sprints and assume half the team. Up to 2 work items in parallel.');
  });

  it('one at a time when parallel is 1', () => {
    expect(describeEstimation(inputs({ velocityPerSprint: 40, tracks: 1 }), WORK_ITEMS_LABEL)).toBe(
      '40 story points per 10-day sprint. One work item at a time.',
    );
  });

  it('names the work item type on a per-type form', () => {
    expect(describeEstimation(inputs({ tracks: 2 }), itemLabelFor('Epic'))).toBe(
      '21 story points per 10-day sprint. Up to 2 Epics in parallel.',
    );
    expect(describeEstimation(inputs({ tracks: 1 }), itemLabelFor('Epic'))).toBe(
      '21 story points per 10-day sprint. One Epic at a time.',
    );
  });

  it('singular member', () => {
    expect(describeEstimation(inputs({ estimateUnit: 'devDays', teamMembers: 1 }), WORK_ITEMS_LABEL)).toBe(
      '1 full-time team member. One work item at a time.',
    );
  });
});

describe('formatCapacity', () => {
  // V is the effective velocity for a half-team share and a 10-day sprint.
  it('Story Points', () => {
    expect(formatCapacity('storyPoints', 'full', 20, 10)).toEqual({
      perPeriod: { value: 20, label: 'points / sprint' },
      perDay: { value: 2, label: 'points / day' },
    });
  });

  it('Dev Days has no per-period cell', () => {
    expect(formatCapacity('devDays', 'full', 50, 10)).toEqual({ perDay: { value: 5, label: 'dev days / day' } });
  });

  it('Team Working Days has no per-period cell', () => {
    expect(formatCapacity('teamDays', 'half', 20, 10)).toEqual({ perDay: { value: 2, label: 'half-team days / day' } });
  });

  it('Team Weeks, half team', () => {
    expect(formatCapacity('teamWeeks', 'half', 4, 10)).toEqual({
      perPeriod: { value: 2, label: 'half-team weeks / week' },
      perDay: { value: 0.4, label: 'half-team weeks / day' },
    });
  });

  it('Team Sprints, half team', () => {
    expect(formatCapacity('teamSprints', 'half', 2, 10)).toEqual({
      perPeriod: { value: 2, label: 'half-team sprints / sprint' },
      perDay: { value: 0.2, label: 'half-team sprints / day' },
    });
  });

  it('full team, singular where the value is 1', () => {
    expect(formatCapacity('teamWeeks', 'full', 2, 10)).toEqual({
      perPeriod: { value: 1, label: 'team week / week' },
      perDay: { value: 0.2, label: 'team weeks / day' },
    });
    expect(formatCapacity('teamSprints', 'full', 1, 10).perPeriod).toEqual({ value: 1, label: 'team sprint / sprint' });
    expect(formatCapacity('teamDays', 'full', 10, 10).perDay).toEqual({ value: 1, label: 'team day / day' });
    expect(formatCapacity('devDays', 'full', 10, 10).perDay).toEqual({ value: 1, label: 'dev day / day' });
  });

  it('third and quarter shares', () => {
    expect(formatCapacity('teamDays', 'third', 30, 10).perDay.label).toBe('third-team days / day');
    expect(formatCapacity('teamDays', 'quarter', 40, 10).perDay.label).toBe('quarter-team days / day');
  });

  it('rounds to 2 decimals', () => {
    expect(formatCapacity('storyPoints', 'full', 21, 9).perDay.value).toBe(2.33);
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

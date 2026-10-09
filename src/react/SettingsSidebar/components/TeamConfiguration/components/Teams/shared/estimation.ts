/**
 * Turns a team's answers to the estimation questions into the numbers the scheduler needs.
 *
 * The scheduler works from three numbers per issue (`jira/normalized/normalize.ts`):
 *
 *   pointsPerDayPerTrack = velocity / daysPerSprint / parallelWorkLimit
 *   daysOfWork           = estimate / pointsPerDayPerTrack
 *   default estimate     = velocity / parallelWorkLimit          (unestimated items)
 *
 * The engine's names predate estimate units: "velocity" is estimate units per *scheduling period*,
 * and "daysPerSprint" is that period's length in working days. Each unit supplies both:
 *
 * - `getSchedulingPeriodDays` — the period. Units that ask for a sprint length use it; the rest use a
 *   fixed constant, so no unit ever reads a setting its form hides.
 * - `getEffectiveVelocity` — estimate units the whole team finishes in that period.
 *
 * The period cancels out of every estimated duration. Its only visible effect is the default
 * estimate: an unestimated item takes exactly one period. See spec/040-update-team-estimation-settings.
 */
import type { Configuration, EstimateTeamShare, EstimateUnit } from '../services/team-configuration';

import { roundTo } from '../../../../../../../utils/number/number';

/** What a configuration that never chose a unit — every one saved before spec/040 — means. */
export const DEFAULT_ESTIMATE_UNIT: EstimateUnit = 'storyPoints';

/** What a team-time unit with no share chosen assumes. */
export const DEFAULT_TEAM_SHARE: EstimateTeamShare = 'full';

const SHARE: Record<EstimateTeamShare, number> = { full: 1, half: 1 / 2, third: 1 / 3, quarter: 1 / 4 };

/** "One week is 5 working days." */
const DAYS_PER_WEEK = 5;

/**
 * Working days an unestimated item takes, for the units that don't ask for a sprint length. The
 * sprint units (Story Points, Team Sprints) use their sprint length instead.
 */
export const UNESTIMATED_WORKING_DAYS: Record<Exclude<EstimateUnit, 'storyPoints' | 'teamSprints'>, number> = {
  devDays: 5,
  teamDays: 5,
  teamWeeks: 5,
};

export type EstimationInputs = Pick<
  Configuration,
  'estimateUnit' | 'estimateTeamShare' | 'velocityPerSprint' | 'teamMembers' | 'sprintLength' | 'tracks'
>;

/** How a work item is named in the questions and summary: "work item(s)" on defaults, "Epic(s)" per level. */
export type ItemLabel = { singular: string; plural: string };

export const WORK_ITEMS_LABEL: ItemLabel = { singular: 'work item', plural: 'work items' };

/** Jira type names are English nouns; this covers the ones Jira ships and any regular custom type. */
export function pluralize(name: string): string {
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;

  return `${name}s`;
}

export function itemLabelFor(levelName: string): ItemLabel {
  return { singular: levelName, plural: pluralize(levelName) };
}

/** Does this unit ask "How many working days are in a sprint?" */
export function usesSprintLength(unit: EstimateUnit): unit is 'storyPoints' | 'teamSprints' {
  return unit === 'storyPoints' || unit === 'teamSprints';
}

/**
 * The scheduler's period, in working days: one sprint for the sprint units, otherwise the fixed
 * default for unestimated items. Never reads `sprintLength` for a unit that doesn't ask for it.
 */
export function getSchedulingPeriodDays(config: Pick<EstimationInputs, 'estimateUnit' | 'sprintLength'>): number {
  const unit = config.estimateUnit ?? DEFAULT_ESTIMATE_UNIT;

  return usesSprintLength(unit) ? Number(config.sprintLength) : UNESTIMATED_WORKING_DAYS[unit];
}

/** Estimate units the whole team finishes in one scheduling period (`getSchedulingPeriodDays`). */
export function getEffectiveVelocity(config: EstimationInputs): number {
  const periodDays = getSchedulingPeriodDays(config);
  const share = SHARE[config.estimateTeamShare ?? DEFAULT_TEAM_SHARE];

  switch (config.estimateUnit ?? DEFAULT_ESTIMATE_UNIT) {
    case 'storyPoints':
      return Number(config.velocityPerSprint);
    case 'devDays':
      // Every member puts in one dev-day per working day.
      return Number(config.teamMembers) * periodDays;
    case 'teamDays':
      return periodDays / share;
    case 'teamWeeks':
      return periodDays / (DAYS_PER_WEEK * share);
    case 'teamSprints':
      return 1 / share;
  }
}

const SHARE_PHRASE: Record<EstimateTeamShare, string> = {
  full: 'the full team',
  half: 'half the team',
  third: 'one-third of the team',
  quarter: 'a quarter of the team',
};

const plural = (count: number, singular: string, many: string) => (count === 1 ? singular : many);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function describeParallel(tracks: number, item: ItemLabel) {
  return tracks === 1 ? `One ${item.singular} at a time.` : `Up to ${tracks} ${item.plural} in parallel.`;
}

/** The unit question's second hint, e.g. "Work items without estimates default to 5 working days." */
export function describeUnestimated(config: EstimationInputs, item: ItemLabel): string {
  const days = getSchedulingPeriodDays(config);

  return `${capitalize(item.plural)} without estimates default to ${days} working ${plural(days, 'day', 'days')}.`;
}

function describeUnit(config: EstimationInputs) {
  const sprintLength = Number(config.sprintLength);
  const share = SHARE_PHRASE[config.estimateTeamShare ?? DEFAULT_TEAM_SHARE];

  switch (config.estimateUnit ?? DEFAULT_ESTIMATE_UNIT) {
    case 'storyPoints': {
      const velocity = Number(config.velocityPerSprint);

      return `${velocity} story ${plural(velocity, 'point', 'points')} per ${sprintLength}-day sprint.`;
    }
    case 'devDays': {
      const members = Number(config.teamMembers);

      return `${members} full-time team ${plural(members, 'member', 'members')}.`;
    }
    case 'teamDays':
      return `Estimates are based on working days and assume ${share}.`;
    case 'teamWeeks':
      return `Estimates are based on weeks and assume ${share}.`;
    case 'teamSprints':
      return `Estimates are based on ${sprintLength}-day sprints and assume ${share}.`;
  }
}

/** The summary under the estimation questions, e.g. "40 story points per 10-day sprint. Up to 2 work items in parallel." */
export function describeEstimation(config: EstimationInputs, item: ItemLabel): string {
  return `${describeUnit(config)} ${describeParallel(Number(config.tracks), item)}`;
}

export type CapacityReadout = { value: number; label: string };

const SHARE_PREFIX: Record<EstimateTeamShare, string> = {
  full: 'team',
  half: 'half-team',
  third: 'third-team',
  quarter: 'quarter-team',
};

const readout = (value: number, singular: string, many: string, per: string): CapacityReadout => {
  const rounded = roundTo(value, 2);

  return { value: rounded, label: `${plural(rounded, singular, many)} / ${per}` };
};

/**
 * The AutoScheduler team bar's whole-team throughput, in the team's own unit. `perPeriod` is left out
 * for Dev Days and Team Working Days, whose period already is a day.
 *
 * @param velocity effective velocity (`getEffectiveVelocity`)
 * @param periodDays the scheduling period it is measured over (`getSchedulingPeriodDays`)
 */
export function formatCapacity(
  unit: EstimateUnit,
  share: EstimateTeamShare,
  velocity: number,
  periodDays: number,
): { perPeriod?: CapacityReadout; perDay: CapacityReadout } {
  const perDay = velocity / periodDays;
  const prefix = SHARE_PREFIX[share];

  switch (unit) {
    case 'storyPoints':
      return {
        perPeriod: readout(velocity, 'point', 'points', 'sprint'),
        perDay: readout(perDay, 'point', 'points', 'day'),
      };
    case 'devDays':
      return { perDay: readout(perDay, 'dev day', 'dev days', 'day') };
    case 'teamDays':
      return { perDay: readout(perDay, `${prefix} day`, `${prefix} days`, 'day') };
    case 'teamWeeks':
      return {
        perPeriod: readout(perDay * DAYS_PER_WEEK, `${prefix} week`, `${prefix} weeks`, 'week'),
        perDay: readout(perDay, `${prefix} week`, `${prefix} weeks`, 'day'),
      };
    case 'teamSprints':
      return {
        perPeriod: readout(velocity, `${prefix} sprint`, `${prefix} sprints`, 'sprint'),
        perDay: readout(perDay, `${prefix} sprint`, `${prefix} sprints`, 'day'),
      };
  }
}

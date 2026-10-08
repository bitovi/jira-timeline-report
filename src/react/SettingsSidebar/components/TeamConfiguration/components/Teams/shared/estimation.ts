/**
 * Turns a team's answers to the estimation questions into the one number the scheduler needs.
 *
 * The scheduler works from three numbers per issue (`jira/normalized/normalize.ts`):
 *
 *   pointsPerDayPerTrack = velocity / daysPerSprint / parallelWorkLimit
 *   daysOfWork           = estimate / pointsPerDayPerTrack
 *   default estimate     = velocity / parallelWorkLimit          (unestimated items)
 *
 * so each estimate unit only has to produce an **effective velocity**: how many estimate units the
 * whole team finishes per sprint. `daysPerSprint` and `parallelWorkLimit` keep coming from
 * `sprintLength` and `tracks`. See spec/040-update-team-estimation-settings.
 */
import type { Configuration, EstimateTeamShare, EstimateUnit } from '../services/team-configuration';

import { roundTo } from '../../../../../../../utils/number/number';

const SHARE: Record<EstimateTeamShare, number> = { full: 1, half: 1 / 2, third: 1 / 3, quarter: 1 / 4 };

/** "One week is 5 working days." */
const DAYS_PER_WEEK = 5;

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

/** Estimate units the whole team finishes per sprint. */
export function getEffectiveVelocity(config: EstimationInputs): number {
  const sprintLength = Number(config.sprintLength);
  const share = SHARE[config.estimateTeamShare ?? 'full'];

  switch (config.estimateUnit ?? 'storyPoints') {
    case 'storyPoints':
      return Number(config.velocityPerSprint);
    case 'devDays':
      // Every member puts in one dev-day per working day.
      return Number(config.teamMembers) * sprintLength;
    case 'teamDays':
      return sprintLength / share;
    case 'teamWeeks':
      return sprintLength / (DAYS_PER_WEEK * share);
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

function describeParallel(tracks: number, item: ItemLabel) {
  return tracks === 1 ? `One ${item.singular} at a time.` : `Up to ${tracks} ${item.plural} in parallel.`;
}

/** The one-line summary under the estimation questions, e.g. "40 story points per 10-day sprint. …" */
export function describeEstimation(config: EstimationInputs, item: ItemLabel): string {
  const sprintLength = Number(config.sprintLength);
  const share = SHARE_PHRASE[config.estimateTeamShare ?? 'full'];
  const parallel = describeParallel(Number(config.tracks), item);

  switch (config.estimateUnit ?? 'storyPoints') {
    case 'storyPoints': {
      const velocity = Number(config.velocityPerSprint);

      return `${velocity} story ${plural(velocity, 'point', 'points')} per ${sprintLength}-day sprint. ${parallel}`;
    }
    case 'devDays': {
      const members = Number(config.teamMembers);

      return `${members} full-time team ${plural(members, 'member', 'members')}. ${parallel}`;
    }
    case 'teamDays':
      return `Estimates are based on working days and assume ${share}. ${parallel}`;
    case 'teamWeeks':
      return `Estimates are based on weeks and assume ${share}. ${parallel}`;
    case 'teamSprints':
      return `Estimates are based on ${sprintLength}-day sprints and assume ${share}. ${parallel}`;
  }
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
 * @param sprintLength working days in a sprint
 */
export function formatCapacity(
  unit: EstimateUnit,
  share: EstimateTeamShare,
  velocity: number,
  sprintLength: number,
): { perPeriod?: CapacityReadout; perDay: CapacityReadout } {
  const perDay = velocity / sprintLength;
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

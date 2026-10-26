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
 * and "daysPerSprint" is that period's length in working days.
 *
 * Every unit stores one number, X (`pointsPerPersonDay`): estimate units one person finishes in one
 * working day. With the headcount N, the tracks T and the period P:
 *
 *   team / day      = X × N
 *   per track / day = X × N / T                                   (= pointsPerDayPerTrack)
 *   velocity        = X × N × P                                   (`getEffectiveVelocity`)
 *
 * So headcount scales capacity for every unit, tracks only divide it, and X changes only when the
 * team redefines what one estimate unit is.
 *
 * The team-time units (Team Days, Weeks, Sprints) don't store X: their estimates assume a share of the
 * team (`estimateTeamShare`), so X = 1 / (share × saved headcount × unit days). A saved headcount
 * change therefore redefines their estimates, which is why the AutoScheduler — where a headcount
 * what-if holds X fixed so throughput rises — won't commit one for them, and explains the manual
 * steps instead. Configs saved before X existed derive it from their
 * legacy answers at their own headcount, which reproduces their old velocity exactly.
 *
 * The period cancels out of every estimated duration. Its only visible effect is the default
 * estimate: an unestimated item takes exactly one period. See spec/042-update-team-estimation-settings.
 */
import type { Configuration, EstimateTeamShare, EstimateUnit } from '../services/team-configuration';

import { roundTo } from '../../../../../../../utils/number/number';

/** What a configuration that never chose a unit — every one saved before spec/042 — means. */
export const DEFAULT_ESTIMATE_UNIT: EstimateUnit = 'storyPoints';

/** The headcount of a team that never entered one. */
export const DEFAULT_TEAM_MEMBERS = 5;

/** The share shortcuts for "How many people does one estimate assume?", and the legacy saved shares. */
export const SHARE: Record<EstimateTeamShare, number> = { full: 1, half: 1 / 2, third: 1 / 3, quarter: 1 / 4 };

/** "One week is 5 working days." Also how the form's sprint length, asked in weeks, is stored in days. */
export const DAYS_PER_WEEK = 5;

/**
 * Working days an unestimated item takes, for the units that don't ask for a sprint length. The
 * sprint units (Story Points, Team Sprints) use their sprint length instead.
 */
export const UNESTIMATED_WORKING_DAYS: Record<Exclude<EstimateUnit, 'storyPoints' | 'teamSprints'>, number> = {
  devDays: 10,
  teamDays: 10,
  teamWeeks: 10,
};

export type EstimationInputs = Pick<
  Configuration,
  | 'estimateUnit'
  | 'estimateTeamShare'
  | 'velocityPerSprint'
  | 'pointsPerPersonDay'
  | 'teamMembers'
  | 'sprintLength'
  | 'tracks'
>;

export type TeamTimeUnit = 'teamDays' | 'teamWeeks' | 'teamSprints';

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

/**
 * A stored `sprintLength` (working days) as the weeks the form asks for. The setting stays in days so
 * the scheduler, the legacy form and every saved config read it unchanged.
 */
export function sprintWeeks(sprintLengthDays: number): number {
  return roundTo(sprintLengthDays / DAYS_PER_WEEK, 2);
}

/** Does this unit ask "How many weeks are in a sprint?" */
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

/** Do this unit's estimates mean a stretch of time for some number of people? */
export function isTeamTimeUnit(unit: EstimateUnit): unit is TeamTimeUnit {
  return unit === 'teamDays' || unit === 'teamWeeks' || unit === 'teamSprints';
}

const unitOf = (config: Pick<EstimationInputs, 'estimateUnit'>) => config.estimateUnit ?? DEFAULT_ESTIMATE_UNIT;

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/** The team's headcount, or the default for a team that never entered one. */
export function getTeamMembers(config: Pick<EstimationInputs, 'teamMembers'>): number {
  const members = Number(config.teamMembers);

  return config.teamMembers != null && isPositive(members) ? members : DEFAULT_TEAM_MEMBERS;
}

/** Working days one team-time estimate covers: a day, a week, or a sprint. */
export function getUnitDays(unit: TeamTimeUnit, sprintLength: number | null): number {
  switch (unit) {
    case 'teamDays':
      return 1;
    case 'teamWeeks':
      return DAYS_PER_WEEK;
    case 'teamSprints':
      return Number(sprintLength);
  }
}

/** The pre-X velocity — each unit's own formula, from the answers saved before X existed. */
function getLegacyVelocity(config: EstimationInputs): number {
  const periodDays = getSchedulingPeriodDays(config);
  const share = SHARE[config.estimateTeamShare ?? 'full'];

  switch (unitOf(config)) {
    case 'storyPoints':
      return Number(config.velocityPerSprint);
    case 'devDays':
      return getTeamMembers(config) * periodDays;
    case 'teamDays':
      return periodDays / share;
    case 'teamWeeks':
      return periodDays / (DAYS_PER_WEEK * share);
    case 'teamSprints':
      return 1 / share;
  }
}

/**
 * X: estimate units one person finishes in one working day. The stored value, or — for a config
 * saved before X existed — the one that reproduces its old velocity at its current headcount.
 * Dev Days is always 1: a dev day is one person's working day by definition.
 */
export function getPointsPerPersonDay(config: EstimationInputs): number {
  return (
    getStoredPointsPerPersonDay(config) ??
    getLegacyVelocity(config) / (getSchedulingPeriodDays(config) * getTeamMembers(config))
  );
}

/** X when it is known without the legacy answers: saved, or Dev Days' fixed 1. */
function getStoredPointsPerPersonDay(config: EstimationInputs): number | null {
  if (unitOf(config) === 'devDays') return 1;

  const stored = Number(config.pointsPerPersonDay);

  return config.pointsPerPersonDay != null && isPositive(stored) ? stored : null;
}

/** The answers X is calculated from. Only the ones the unit asks for are read. */
export interface CapacityAnswers {
  velocityPerSprint?: number | null;
  teamMembers: number;
  sprintLength: number | null;
  /** "How many people does one estimate assume?" (Team Working Days, Weeks and Sprints). */
  peoplePerEstimate?: number | null;
}

/** X from the answers: `1 / (person-days in one estimate unit)`. */
export function pointsPerPersonDayFor(unit: EstimateUnit, answers: CapacityAnswers): number {
  switch (unit) {
    case 'storyPoints':
      return Number(answers.velocityPerSprint) / (answers.teamMembers * Number(answers.sprintLength));
    case 'devDays':
      return 1;
    default:
      return 1 / (Number(answers.peoplePerEstimate) * getUnitDays(unit, answers.sprintLength));
  }
}

/** People one team-time estimate assumes, `1 / (X × unit days)`; `null` for the other units. */
export function getPeoplePerEstimate(config: EstimationInputs): number | null {
  const unit = unitOf(config);
  if (!isTeamTimeUnit(unit)) return null;

  return 1 / (getPointsPerPersonDay(config) * getUnitDays(unit, config.sprintLength));
}

/** Estimate units the whole team finishes in one sprint, `X × N × sprint length`. */
export function getVelocityPerSprint(config: EstimationInputs): number {
  return getPointsPerPersonDay(config) * getTeamMembers(config) * Number(config.sprintLength);
}

/** Estimate units the whole team finishes in one scheduling period, `X × N × P`. */
export function getEffectiveVelocity(config: EstimationInputs): number {
  const stored = getStoredPointsPerPersonDay(config);

  // A derived X would only round-trip back to the legacy velocity, so skip it: that keeps a config
  // saved before X identical to before, even one whose period doesn't resolve.
  return stored === null
    ? getLegacyVelocity(config)
    : stored * getTeamMembers(config) * getSchedulingPeriodDays(config);
}

/**
 * The parallel count ("tracks") implied by the other answers, or `null` when they imply none:
 *
 * - Dev Days: one item per developer — the headcount, rounded down, at least 1.
 * - Team Working Days, Weeks and Sprints: as many items as one estimate's people fit into the
 *   team — `round(headcount / people per estimate)`, at least 1.
 * - Story Points: nothing to derive from.
 *
 * Only the settings form applies it — whenever the unit, the people per estimate or the headcount
 * changes, overwriting whatever parallel count was there. The AutoScheduler never does.
 */
export function getDefaultTracks(config: EstimationInputs): number | null {
  const unit = unitOf(config);

  if (unit === 'storyPoints') return null;

  const members = getTeamMembers(config);

  if (unit === 'devDays') return Math.max(1, Math.floor(members));

  return Math.max(1, Math.round(members / getPeoplePerEstimate(config)!));
}

/**
 * The X to save alongside a new headcount, or `undefined` when only `teamMembers` is written:
 *
 * - **Re-anchor** — the team never entered a headcount, so its X was derived against the default.
 *   The first headcount says how many people the existing capacity assumes: X is rescaled so the
 *   team's capacity doesn't change.
 * - **Pin** — X is still derived, so it would follow the new headcount and cancel it out. Saving
 *   the current X makes the headcount count.
 *
 * Dev Days never needs either: its X is always 1. Neither do the team-time units: their X is their
 * share of the saved team, so saving a new headcount is meant to redefine every estimate along with it
 * (the AutoScheduler's what-if holds X fixed instead, and only explains how to commit).
 */
export function pointsPerPersonDayForHeadcount(
  config: EstimationInputs,
  nextMembers: number,
  hasSavedHeadcount: boolean,
): number | undefined {
  const unit = unitOf(config);
  if (unit === 'devDays' || isTeamTimeUnit(unit)) return undefined;

  const current = getPointsPerPersonDay(config);

  if (!hasSavedHeadcount) return (current * getTeamMembers(config)) / nextMembers;
  if (config.pointsPerPersonDay == null) return current;

  return undefined;
}

/**
 * X for a newly chosen unit, from that unit's formula and the current answers. A team-time unit
 * keeps its people per estimate when coming from another team-time unit, and otherwise starts at the
 * full team. Story Points keeps the current points per sprint.
 */
export function pointsPerPersonDayForUnit(config: EstimationInputs, nextUnit: EstimateUnit): number {
  const teamMembers = getTeamMembers(config);
  const peoplePerEstimate = getPeoplePerEstimate(config) ?? teamMembers;

  return pointsPerPersonDayFor(nextUnit, {
    velocityPerSprint: unitOf(config) === 'storyPoints' ? getVelocityPerSprint(config) : config.velocityPerSprint,
    teamMembers,
    sprintLength: config.sprintLength,
    peoplePerEstimate,
  });
}

/**
 * X after a sprint length change: Story Points keeps its points per sprint, and Team Sprints its
 * people per estimate. Both come to `X × old / new`.
 */
export function pointsPerPersonDayForSprintLength(config: EstimationInputs, nextSprintLength: number): number {
  return (getPointsPerPersonDay(config) * Number(config.sprintLength)) / nextSprintLength;
}

const plural = (count: number, singular: string, many: string) => (count === 1 ? singular : many);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * How the estimate field reads in a sentence. Field names are usually plural nouns ("Story
 * Points"); a name not ending in a plain "s" ("Days median") is used as is for both.
 */
export type FieldLabel = { singular: string; plural: string };

export const DEFAULT_FIELD_LABEL: FieldLabel = { singular: 'estimate', plural: 'estimates' };

export function fieldLabelFor(name: string | null | undefined): FieldLabel {
  if (!name) return DEFAULT_FIELD_LABEL;

  return { singular: /[^s]s$/i.test(name) ? name.slice(0, -1) : name, plural: name };
}

/** Rates get small (0.02 / day), so keep a third decimal below 0.1 — 0.067, not 0.07. */
export function formatRate(value: number): number {
  return roundTo(value, Math.abs(value) < 0.1 ? 3 : 2);
}

/** "5 people", "1 developer", "5.5 developers" */
const count = (value: number, singular: string, many: string) => {
  const rounded = roundTo(value, 2);

  return `${rounded} ${plural(rounded, singular, many)}`;
};

/** "(50% of the team)" — display only, so it follows the current headcount. */
export function describeShareOfTeam(peoplePerEstimate: number, teamMembers: number): string {
  return `${roundTo((peoplePerEstimate / teamMembers) * 100, 0)}% of the team`;
}

const UNIT_STRETCH: Record<TeamTimeUnit, (weeks: number) => string> = {
  teamDays: () => '1 day',
  teamWeeks: () => '1 week',
  teamSprints: (weeks) => `one ${weeks}-week sprint`,
};

/**
 * What one unit of the estimate field means for this team:
 *
 * - "1 Story Point is 1 week of work for 5 people (50% of the team)"
 * - "1 Story Point is 1 day of work for 1 developer"
 * - "21 Story Points per 2-week sprint with 10 developers"
 */
export function describeEstimateUnit(config: EstimationInputs, field: FieldLabel, verb = 'is'): string {
  const unit = unitOf(config);
  const members = getTeamMembers(config);
  const weeks = sprintWeeks(Number(config.sprintLength));

  if (unit === 'storyPoints') {
    const velocity = formatRate(getVelocityPerSprint(config));

    return `${velocity} ${plural(velocity, field.singular, field.plural)} per ${weeks}-week sprint with ${count(members, 'developer', 'developers')}`;
  }

  if (unit === 'devDays') return `1 ${field.singular} ${verb} 1 day of work for 1 developer`;

  const people = getPeoplePerEstimate(config)!;

  return `1 ${field.singular} ${verb} ${UNIT_STRETCH[unit](weeks)} of work for ${count(people, 'person', 'people')} (${describeShareOfTeam(people, members)})`;
}

function describeParallel(tracks: number, item: ItemLabel) {
  return tracks === 1 ? `One ${item.singular} at a time.` : `With ${tracks} ${item.plural} in parallel.`;
}

/**
 * The variable parts of the unit question's second hint, "{items} without estimates default to
 * {period}." — returned apart so the hint can emphasize them.
 */
export function describeUnestimated(config: EstimationInputs, item: ItemLabel): { items: string; period: string } {
  const days = getSchedulingPeriodDays(config);

  return { items: capitalize(item.plural), period: `${days} working ${plural(days, 'day', 'days')}` };
}

/**
 * The summary under the estimation questions, e.g. "1 Story Point is 1 week of work for 5 people
 * (50% of the team). 10 developers. With 2 work items in parallel."
 */
export function describeEstimation(
  config: EstimationInputs,
  item: ItemLabel,
  field: FieldLabel = DEFAULT_FIELD_LABEL,
): string {
  const meaning = capitalize(describeEstimateUnit(config, field));
  // Story Points already names the headcount ("… with 10 developers").
  const headcount =
    unitOf(config) === 'storyPoints' ? '' : ` ${count(getTeamMembers(config), 'developer', 'developers')}.`;

  return `${meaning}.${headcount} ${describeParallel(Number(config.tracks), item)}`;
}

/** A rate per working day, plus per sprint or week where the unit has one. */
export type CapacityRate = { perDay: number; perPeriod?: number };

export type CapacityReadout = {
  /** X — doesn't change with headcount. */
  perPerson: CapacityRate;
  /** X × N. */
  team: CapacityRate;
  /** What `perPeriod` is per: a sprint for Story Points and Team Sprints, a week for Team Weeks. */
  period?: 'sprint' | 'week';
};

/**
 * The AutoScheduler team bar's readout: the per-developer rate and the team total, per day for every
 * unit, plus per sprint (Story Points, Team Sprints) or per week (Team Weeks). Unrounded — the caller
 * formats (`formatRate`).
 */
export function formatCapacity({
  unit,
  pointsPerPersonDay,
  teamMembers,
  sprintLength,
}: {
  unit: EstimateUnit;
  pointsPerPersonDay: number;
  teamMembers: number;
  /** Working days in a sprint; read only by the sprint units. */
  sprintLength: number;
}): CapacityReadout {
  const periodDays = unit === 'teamWeeks' ? DAYS_PER_WEEK : usesSprintLength(unit) ? sprintLength : undefined;
  const rate = (perDay: number): CapacityRate =>
    periodDays === undefined ? { perDay } : { perDay, perPeriod: perDay * periodDays };

  return {
    perPerson: rate(pointsPerPersonDay),
    team: rate(pointsPerPersonDay * teamMembers),
    period: unit === 'teamWeeks' ? 'week' : periodDays === undefined ? undefined : 'sprint',
  };
}

/**
 * Contains shared type definitions and utility functions to create empty configurations for consumption by the UI
 */
import type { EstimateTeamShare, EstimateUnit } from '../../../../../../../../../jira/shared/types';

export type { EstimateTeamShare, EstimateUnit };

export type IssueFields = Array<{
  name: string;
  key: string;
  schema: Record<string, string>;
  id: string;
  custom: boolean;
  clauseNames: string[];
  searchable: boolean;
  navigable: boolean;
  orderable: boolean;
}>;

export type Configuration = {
  /** Working days in a sprint. */
  sprintLength: number | null;
  /**
   * Legacy: story points completed per sprint. No longer written — read only to derive
   * `pointsPerPersonDay` for configs saved before it existed. See spec/040.
   */
  velocityPerSprint: number | null;
  /**
   * The team's capacity, X: estimate units one person finishes in one working day, in the team's
   * estimate unit. Resolves together with `estimateUnit` (see `inheritance.ts`).
   */
  pointsPerPersonDay: number | null;
  /** Work items the team handles in parallel (every unit). */
  tracks: number | null;
  /** `null` resolves to `storyPoints`, which is how every config saved before spec/040 behaves. */
  estimateUnit: EstimateUnit | null;
  /** Developers on the team. Drives capacity for every unit; decimals allowed. */
  teamMembers: number | null;
  /** Legacy: read only to derive `pointsPerPersonDay` for configs saved before it existed. */
  estimateTeamShare: EstimateTeamShare | null;
  estimateField: string | null;
  confidenceField: string | null;
  startDateField: string | null;
  dueDateField: string | null;
  statusSummaryField: string | null;
  spreadEffortAcrossDates: boolean | null;
};

export type TeamConfiguration = Partial<Record<string, Configuration>> & {
  defaults: Configuration;
};

export type AllTeamData = Partial<Record<string, TeamConfiguration>> & {
  __GLOBAL__: TeamConfiguration;
};

export const createEmptyConfiguration = (): Configuration => {
  return {
    sprintLength: null,
    velocityPerSprint: null,
    pointsPerPersonDay: null,
    tracks: null,
    estimateUnit: null,
    teamMembers: null,
    estimateTeamShare: null,
    estimateField: null,
    confidenceField: null,
    startDateField: null,
    dueDateField: null,
    statusSummaryField: null,
    spreadEffortAcrossDates: null,
  };
};

export const createEmptyTeamConfiguration = (issueHierarchy: string[]): TeamConfiguration => {
  return issueHierarchy.reduce(
    (config, level) => {
      return { ...config, [level]: createEmptyConfiguration() };
    },
    { defaults: createEmptyConfiguration() },
  );
};

export const createEmptyAllTeamsData = (issueHierarchy: string[] = []): AllTeamData => {
  return { __GLOBAL__: createEmptyTeamConfiguration(issueHierarchy) };
};

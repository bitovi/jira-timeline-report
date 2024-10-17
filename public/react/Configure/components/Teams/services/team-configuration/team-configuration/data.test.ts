import type { AllTeamData, Configuration, IssueFields, TeamConfiguration } from "./shared";
import { expect, test, describe } from "vitest";
import { createEmptyAllTeamsData, createEmptyConfiguration, createEmptyTeamConfiguration } from "./shared";
import { applyInheritance, getInheritedData } from "./inheritance";
import { applyGlobalDefaultData, getGlobalDefaultData } from "./allTeamDefault";

const createConfiguration = (overrides: Partial<Configuration> = {}): Configuration => ({
  ...createEmptyConfiguration(),
  ...overrides,
});

const createTeamConfiguration = (overrides: Partial<TeamConfiguration> = {}): TeamConfiguration => ({
  ...createEmptyTeamConfiguration(),
  ...overrides,
});

const createAllTeamData = (teamOverrides: Partial<Record<string, TeamConfiguration>> = {}): AllTeamData => ({
  ...createEmptyAllTeamsData(),
  ...teamOverrides,
});

const jiraFields: IssueFields = [
  {
    name: "Story points",
    key: "customfield_10000",
    schema: {},
    id: "10000",
    custom: true,
    clauseNames: [],
    searchable: true,
    navigable: true,
    orderable: true,
  },
  {
    name: "Confidence",
    key: "customfield_10001",
    schema: {},
    id: "10001",
    custom: true,
    clauseNames: [],
    searchable: true,
    navigable: true,
    orderable: true,
  },
  {
    name: "Start date",
    key: "customfield_10002",
    schema: {},
    id: "10002",
    custom: true,
    clauseNames: [],
    searchable: true,
    navigable: true,
    orderable: true,
  },
  {
    name: "Due date",
    key: "customfield_10003",
    schema: {},
    id: "10003",
    custom: true,
    clauseNames: [],
    searchable: true,
    navigable: true,
    orderable: true,
  },
];

describe("Configuration Inheritance and Defaults", () => {
  test("getGlobalDefaultData returns correct defaults with empty allTeamData", () => {
    const allTeamData = createAllTeamData();

    const globalDefaults = getGlobalDefaultData(allTeamData, jiraFields);

    const expectedDefaults: Configuration = {
      sprintLength: 10,
      velocityPerSprint: 21,
      tracks: 1,
      spreadEffortAcrossDates: false,
      estimateField: "Story points",
      confidenceField: "Confidence",
      startDateField: "Start date",
      dueDateField: "Due date",
    };

    expect(globalDefaults).toEqual(expectedDefaults);
  });

  // test("getInheritedData applies team and global defaults correctly", () => {
  //   const allTeamData: AllTeamData = {
  //     __GLOBAL__: createTeamConfiguration({
  //       defaults: {
  //         sprintLength: 10,
  //         velocityPerSprint: 21,
  //         tracks: 1,
  //         spreadEffortAcrossDates: false,
  //         estimateField: "Story points",
  //         confidenceField: "Confidence",
  //         startDateField: "Start date",
  //         dueDateField: "Due date",
  //       },
  //     }),
  //     "Team A": createTeamConfiguration({
  //       defaults: createConfiguration({
  //         sprintLength: 15,
  //         velocityPerSprint: 30,
  //       }),
  //       epics: createConfiguration({
  //         tracks: 2,
  //       }),
  //     }),
  //   };

  //   const teamAInheritedData = getInheritedData("Team A", allTeamData);

  //   expect(teamAInheritedData.epics).toEqual({
  //     sprintLength: 15,
  //     velocityPerSprint: 30,
  //     tracks: 2,
  //     spreadEffortAcrossDates: false,
  //     estimateField: "Story points",
  //     confidenceField: "Confidence",
  //     startDateField: "Start date",
  //     dueDateField: "Due date",
  //   });

  //   expect(teamAInheritedData.stories).toEqual({
  //     sprintLength: 15,
  //     velocityPerSprint: 30,
  //     tracks: 1,
  //     spreadEffortAcrossDates: false,
  //     estimateField: "Story points",
  //     confidenceField: "Confidence",
  //     startDateField: "Start date",
  //     dueDateField: "Due date",
  //   });
  // });

  test("applyGlobalDefaultData augments allTeamData with computed global defaults", () => {
    const allTeamData = createAllTeamData();

    const augmentedData = applyGlobalDefaultData(allTeamData, jiraFields);

    const expectedDefaults: Configuration = {
      sprintLength: 10,
      velocityPerSprint: 21,
      tracks: 1,
      spreadEffortAcrossDates: false,
      estimateField: "Story points",
      confidenceField: "Confidence",
      startDateField: "Start date",
      dueDateField: "Due date",
    };

    expect(augmentedData.__GLOBAL__.defaults).toEqual(expectedDefaults);
  });

  test("applyInheritance applies inheritance to team configurations correctly", () => {
    const allTeamData: AllTeamData = {
      __GLOBAL__: createTeamConfiguration({
        defaults: {
          sprintLength: 10,
          velocityPerSprint: 21,
          tracks: 1,
          spreadEffortAcrossDates: false,
          estimateField: "Story points",
          confidenceField: "Confidence",
          startDateField: "Start date",
          dueDateField: "Due date",
        },
        epics: createConfiguration({
          spreadEffortAcrossDates: true,
        }),
      }),
      "Team B": createTeamConfiguration({
        defaults: createConfiguration({
          tracks: 3,
        }),
        stories: createConfiguration({
          estimateField: "Custom Estimate",
        }),
      }),
    };

    const augmentedData = applyGlobalDefaultData(allTeamData, jiraFields);
    const inheritedData = applyInheritance("Team B", augmentedData);

    expect(inheritedData["Team B"]?.epics).toEqual({
      sprintLength: 10,
      velocityPerSprint: 21,
      tracks: 3,
      spreadEffortAcrossDates: true,
      estimateField: "Story points",
      confidenceField: "Confidence",
      startDateField: "Start date",
      dueDateField: "Due date",
    });

    expect(inheritedData["Team B"]?.stories).toEqual({
      sprintLength: 10,
      velocityPerSprint: 21,
      tracks: 3,
      spreadEffortAcrossDates: false,
      estimateField: "Custom Estimate",
      confidenceField: "Confidence",
      startDateField: "Start date",
      dueDateField: "Due date",
    });
  });
});

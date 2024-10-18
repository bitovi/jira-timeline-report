import { AllTeamData, Configuration, IssueFields } from "./shared";

const findFieldCalled = (name: string, jiraFields: IssueFields): string | undefined => {
  return jiraFields.find((field) => field.name.toLowerCase() === name.toLowerCase())?.name;
};

const createDefaultJiraFieldGetter = <TFormField extends keyof Configuration>(
  formField: TFormField,
  possibleNames: string[],
  nameFragments: string[] = []
) => {
  return function (userData: Partial<Configuration>, jiraFields: IssueFields) {
    const userDefinedFieldExists = findFieldCalled((userData[formField] ?? "").toString(), jiraFields);

    if (userData?.[formField] && userDefinedFieldExists) {
      return userData[formField];
    }

    for (const possibleName of possibleNames) {
      const field = jiraFields.find(
        (field) => field.name === possibleName || field.name.toLowerCase() === possibleName.toLowerCase()
      );

      if (field) {
        return field.name;
      }
    }

    for (const fragment of nameFragments) {
      const field = jiraFields.find(({ name }) => name.toLowerCase().includes(fragment.toLowerCase()));

      if (field) {
        return field.name;
      }
    }

    return null;
  };
};

const getEstimateField = createDefaultJiraFieldGetter(
  "estimateField",
  ["story points median", "days median", "story points", "story point estimate"],
  ["median", "estimate"]
);

const getConfidenceField = createDefaultJiraFieldGetter(
  "confidenceField",
  ["Story points confidence", "Estimate confidence", "Days confidence"],
  ["confidence"]
);

const getStartDateField = createDefaultJiraFieldGetter("startDateField", ["start date", "starting date"]);

const getDueDateField = createDefaultJiraFieldGetter("dueDateField", ["due date", "end date", "target date"]);

const nonFieldDefaults: Omit<Configuration, "estimateField" | "confidenceField" | "startDateField" | "dueDateField"> = {
  sprintLength: 10,
  velocityPerSprint: 21,
  tracks: 1,
  spreadEffortAcrossDates: false,
};

export const getGlobalDefaultData = (allTeamData: AllTeamData, jiraFields: IssueFields): Configuration => {
  return {
    sprintLength: allTeamData.__GLOBAL__.defaults.sprintLength ?? nonFieldDefaults.sprintLength,
    velocityPerSprint: allTeamData.__GLOBAL__.defaults.velocityPerSprint ?? nonFieldDefaults.velocityPerSprint,
    tracks: allTeamData.__GLOBAL__.defaults.tracks ?? nonFieldDefaults.tracks,
    spreadEffortAcrossDates:
      allTeamData.__GLOBAL__.defaults.spreadEffortAcrossDates ?? nonFieldDefaults.spreadEffortAcrossDates,
    estimateField: getEstimateField(allTeamData.__GLOBAL__.defaults, jiraFields),
    confidenceField: getConfidenceField(allTeamData.__GLOBAL__.defaults, jiraFields),
    startDateField: getStartDateField(allTeamData.__GLOBAL__.defaults, jiraFields),
    dueDateField: getDueDateField(allTeamData.__GLOBAL__.defaults, jiraFields),
  };
};

export const applyGlobalDefaultData = (allTeamData: AllTeamData, jiraFields: IssueFields): AllTeamData => {
  return {
    ...allTeamData,
    __GLOBAL__: {
      ...allTeamData.__GLOBAL__,
      defaults: getGlobalDefaultData(allTeamData, jiraFields),
    },
  };
};

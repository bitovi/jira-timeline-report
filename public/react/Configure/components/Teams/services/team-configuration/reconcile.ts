import type { AppStorage } from "../../../../../../jira/storage/common";

import { globalTeamConfigurationStorageKey } from "./key-factory";

export type TeamConfiguration = {
  sprintLength: number | null;
  velocityPerSprint: number | null;
  tracks: number | null;
  estimateField: string | null;
  confidenceField: string | null;
  startDateField: string | null;
  dueDateField: string | null;
  spreadEffortAcrossDates: boolean | null;
};

export function isFieldUpdate(event: { name: string }): event is { name: keyof TeamConfiguration } {
  return [
    "sprintLength",
    "velocityPerSprint",
    "tracks",
    "estimateField",
    "confidenceField",
    "startDateField",
    "dueDateField",
    "spreadEffortAcrossDates",
  ].includes(event.name);
}

import jiraOidcHelpers from "../../../../../../jira-oidc-helpers";
type Jira = ReturnType<typeof jiraOidcHelpers>;

type IssueFields = Array<{
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

const nonFieldDefaults: Omit<
  TeamConfiguration,
  "estimateField" | "confidenceField" | "startDateField" | "dueDateField"
> = {
  sprintLength: 10,
  velocityPerSprint: 21,
  tracks: 1,
  spreadEffortAcrossDates: false,
};

const findFieldCalled = (name: string, jiraFields: IssueFields): string | undefined => {
  return jiraFields.find((field) => field.name.toLowerCase() === name.toLowerCase())?.name;
};

const createDefaultJiraFieldGetter = <TFormField extends keyof TeamConfiguration>(
  formField: TFormField,
  possibleNames: string[],
  nameFragments: string[] = []
) => {
  return function (userData: Partial<TeamConfiguration>, jiraFields: IssueFields) {
    const userDefinedFieldExists = findFieldCalled((userData[formField] ?? "").toString(), jiraFields);

    if (userData?.[formField] !== undefined && userDefinedFieldExists) {
      return userData[formField]!;
    }

    for (const possibleName of possibleNames) {
      const caseSensitiveField = jiraFields.find((field) => field.name === possibleName);

      if (caseSensitiveField) {
        return caseSensitiveField.name;
      }

      const caseInsensitiveField = findFieldCalled(possibleName, jiraFields);

      if (caseInsensitiveField) {
        return caseInsensitiveField;
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

const getStartDateField = createDefaultJiraFieldGetter("startDateField", ["Start date", "starting date"]);

const getDueDateField = createDefaultJiraFieldGetter("dueDateField", ["due date", "end date", "target date"]);

export const getFormData = async (jira: Jira, storage: AppStorage): Promise<TeamConfiguration> => {
  const [jiraFields, userData] = await Promise.all([
    jira.fetchJiraFields() as unknown as IssueFields,
    storage.get<Partial<TeamConfiguration> | undefined>(globalTeamConfigurationStorageKey),
  ]);

  return addDefaultFormData(jiraFields, userData ?? {});
};

export const addDefaultFormData = (
  jiraFields: IssueFields,
  userData: Partial<TeamConfiguration>
): TeamConfiguration => {
  return {
    ...nonFieldDefaults,
    ...userData,
    estimateField: getEstimateField(userData, jiraFields),
    confidenceField: getConfidenceField(userData, jiraFields),
    startDateField: getStartDateField(userData, jiraFields),
    dueDateField: getDueDateField(userData, jiraFields),
  };
};

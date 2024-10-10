import type { DefaultFormFields } from "../../ConfigureTeamsForm";
import type { AppStorage } from "../../../../../../jira/storage/common";

import { globalTeamConfigurationStorageKey } from "./key-factory";

export type TeamConfiguration = {
  sprintLength: number;
  velocityPerSprint: number;
  tracks: number;
  estimateField: string;
  confidenceField: string;
  startDateField: string;
  dueDateField: string;
  spreadEffortAcrossDates: boolean;
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
  DefaultFormFields,
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

const createDefaultJiraFieldGetter = <TFormField extends keyof DefaultFormFields>(
  formField: TFormField,
  possibleNames: string[],
  nameFragments: string[] = []
) => {
  return function (userData: Partial<DefaultFormFields>, jiraFields: IssueFields) {
    const userDefinedFieldExists = findFieldCalled((userData[formField] ?? "").toString(), jiraFields);

    if (userData?.[formField] && userDefinedFieldExists) {
      return userData[formField];
    }

    for (const possibleName of possibleNames) {
      const field = findFieldCalled(possibleName, jiraFields);

      if (field) {
        return field;
      }
    }

    for (const fragment of nameFragments) {
      const field = jiraFields.find(({ name }) => name.includes(fragment));

      if (field) {
        return field.name;
      }
    }

    throw new Error(`Could not determine default value for ${formField}`);
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

export const getFormData = async (jira: Jira, storage: AppStorage): Promise<DefaultFormFields> => {
  const [jiraFields, userData] = await Promise.all([
    jira.fetchJiraFields() as unknown as IssueFields,
    storage.get<Partial<DefaultFormFields> | undefined>(globalTeamConfigurationStorageKey),
  ]);

  return addDefaultFormData(jiraFields, userData ?? {});
};

export const addDefaultFormData = (
  jiraFields: IssueFields,
  userData: Partial<DefaultFormFields>
): DefaultFormFields => {
  return {
    ...nonFieldDefaults,
    ...userData,
    estimateField: getEstimateField(userData, jiraFields),
    confidenceField: getConfidenceField(userData, jiraFields),
    startDateField: getStartDateField(userData, jiraFields),
    dueDateField: getDueDateField(userData, jiraFields),
  };
};

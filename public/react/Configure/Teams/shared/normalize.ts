import { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import { DefaultFormFields } from "../ConfigureTeams";

export const createNormalizeConfiguration = (values: DefaultFormFields): Partial<NormalizeIssueConfig> => {
  return {
    getDaysPerSprint: () => Number(values.sprintLength),
  };
};

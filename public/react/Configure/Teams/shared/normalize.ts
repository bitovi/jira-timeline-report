import { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import { DefaultFormFields } from "../ConfigureTeams";

export const createNormalizeConfiguration = (values: DefaultFormFields): Partial<NormalizeIssueConfig> => {
  return {
    getDaysPerSprint: () => Number(values.sprintLength),
    getVelocity: () => Number(values.velocityPerSprint),
    getParallelWorkLimit: () => Number(values.tracks),
    getStartDate: ({ fields }) => {
      const value = fields[values.startDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getConfidence: ({ fields }) => {
      const value = fields[values.confidenceField];

      if (!value) {
        return null;
      }

      const confidence = Number(value);

      if (isNaN(confidence)) {
        return null;
      }

      return confidence;
    },
    getDueDate: ({ fields }) => {
      const value = fields[values.confidenceField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
  };
};

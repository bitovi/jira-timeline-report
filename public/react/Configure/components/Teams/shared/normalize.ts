import { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import { fields } from "../../../../../jira/raw/rollback/rollback";
import { DefaultFormFields } from "../ConfigureTeams";

export const createNormalizeConfiguration = (values: DefaultFormFields): Partial<NormalizeIssueConfig> => {
  return {
    getDaysPerSprint: () => Number(values.sprintLength),
    getVelocity: () => Number(values.velocityPerSprint),
    getParallelWorkLimit: () => Number(values.tracks),
    getTeamSpreadsEffortAcrossDates: () => {
      return values.spreadEffortAcrossDates;
    },
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
      const value = fields[values.dueDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getStoryPoints: ({ fields }) => {
      const value = fields[values.estimateField];

      if (!value) {
        return null;
      }

      const storyPoints = Number(value);

      if (isNaN(storyPoints)) {
        return null;
      }

      return storyPoints;
    },
    getStoryPointsMedian: ({ fields }) => {
      const value = fields[values.estimateField];

      if (!value) {
        return null;
      }

      const storyPoints = Number(value);

      if (isNaN(storyPoints)) {
        return null;
      }

      return storyPoints;
    },
  };
};

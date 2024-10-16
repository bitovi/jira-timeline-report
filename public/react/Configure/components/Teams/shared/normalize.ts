import type { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import type { Configuration } from "../services/team-configuration";

export const createNormalizeConfiguration = (values?: Configuration | undefined): Partial<NormalizeIssueConfig> => {
  if (!values) {
    return {};
  }

  return {
    getDaysPerSprint: () => Number(values.sprintLength),
    getVelocity: () => Number(values.velocityPerSprint),
    getParallelWorkLimit: () => Number(values.tracks),
    getTeamSpreadsEffortAcrossDates: () => {
      return !!values.spreadEffortAcrossDates;
    },
    getStartDate: ({ fields }) => {
      if (!values.startDateField) {
        return null;
      }

      const value = fields[values.startDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getConfidence: ({ fields }) => {
      if (!values.confidenceField) {
        return null;
      }

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
      if (!values.dueDateField) {
        return null;
      }

      const value = fields[values.dueDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getStoryPoints: ({ fields }) => {
      if (!values.estimateField) {
        return null;
      }

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
      if (!values.estimateField) {
        return null;
      }

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

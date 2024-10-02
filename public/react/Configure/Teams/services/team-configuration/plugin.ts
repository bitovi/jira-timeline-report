interface Configuration {
  appKey: string;
}

interface SprintDefaultResponse {
  key: string;
  value: {
    sprintLength: number;
  };
  self: string;
}

export type SprintDefaults = SprintDefaultResponse["value"];

const initialSprintLength = 10;

const initialDefaults: SprintDefaults = {
  sprintLength: initialSprintLength,
};

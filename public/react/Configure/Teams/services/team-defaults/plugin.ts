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

export const getSprintDefaults = ({ appKey }: Configuration): Promise<SprintDefaults> => {
  if (!AP) {
    throw new Error("getSprintDefaults (plugin) can only be used when connected with jira.");
  }

  return AP.request<{ body: string }>(`/rest/atlassian-connect/1/addons/${appKey}/properties/sprintDefaults`)
    .then((res) => {
      return JSON.parse(res.body) as SprintDefaultResponse;
    })
    .then((response) => {
      return response.value;
    })
    .catch((errorResponse) => {
      if ("err" in errorResponse) {
        const parsed = JSON.parse(errorResponse.err) as { statusCode: number; message: string };

        if (parsed.statusCode === 404) {
          return initialDefaults;
        }
      }

      throw errorResponse;
    });
};

export const setSprintDefaults = (updated: SprintDefaults, { appKey }: Configuration): Promise<void> => {
  if (!AP) {
    throw new Error("setSprintDefaults (plugin) can only be used when connected with jira.");
  }

  return AP.request<void>(`/rest/atlassian-connect/1/addons/${appKey}/properties/sprintDefaults`, {
    type: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: JSON.stringify(updated),
  });
};

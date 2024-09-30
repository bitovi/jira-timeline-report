interface Configuration {
  appKey: string;
}

declare global {
  const AP: AP;

  interface AP {
    request: <T = unknown>(
      url: string,
      config?: {
        type?: "GET" | "PUT";
        headers: Record<string, string>;
        data: any;
      }
    ) => Promise<T>;
  }
}

interface SprintDefaultResponse {
  key: string;
  value: {
    sprintLength: number;
  };
  self: string;
}

type SprintDefaults = SprintDefaultResponse["value"];

const initialSprintLength = 10;

const initialDefaults: SprintDefaults = {
  sprintLength: initialSprintLength,
};

export const getSprintDefaults = ({ appKey }: Configuration): Promise<SprintDefaults> => {
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
  return AP.request<void>(`/rest/atlassian-connect/1/addons/${appKey}/properties/sprintDefaults`, {
    type: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: JSON.stringify(updated),
  });
};

interface Configuration {
  appKey: string;
}

declare global {
  const AP: AP;

  interface AP {
    request: <T = unknown>(
      url: string,
      config?: {
        method?: "GET" | "PUT";
        headers: Record<string, string>;
        body: any;
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

export const getSprintDefaults = ({ appKey }: Configuration): Promise<SprintDefaults> => {
  return AP.request<SprintDefaultResponse>(`/atlassian-connect/1/addons/${appKey}/properties/sprintDefaults`).then(
    (response) => {
      return response.value;
    }
  );
};

export const setSprintDefaults = (updated: SprintDefaults, { appKey }: Configuration): Promise<void> => {
  return AP.request<void>(`/atlassian-connect/1/addons/${appKey}/properties/sprintDefaults`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updated),
  });
};

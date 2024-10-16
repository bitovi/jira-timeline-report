export const globalTeamConfigurationStorageKey = "global-configuration" as const;

export const teamConfigurationKeys = {
  all: ["team-configuration"] as const,
  storageContainer: () => [...teamConfigurationKeys.all, "storage-available"] as const,
  globalConfiguration: () => [...teamConfigurationKeys.all, globalTeamConfigurationStorageKey] as const,
};

export const allTeamDataKey = "all-team-data";

export const updateTeamConfigurationKeys = {
  allTeamData: [allTeamDataKey],
};

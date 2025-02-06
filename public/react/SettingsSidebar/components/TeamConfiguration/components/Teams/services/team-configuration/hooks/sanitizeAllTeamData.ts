import { AllTeamData, type Configuration, createUpdatedTeamData } from "../team-configuration";

export function sanitizeAllTeamData(
  allTeamData: AllTeamData,
  teamName: string,
  hierarchyLevel: string,
  updates: Configuration
) {
  const allUpdates = createUpdatedTeamData(allTeamData, {
    teamName,
    hierarchyLevel,
    configuration: updates,
  });

  const sanitized = Object.fromEntries(
    Object.entries(allUpdates).flatMap(([teamKey, teamConfig]) => {
      if (!teamConfig) return [];

      const configs = Object.fromEntries(
        Object.entries(teamConfig).flatMap(([configKey, config]) => {
          if (!config) return [];

          // filter out null values
          const sanitizedConfig = Object.fromEntries(
            Object.entries(config).filter(([_, value]) => value != null)
          );

          // filter out empty hierarchy levels
          return Object.keys(sanitizedConfig).length > 0 ? [[configKey, sanitizedConfig]] : [];
        })
      );

      // filter out empty teams
      return Object.keys(configs).length > 0 ? [[teamKey, configs]] : [];
    })
  );

  return sanitized as AllTeamData;
}

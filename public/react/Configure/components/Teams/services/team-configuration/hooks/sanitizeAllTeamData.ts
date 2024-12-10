import { type Configuration, createUpdatedTeamData } from "../team-configuration";

export function sanitizeAllTeamData(
  allTeamData: any,
  teamName: string,
  hierarchyLevel: string,
  updates: Configuration
) {
  const allUpdates = createUpdatedTeamData(allTeamData, {
    teamName,
    hierarchyLevel,
    configuration: updates,
  });

  const sanitized = entriesFlatMap(allUpdates, ([teamKey, teamConfig]) => {
    if (!teamConfig) return [];

    const configs = entriesFlatMap(teamConfig, ([configKey, config]) => {
      if (!config) return [];

      const sanitizedConfig = filterNullValues(config);
      return notEmpty(sanitizedConfig, [configKey, sanitizedConfig]);
    });

    return notEmpty(configs, [teamKey, configs]);
  });

  return sanitized;
}

function entriesFlatMap<T, R extends readonly [string, any]>(
  obj: Record<string, T>,
  fn: (entry: [string, T]) => R[]
): T {
  return Object.fromEntries(Object.entries(obj).flatMap(fn)) as T;
}

function filterNullValues<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value != null)
  ) as Partial<T>;
}

function notEmpty<T extends object | undefined>(value: T, result: [string, T]) {
  if (!value) {
    return [];
  }

  return Object.keys(value).length > 0 ? [result] : [];
}

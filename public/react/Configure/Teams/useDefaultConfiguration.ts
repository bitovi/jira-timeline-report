import { useSuspenseQuery } from "@tanstack/react-query";
import { getSprintDefaults, SprintDefaults } from "./plugin";
import { createNormalizeConfiguration } from "./ConfigureTeams";
import { NormalizeIssueConfig } from "../../../jira/normalized/normalize";

export type UseDefaultConfiguration = (config: {
  appKey: string;
  onInitialDefaultsLoad?: (config: Partial<NormalizeIssueConfig>) => void;
}) => SprintDefaults;

export const useDefaultConfiguration: UseDefaultConfiguration = ({ appKey, onInitialDefaultsLoad }) => {
  const { data } = useSuspenseQuery({
    queryKey: ["configuration", "default"],
    queryFn: async () => {
      const defaults = await getSprintDefaults({ appKey });

      onInitialDefaultsLoad?.(createNormalizeConfiguration(defaults));

      return defaults;
    },
  });

  return data;
};

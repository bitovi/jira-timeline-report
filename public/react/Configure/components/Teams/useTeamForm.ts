import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import type { Configuration, TeamConfiguration } from "./services/team-configuration";

import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { createEmptyConfiguration, useSaveTeamData } from "./services/team-configuration";
import { FieldUpdates } from "./ConfigureTeamsForm";

type UseTeamFormConfig = {
  teamName: string;
  hierarchyLevel: keyof TeamConfiguration;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  augmentedTeamData: TeamConfiguration;
  userTeamData: TeamConfiguration;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
};

export const useTeamForm = ({
  teamName,
  hierarchyLevel,
  onUpdate,
  augmentedTeamData,
  userTeamData,
  getInheritance,
}: UseTeamFormConfig) => {
  const { save, isSaving } = useSaveTeamData({ teamName, hierarchyLevel, onUpdate });
  const { register, setValue, control, reset } = useForm<Configuration>({
    defaultValues: augmentedTeamData[hierarchyLevel],
  });

  useEffect(() => {
    reset(augmentedTeamData[hierarchyLevel]);
  }, [teamName, userTeamData]);

  function update<TProperty extends keyof Configuration>({ name, value }: FieldUpdates<TProperty>) {
    save({ ...userTeamData[hierarchyLevel]!, [name]: value });
  }

  const toggleInheritance = (field: keyof Configuration, shouldCustomize: boolean) => {
    if (shouldCustomize) {
      update({ name: field, value: augmentedTeamData[hierarchyLevel]![field] });
      return;
    }

    setValue(field, getInheritance(hierarchyLevel)[hierarchyLevel]![field]);

    update({ name: field, value: null });
  };

  if (process.env.NODE_ENV !== "production") {
    if (!userTeamData[hierarchyLevel]) {
      console.warn(
        [
          "Could not find saved configuration in useTeamForm",
          `looking in "userData" at level "${hierarchyLevel}"`,
          "Returning an empty configuration",
        ].join("\n")
      );
    }

    if (!augmentedTeamData[hierarchyLevel]) {
      console.warn(
        [
          "Could not find saved configuration in useTeamForm",
          `looking in "augmentedTeamData" at level "${hierarchyLevel}"`,
          "Returning an empty configuration",
        ].join("\n")
      );
    }
  }

  return {
    toggleInheritance,
    register,
    control,
    isSaving,
    update,
    userData: userTeamData[hierarchyLevel] || createEmptyConfiguration(),
    augmented: augmentedTeamData[hierarchyLevel] || createEmptyConfiguration(),
  };
};

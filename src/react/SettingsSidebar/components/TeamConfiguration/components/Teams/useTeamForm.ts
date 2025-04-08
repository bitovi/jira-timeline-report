import type { NormalizeIssueConfig } from "../../../../../../jira/normalized/normalize";
import type { Configuration, TeamConfiguration } from "./services/team-configuration";

import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { createEmptyConfiguration, useSaveTeamData } from "./services/team-configuration";
import { FieldUpdates } from "./ConfigureTeamsForm";

type UseTeamFormConfig = {
  teamName: string;
  hierarchyLevel: keyof TeamConfiguration;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  inheritedTeamData: TeamConfiguration;
  savedUserTeamData: TeamConfiguration;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
};

export const useTeamForm = ({
  teamName,
  hierarchyLevel,
  onUpdate,
  inheritedTeamData,
  savedUserTeamData,
  getInheritance,
}: UseTeamFormConfig) => {
  const { save, isSaving } = useSaveTeamData({ teamName, hierarchyLevel, onUpdate });
  const { register, setValue, control, reset } = useForm<Configuration>({
    defaultValues: inheritedTeamData[hierarchyLevel],
  });

  useEffect(() => {
    reset(inheritedTeamData[hierarchyLevel]);
  }, [teamName, savedUserTeamData]);

  function update<TProperty extends keyof Configuration>({ name, value }: FieldUpdates<TProperty>) {
    save({ ...savedUserTeamData[hierarchyLevel]!, [name]: value });
  }

  const toggleInheritance = (field: keyof Configuration, shouldCustomize: boolean) => {
    if (shouldCustomize) {
      update({ name: field, value: inheritedTeamData[hierarchyLevel]![field] });
      return;
    }

    setValue(field, getInheritance(hierarchyLevel)[hierarchyLevel]![field]);

    update({ name: field, value: null });
  };

  return {
    toggleInheritance,
    register,
    control,
    isSaving,
    update,
    savedUserData: savedUserTeamData[hierarchyLevel] || createEmptyConfiguration(),
    inheritedUserData: inheritedTeamData[hierarchyLevel] || createEmptyConfiguration(),
  };
};

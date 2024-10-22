import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import type { TeamConfiguration, Configuration } from "./services/team-configuration";

import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { useSaveTeamData } from "./services/team-configuration";
import { FieldUpdates } from "./ConfigureTeamsForm";

type UseTeamFormConfig = {
  teamName: string;
  issueType: keyof TeamConfiguration;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  augmentedTeamData: TeamConfiguration;
  userTeamData: TeamConfiguration;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
};

export const useTeamForm = ({
  teamName,
  issueType,
  onUpdate,
  augmentedTeamData,
  userTeamData,
  getInheritance,
}: UseTeamFormConfig) => {
  const { save, isSaving } = useSaveTeamData({ teamName, issueType, onUpdate });
  const { register, setValue, control, reset } = useForm<Configuration>({
    defaultValues: augmentedTeamData[issueType],
  });

  useEffect(() => {
    reset(augmentedTeamData[issueType]);
  }, [teamName]);

  function update<TProperty extends keyof Configuration>({ name, value }: FieldUpdates<TProperty>) {
    save({ ...userTeamData[issueType], [name]: value });
  }

  const toggleInheritance = (field: keyof Configuration, shouldCustomize: boolean) => {
    if (shouldCustomize) {
      update({ name: field, value: augmentedTeamData[issueType][field] });
      return;
    }

    setValue(field, getInheritance(issueType)[issueType][field]);

    update({ name: field, value: null });
  };

  return {
    toggleInheritance,
    register,
    control,
    isSaving,
    update,
    userData: userTeamData[issueType],
    augmented: augmentedTeamData[issueType],
  };
};

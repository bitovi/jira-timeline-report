import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';
import type { Configuration, TeamConfiguration } from './services/team-configuration';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { createEmptyConfiguration, useSaveTeamData } from './services/team-configuration';
import { FieldUpdates } from './ConfigureTeamsForm';

type UseTeamFormConfig = {
  teamName: string;
  hierarchyLevel: keyof TeamConfiguration;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  inheritedTeamData: TeamConfiguration;
  savedUserTeamData: TeamConfiguration;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
  hasSavedHeadcount?: (issueType: keyof TeamConfiguration) => boolean;
};

export const useTeamForm = ({
  teamName,
  hierarchyLevel,
  onUpdate,
  inheritedTeamData,
  savedUserTeamData,
  getInheritance,
  hasSavedHeadcount,
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

  /** Several fields in one write: separate `update`s would each spread the same saved snapshot. */
  function updateFields(patch: Partial<Configuration>) {
    save({ ...savedUserTeamData[hierarchyLevel]!, ...patch });
  }

  /**
   * `alsoWrite` goes out in the same write — for fields that only make sense together, like the
   * estimate unit and the capacity (`pointsPerPersonDay`) expressed in it.
   */
  const toggleInheritance = (
    field: keyof Configuration,
    shouldCustomize: boolean,
    alsoWrite?: Partial<Configuration>,
  ) => {
    if (shouldCustomize) {
      updateFields({ [field]: inheritedTeamData[hierarchyLevel]![field], ...alsoWrite });
      return;
    }

    setValue(field, getInheritance(hierarchyLevel)[hierarchyLevel]![field]);

    updateFields({ [field]: null, ...alsoWrite });
  };

  return {
    toggleInheritance,
    register,
    control,
    isSaving,
    update,
    updateFields,
    setValue,
    savedUserData: savedUserTeamData[hierarchyLevel] || createEmptyConfiguration(),
    hasSavedHeadcount: hasSavedHeadcount?.(hierarchyLevel) ?? false,
    inheritedUserData: inheritedTeamData[hierarchyLevel] || createEmptyConfiguration(),
  };
};

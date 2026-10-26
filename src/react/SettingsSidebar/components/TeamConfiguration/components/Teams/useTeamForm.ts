import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';
import type { Configuration, TeamConfiguration } from './services/team-configuration';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { createEmptyConfiguration, useSaveTeamData } from './services/team-configuration';
import { FieldUpdates } from './ConfigureTeamsForm';
import { DEFAULT_ESTIMATE_UNIT } from './shared/estimation';

/** Fields saved alongside an inheritance toggle, or a function of the values the level ends up with. */
export type AlsoWrite = Partial<Configuration> | ((values: Configuration) => Partial<Configuration>);

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

  /**
   * Several fields in one write: separate `update`s would each spread the same saved snapshot.
   *
   * X is in its unit's terms, so a level saving its own X also saves the unit it is read in — or a
   * parent later switching units would reinterpret this level's rate in the new unit.
   */
  function updateFields(patch: Partial<Configuration>) {
    const saved = savedUserTeamData[hierarchyLevel] ?? createEmptyConfiguration();
    const pinsUnit = patch.pointsPerPersonDay != null && patch.estimateUnit === undefined && saved.estimateUnit == null;

    save({
      ...saved,
      ...patch,
      ...(pinsUnit && { estimateUnit: inheritedTeamData[hierarchyLevel]?.estimateUnit ?? DEFAULT_ESTIMATE_UNIT }),
    });
  }

  /**
   * `alsoWrite` goes out in the same write — for fields that only make sense together, like the
   * estimate unit and the capacity (`pointsPerPersonDay`) expressed in it. As a function it gets the
   * values the level ends up with (the parent's, when returning to inheritance), for a patch that
   * depends on them.
   */
  const toggleInheritance = (field: keyof Configuration, shouldCustomize: boolean, alsoWrite?: AlsoWrite) => {
    const resolve = (values: Configuration) => (typeof alsoWrite === 'function' ? alsoWrite(values) : alsoWrite);

    if (shouldCustomize) {
      const values = inheritedTeamData[hierarchyLevel]!;

      updateFields({ [field]: values[field], ...resolve(values) });
      return;
    }

    const parent = getInheritance(hierarchyLevel)[hierarchyLevel]!;

    setValue(field, parent[field]);

    updateFields({ [field]: null, ...resolve(parent) });
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

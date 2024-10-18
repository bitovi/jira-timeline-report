import type { FC } from "react";

import type { Configuration, IssueFields } from "./services/team-configuration";
import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";

import React from "react";
import { useForm } from "react-hook-form";
import { Flex } from "@atlaskit/primitives";

import Hr from "../../../components/Hr";

import InheritanceTextField from "./components/InheritanceTextField";
import InheritanceToggleField from "./components/InheritanceToggleField";
import InheritanceSelect from "./components/InheritanceSelect";

export interface ConfigureTeamsFormProps {
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  userData: Configuration;
  augmented: Configuration;
  getInheritance: () => Configuration;
  jiraFields: IssueFields;
  save: (newConfiguration: Configuration) => void;
}

export interface FieldUpdates<TProperty extends keyof Configuration> {
  name: TProperty;
  value: Configuration[TProperty];
}

const ConfigureTeamsForm: FC<ConfigureTeamsFormProps> = ({ save, userData, augmented, jiraFields, getInheritance }) => {
  const selectableFields = jiraFields.map(({ name }) => ({ value: name, label: name }));

  const { register, setValue, control } = useForm<Configuration>({
    defaultValues: augmented,
  });

  function update<TProperty extends keyof Configuration>({ name, value }: FieldUpdates<TProperty>) {
    save({ ...userData, [name]: value });
  }

  const toggleInheritance = (field: keyof Configuration, shouldCustomize: boolean) => {
    if (shouldCustomize) {
      update({ name: field, value: augmented[field] });
      return;
    }

    // recalculate what the inherited value will be
    setValue(field, getInheritance()[field]);

    update({ name: field, value: null });
  };

  return (
    <Flex direction="column" gap="space.100">
      <InheritanceTextField
        isInheriting={!userData.velocityPerSprint}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("velocityPerSprint", shouldCustomize)}
        name="velocityPerSprint"
        type="number"
        label="Velocity per sprint"
        unit="estimating units"
        min={1}
        register={register}
        onSave={update}
      />
      <InheritanceTextField
        isInheriting={!userData.tracks}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("tracks", shouldCustomize)}
        name="tracks"
        type="number"
        label="Tracks"
        min={1}
        register={register}
        onSave={update}
      />
      <InheritanceToggleField
        isInheriting={!userData.spreadEffortAcrossDates && typeof userData.spreadEffortAcrossDates === "object"}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("spreadEffortAcrossDates", shouldCustomize)}
        name="spreadEffortAcrossDates"
        control={control}
        onSave={update}
        label="Spread effort"
        description="Spread estimate access dates"
      />
      <InheritanceTextField
        isInheriting={!userData.sprintLength}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("sprintLength", shouldCustomize)}
        name="sprintLength"
        type="number"
        label="Sprint length"
        unit="business days"
        min={1}
        register={register}
        onSave={update}
      />
      <Hr />
      <InheritanceSelect
        isInheriting={!userData.estimateField}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("estimateField", shouldCustomize)}
        name="estimateField"
        label="Estimate Field"
        jiraFields={selectableFields}
        control={control}
        onSave={update}
      />
      <InheritanceSelect
        isInheriting={!userData.confidenceField}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("confidenceField", shouldCustomize)}
        name="confidenceField"
        label="Confidence field"
        jiraFields={selectableFields}
        control={control}
        onSave={update}
      />
      <InheritanceSelect
        isInheriting={!userData.startDateField}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("startDateField", shouldCustomize)}
        name="startDateField"
        label="Start date field"
        jiraFields={selectableFields}
        control={control}
        onSave={update}
      />
      <InheritanceSelect
        isInheriting={!userData.dueDateField}
        onInheritanceChange={(shouldCustomize) => toggleInheritance("dueDateField", shouldCustomize)}
        name="dueDateField"
        label="End date field"
        jiraFields={selectableFields}
        control={control}
        onSave={update}
      />
    </Flex>
  );
};

export default ConfigureTeamsForm;

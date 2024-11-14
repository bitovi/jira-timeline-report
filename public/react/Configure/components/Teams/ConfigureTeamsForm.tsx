import type { FC } from "react";

import type { Configuration, IssueFields } from "./services/team-configuration";
import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import type { Control, UseFormReturn } from "react-hook-form";

import React from "react";
import { Flex } from "@atlaskit/primitives";

import Hr from "../../../components/Hr";

import InheritanceTextField from "./components/InheritanceTextField";
import InheritanceToggleField from "./components/InheritanceToggleField";
import InheritanceSelect from "./components/InheritanceSelect";

export interface ConfigureTeamsFormProps {
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  userData: Configuration;
  augmented: Configuration;
  jiraFields: IssueFields;
  register: UseFormReturn<Configuration>["register"];
  control: Control<Configuration>;
  update: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
  toggleInheritance: (field: keyof Configuration, shouldCustomize: boolean) => void;
}

export interface FieldUpdates<TProperty extends keyof Configuration> {
  name: TProperty;
  value: Configuration[TProperty];
}

const ConfigureTeamsForm: FC<ConfigureTeamsFormProps> = ({
  userData,
  jiraFields,
  register,
  control,
  update,
  toggleInheritance,
}) => {
  const selectableFields = jiraFields.map(({ name }) => ({ value: name, label: name }));

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
        jiraFields={[{ value: "confidence-not-used", label: "Don't use confidence" }, ...selectableFields]}
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

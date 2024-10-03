import type { FC } from "react";
import type { Control } from "react-hook-form";

import React, { useId } from "react";
import { Controller } from "react-hook-form";
import AtlasSelect from "@atlaskit/select";
import { Label } from "@atlaskit/form";
import { DefaultFormFields, FieldUpdates } from "../../ConfigureTeams";
import { SprintDefaults } from "../../services/team-configuration";

interface SelectProps {
  control: Control<SprintDefaults>;
  name: keyof DefaultFormFields;
  label: string;
  jiraFields: Array<{ label: string; value: string }>;
  onSave: <TProperty extends keyof DefaultFormFields>(config: FieldUpdates<TProperty>) => void;
}

const Select: FC<SelectProps> = ({ name, control, label, jiraFields, onSave }) => {
  const id = useId();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selectedOption = jiraFields.find((option) => option.value === field.value);

        return (
          <>
            <Label htmlFor={id}>{label}</Label>
            <AtlasSelect
              id={id}
              name={field.name}
              value={selectedOption}
              options={jiraFields}
              onBlur={field.onBlur}
              onChange={(option) => {
                field.onChange(option?.value);
                onSave({ name, value: option!.value });
              }}
            />
          </>
        );
      }}
    />
  );
};

export default Select;

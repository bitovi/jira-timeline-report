import type { FC } from "react";
import type { Control } from "react-hook-form";
import type { Configuration } from "../../services/team-configuration";
import type { FieldUpdates } from "../../ConfigureTeamsForm";

import React, { useId } from "react";
import { Controller } from "react-hook-form";
import AtlasSelect from "@atlaskit/select";

import Label from "../Label";

interface SelectProps {
  disabled?: boolean;
  control: Control<Configuration>;
  name: keyof Configuration;
  label: string;
  jiraFields: Array<{ label: string; value: string }>;
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const Select: FC<SelectProps> = ({ name, control, label, jiraFields, onSave, disabled = false }) => {
  const id = useId();

  return (
    <Controller
      name={name}
      control={control}
      disabled={disabled}
      render={({ field }) => {
        const selectedOption = jiraFields.find((option) => {
          return option.value === field.value;
        });

        return (
          <div className="mt-2">
            <Label htmlFor={id} isRequired>
              {label}
            </Label>
            <AtlasSelect
              isDisabled={disabled}
              id={id}
              name={field.name}
              value={selectedOption}
              options={jiraFields}
              onBlur={field.onBlur}
              onChange={(option) => {
                if (!option?.value) {
                  return;
                }

                field.onChange(option?.value);
                onSave({ name, value: option?.value });
              }}
            />
          </div>
        );
      }}
    />
  );
};

export default Select;

import type { ComponentProps, FC } from "react";

import React, { useId } from "react";
import AtlasToggle from "@atlaskit/toggle";

import Label from "../Label";
import { Control, Controller } from "react-hook-form";
import { isFieldUpdate, TeamConfiguration } from "../../services/team-configuration";
import { DefaultFormFields, FieldUpdates } from "../../ConfigureTeamsForm";

interface ToggleProps extends Pick<ComponentProps<typeof AtlasToggle>, "onChange" | "isChecked"> {
  label: string;
  description: string;
}

const Toggle: FC<ToggleProps> = ({ label, description, onChange, isChecked }) => {
  const id = useId();

  return (
    <div>
      <Label htmlFor={id} isRequired>
        {label}
      </Label>
      <div className="flex justify-between align-center">
        <p>{description}</p>
        <div className="w-10">
          <AtlasToggle id={id} onChange={onChange} isChecked={isChecked} />
        </div>
      </div>
    </div>
  );
};

export default Toggle;

interface FormToggleProps {
  name: keyof DefaultFormFields;
  label: string;
  description: string;
  control: Control<TeamConfiguration>;
  onSave: <TProperty extends keyof DefaultFormFields>(config: FieldUpdates<TProperty>) => void;
}

export const FormToggle: FC<FormToggleProps> = ({ name, label, description, control, onSave }) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Toggle
          label={label}
          description={description}
          isChecked={Boolean(field.value)}
          onChange={(event) => {
            field.onChange(event.target.checked);
            onSave?.({ name, value: event.target.checked });
          }}
        />
      )}
    />
  );
};

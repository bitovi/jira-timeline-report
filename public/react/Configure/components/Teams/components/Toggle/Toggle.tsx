import type { ComponentProps, FC } from "react";
import type { Configuration } from "../../services/team-configuration";

import React, { useId } from "react";
import AtlasToggle from "@atlaskit/toggle";

import Label from "../Label";
import { Control, Controller } from "react-hook-form";
import { FieldUpdates } from "../../ConfigureTeamsForm";

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
  name: keyof Configuration;
  label: string;
  description: string;
  control: Control<Configuration>;
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
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

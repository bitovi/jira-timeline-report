import type { FC } from "react";
import type { DefaultFormFields, FieldUpdates } from "../../ConfigureTeamsForm";

import React from "react";

import AtlasTextField from "@atlaskit/textfield";
import { UseFormReturn } from "react-hook-form";
import { Field } from "@atlaskit/form";

import { isFieldUpdate } from "../../services/team-configuration";

interface TextFieldProps {
  disabled?: boolean;
  type: string;
  name: keyof DefaultFormFields;
  label: string;
  min?: number;
  register: UseFormReturn<DefaultFormFields>["register"];
  onSave: <TProperty extends keyof DefaultFormFields>(config: FieldUpdates<TProperty>) => void;
}

const TextField: FC<TextFieldProps> = ({ register, onSave, type, label, name, min, disabled = false }) => {
  const handleBlur = (eventTarget: { name: string; value: string }) => {
    if (!isFieldUpdate(eventTarget)) {
      return;
    }

    onSave(eventTarget);
  };

  return (
    <Field name="sprintLength" label={label} isRequired>
      {() => (
        <AtlasTextField
          isDisabled={disabled}
          type={type}
          min={min}
          autoComplete="off"
          {...register(name)}
          onBlur={({ target }) => handleBlur(target)}
        />
      )}
    </Field>
  );
};

export default TextField;

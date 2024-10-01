import type { FC } from "react";
import type { DefaultFormFields, FieldUpdates } from "./ConfigureTeams";

import React from "react";

import AtlasTextField from "@atlaskit/textfield";
import { UseFormReturn } from "react-hook-form";
import { Field } from "@atlaskit/form";

function isFieldUpdate<TProperty extends keyof DefaultFormFields>(event: {
  name: string;
}): event is FieldUpdates<TProperty> {
  return ["sprintLength"].includes(event.name);
}

interface TextFieldProps {
  type: string;
  name: keyof DefaultFormFields;
  label: string;
  register: UseFormReturn<DefaultFormFields>["register"];
  onSave: <TProperty extends keyof DefaultFormFields>(config: FieldUpdates<TProperty>) => void;
}

const TextField: FC<TextFieldProps> = ({ register, onSave, type, label, name }) => {
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
          type={type}
          autoComplete="off"
          {...register(name)}
          onBlur={({ target }) => handleBlur(target)}
        />
      )}
    </Field>
  );
};

export default TextField;

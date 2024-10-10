import type { FC } from "react";

import React, { useState } from "react";
import { HelperMessage } from "@atlaskit/form";
import { UseFormReturn } from "react-hook-form";

import Toggle from "../Toggle";
import TextField from "../TextField";
import { DefaultFormFields, FieldUpdates } from "../../ConfigureTeamsForm";

interface EnableableTextFieldProps {
  min?: number;
  toggleLabel: string;
  toggleDescription: string;
  type: string;
  name: keyof DefaultFormFields;
  textFieldLabel: string;
  register: UseFormReturn<DefaultFormFields>["register"];
  onSave: <TProperty extends keyof DefaultFormFields>(config: FieldUpdates<TProperty>) => void;
  message?: string;
}

const EnableableTextField: FC<EnableableTextFieldProps> = ({
  message,
  toggleLabel,
  toggleDescription,
  type,
  name,
  textFieldLabel,
  register,
  onSave,
}) => {
  const toggleProps = { label: toggleLabel, description: toggleDescription };
  const textFieldProps = { type, name, label: textFieldLabel, register, onSave };

  const [enabled, setEnabled] = useState(true);

  return (
    <div>
      <Toggle isChecked={enabled} onChange={() => setEnabled((prev) => !prev)} {...toggleProps} />
      <TextField disabled={enabled} {...textFieldProps} />
      <HelperMessage>{message}</HelperMessage>
    </div>
  );
};

export default EnableableTextField;

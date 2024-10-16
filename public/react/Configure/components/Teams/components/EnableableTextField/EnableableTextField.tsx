import type { FC } from "react";
import type { Configuration } from "../../services/team-configuration";

import React, { useState } from "react";
import { HelperMessage } from "@atlaskit/form";
import { UseFormReturn } from "react-hook-form";

import Toggle from "../Toggle";
import TextField from "../TextField";
import { FieldUpdates } from "../../ConfigureTeamsForm";

interface EnableableTextFieldProps {
  min?: number;
  toggleLabel: string;
  toggleDescription: string;
  type: string;
  name: keyof Configuration;
  textFieldLabel: string;
  register: UseFormReturn<Configuration>["register"];
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
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

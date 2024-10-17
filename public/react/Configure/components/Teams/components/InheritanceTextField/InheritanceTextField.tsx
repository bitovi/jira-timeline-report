import type { FC } from "react";
import type { FieldUpdates } from "../../ConfigureTeamsForm";
import type { Configuration } from "../../services/team-configuration";
import type { UseFormReturn } from "react-hook-form";

import React from "react";

import TextField from "../TextField";
import ToggleButton from "../../../../../components/ToggleButton";

interface InheritanceTextFieldProps {
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  type: string;
  name: keyof Configuration;
  label: string;
  min?: number;
  unit?: string;
  register: UseFormReturn<Configuration>["register"];
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const InheritanceTextField: FC<InheritanceTextFieldProps> = ({
  isInheriting,
  onInheritanceChange,
  ...textFieldProps
}) => {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-x-1">
      <TextField disabled={isInheriting} {...textFieldProps} />
      <ToggleButton
        active={!isInheriting}
        onActiveChange={onInheritanceChange}
        left={isInheriting ? "inheriting" : "inherit"}
        right={isInheriting ? "customize" : "customized"}
      />
    </div>
  );
};

export default InheritanceTextField;

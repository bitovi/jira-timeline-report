import type { FC } from "react";
import type { Control } from "react-hook-form";
import type { Configuration } from "../../services/team-configuration";
import type { FieldUpdates } from "../../ConfigureTeamsForm";

import React from "react";
import Select from "../Select";
import ToggleButton from "../../../../../components/ToggleButton";

interface SelectProps {
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  control: Control<Configuration>;
  name: keyof Configuration;
  label: string;
  jiraFields: Array<{ label: string; value: string }>;
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const InheritanceSelect: FC<SelectProps> = ({ isInheriting, onInheritanceChange, ...selectProps }) => {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-x-1">
      <Select disabled={isInheriting} {...selectProps} />
      <ToggleButton
        active={!isInheriting}
        onActiveChange={onInheritanceChange}
        left={isInheriting ? "inheriting" : "inherit"}
        right={isInheriting ? "customize" : "customized"}
      />
    </div>
  );
};

export default InheritanceSelect;

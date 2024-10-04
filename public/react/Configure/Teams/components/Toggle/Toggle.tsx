import type { ComponentProps, FC } from "react";

import React, { useId } from "react";
import AtlasToggle from "@atlaskit/toggle";

import Label from "../Label";

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

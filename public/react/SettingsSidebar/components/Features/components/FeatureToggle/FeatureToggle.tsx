import AtlasToggle from "@atlaskit/toggle";
import type { FC } from "react";

import React, { useId } from "react";

interface FeatureToggleProps {
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const FeatureToggle: FC<FeatureToggleProps> = ({
  title,
  subtitle,
  checked,
  onChange,
  disabled,
}) => {
  const id = useId();

  return (
    <div className="flex gap-x-4 items-center">
      <AtlasToggle
        id={id}
        size="large"
        isDisabled={disabled}
        isChecked={checked}
        onChange={({ target }) => onChange(target.checked)}
      />
      <div className="flex-col gap-y-6">
        <label htmlFor={id} className="font-bold text-base text-slate-800">
          {title}
        </label>
        <p className="text-sm">{subtitle}</p>
      </div>
    </div>
  );
};

export default FeatureToggle;

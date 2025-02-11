import AtlasToggle from "@atlaskit/toggle";
import type { FC } from "react";

import React, { useId } from "react";

interface FeatureToggleProps {
  title: string;
  subtitle: string;
}

export const FeatureToggle: FC<FeatureToggleProps> = ({ title, subtitle }) => {
  const id = useId();

  return (
    <div className="flex gap-x-4 items-center">
      <AtlasToggle id={id} size="large" />
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

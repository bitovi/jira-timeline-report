import { Label as AtlasLabel } from "@atlaskit/form";
import AtlasToggle from "@atlaskit/toggle";
import type { FC } from "react";

import React, { useId } from "react";

interface FeatureToggleProps {}

export const FeatureToggle: FC<FeatureToggleProps> = ({}) => {
  const id = useId();
  return (
    <div className="flex gap-x-4">
      <AtlasToggle id={id} size="large" />
      <div className="flex-col gap-y-6">
        <AtlasLabel htmlFor={id}>
          <span className="font-light text-black text-xl">Scatter timeline plot</span>
        </AtlasLabel>
        <p className="text-sm">Report due dates in a condensed scatter plot</p>
      </div>
    </div>
  );
};

export default FeatureToggle;

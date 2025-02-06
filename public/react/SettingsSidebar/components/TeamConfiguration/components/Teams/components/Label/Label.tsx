import type { FC, ReactNode } from "react";

import React from "react";
import { Label as AtlasLabel } from "@atlaskit/form";

export const RequiredAsterisk: FC = () => {
  return (
    <span className="text-rose-600" aria-hidden="true" title="required">
      *
    </span>
  );
};

const Label: FC<{ children: ReactNode; isRequired?: boolean; htmlFor: string }> = ({
  children,
  htmlFor,
  isRequired = false,
}) => {
  return (
    <AtlasLabel htmlFor={htmlFor}>
      {children} {isRequired && <RequiredAsterisk />}
    </AtlasLabel>
  );
};

export default Label;

import type { FC, ReactNode } from 'react';

import React from 'react';
import { Label as AtlasLabel } from '@atlaskit/form';

/**
 * Every team setting needs a value, inherited or customized, so only the exceptions are marked.
 */
export const OptionalMarker: FC = () => <span className="font-normal text-slate-500">(optional)</span>;

const Label: FC<{ children: ReactNode; isOptional?: boolean; htmlFor: string }> = ({
  children,
  htmlFor,
  isOptional = false,
}) => {
  return (
    <AtlasLabel htmlFor={htmlFor}>
      {children} {isOptional && <OptionalMarker />}
    </AtlasLabel>
  );
};

export default Label;

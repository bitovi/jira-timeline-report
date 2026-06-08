import AtlasToggle from '@atlaskit/toggle';
import type { FC } from 'react';

import React, { useId } from 'react';

interface FeatureToggleProps {
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const FeatureToggle: FC<FeatureToggleProps> = ({ title, subtitle, checked, onChange, disabled }) => {
  const id = useId();

  return (
    <div className="flex gap-x-4 items-center">
      <div className="flex-shrink-0">
        <AtlasToggle
          id={id}
          size="large"
          isDisabled={disabled}
          isChecked={checked}
          onChange={({ target }) => onChange(target.checked)}
        />
      </div>
      <div className="flex flex-col gap-y-1">
        <label htmlFor={id} className="font-bold text-base text-slate-800">
          {title}
        </label>
        <p className="text-sm">{subtitle}</p>
      </div>
    </div>
  );
};

export default FeatureToggle;

import type { FC } from 'react';
import type { Configuration } from '../../services/team-configuration';
import type { Control } from 'react-hook-form';
import type { FieldUpdates } from '../../ConfigureTeamsForm';

import React from 'react';

import ToggleButton from '../../../../../../../components/ToggleButton';
import { FormToggle } from '../Toggle';

interface InheritanceToggleFieldProps {
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  name: keyof Configuration;
  label: string;
  description: string;
  control: Control<Configuration>;
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const InheritanceToggleField: FC<InheritanceToggleFieldProps> = ({
  isInheriting,
  onInheritanceChange,
  ...toggleProps
}) => {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-x-1">
      <FormToggle disabled={isInheriting} {...toggleProps} />
      <ToggleButton
        active={!isInheriting}
        onActiveChange={onInheritanceChange}
        inactiveLabel={isInheriting ? 'inheriting' : 'inherit'}
        activeLabel={isInheriting ? 'customize' : 'customized'}
      />
    </div>
  );
};

export default InheritanceToggleField;

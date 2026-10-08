import type { FC } from 'react';
import type { FieldUpdates } from '../../ConfigureTeamsForm';
import type { Configuration } from '../../services/team-configuration';
import type { UseFormReturn } from 'react-hook-form';

import React, { useId } from 'react';

import TextField from '../TextField';
import ToggleButton from '../../../../../../../components/ToggleButton';
import Label from '../Label';

interface InheritanceTextFieldProps {
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  type: string;
  name: keyof Configuration;
  label: string;
  min?: number;
  unit?: string;
  register: UseFormReturn<Configuration>['register'];
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const InheritanceTextField: FC<InheritanceTextFieldProps> = ({
  isInheriting,
  onInheritanceChange,
  ...textFieldProps
}) => {
  const id = useId();

  return (
    // The label is its own row across both columns, so a long question wraps over the toggle rather
    // than being squeezed into the input's width.
    <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-x-1">
      <div className="col-span-2">
        <Label htmlFor={id} isRequired>
          {textFieldProps.label}
        </Label>
      </div>
      <TextField disabled={isInheriting} hideLabel id={id} {...textFieldProps} />
      <ToggleButton
        active={!isInheriting}
        onActiveChange={onInheritanceChange}
        inactiveLabel={isInheriting ? 'inheriting' : 'inherit'}
        activeLabel={isInheriting ? 'customize' : 'customized'}
      />
    </div>
  );
};

export default InheritanceTextField;

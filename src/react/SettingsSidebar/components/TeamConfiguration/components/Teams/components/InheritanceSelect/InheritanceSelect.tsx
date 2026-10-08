import type { FC } from 'react';
import type { Control } from 'react-hook-form';
import type { Configuration } from '../../services/team-configuration';
import type { FieldUpdates } from '../../ConfigureTeamsForm';

import React, { useId } from 'react';
import Select from '../Select';
import ToggleButton from '../../../../../../../components/ToggleButton';
import Label from '../Label';

interface SelectProps {
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  control: Control<Configuration>;
  name: keyof Configuration;
  label: string;
  optional?: boolean;
  jiraFields:
    | Array<{ label: string; value: string }>
    | Array<{ label: string; options: Array<{ label: string; value: string }> }>;
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const InheritanceSelect: FC<SelectProps> = ({ isInheriting, onInheritanceChange, ...selectProps }) => {
  const id = useId();

  return (
    // The label is its own row across both columns, so a long question wraps over the toggle rather
    // than being squeezed into the input's width.
    <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-x-1">
      <div className="col-span-2">
        <Label htmlFor={id} isRequired={!selectProps.optional}>
          {selectProps.label}
        </Label>
      </div>
      <Select disabled={isInheriting} hideLabel id={id} {...selectProps} />
      <ToggleButton
        active={!isInheriting}
        onActiveChange={onInheritanceChange}
        inactiveLabel={isInheriting ? 'inheriting' : 'inherit'}
        activeLabel={isInheriting ? 'customize' : 'customized'}
      />
    </div>
  );
};

export default InheritanceSelect;

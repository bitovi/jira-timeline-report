import type { FC } from 'react';
import type { Configuration } from '../../services/team-configuration';
import type { Control } from 'react-hook-form';
import type { FieldUpdates } from '../../ConfigureTeamsForm';

import React, { useId } from 'react';
import { useWatch } from 'react-hook-form';

import { FormToggle } from '../Toggle';
import InheritanceRow from '../InheritanceRow';

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
  const id = useId();
  const value = useWatch({ control: toggleProps.control, name: toggleProps.name });

  return (
    <InheritanceRow
      id={id}
      label={toggleProps.label}
      isInheriting={isInheriting}
      onInheritanceChange={onInheritanceChange}
      inheritedValue={`${value ? 'On' : 'Off'}: ${toggleProps.description.toLowerCase()}`}
    >
      <FormToggle hideLabel id={id} {...toggleProps} />
    </InheritanceRow>
  );
};

export default InheritanceToggleField;

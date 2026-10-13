import type { FC } from 'react';
import type { Control, UseFormReturn } from 'react-hook-form';
import type { FieldUpdates } from '../../ConfigureTeamsForm';
import type { Configuration } from '../../services/team-configuration';
import type { FieldScale } from '../TextField/TextField';

import React, { useId } from 'react';
import { useWatch } from 'react-hook-form';

import TextField, { formatScaled } from '../TextField';
import InheritanceRow from '../InheritanceRow';

interface InheritanceTextFieldProps {
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  type: string;
  name: keyof Configuration;
  label: string;
  min?: number;
  unit?: string;
  control: Control<Configuration>;
  register: UseFormReturn<Configuration>['register'];
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
  scale?: FieldScale;
}

/** "1 weeks" reads wrong; every unit these fields use is a plain plural. */
const withUnit = (value: string, unit: string | undefined) => {
  if (!unit) return value;

  return `${value} ${Number(value) === 1 ? unit.replace(/s$/, '') : unit}`;
};

const InheritanceTextField: FC<InheritanceTextFieldProps> = ({
  isInheriting,
  onInheritanceChange,
  control,
  ...textFieldProps
}) => {
  const id = useId();
  const value = useWatch({ control, name: textFieldProps.name });
  const shown = formatScaled(value, textFieldProps.scale?.factor ?? 1);

  return (
    <InheritanceRow
      id={id}
      label={textFieldProps.label}
      isInheriting={isInheriting}
      onInheritanceChange={onInheritanceChange}
      inheritedValue={shown === '' ? 'Not set' : withUnit(shown, textFieldProps.unit)}
    >
      <TextField hideLabel id={id} {...textFieldProps} />
    </InheritanceRow>
  );
};

export default InheritanceTextField;

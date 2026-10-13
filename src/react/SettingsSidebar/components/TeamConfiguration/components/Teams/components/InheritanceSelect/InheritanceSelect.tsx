import type { FC } from 'react';
import type { Control } from 'react-hook-form';
import type { Configuration } from '../../services/team-configuration';
import type { FieldUpdates } from '../../ConfigureTeamsForm';

import React, { useId } from 'react';
import { useWatch } from 'react-hook-form';

import Select from '../Select';
import InheritanceRow from '../InheritanceRow';

type Option = { label: string; value: string };

interface SelectProps {
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  control: Control<Configuration>;
  name: keyof Configuration;
  label: string;
  optional?: boolean;
  jiraFields: Array<Option> | Array<{ label: string; options: Array<Option> }>;
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const optionLabel = (options: SelectProps['jiraFields'], value: unknown) =>
  options
    .flatMap((option): Option[] => ('options' in option ? option.options : [option]))
    .find((option) => option.value === value)?.label;

const InheritanceSelect: FC<SelectProps> = ({ isInheriting, onInheritanceChange, ...selectProps }) => {
  const id = useId();
  const value = useWatch({ control: selectProps.control, name: selectProps.name });

  return (
    <InheritanceRow
      id={id}
      label={selectProps.label}
      isRequired={!selectProps.optional}
      isInheriting={isInheriting}
      onInheritanceChange={onInheritanceChange}
      // A field missing from the list (renamed, or deleted in Jira) still shows what is stored.
      inheritedValue={optionLabel(selectProps.jiraFields, value) ?? (value ? String(value) : 'Not set')}
    >
      <Select hideLabel id={id} {...selectProps} />
    </InheritanceRow>
  );
};

export default InheritanceSelect;

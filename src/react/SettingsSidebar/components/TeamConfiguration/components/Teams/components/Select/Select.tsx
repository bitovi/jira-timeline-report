import type { FC, ReactNode } from 'react';
import type { Control } from 'react-hook-form';
import type { Configuration } from '../../services/team-configuration';
import type { FieldUpdates } from '../../ConfigureTeamsForm';

import React, { useId } from 'react';
import { Controller } from 'react-hook-form';
import AtlasSelect from '@atlaskit/select';

import Label from '../Label';

const isSingle = (obj: SelectProps['jiraFields']): obj is Array<{ label: string; value: string }> => {
  // An empty list (no Jira fields yet) is flat too; reading `obj[0]` would throw.
  return obj.length === 0 || 'value' in obj[0];
};

type SelectField = { label: string; value: string };

interface SelectProps {
  disabled?: boolean;
  /** Leave the label to the caller, which renders it with `htmlFor={id}` — see `InheritanceSelect`. */
  hideLabel?: boolean;
  id?: string;
  optional?: boolean;
  /** Small print directly under the select. */
  hint?: ReactNode;
  control: Control<Configuration>;
  name: keyof Configuration;
  label: string;
  jiraFields: Array<SelectField> | Array<{ label: string; options: Array<SelectField> }>;
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

const Select: FC<SelectProps> = ({
  name,
  control,
  label,
  jiraFields,
  onSave,
  disabled = false,
  optional = false,
  hint,
  hideLabel = false,
  id: providedId,
}) => {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <Controller
      name={name}
      control={control}
      disabled={disabled}
      render={({ field }) => {
        const allFields = isSingle(jiraFields) ? jiraFields : jiraFields.flatMap((group) => group.options);

        const selectedOption = allFields.find((option) => {
          return option.value === field.value;
        });

        return (
          <div className={hideLabel ? undefined : 'mt-2'}>
            {!hideLabel && (
              <Label htmlFor={id} isOptional={optional}>
                {label}
              </Label>
            )}
            <AtlasSelect
              isDisabled={disabled}
              // `id` lands on react-select's wrapper div; the label has to point at the input itself.
              inputId={id}
              name={field.name}
              value={selectedOption}
              options={jiraFields}
              onBlur={field.onBlur}
              onChange={(option) => {
                if (!option?.value) {
                  return;
                }

                field.onChange(option?.value);
                onSave({ name, value: option?.value });
              }}
            />
            {hint && <div className="mt-1">{hint}</div>}
          </div>
        );
      }}
    />
  );
};

export default Select;

import type { FC } from 'react';
import type { FieldUpdates } from '../../ConfigureTeamsForm';
import type { Configuration } from '../../services/team-configuration';

import React, { useEffect, useState } from 'react';

import AtlasTextField from '@atlaskit/textfield';
import { Control, UseFormReturn, useController } from 'react-hook-form';
import { Field } from '@atlaskit/form';

import { roundTo } from '../../../../../../../../utils/number/number';

/**
 * Shows a stored number in a different unit: the input reads `stored / factor` and saves
 * `typed × factor`. Sprint length is asked in weeks but stored in working days.
 */
export interface FieldScale {
  control: Control<Configuration>;
  factor: number;
}

interface TextFieldProps {
  disabled?: boolean;
  /** Leave the label to the caller, which renders it with `htmlFor={id}` — see `InheritanceTextField`. */
  hideLabel?: boolean;
  id?: string;
  type: string;
  name: keyof Configuration;
  label: string;
  min?: number;
  unit?: string;
  register: UseFormReturn<Configuration>['register'];
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
  scale?: FieldScale;
}

export function isFieldUpdate(event: { name: string }): event is { name: keyof Configuration } {
  return [
    'sprintLength',
    'velocityPerSprint',
    'tracks',
    'teamMembers',
    'estimateField',
    'confidenceField',
    'startDateField',
    'dueDateField',
    'spreadEffortAcrossDates',
  ].includes(event.name);
}

const TextField: FC<TextFieldProps> = ({
  register,
  onSave,
  type,
  label,
  name,
  min,
  unit,
  disabled = false,
  hideLabel = false,
  id,
  scale,
}) => {
  const handleBlur = (eventTarget: { name: string; value: string }) => {
    if (!isFieldUpdate(eventTarget)) {
      return;
    }

    onSave(eventTarget);
  };

  const renderInput = (inputId: string | undefined) =>
    scale ? (
      <ScaledInput id={inputId} name={name} disabled={disabled} min={min} unit={unit} scale={scale} onSave={onSave} />
    ) : (
      <RegisteredInput
        id={inputId}
        name={name}
        type={type}
        disabled={disabled}
        min={min}
        unit={unit}
        register={register}
        onBlur={handleBlur}
      />
    );

  if (hideLabel) {
    return renderInput(id);
  }

  // `Field` renders the label with `htmlFor` its own generated id, so the input has to carry it.
  return (
    <Field name={name} label={label} isRequired>
      {({ fieldProps }) => renderInput(fieldProps.id)}
    </Field>
  );
};

// These classes are needed to make the `elemAfterProp` function the same as the `slot` prop in figma
const inputClassName = '[&>input]:!flex-1 [&>input]:!p-0 !py-2 !px-2 !h-10 no-spin-container';

const RegisteredInput: FC<
  Pick<TextFieldProps, 'id' | 'name' | 'type' | 'disabled' | 'min' | 'unit' | 'register'> & {
    onBlur: (target: { name: string; value: string }) => void;
  }
> = ({ id, name, type, disabled, min, unit, register, onBlur }) => {
  const props = register(name);

  return (
    <AtlasTextField
      className={inputClassName}
      id={id}
      isDisabled={disabled}
      type={type}
      min={min}
      autoComplete="off"
      elemAfterInput={unit ? <div>{unit}</div> : null}
      {...props}
      onBlur={(e) => {
        props.onBlur(e);
        onBlur(e.target);
      }}
    />
  );
};

export const formatScaled = (stored: unknown, factor: number) =>
  stored == null || stored === '' ? '' : String(roundTo(Number(stored) / factor, 2));

const ScaledInput: FC<
  Pick<TextFieldProps, 'id' | 'name' | 'disabled' | 'min' | 'unit' | 'onSave'> & { scale: FieldScale }
> = ({ id, name, disabled, min, unit, scale, onSave }) => {
  const { field } = useController({ name, control: scale.control });
  const [text, setText] = useState(() => formatScaled(field.value, scale.factor));

  // The stored value also changes from outside — a reset after saving, or the inherit toggle — so
  // follow it, unless it is just the echo of what is being typed.
  useEffect(() => {
    if (Number(text) * scale.factor !== Number(field.value)) {
      setText(formatScaled(field.value, scale.factor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.value, scale.factor]);

  return (
    <AtlasTextField
      className={inputClassName}
      id={id}
      name={name}
      isDisabled={disabled}
      type="number"
      min={min}
      step="any"
      autoComplete="off"
      elemAfterInput={unit ? <div>{unit}</div> : null}
      value={text}
      ref={field.ref}
      onChange={(event) => {
        const next = event.currentTarget.value;

        setText(next);
        field.onChange(next === '' ? null : Number(next) * scale.factor);
      }}
      onBlur={() => {
        field.onBlur();

        if (text !== '' && Number(text) > 0) {
          onSave({ name, value: Number(text) * scale.factor });
        }
      }}
    />
  );
};

export default TextField;

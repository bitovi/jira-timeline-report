import type { FC, ReactNode } from 'react';

import React, { useEffect, useId, useState } from 'react';
import AtlasTextField from '@atlaskit/textfield';
import { Field } from '@atlaskit/form';

import InheritanceRow from '../InheritanceRow';
import { roundTo } from '../../../../../../../../utils/number/number';

const inputClassName = '[&>input]:!flex-1 [&>input]:!p-0 !py-2 !px-2 !h-10 no-spin-container';

const shown = (value: number | null) => (value == null || !Number.isFinite(value) ? '' : String(roundTo(value, 2)));

export interface DerivedNumberFieldProps {
  name: string;
  label: string;
  /** The value as calculated from the saved settings. */
  value: number | null;
  unit?: string;
  /** Called on blur with a typed number greater than 0 that differs from `value`. */
  onCommit: (next: number) => void;
  /** Omit for the global defaults, which have nothing to inherit. */
  inheritance?: {
    isInheriting: boolean;
    onInheritanceChange: (shouldCustomize: boolean) => void;
    /** Shown in place of the input while inheriting. */
    inheritedValue: ReactNode;
  };
  /** Under the input: hints and shortcuts. */
  children?: ReactNode;
}

/**
 * A question whose answer isn't stored as typed but calculated from saved settings — points per
 * sprint and people per estimate are both views of `pointsPerPersonDay`. So it isn't registered with
 * the form: it shows the calculated value and hands a typed one to `onCommit`, which saves whatever
 * it implies.
 */
const DerivedNumberField: FC<DerivedNumberFieldProps> = ({
  name,
  label,
  value,
  unit,
  onCommit,
  inheritance,
  children,
}) => {
  const id = useId();
  const [text, setText] = useState(() => shown(value));

  // The calculated value also changes from outside — a save, a headcount edit, the inherit toggle —
  // so follow it, unless it is just the echo of what is being typed.
  useEffect(() => {
    if (text === '' || roundTo(Number(text), 2) !== roundTo(Number(value), 2)) setText(shown(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const input = (inputId: string) => (
    <AtlasTextField
      className={inputClassName}
      id={inputId}
      name={name}
      type="number"
      min={0}
      step="any"
      autoComplete="off"
      elemAfterInput={unit ? <div>{unit}</div> : null}
      value={text}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={() => {
        const next = Number(text);

        if (text !== '' && Number.isFinite(next) && next > 0 && roundTo(next, 2) !== roundTo(Number(value), 2)) {
          onCommit(next);
        }
      }}
    />
  );

  if (inheritance) {
    return (
      <InheritanceRow id={id} label={label} {...inheritance}>
        {input(id)}
        {children}
      </InheritanceRow>
    );
  }

  return (
    <div>
      <Field name={name} label={label} isRequired>
        {({ fieldProps }) => input(fieldProps.id)}
      </Field>
      {children}
    </div>
  );
};

export default DerivedNumberField;

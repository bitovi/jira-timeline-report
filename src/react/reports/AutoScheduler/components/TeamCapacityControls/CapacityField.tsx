import type { FC } from 'react';

import React, { useState } from 'react';
import InlineEdit from '@atlaskit/inline-edit';
import Textfield from '@atlaskit/textfield';

interface CapacityFieldProps {
  value: number;
  onChange: (next: number) => void;
}

// InlineEdit's outer margin and Textfield's 40px default height would both grow the team header row
// the moment capacity is clicked. Neither is reachable through props.
const compactEdit = [
  '[&>form>div]:!m-0',
  '[&_[data-ds--text-field--container]]:!h-[22px]',
  '[&_[data-ds--text-field--container]]:!min-h-0',
  '[&_[data-ds--text-field--input]]:!px-1.5',
  '[&_[data-ds--text-field--input]]:!py-0',
  '[&_[data-ds--text-field--input]]:!text-xs',
  '[&_[data-ds--text-field--input]]:!font-semibold',
].join(' ');

/**
 * The team's capacity per sprint, as the standard Jira click-to-edit. `EditableTitle.tsx` is the
 * model: `InlineEdit`'s own read view is the click target, which works here because the team header
 * row has no click handler of its own competing for the gesture.
 */
export const CapacityField: FC<CapacityFieldProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={compactEdit}>
      <InlineEdit<string>
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        defaultValue={String(value)}
        editButtonLabel={`Capacity, ${value} points per sprint`}
        // `Number('1e999')` is `Infinity`, which survives `> 0` and then `JSON.stringify`s to `null` —
        // a committed capacity that reads as unset.
        validate={(next) => (isCapacity(Number(next)) ? undefined : 'Enter a number greater than 0')}
        onConfirm={(next) => {
          setIsEditing(false);
          const parsed = Number(next);
          if (isCapacity(parsed) && parsed !== value) onChange(parsed);
        }}
        onCancel={() => setIsEditing(false)}
        editView={({ errorMessage, ...fieldProps }) => (
          <Textfield {...fieldProps} type="number" min={0} autoFocus width={56} />
        )}
        readView={() => <span className="font-semibold tabular-nums">{value}</span>}
      />
    </div>
  );
};

function isCapacity(parsed: number) {
  return Number.isFinite(parsed) && parsed > 0;
}

import type { FC } from 'react';

import React, { useState } from 'react';
import InlineEdit from '@atlaskit/inline-edit';
import Textfield from '@atlaskit/textfield';

interface CapacityFieldProps {
  value: number;
  onChange: (next: number) => void;
}

/**
 * The team's capacity per sprint, as the standard Jira click-to-edit. `EditableTitle.tsx` is the
 * model: `InlineEdit`'s own read view is the click target, which works here because the team header
 * row has no click handler of its own competing for the gesture.
 */
export const CapacityField: FC<CapacityFieldProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    // Cannot override styles inside InlineEdit through props. This removes excess margin, which
    // would otherwise stretch the team header row's height.
    <div className="[&>form>div]:!m-0">
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
          <Textfield {...fieldProps} type="number" min={0} autoFocus width={72} />
        )}
        readView={() => <span className="font-semibold tabular-nums">{value}</span>}
      />
    </div>
  );
};

function isCapacity(parsed: number) {
  return Number.isFinite(parsed) && parsed > 0;
}

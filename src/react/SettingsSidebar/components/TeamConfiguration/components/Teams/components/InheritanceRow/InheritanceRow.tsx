import type { FC, ReactNode } from 'react';

import React from 'react';

import ToggleButton from '../../../../../../../components/ToggleButton';
import { RequiredAsterisk } from '../Label';

export interface InheritanceRowProps {
  /** The customized input's id. An inherited value is plain text, so the label then points at nothing. */
  id: string;
  label: string;
  isRequired?: boolean;
  isInheriting: boolean;
  onInheritanceChange: (newInheritance: boolean) => void;
  /** The inherited value as text — shown instead of the input while the level inherits. */
  inheritedValue: ReactNode;
  children: ReactNode;
}

/**
 * One inherit-or-customize setting: the question on its own row across the full width, then either
 * the inherited value as text or the input, with the toggle beside it.
 */
const InheritanceRow: FC<InheritanceRowProps> = ({
  id,
  label,
  isRequired = true,
  isInheriting,
  onInheritanceChange,
  inheritedValue,
  children,
}) => (
  <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-slate-200 py-3">
    <div className="col-span-2">
      <label htmlFor={isInheriting ? undefined : id} className="text-sm font-semibold text-slate-900">
        {label} {!isInheriting && isRequired && <RequiredAsterisk />}
      </label>
    </div>
    <div className="min-w-0">
      {isInheriting ? (
        <p className="text-sm text-slate-700" data-testid="inherited-value">
          {inheritedValue}
        </p>
      ) : (
        children
      )}
    </div>
    <ToggleButton
      active={!isInheriting}
      onActiveChange={onInheritanceChange}
      inactiveLabel={isInheriting ? 'Inheriting' : 'Inherit'}
      activeLabel={isInheriting ? 'Customize' : 'Customized'}
    />
  </div>
);

export default InheritanceRow;

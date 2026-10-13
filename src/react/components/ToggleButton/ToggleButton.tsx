import type { FC } from 'react';

import React from 'react';

interface ToggleButtonProps {
  active: boolean;
  onActiveChange: (newActive: boolean) => void;
  activeLabel: string;
  inactiveLabel: string;
}

const segmentClasses = 'rounded-sm px-2 text-xs font-semibold';

const getInactiveButtonStyles = (isSelected: boolean) =>
  [segmentClasses, isSelected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'].join(' ');

const getActiveButtonStyles = (isSelected: boolean) =>
  [
    segmentClasses,
    isSelected ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-400' : 'text-slate-500 hover:text-slate-700',
  ].join(' ');

const ToggleButton: FC<ToggleButtonProps> = ({ active, onActiveChange, inactiveLabel, activeLabel }) => {
  return (
    <div className="grid h-9 w-48 shrink-0 grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
      <button
        type="button"
        className={getInactiveButtonStyles(!active)}
        disabled={!active}
        onClick={() => onActiveChange(!active)}
      >
        {inactiveLabel}
      </button>
      <button
        type="button"
        className={getActiveButtonStyles(active)}
        disabled={active}
        onClick={() => onActiveChange(!active)}
      >
        {activeLabel}
      </button>
    </div>
  );
};

export default ToggleButton;

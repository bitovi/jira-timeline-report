import type { FC } from "react";

import React from "react";

interface ToggleButtonProps {
  active: boolean;
  onActiveChange: (newActive: boolean) => void;
  activeLabel: string;
  inactiveLabel: string;
}

const getButtonClasses = () => {
  return ["uppercase", "font-bold", "rounded-sm", "text-xs", "p-1"];
};

const getInactiveButtonStyles = (isInactive: boolean) => {
  return [...getButtonClasses(), isInactive ? "bg-gray-200" : "", !isInactive ? "text-zinc-400" : ""]
    .filter(Boolean)
    .join(" ");
};

const getActiveButtonStyles = (isActive: boolean) => {
  return [
    ...getButtonClasses(),
    isActive ? "bg-blue-50" : "",
    isActive ? "text-blue-700" : "",
    !isActive ? "text-zinc-400" : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const ToggleButton: FC<ToggleButtonProps> = ({ active, onActiveChange, inactiveLabel, activeLabel }) => {
  return (
    <div className="bg-gray-100 p-1 rounded-sm grid grid-cols-2 h-10 w-48">
      <button className={getInactiveButtonStyles(!active)} disabled={!active} onClick={() => onActiveChange(!active)}>
        {inactiveLabel}
      </button>
      <button className={getActiveButtonStyles(active)} disabled={active} onClick={() => onActiveChange(!active)}>
        {activeLabel}
      </button>
    </div>
  );
};

export default ToggleButton;

import React from 'react';
import Tooltip from '@atlaskit/tooltip';

export interface InfoTooltipProps {
  label: string;
  children: React.ReactNode;
}

/** A small circled "i" that explains the card it titles. Focusable so the copy is reachable by keyboard. */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ label, children }) => (
  <Tooltip content={children}>
    <span
      role="img"
      aria-label={label}
      tabIndex={0}
      className="inline-flex h-[13px] w-[13px] shrink-0 cursor-help items-center justify-center rounded-full border border-neutral-40 text-[9px] font-bold leading-none text-neutral-500 hover:border-blue-300 hover:text-blue-300"
    >
      i
    </span>
  </Tooltip>
);

export interface ColumnLabelProps {
  tip: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A column heading that defines its own number, so the card tooltip never has to stack a
 * definition per column. Matches the dotted-underline affordance used in the rail header.
 */
export const ColumnLabel: React.FC<ColumnLabelProps> = ({ tip, children }) => (
  <Tooltip content={tip}>
    <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2">
      {children}
    </span>
  </Tooltip>
);

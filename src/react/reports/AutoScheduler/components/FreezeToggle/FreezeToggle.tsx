import type { FC } from 'react';

import React from 'react';
import Tooltip from '@atlaskit/tooltip';
import LockLockedIcon from '@atlaskit/icon/core/lock-locked';
import LockUnlockedIcon from '@atlaskit/icon/core/lock-unlocked';

export const FREEZE_NEEDS_DATES = 'Needs a start or due date in Jira to freeze.';

interface FreezeToggleProps {
  summary: string;
  isFrozen: boolean;
  /** False when Jira gives the item neither a start nor a due date. */
  canFreeze: boolean;
  onToggle: (frozen: boolean) => void;
  /** While hovered or focused, so the row can preview what toggling would do. Never fires when disabled. */
  onPreviewChange?: (previewing: boolean) => void;
}

/**
 * The lock at the start of a row's label. Unlocked rows show it faintly, and only on hover of the
 * label (the `group` on `IssueSummaryLabel`); locked rows always show it.
 *
 * `aria-disabled` rather than `disabled`: a disabled button gets no pointer or focus events, so the
 * tooltip explaining *why* it's disabled could never open.
 */
export const FreezeToggle: FC<FreezeToggleProps> = ({ summary, isFrozen, canFreeze, onToggle, onPreviewChange }) => {
  const label = `${isFrozen ? 'Unfreeze' : 'Freeze'} ${summary}`;
  const disabled = !canFreeze && !isFrozen;
  const preview = (previewing: boolean) => {
    if (!disabled) onPreviewChange?.(previewing);
  };

  const visibility = isFrozen
    ? 'text-neutral-800'
    : disabled
      ? 'opacity-0 group-hover:opacity-40 focus-visible:opacity-40 cursor-not-allowed text-neutral-500'
      : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100 text-neutral-500';

  return (
    <Tooltip
      // Below, it would cover the next row's lock and swallow the hover meant for it.
      position="left"
      ignoreTooltipPointerEvents
      content={
        disabled ? FREEZE_NEEDS_DATES : isFrozen ? 'Unfreeze: let the scheduler move this' : 'Freeze at its Jira dates'
      }
    >
      {(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={label}
          aria-pressed={isFrozen}
          aria-disabled={disabled || undefined}
          data-testid="freeze-toggle"
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded bg-transparent p-0 ${visibility}`}
          onClick={() => {
            if (!disabled) onToggle(!isFrozen);
          }}
          onMouseEnter={() => preview(true)}
          onMouseLeave={() => preview(false)}
          onFocus={(e) => {
            triggerProps.onFocus?.(e);
            preview(true);
          }}
          onBlur={(e) => {
            triggerProps.onBlur?.(e);
            preview(false);
          }}
        >
          {isFrozen ? <LockLockedIcon label="" /> : <LockUnlockedIcon label="" />}
        </button>
      )}
    </Tooltip>
  );
};

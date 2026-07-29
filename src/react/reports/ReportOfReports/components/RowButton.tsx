import type { ButtonHTMLAttributes, ComponentType } from 'react';

import React, { forwardRef } from 'react';

export interface RowButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** An `@atlaskit/icon` glyph. Rendered decoratively — `label` below is the accessible name. */
  icon: ComponentType<{ label: string }>;
  /** The accessible name. These buttons are icon-only, so there is nothing else to read out. */
  label: string;
  /** `danger` is Delete's: a light danger tint with a danger-colored glyph on hover. */
  tone?: 'neutral' | 'danger';
}

// One line each rather than a shared base plus an override: two `hover:bg-*` utilities on the same
// element are resolved by stylesheet order, not by the order they appear in `class`, so an override
// would win or lose depending on how Tailwind happened to emit them.
const tones = {
  neutral: 'text-neutral-801 hover:bg-neutral-201',
  danger: 'text-neutral-801 hover:bg-red-500/10 hover:text-red-500',
};

/**
 * The icon button used by a row's controls and its caret: 24px, borderless, muted until pointed at.
 *
 * A plain `<button>` rather than Atlaskit's `IconButton` because the redesign specifies the resting,
 * hover, and disabled treatments precisely (including a danger tint Atlaskit's `subtle` appearance
 * has no equivalent of), and because `@atlaskit/popup` triggers in this codebase are plain buttons —
 * see `ColumnHeaderMenu` and `AddColumnButton`. Forwards its ref for that reason.
 */
export const RowButton = forwardRef<HTMLButtonElement, RowButtonProps>(
  ({ icon: Icon, label, tone = 'neutral', className = '', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      {...props}
      aria-label={label}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${tones[tone]} ${className}`}
    >
      <Icon label="" />
    </button>
  ),
);

RowButton.displayName = 'RowButton';

export default RowButton;

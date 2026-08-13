import type { FC, ReactNode } from 'react';

import React, { useId } from 'react';
import Heading from '@atlaskit/heading';

export type StorageOptionValue = 'legacy' | 'space';

export interface StorageOption {
  value: StorageOptionValue;
  label: string;
  description?: string;
}

export interface StorageCardProps {
  /** The host this card describes — `Connect` or `Web`. */
  title: string;
  /**
   * What these radios choose the storage for. A card is scoped to a host, not to a kind of data, so
   * this is the first of several groups it will hold — "Team storage" and friends land beside this
   * one, each with its own radios. It is also what keeps the radios' accessible name specific once
   * more than one group exists.
   */
  groupTitle: string;
  options: StorageOption[];
  selected: StorageOptionValue | null;
  /**
   * A card for the host you are not running in is read-only: it documents how that host stores
   * reports, it does not show its state. The web build cannot read a Connect app property, so there
   * is no live state to show in that direction — a deliberate limit, hence the explicit note.
   */
  disabled?: boolean;
  note?: ReactNode;
  onSelect?: (value: StorageOptionValue) => void;
  /** Rendered under the `space` option while it is the selected one. */
  children?: ReactNode;
}

const StorageCard: FC<StorageCardProps> = ({
  title,
  groupTitle,
  options,
  selected,
  disabled = false,
  note,
  onSelect,
  children,
}) => {
  const name = useId();

  return (
    <section
      className={`flex flex-1 flex-col gap-3 rounded border border-neutral-30 p-4 ${disabled ? 'bg-neutral-10' : ''}`}
      aria-label={`${title} storage`}
    >
      <Heading size="xsmall">{title}</Heading>

      {/* A fieldset rather than a div: with a second group in this card, "the radios" stops being
          unambiguous, and the legend is what tells a screen reader which storage each set chooses. */}
      <fieldset>
        <legend className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">{groupTitle}</legend>
        <div className="flex flex-col gap-3">
          {options.map((option) => {
            const id = `${name}-${option.value}`;

            return (
              <div key={option.value} className="flex flex-col gap-1">
                <label
                  htmlFor={id}
                  className={`flex items-start gap-2 text-sm ${disabled ? 'text-slate-300' : 'cursor-pointer'}`}
                >
                  <input
                    id={id}
                    type="radio"
                    name={name}
                    className="mt-0.5"
                    value={option.value}
                    disabled={disabled}
                    checked={!disabled && selected === option.value}
                    onChange={() => onSelect?.(option.value)}
                  />
                  <span>
                    <span className="font-semibold">{option.label}</span>
                    {option.description && <span className="block text-slate-300 text-xs">{option.description}</span>}
                  </span>
                </label>
                {option.value === 'space' && !disabled && selected === 'space' && children}
              </div>
            );
          })}
        </div>
      </fieldset>

      {note && <p className="text-slate-300 text-xs">{note}</p>}
    </section>
  );
};

export default StorageCard;

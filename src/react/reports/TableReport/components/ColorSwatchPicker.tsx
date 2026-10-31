/**
 * A colour swatch button that opens a grid of fixed colours — Atlaskit has no standalone colour
 * picker, and Jira's own pickers (epic colours, labels) are a fixed swatch grid too. Offers
 * "Default" (the colour the value gets when nobody picks one), then Atlassian's chart colours, one
 * row per shade (see `model/chartColors.ts`).
 */
import React, { useState } from 'react';
import Popup from '@atlaskit/popup';

import { FAMILY_COLORS } from '../model/chartColors';

import type { ChartColor } from '../model/chartColors';

interface ColorSwatchPickerProps {
  /** What is being coloured, for accessible names ("Color for Ready"). */
  name: string;
  /** The picked colour, or `undefined` when it uses the default. */
  value: ChartColor | undefined;
  /** The colour used when nothing is picked. */
  defaultColor: ChartColor;
  /** Pick a colour id, or `undefined` for the default. */
  onChange: (id: string | undefined) => void;
}

const SWATCH = 20;

/**
 * Atlaskit popups default to the "layer" z-index (400), below modals (510), and this picker opens
 * from the Order and colors modal — so it would render behind it. One above the modal layer.
 */
export const ABOVE_MODAL_Z_INDEX = 511;

const Swatch: React.FC<{ color: ChartColor; selected: boolean; onClick: () => void }> = ({
  color,
  selected,
  onClick,
}) => (
  <button
    type="button"
    aria-label={color.label}
    aria-pressed={selected}
    title={color.label}
    data-testid="color-swatch"
    data-color={color.id}
    onClick={onClick}
    className={`rounded cursor-pointer ${selected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
    style={{ width: SWATCH, height: SWATCH, background: color.background }}
  />
);

export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ name, value, defaultColor, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const shown = value ?? defaultColor;
  const pick = (id: string | undefined) => {
    onChange(id);
    setIsOpen(false);
  };
  const swatches = (colors: readonly ChartColor[]) =>
    colors.map((color) => (
      <Swatch key={color.id} color={color} selected={value?.id === color.id} onClick={() => pick(color.id)} />
    ));

  return (
    <Popup
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-start"
      zIndex={ABOVE_MODAL_Z_INDEX}
      content={() => (
        <div className="p-3 flex flex-col gap-2" data-testid="color-swatch-picker">
          <button
            type="button"
            aria-label={`Default (${defaultColor.label})`}
            aria-pressed={value == null}
            data-testid="color-swatch-default"
            onClick={() => pick(undefined)}
            className={`flex items-center gap-2 self-start rounded px-1 py-0.5 text-sm text-neutral-801 hover:bg-neutral-201 ${
              value == null ? 'font-semibold' : ''
            }`}
          >
            <span className="rounded" style={{ width: SWATCH, height: SWATCH, background: defaultColor.background }} />
            Default
          </button>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${FAMILY_COLORS.length / 3}, ${SWATCH}px)` }}
          >
            {swatches(FAMILY_COLORS)}
          </div>
        </div>
      )}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={`Color for ${name}: ${shown.label}${value ? '' : ' (default)'}`}
          data-testid="color-swatch-trigger"
          data-color={shown.id}
          onClick={() => setIsOpen((open) => !open)}
          className="flex-none rounded cursor-pointer border border-neutral-301"
          style={{ width: SWATCH, height: SWATCH, background: shown.background }}
        />
      )}
    />
  );
};

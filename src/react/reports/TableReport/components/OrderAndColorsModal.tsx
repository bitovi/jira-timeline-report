/**
 * "Order and colors" for one column (its ⋯ menu): the order its values appear in inside grouped
 * cells (Count by value, Stacked bar, Distinct list) and each value's Stacked bar colour. Opens on
 * the current settings; Save writes them, "Reset to default" goes back to A→Z and default colours.
 */
import React, { useState } from 'react';
import Button from '@atlaskit/button/new';
import ModalDialog, { ModalBody, ModalFooter, ModalHeader, ModalTitle } from '@atlaskit/modal-dialog';

import { ReorderableList } from './ReorderableList';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { chartColor } from '../model/chartColors';

import type { ChartColor } from '../model/chartColors';

export interface OrderAndColors {
  /** The arranged values, or `undefined` for the default (A→Z). */
  valueOrder: string[] | undefined;
  /** Picked colours, value → colour id. Values left on their default are absent. */
  valueColors: Record<string, string>;
  /** "Reset to default" was used: replace everything saved, rather than merging. */
  isReset: boolean;
}

interface OrderAndColorsModalProps {
  columnLabel: string;
  /** The column's loaded values in their current order. */
  values: readonly string[];
  /** The same values in the default order (A→Z), for Reset. */
  defaultValues: readonly string[];
  /** The colours picked so far, value → colour id. */
  valueColors: Readonly<Record<string, string>>;
  /** A value's colour when nothing is picked for it. */
  defaultColorFor: (value: string) => ChartColor;
  onSave: (settings: OrderAndColors) => void;
  onClose: () => void;
}

export const OrderAndColorsModal: React.FC<OrderAndColorsModalProps> = ({
  columnLabel,
  values,
  defaultValues,
  valueColors,
  defaultColorFor,
  onSave,
  onClose,
}) => {
  const [items, setItems] = useState<string[]>(() => [...values]);
  const [colors, setColors] = useState<Record<string, string>>(() => ({ ...valueColors }));
  // Reset only stages the defaults; nothing is saved until Save, so Cancel still backs out.
  const [isReset, setIsReset] = useState(false);
  const [isOrderDefault, setIsOrderDefault] = useState(false);

  return (
    <ModalDialog testId="table-order-and-colors-modal" onClose={onClose} width="small">
      <ModalHeader>
        <ModalTitle>{columnLabel}: order and colors</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <p className="pb-3 text-sm text-neutral-801">
          When this column is grouped, its values appear in this order. Colors are used by Stacked bar.
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-801">No values loaded.</p>
        ) : (
          <ReorderableList
            label={`${columnLabel} values`}
            items={items}
            onChange={(next) => {
              setItems(next);
              setIsOrderDefault(false);
            }}
            renderItem={(item) => (
              <>
                <ColorSwatchPicker
                  name={item}
                  value={chartColor(colors[item])}
                  defaultColor={defaultColorFor(item)}
                  onChange={(id) =>
                    setColors(({ [item]: _previous, ...rest }) => (id == null ? rest : { ...rest, [item]: id }))
                  }
                />
                <span className="truncate">{item}</span>
              </>
            )}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <div className="mr-auto">
          <Button
            appearance="subtle"
            testId="table-order-and-colors-reset"
            onClick={() => {
              setItems([...defaultValues]);
              setColors({});
              setIsReset(true);
              setIsOrderDefault(true);
            }}
          >
            Reset to default
          </Button>
        </div>
        <Button appearance="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button
          appearance="primary"
          testId="table-order-and-colors-save"
          onClick={() => {
            onSave({ valueOrder: isOrderDefault ? undefined : items, valueColors: colors, isReset });
            onClose();
          }}
        >
          Save
        </Button>
      </ModalFooter>
    </ModalDialog>
  );
};

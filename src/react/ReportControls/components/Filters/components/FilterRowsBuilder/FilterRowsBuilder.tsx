import type { FC } from 'react';

import React from 'react';
import Select from '@atlaskit/select';
import Button from '@atlaskit/button/new';
import { IconButton } from '@atlaskit/button/new';
import CrossIcon from '@atlaskit/icon/glyph/cross';
import VisuallyHidden from '@atlaskit/visually-hidden';

import type { FilterField, FilterOperator, FilterRow } from '../../../../../../jira/rollup/filter-rows/filter-rows';

export interface FilterFieldDefinition {
  field: FilterField;
  label: string;
  operators: FilterOperator[];
  options: { label: string; value: string }[];
}

export interface FilterRowsBuilderProps {
  rows: FilterRow[];
  onChange: (rows: FilterRow[]) => void;
  fieldDefinitions: FilterFieldDefinition[];
}

const makeRowId = () => `filter-row-${Math.random().toString(36).slice(2, 9)}`;

const getFieldDefinition = (fieldDefinitions: FilterFieldDefinition[], field: FilterField) =>
  fieldDefinitions.find((def) => def.field === field) ?? fieldDefinitions[0];

/**
 * Generic, Jira-Plans-style filter row builder: one row per entry (Field / Operator / Value
 * multi-select / remove), a "+ Add filter" button, and a "Clear all filters" action. This is a
 * pure, presentation-only component — all matching logic lives in the pure predicate module
 * `filter-rows.ts`; this component only produces/edits `FilterRow[]`.
 */
export const FilterRowsBuilder: FC<FilterRowsBuilderProps> = ({ rows, onChange, fieldDefinitions }) => {
  const updateRow = (id: string, updates: Partial<FilterRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const handleFieldChange = (row: FilterRow, newField: FilterField) => {
    const fieldDef = getFieldDefinition(fieldDefinitions, newField);
    updateRow(row.id, { field: newField, operator: fieldDef.operators[0], value: [] });
  };

  const handleRemoveRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const handleAddFilter = () => {
    const firstFieldDef = fieldDefinitions[0];
    onChange([
      ...rows,
      { id: makeRowId(), field: firstFieldDef.field, operator: firstFieldDef.operators[0], value: [] },
    ]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div>
      <div className="flex justify-end pb-2">
        <button
          type="button"
          className="text-sm font-semibold text-blue-600 hover:underline disabled:text-zinc-400 disabled:no-underline"
          onClick={handleClearAll}
          disabled={rows.length === 0}
        >
          Clear all filters
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const fieldDef = getFieldDefinition(fieldDefinitions, row.field);
          const fieldOptions = fieldDefinitions.map((def) => ({ label: def.label, value: def.field }));
          const operatorOptions = fieldDef.operators.map((operator) => ({ label: operator, value: operator }));
          const selectedValues = fieldDef.options.filter((option) => row.value.includes(option.value));

          return (
            <div key={row.id} className="grid grid-cols-[160px_110px_1fr_28px] gap-2 items-start">
              <div>
                <VisuallyHidden>
                  <label htmlFor={`${row.id}-field`}>Field</label>
                </VisuallyHidden>
                <Select
                  inputId={`${row.id}-field`}
                  options={fieldOptions}
                  value={fieldOptions.find((option) => option.value === row.field)}
                  onChange={(option) => option && handleFieldChange(row, option.value)}
                />
              </div>
              <div>
                <VisuallyHidden>
                  <label htmlFor={`${row.id}-operator`}>Operator</label>
                </VisuallyHidden>
                <Select
                  inputId={`${row.id}-operator`}
                  options={operatorOptions}
                  value={operatorOptions.find((option) => option.value === row.operator)}
                  onChange={(option) => option && updateRow(row.id, { operator: option.value })}
                />
              </div>
              <div>
                <VisuallyHidden>
                  <label htmlFor={`${row.id}-value`}>Value</label>
                </VisuallyHidden>
                <Select
                  inputId={`${row.id}-value`}
                  isMulti
                  isSearchable
                  options={fieldDef.options}
                  value={selectedValues}
                  onChange={(options) => updateRow(row.id, { value: (options ?? []).map((option) => option.value) })}
                />
              </div>
              <IconButton
                appearance="subtle"
                icon={CrossIcon}
                label="Remove filter"
                onClick={() => handleRemoveRow(row.id)}
              />
            </div>
          );
        })}
      </div>
      <div className="pt-2">
        <Button appearance="subtle" spacing="compact" onClick={handleAddFilter}>
          + Add filter
        </Button>
      </div>
    </div>
  );
};

export default FilterRowsBuilder;

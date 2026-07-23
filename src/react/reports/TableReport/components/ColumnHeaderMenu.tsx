/**
 * Per-column header `⋯` menu for the Table report (spec/012-table-and-grouper, Phase 1, design §5).
 *
 * A hover/focus-only trigger button (hidden at rest so the table reads "printable") that opens a
 * popup containing the column's type-aware filter control and a "Remove column" action. All filter
 * UX lives here — there is no separate filter bar (plan Q6).
 */
import React, { useState } from 'react';
import Popup from '@atlaskit/popup';

import FilterControl from './filters/FilterControl';

import { aggregations } from '../model/aggregations';
import { applicableAggregations, effectiveAggregationId } from '../model/grouping';

import type { AggregationId } from '../model/aggregations';
import type { ColumnDefinition } from '../model/columns';
import type { FilterValue, SortMode } from '../model/applyView';

interface ColumnHeaderMenuProps {
  column: ColumnDefinition;
  onRemove: () => void;
  /**
   * Omitted entirely in contexts with no filter control (e.g. the 2D cross-tab measure menu), which
   * hides the Filter section regardless of `column.filter`.
   */
  filterValue?: FilterValue | undefined;
  onFilterChange?: (value: FilterValue | undefined) => void;
  /** Distinct values observed for this column, used by `select` filters. */
  filterOptions?: string[];
  /** Whether the column currently has an active filter (drives the always-visible state). */
  isActive?: boolean;
  /** This column's active sort mode, or `null` when another column (or none) owns the sort. */
  sortMode?: SortMode | null;
  /** Set this column's sort mode. Tree-capable columns also offer the `tree` (Hierarchy) mode. */
  onSortChange?: (mode: SortMode) => void;
  /**
   * The column's current per-column aggregation override, if any. Supplied whenever the column is a
   * measure (identity/grouped columns are excluded upstream). When omitted the submenu is hidden.
   */
  aggregationOverride?: AggregationId;
  /** Set/clear this column's per-column aggregation override. Presence enables the submenu. */
  onAggregationChange?: (value: AggregationId) => void;
  /**
   * Whether the chosen aggregation currently affects anything on screen (i.e. the report is grouped
   * or in a 2D cross-tab). When `false`, the Aggregation label gets a "(used when grouped)" hint
   * (mirrors spec/012-table-and-grouper/mockups/table-report.html) since the choice is a no-op until
   * the view is grouped. Defaults to `true`.
   */
  aggregationActive?: boolean;
  /** Move this column one position toward the start. Omitted/disabled on the first shown column. */
  onMoveLeft?: () => void;
  /** Move this column one position toward the end. Omitted/disabled on the last shown column. */
  onMoveRight?: () => void;
}

export const ColumnHeaderMenu: React.FC<ColumnHeaderMenuProps> = ({
  column,
  filterValue,
  onFilterChange,
  onRemove,
  filterOptions,
  isActive = false,
  sortMode,
  onSortChange,
  aggregationOverride,
  onAggregationChange,
  aggregationActive = true,
  onMoveLeft,
  onMoveRight,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const aggregationOptions = onAggregationChange ? applicableAggregations(column) : [];
  const currentAggregation = effectiveAggregationId(column, aggregationOverride);

  // Sort options match the header-click behavior: tree-capable identity columns offer
  // Hierarchy / A→Z / Z→A / Rank; every other column offers plain ascending / descending.
  const sortOptions: Array<{ mode: SortMode; label: string }> = column.isTree
    ? [
        { mode: 'tree', label: 'Hierarchy (nested)' },
        { mode: 'asc', label: 'A → Z' },
        { mode: 'desc', label: 'Z → A' },
        { mode: 'rank', label: 'Rank' },
      ]
    : [
        { mode: 'asc', label: 'Sort ascending' },
        { mode: 'desc', label: 'Sort descending' },
      ];

  return (
    <Popup
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-start"
      content={() => (
        <div className="p-3 w-64 flex flex-col gap-3" data-testid="table-column-menu">
          {onSortChange && (
            <div className="flex flex-col gap-1" data-testid="table-sort-menu">
              <span className="text-xs font-semibold text-neutral-801">Sort</span>
              <div className="flex flex-col">
                {sortOptions.map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={sortMode === mode}
                    data-testid={`table-sort-${mode}`}
                    className={`text-left text-sm px-2 py-1 rounded hover:bg-neutral-201 ${
                      sortMode === mode ? 'font-semibold text-blue-400' : 'text-neutral-801'
                    }`}
                    onClick={() => onSortChange(mode)}
                  >
                    {sortMode === mode ? '✓ ' : ''}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {aggregationOptions.length > 0 && onAggregationChange && (
            <div className="flex flex-col gap-1" data-testid="table-aggregation-menu">
              <span className="text-xs font-semibold text-neutral-801">
                Aggregation{aggregationActive ? '' : ' (used when grouped)'}
              </span>
              <div className="flex flex-col">
                {aggregationOptions.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={currentAggregation === id}
                    data-testid={`table-aggregation-${id}`}
                    className={`text-left text-sm px-2 py-1 rounded hover:bg-neutral-201 ${
                      currentAggregation === id ? 'font-semibold text-blue-400' : 'text-neutral-801'
                    }`}
                    onClick={() => onAggregationChange(id)}
                  >
                    {currentAggregation === id ? '✓ ' : ''}
                    {aggregations[id].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(onMoveLeft || onMoveRight) && (
            <div className="flex flex-col gap-1" data-testid="table-move-menu">
              <span className="text-xs font-semibold text-neutral-801">Move column</span>
              <div className="flex flex-col">
                <button
                  type="button"
                  data-testid="table-move-left"
                  disabled={!onMoveLeft}
                  className="text-left text-sm px-2 py-1 rounded hover:bg-neutral-201 text-neutral-801 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  onClick={() => {
                    setIsOpen(false);
                    onMoveLeft?.();
                  }}
                >
                  Move left
                </button>
                <button
                  type="button"
                  data-testid="table-move-right"
                  disabled={!onMoveRight}
                  className="text-left text-sm px-2 py-1 rounded hover:bg-neutral-201 text-neutral-801 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  onClick={() => {
                    setIsOpen(false);
                    onMoveRight?.();
                  }}
                >
                  Move right
                </button>
              </div>
            </div>
          )}
          {column.filter && onFilterChange && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-neutral-801">Filter</span>
              <FilterControl
                descriptor={column.filter}
                value={filterValue}
                onChange={onFilterChange}
                options={filterOptions}
              />
              {isActive && (
                <button
                  type="button"
                  className="link text-xs self-start"
                  onClick={() => onFilterChange(undefined)}
                  data-testid="table-clear-filter"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            className="link text-xs self-start"
            onClick={() => {
              setIsOpen(false);
              onRemove();
            }}
            data-testid="table-remove-column"
          >
            Remove column
          </button>
        </div>
      )}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={`${column.label} column options`}
          data-testid="table-column-menu-trigger"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((open) => !open);
          }}
          // Hidden at rest; revealed on header hover (group-hover) or when focused/active/open.
          className={[
            'ml-1 px-1 rounded leading-none text-neutral-801 hover:bg-neutral-201 focus:opacity-100 group-hover:opacity-100',
            isActive || isOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          ⋯
        </button>
      )}
    />
  );
};

export default ColumnHeaderMenu;

/**
 * Pure view-transform layer for the Table report (spec/012-table-and-grouper, Phase 1).
 *
 * These helpers take the top-level issue set plus the user's current view state (which columns are
 * shown, the active sort, and per-column filters) and produce the rows to render. Everything here is
 * side-effect-free and unit-tested independently of React so the report component stays a thin
 * orchestrator.
 *
 * A column is a {@link ColumnDefinition} from the Phase 0 model; this module never mutates it. It
 * reads `getValue` (to filter/sort) and `compare` (to sort), and inspects `filter.kind` to interpret
 * the stored {@link FilterValue}.
 */
import type { ColumnDefinition, TableIssue } from './columns';

/**
 * The stored value for a single active column filter. The discriminant mirrors
 * {@link FilterDescriptor} `kind` so a column's filter control and its stored value always agree.
 */
export type FilterValue =
  | { kind: 'text'; contains: string }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'date'; from?: string; to?: string }
  | { kind: 'select'; selected: string[] }
  | { kind: 'boolean'; value: boolean };

/** A per-column filter map keyed by column id. Absent keys mean "no filter on that column". */
export type FilterState = Record<string, FilterValue>;

/** The sort applied to the table, or `null` when unsorted. */
export type SortState = { columnId: string; dir: SortMode } | null;

export type SortDir = 'asc' | 'desc';

/**
 * A column's sort mode. `asc`/`desc` are the ordinary type-aware sorts; `tree` is only valid on a
 * tree-capable identity column and means "nest the rows into the reporting hierarchy" (row ordering
 * is a property of the column's sort — design/tree-column-brainstorm §4).
 */
export type SortMode = SortDir | 'tree';

/** Coerce a date-ish value (Date | epoch number | parseable string) to epoch ms, or `null`. */
function toTime(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Is a stored {@link FilterValue} actually constraining anything? An empty text box, a range with no
 * bounds, or an empty multi-select is treated as "no filter" so it neither hides rows nor marks the
 * column active.
 */
export function isFilterActive(value: FilterValue | undefined): boolean {
  if (!value) return false;
  switch (value.kind) {
    case 'text':
      return value.contains.trim() !== '';
    case 'number':
      return value.min != null || value.max != null;
    case 'date':
      return !!value.from || !!value.to;
    case 'select':
      return value.selected.length > 0;
    case 'boolean':
      return true;
  }
}

/**
 * Build a predicate that decides whether an issue passes a single column's filter. Returns `null`
 * when the filter is inactive (so the caller can skip it entirely). The predicate reads the value
 * via `column.getValue`.
 */
export function makeFilterPredicate(
  column: ColumnDefinition,
  value: FilterValue | undefined,
): ((issue: TableIssue) => boolean) | null {
  if (!isFilterActive(value) || !value) return null;

  switch (value.kind) {
    case 'text': {
      const needle = value.contains.trim().toLowerCase();
      return (issue) => {
        const raw = column.getValue(issue);
        return raw != null && String(raw).toLowerCase().includes(needle);
      };
    }
    case 'number': {
      const { min, max } = value;
      return (issue) => {
        const raw = column.getValue(issue);
        if (raw == null || raw === '') return false;
        const num = Number(raw);
        if (Number.isNaN(num)) return false;
        if (min != null && num < min) return false;
        if (max != null && num > max) return false;
        return true;
      };
    }
    case 'date': {
      const from = value.from ? toTime(value.from) : null;
      const to = value.to ? toTime(value.to) : null;
      return (issue) => {
        const time = toTime(column.getValue(issue));
        if (time == null) return false;
        if (from != null && time < from) return false;
        if (to != null && time > to) return false;
        return true;
      };
    }
    case 'select': {
      const allowed = new Set(value.selected);
      return (issue) => {
        const raw = column.getValue(issue);
        if (raw == null) return false;
        return allowed.has(String(raw));
      };
    }
    case 'boolean': {
      const want = value.value;
      return (issue) => Boolean(column.getValue(issue)) === want;
    }
  }
}

/**
 * Apply every active filter (ANDed together) to the issue set. Columns are resolved by id from the
 * provided (active) column list; a filter whose column isn't currently shown is ignored.
 */
export function applyFilters(
  issues: TableIssue[],
  columns: ColumnDefinition[],
  filters: FilterState,
): TableIssue[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const predicates: Array<(issue: TableIssue) => boolean> = [];

  for (const [columnId, value] of Object.entries(filters)) {
    const column = byId.get(columnId);
    if (!column) continue;
    const predicate = makeFilterPredicate(column, value);
    if (predicate) predicates.push(predicate);
  }

  if (predicates.length === 0) return issues;
  return issues.filter((issue) => predicates.every((p) => p(issue)));
}

/**
 * Sort issues by a column using its type-aware `compare`. Returns a new array (never mutates the
 * input). `desc` reverses the comparison. A `null` column is a no-op (returns the input unchanged).
 */
export function applySort(
  issues: TableIssue[],
  column: ColumnDefinition | null | undefined,
  dir: SortMode,
): TableIssue[] {
  // `tree` ordering is handled by the hierarchy render path, not here: leave the input untouched.
  if (!column || dir === 'tree') return issues;
  const sign = dir === 'desc' ? -1 : 1;
  return [...issues].sort((a, b) => sign * column.compare(column.getValue(a), column.getValue(b)));
}

/**
 * The full flat pipeline: filter, then sort. `sort` is resolved against `columns` by id; if the
 * sorted column isn't shown (or sort is `null`) only filtering is applied.
 */
export function applyView(
  issues: TableIssue[],
  columns: ColumnDefinition[],
  filters: FilterState,
  sort: SortState,
): TableIssue[] {
  const filtered = applyFilters(issues, columns, filters);
  if (!sort) return filtered;
  const column = columns.find((c) => c.id === sort.columnId) ?? null;
  return applySort(filtered, column, sort.dir);
}

// --- Column list + sort reducers -------------------------------------------

/** Append a column id to the ordered list, ignoring duplicates. */
export function addColumn(columns: string[], id: string): string[] {
  return columns.includes(id) ? columns : [...columns, id];
}

/** Remove a column id from the ordered list. */
export function removeColumn(columns: string[], id: string): string[] {
  return columns.filter((c) => c !== id);
}

/**
 * Move `sourceId` to just before `targetId`, or to the end when `targetId` is `null` (or not present).
 * A no-op when `sourceId === targetId` or `sourceId` isn't in the list. All other ids keep their order.
 */
export function reorderColumn(columns: string[], sourceId: string, targetId: string | null): string[] {
  if (sourceId === targetId || !columns.includes(sourceId)) return columns;
  const without = columns.filter((c) => c !== sourceId);
  if (targetId == null) return [...without, sourceId];
  const targetIndex = without.indexOf(targetId);
  if (targetIndex === -1) return [...without, sourceId];
  return [...without.slice(0, targetIndex), sourceId, ...without.slice(targetIndex)];
}

/**
 * Cycle a column's sort on a header click: unsorted → asc → desc → unsorted. Clicking a different
 * column starts it fresh at `asc`.
 */
export function cycleSort(current: SortState, columnId: string): SortState {
  if (!current || current.columnId !== columnId) return { columnId, dir: 'asc' };
  if (current.dir === 'asc') return { columnId, dir: 'desc' };
  return null;
}

/**
 * Cycle a TREE-CAPABLE column's sort on a header click: hierarchy → asc → desc → hierarchy. A
 * tree-capable column always holds one of these three modes (never "unsorted"); clicking a different
 * tree-capable column starts it in `tree` (hierarchy) mode.
 */
export function cycleTreeSort(current: SortState, columnId: string): SortState {
  if (!current || current.columnId !== columnId) return { columnId, dir: 'tree' };
  if (current.dir === 'tree') return { columnId, dir: 'asc' };
  if (current.dir === 'asc') return { columnId, dir: 'desc' };
  return { columnId, dir: 'tree' };
}

/**
 * Is the active sort a hierarchy (tree) sort on a tree-capable column? Row nesting is derived from
 * this rather than a separate global mode (design/tree-column-brainstorm §3).
 */
export function isHierarchySort(sort: SortState, treeCapableIds: ReadonlySet<string>): boolean {
  return sort != null && sort.dir === 'tree' && treeCapableIds.has(sort.columnId);
}

/**
 * The order of a column's values inside one grouped cell — Count by value, Stacked bar and Distinct
 * list (e.g. grouped by Parent Summary, a Status cell listing `Idea (1), Ready (2), Done (1)`).
 *
 * Default: A→Z, for every column. A user's saved order (the column's ⋯ menu → Order and colors) goes
 * first; values it doesn't name, such as a status that appeared later, follow A→Z.
 */
import { fieldValueText } from './fieldValueText';

import type { ColumnDefinition, TableIssue } from './columns';

/** Saved value orders, keyed by column id. */
export type ValueOrders = Record<string, readonly string[]>;
/** Picked value colours (value → colour id), keyed by column id. */
export type ValueColors = Record<string, Readonly<Record<string, string>>>;

/** A column value as one or more display strings: arrays (e.g. Labels) are flattened, blanks dropped. */
function valueTexts(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : [raw]).map(fieldValueText).filter((text) => text !== '');
}

/** Each distinct value of `column` among `issues` with the issues that have it, in first-seen order. */
export function issuesByValue(column: ColumnDefinition, issues: readonly TableIssue[]): Map<string, TableIssue[]> {
  const byValue = new Map<string, TableIssue[]>();
  for (const issue of issues) {
    for (const text of valueTexts(column.getValue(issue))) {
      const list = byValue.get(text);
      if (list) list.push(issue);
      else byValue.set(text, [issue]);
    }
  }
  return byValue;
}

/**
 * Whether a column offers ⋯ → Order and colors: text and select columns, whose grouped cells list values.
 * Not identity columns (Summary, Issue key), whose "Distinct list" draws its own sorted links.
 */
export function supportsOrderAndColors(column: ColumnDefinition): boolean {
  const kind = column.filter?.kind;
  return !column.isIdentity && (kind === 'text' || kind === 'select');
}

/** The distinct values of `column` among `issues`. */
export function columnValues(column: ColumnDefinition, issues: readonly TableIssue[]): string[] {
  return [...issuesByValue(column, issues).keys()];
}

/**
 * Order `values`: the saved `valueOrder` first, then A→Z. Saved names that aren't among `values`
 * are ignored.
 */
export function orderValues(values: Iterable<string>, valueOrder: readonly string[] = []): string[] {
  const rank = (value: string) => {
    const index = valueOrder.indexOf(value);
    return index === -1 ? Infinity : index;
  };
  return [...new Set(values)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * The order to save after the user arranges `ordered` (the values currently loaded). Values from the
 * previous saved order that aren't loaded right now are kept after them, so filtering a value out
 * doesn't forget where it went.
 */
export function mergeValueOrder(ordered: readonly string[], previous: readonly string[] = []): string[] {
  return [...ordered, ...previous.filter((value) => !ordered.includes(value))];
}

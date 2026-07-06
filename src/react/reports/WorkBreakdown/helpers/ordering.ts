import { ROLLUP_PRIORITY } from './childRollup';

/**
 * Optional attention-first ordering (Blocked → Behind → … → Complete → Not started).
 *
 * Off by default in `buildBoard` (children render in source order for parity); exposed as a pure,
 * stable helper so an attention-first sort can be enabled later without touching layout code.
 */
export const orderByAttention = <T>(rows: T[], getStatus: (row: T) => string): T[] => {
  const rank = new Map<string, number>(ROLLUP_PRIORITY.map((status, index) => [status, index]));
  const rankOf = (row: T): number => rank.get(getStatus(row)) ?? ROLLUP_PRIORITY.length;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rankOf(a.row) - rankOf(b.row) || a.index - b.index)
    .map(({ row }) => row);
};

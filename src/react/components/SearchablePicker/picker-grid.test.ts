import { buildRows, buildPositions, moveActiveIndex, type MoveDirection } from './picker-grid';

/** The three things `moveActiveIndex` needs, derived from a group-count list the way the panel does. */
const grid = (counts: readonly number[], columns: number) => {
  const rows = buildRows(counts, columns);

  return {
    rows,
    positions: buildPositions(rows),
    optionCount: counts.reduce((total, count) => total + count, 0),
  };
};

const move = (counts: readonly number[], columns: number, from: number, direction: MoveDirection) => {
  const { rows, positions, optionCount } = grid(counts, columns);

  return moveActiveIndex(rows, positions, from, direction, optionCount);
};

const DIRECTIONS: MoveDirection[] = ['up', 'down', 'left', 'right'];

// See spec/033-column-select-redesign § 6.
describe('buildRows', () => {
  it('chunks per group, so a group never continues on another group’s row', () => {
    expect(buildRows([2, 4], 3)).toEqual([[0, 1], [2, 3, 4], [5]]);
  });

  it('gives one index per row at one column, which is the compact layout', () => {
    expect(buildRows([2, 4], 1)).toEqual([[0], [1], [2], [3], [4], [5]]);
  });

  it('skips a group with no options rather than leaving a hole', () => {
    // The panel drops empty groups from the DOM (`SearchablePicker.tsx`'s `grouped`), so the row
    // view has to agree — a group contributing a row here would offset every index after it.
    expect(buildRows([0, 2, 0], 3)).toEqual([[0, 1]]);
    expect(buildRows([], 3)).toEqual([]);
    expect(buildRows([0], 3)).toEqual([]);
  });

  it('numbers rows off the flat list, not per group', () => {
    expect(buildRows([1, 1, 1], 3)).toEqual([[0], [1], [2]]);
  });

  it('treats a nonsense column count as one column rather than dividing by zero', () => {
    expect(buildRows([3], 0)).toEqual([[0], [1], [2]]);
  });
});

describe('buildPositions', () => {
  it('maps every flat index to its row and column', () => {
    expect([...buildPositions(buildRows([2, 4], 3))]).toEqual([
      [0, { row: 0, col: 0 }],
      [1, { row: 0, col: 1 }],
      [2, { row: 1, col: 0 }],
      [3, { row: 1, col: 1 }],
      [4, { row: 1, col: 2 }],
      [5, { row: 2, col: 0 }],
    ]);
  });
});

describe('moveActiveIndex', () => {
  describe('left and right walk the flat reading order', () => {
    it('steps off a row’s end onto the next row’s first cell', () => {
      // [[0,1,2],[3,4,5],[6]] — 2 is the end of row 0, so Right is row 1 column 0.
      expect(move([7], 3, 2, 'right')).toBe(3);
      expect(move([7], 3, 3, 'left')).toBe(2);
    });

    it('steps off a group’s end onto the next group’s first option', () => {
      // [[0,1],[2,3,4],[5]] — 1 ends the first group, and no special case says so.
      expect(move([2, 4], 3, 1, 'right')).toBe(2);
      expect(move([2, 4], 3, 2, 'left')).toBe(1);
    });

    it('clamps at both ends of the list', () => {
      expect(move([2, 4], 3, 0, 'left')).toBe(0);
      expect(move([2, 4], 3, 5, 'right')).toBe(5);
    });
  });

  describe('up and down move one visual row and keep the column', () => {
    it('keeps the column when the target row is wide enough', () => {
      expect(move([6], 3, 1, 'down')).toBe(4);
      expect(move([6], 3, 4, 'up')).toBe(1);
    });

    it('clamps into a ragged last row instead of swallowing the keypress', () => {
      // [[0,1,2],[3,4]] — down from column 2 has no column 2 to land on.
      expect(move([5], 3, 2, 'down')).toBe(4);
    });

    it('clamps into a one-item group, which is the narrowest ragged row there is', () => {
      // [[0,1,2],[3]] — the second group holds one option.
      expect(move([3, 1], 3, 2, 'down')).toBe(3);
    });

    it('is a no-op off the top of the first row and the bottom of the last', () => {
      expect(move([6], 3, 1, 'up')).toBe(1);
      expect(move([6], 3, 4, 'down')).toBe(4);
    });

    it('collapses to plus-or-minus one in the compact layout', () => {
      // Which is exactly today's behaviour, and `useReportSearch.ts:53-58`'s. One code path.
      expect(move([2, 4], 1, 2, 'down')).toBe(3);
      expect(move([2, 4], 1, 2, 'up')).toBe(1);
      expect(move([2, 4], 1, 0, 'up')).toBe(0);
      expect(move([2, 4], 1, 5, 'down')).toBe(5);
    });
  });

  it('returns 0 in every direction when nothing matches the query', () => {
    const { rows, positions } = grid([], 3);

    for (const direction of DIRECTIONS) {
      expect(moveActiveIndex(rows, positions, 0, direction, 0)).toBe(0);
    }
  });

  it('holds still for an index the grid does not contain', () => {
    // A stale index between a query change and the clamping effect — better inert than a crash.
    expect(move([3], 3, 9, 'down')).toBe(9);
    expect(move([3], 3, 9, 'up')).toBe(9);
  });
});

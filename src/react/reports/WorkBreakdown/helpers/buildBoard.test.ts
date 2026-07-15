import { describe, test, expect } from 'vitest';
import { buildBoard } from './buildBoard';
import { primaryIssues, allIssues, planningIssues } from '../fixtures';
import type { FilterRow } from '../../../../jira/rollup/filter-rows/filter-rows';

describe('buildBoard', () => {
  test('exposes only present work types across the board', () => {
    const board = buildBoard(primaryIssues, allIssues, 'breakdown');
    expect(board.workTypes).toEqual(['design', 'dev', 'qa', 'uat']);
  });

  test('maps each primary issue to a card with its rollup status/date', () => {
    const board = buildBoard(primaryIssues, allIssues, 'breakdown');
    expect(board.cards.map((c) => c.title)).toEqual(['100 Stores', 'Outcome A', 'Digital Channel sales - 5% increase']);
    expect(board.cards[0].status).toBe('ontrack');
  });

  test('builds matrix rows with one cell per work type, in source order', () => {
    const board = buildBoard(primaryIssues, allIssues, 'breakdown');
    const card1 = board.cards[0];
    expect(card1.matrixRows.map((r) => r.name)).toEqual([
      'Digital menu board',
      'Digital orders',
      'Delivery aggregators',
      'Promotions',
      'National menu',
    ]);
    // Digital menu board: design complete, dev complete, qa ontrack, uat none.
    expect(card1.matrixRows[0].cells).toEqual(['complete', 'complete', 'ontrack', 'na']);
    // Delivery aggregators: qa work exists but no date → nodate.
    expect(card1.matrixRows[2].cells).toEqual(['complete', 'ontrack', 'nodate', 'na']);
  });

  test('status rows use the child rollup status', () => {
    const board = buildBoard(primaryIssues, allIssues, 'status');
    const card1 = board.cards[0];
    const digitalOrders = card1.statusRows.find((r) => r.name === 'Digital orders');
    expect(digitalOrders?.status).toBe('behind');
  });

  test('header columns carry per-card work-type status/date and slip', () => {
    const board = buildBoard(primaryIssues, allIssues, 'breakdown');
    const outcomeA = board.cards[1];
    const qaColumn = outcomeA.headerColumns.find((c) => c.type === 'qa');
    expect(qaColumn?.status).toBe('ahead');
    expect(qaColumn?.slip).toEqual({ kind: 'improved', label: 'Oct 10' });

    const channel = board.cards[2];
    const devColumn = channel.headerColumns.find((c) => c.type === 'dev');
    expect(devColumn?.slip).toEqual({ kind: 'slipped', label: 'Jun 19' });
  });

  test('card slip reflects a slipped rollup due date', () => {
    const board = buildBoard(primaryIssues, allIssues, 'breakdown');
    expect(board.cards[2].slip).toEqual({ kind: 'slipped', label: 'Jun 19' });
  });

  test('planning issues become planning rows and are excluded from card children', () => {
    const withPlanningChild = primaryIssues.map((issue, i) =>
      i === 0
        ? { ...issue, reportingHierarchy: { childKeys: [...(issue.reportingHierarchy?.childKeys ?? []), 'P-1'] } }
        : issue,
    );
    const board = buildBoard(withPlanningChild, [...allIssues, ...planningIssues], 'breakdown', planningIssues);
    expect(board.planning.map((p) => p.name)).toEqual(['Future initiative', 'Unscoped idea']);
    expect(board.cards[0].matrixRows.some((r) => r.key === 'P-1')).toBe(false);
  });

  test('derives density from the number of cards', () => {
    expect(buildBoard(primaryIssues, allIssues, 'breakdown').density).toBe('light');
  });

  test('empty input → empty board', () => {
    const board = buildBoard([], [], 'breakdown');
    expect(board.cards).toEqual([]);
    expect(board.workTypes).toEqual([]);
  });

  describe('filterRows (card inclusion) and childFilterRows (child trimming) — independent', () => {
    const rollupRow = (value: string[]): FilterRow[] => [{ id: 'r1', field: 'rollupStatus', operator: 'is', value }];

    test('empty filterRows/childFilterRows → unchanged behavior (all cards, full children)', () => {
      const board = buildBoard(primaryIssues, allIssues, 'breakdown', [], [], []);
      expect(board.cards.map((c) => c.key)).toEqual(['C-1', 'C-2', 'C-3']);
      expect(board.cards[0].matrixRows).toHaveLength(5);
    });

    test('filterRows excludes a card based ONLY on its own rollup status — children are not considered', () => {
      // card2's own status is 'complete'; it also has a 'blocked' child (O-5), but that no longer
      // matters for card inclusion — only the card's own rollup is checked.
      const board = buildBoard(primaryIssues, allIssues, 'breakdown', [], rollupRow(['blocked']));
      expect(board.cards.map((c) => c.key)).toEqual([]);
    });

    test('filterRows keeps a card matching its own rollup status, regardless of its children', () => {
      const board = buildBoard(primaryIssues, allIssues, 'breakdown', [], rollupRow(['complete']));
      expect(board.cards.map((c) => c.key)).toEqual(['C-2']);
      // childFilterRows is empty, so all 6 children still render untrimmed.
      expect(board.cards[0].matrixRows).toHaveLength(6);
    });

    test('childFilterRows trims a shown card down to only its matching children', () => {
      // card1 passes (empty filterRows = no card-level constraint); of its 5 children, S-2/S-5
      // resolve to 'behind'.
      const board = buildBoard(primaryIssues, allIssues, 'breakdown', [], [], rollupRow(['behind']));
      const card1 = board.cards.find((c) => c.key === 'C-1')!;
      expect(card1.matrixRows.map((r) => r.key)).toEqual(['S-2', 'S-5']);
    });

    test('childFilterRows never excludes the card itself — zero matching children still renders the card', () => {
      // None of card3's children resolve to 'blocked'.
      const board = buildBoard(primaryIssues, allIssues, 'breakdown', [], [], rollupRow(['blocked']));
      const card3 = board.cards.find((c) => c.key === 'C-3')!;
      expect(card3).toBeDefined();
      expect(card3.matrixRows).toEqual([]);
    });

    test('filterRows and childFilterRows apply together, independently', () => {
      // Only cards whose OWN status is 'ontrack' or 'behind' show (card1 'ontrack', card3
      // 'behind'); within those shown cards, only children resolving to 'behind' render.
      const board = buildBoard(
        primaryIssues,
        allIssues,
        'breakdown',
        [],
        rollupRow(['ontrack', 'behind']),
        rollupRow(['behind']),
      );
      expect(board.cards.map((c) => c.key)).toEqual(['C-1', 'C-3']);
      expect(board.cards.find((c) => c.key === 'C-1')!.matrixRows.map((r) => r.key)).toEqual(['S-2', 'S-5']);
      expect(board.cards.find((c) => c.key === 'C-3')!.matrixRows.map((r) => r.key)).toEqual(['D-2', 'D-4']);
    });
  });
});

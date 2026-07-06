import { describe, test, expect } from 'vitest';
import { buildBoard } from './buildBoard';
import { primaryIssues, allIssues, planningIssues } from '../fixtures';

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
});

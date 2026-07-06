import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { buildBoard } from '../../helpers';
import { primaryIssues, allIssues } from '../../fixtures';
import { WorkBreakdownCard } from './WorkBreakdownCard';

const board = buildBoard(primaryIssues, allIssues, 'breakdown');
const statusBoard = buildBoard(primaryIssues, allIssues, 'status');

describe('WorkBreakdownCard', () => {
  test('header bubble uses the rollup status color', () => {
    render(<WorkBreakdownCard card={board.cards[0]} mode="breakdown" density="light" />);
    const header = screen.getByText('100 Stores');
    expect(header.className).toContain('color-text-and-bg-ontrack');
  });

  test('breakdown mode renders the matrix (work-type letters)', () => {
    render(<WorkBreakdownCard card={board.cards[0]} mode="breakdown" density="light" />);
    expect(screen.getByText('Q')).toBeTruthy();
  });

  test('status mode renders the single-column body (Target Delivery)', () => {
    render(<WorkBreakdownCard card={statusBoard.cards[0]} mode="status" density="light" />);
    expect(screen.getByText('Target Delivery')).toBeTruthy();
    expect(screen.queryByText('Q')).toBeNull();
  });

  test('clicking the header invokes onIssueClick with the primary issue', () => {
    const onIssueClick = vi.fn();
    render(<WorkBreakdownCard card={board.cards[0]} mode="breakdown" density="light" onIssueClick={onIssueClick} />);
    fireEvent.click(screen.getByText('100 Stores'));
    expect(onIssueClick.mock.calls[0][1].summary).toBe('100 Stores');
  });
});

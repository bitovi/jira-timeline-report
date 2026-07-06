import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { buildBoard } from '../../helpers';
import { primaryIssues, allIssues } from '../../fixtures';
import { StatusMatrixBody } from './StatusMatrixBody';

const card = buildBoard(primaryIssues, allIssues, 'breakdown').cards[0];

describe('StatusMatrixBody', () => {
  test('renders work-type header letters and child rows', () => {
    render(<StatusMatrixBody card={card} />);
    expect(screen.getByText('d')).toBeTruthy();
    expect(screen.getByText('Q')).toBeTruthy();
    expect(screen.getByText('Digital menu board')).toBeTruthy();
  });

  test('renders one swatch cell per work type for each child', () => {
    render(<StatusMatrixBody card={card} />);
    // Delivery aggregators: design complete, dev ontrack, qa nodate, uat na.
    expect(screen.getAllByTitle('uat: no uat work').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('qa: work exists, no dates').length).toBeGreaterThan(0);
  });

  test('clicking a child name invokes onIssueClick with the issue', () => {
    const onIssueClick = vi.fn();
    render(<StatusMatrixBody card={card} onIssueClick={onIssueClick} />);
    fireEvent.click(screen.getByText('National menu'));
    expect(onIssueClick).toHaveBeenCalledTimes(1);
    expect(onIssueClick.mock.calls[0][1].summary).toBe('National menu');
  });
});

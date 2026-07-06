import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { buildBoard } from '../../helpers';
import { primaryIssues, allIssues } from '../../fixtures';
import { StatusColumnBody } from './StatusColumnBody';

const card = buildBoard(primaryIssues, allIssues, 'status').cards[0];

describe('StatusColumnBody', () => {
  test('renders the Target Delivery header and child rows', () => {
    render(<StatusColumnBody card={card} />);
    expect(screen.getByText('Target Delivery')).toBeTruthy();
    expect(screen.getByText('Digital menu board')).toBeTruthy();
    expect(screen.getByText('National menu')).toBeTruthy();
  });

  test('each child row has a status swatch', () => {
    render(<StatusColumnBody card={card} />);
    const digitalOrders = screen.getByText('Digital orders').closest('li');
    // "Digital orders" rolls up to `behind`.
    expect(digitalOrders?.querySelector('.color-text-and-bg-behind')).toBeTruthy();
  });

  test('clicking a row invokes onIssueClick with the issue', () => {
    const onIssueClick = vi.fn();
    render(<StatusColumnBody card={card} onIssueClick={onIssueClick} />);
    fireEvent.click(screen.getByText('Promotions'));
    expect(onIssueClick).toHaveBeenCalledTimes(1);
    expect(onIssueClick.mock.calls[0][1].summary).toBe('Promotions');
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import type { Card } from '../../types';
import { WorkBreakdownCard } from './WorkBreakdownCard';

const baseCard: Card = {
  key: 'C-1',
  title: '100 Stores',
  issue: { key: 'C-1', summary: '100 Stores', rollupStatuses: { rollup: { status: 'ontrack' } } },
  status: 'ontrack',
  due: null,
  slip: { kind: 'none' },
  headerColumns: [],
  statusRows: [{ key: 'S-1', name: 'Digital menu board', issue: {} as never, status: 'ontrack' }],
  matrixRows: [],
};

describe('WorkBreakdownCard statusSummary', () => {
  test('renders the summary text ABOVE the child status rows (both shown) when a status summary is present', () => {
    render(
      <WorkBreakdownCard
        card={{ ...baseCard, statusSummary: { blocks: [{ type: 'paragraph', text: 'Ahead of plan' }] } }}
        mode="status"
        density="light"
      />,
    );
    expect(screen.getByText('Ahead of plan')).toBeTruthy();
    expect(screen.getByText('Digital menu board')).toBeTruthy();
  });

  test('renders no summary block when no status summary is present', () => {
    render(<WorkBreakdownCard card={baseCard} mode="status" density="light" />);
    expect(screen.queryByText('Ahead of plan')).toBeNull();
    expect(screen.getByText('Digital menu board')).toBeTruthy();
  });

  test('orders content as Target Delivery, then the summary, then the child status rows', () => {
    const { container } = render(
      <WorkBreakdownCard
        card={{ ...baseCard, statusSummary: { blocks: [{ type: 'paragraph', text: 'Ahead of plan' }] } }}
        mode="status"
        density="light"
      />,
    );
    const html = container.innerHTML;
    const targetDeliveryIndex = html.indexOf('Target Delivery');
    const summaryIndex = html.indexOf('Ahead of plan');
    const childRowIndex = html.indexOf('Digital menu board');
    expect(targetDeliveryIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(targetDeliveryIndex);
    expect(childRowIndex).toBeGreaterThan(summaryIndex);
  });
});

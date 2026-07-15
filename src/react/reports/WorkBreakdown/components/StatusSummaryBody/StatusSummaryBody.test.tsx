import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import type { Card } from '../../types';
import { StatusSummaryBody } from './StatusSummaryBody';

const baseCard: Card = {
  key: 'C-1',
  title: '100 Stores',
  issue: { key: 'C-1', summary: '100 Stores', rollupStatuses: { rollup: { status: 'ontrack' } } },
  status: 'ontrack',
  due: null,
  slip: { kind: 'none' },
  headerColumns: [],
  statusRows: [],
  matrixRows: [],
};

describe('StatusSummaryBody', () => {
  test('renders a tight bulletList item as plain text, not wrapped in its own <p> (avoids doubled prose spacing)', () => {
    render(
      <StatusSummaryBody
        card={{
          ...baseCard,
          statusSummary: {
            blocks: [
              {
                type: 'bulletList',
                items: [[{ type: 'paragraph', text: 'first' }], [{ type: 'paragraph', text: 'second' }]],
              },
            ],
          },
        }}
      />,
    );
    const firstItem = screen.getByText('first').closest('li');
    expect(firstItem?.querySelector('p')).toBeNull();
    expect(firstItem?.textContent).toBe('first');
  });

  test('tightens list-item spacing via the prose-li modifier', () => {
    const { container } = render(
      <StatusSummaryBody
        card={{
          ...baseCard,
          statusSummary: {
            blocks: [
              {
                type: 'bulletList',
                items: [[{ type: 'paragraph', text: 'first' }], [{ type: 'paragraph', text: 'second' }]],
              },
            ],
          },
        }}
      />,
    );
    expect(container.firstElementChild?.className).toContain('prose-li:my-0');
  });

  test('renders nothing when there are no blocks', () => {
    const { container } = render(<StatusSummaryBody card={baseCard} />);
    expect(container.firstChild).toBeNull();
  });
});

import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { StatusLegend } from './StatusLegend';
import { makeIssue } from '../../fixtures';

afterEach(cleanup);

describe('StatusLegend', () => {
  test('renders nothing when there are no issues', () => {
    const { container } = render(<StatusLegend issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows a labeled count for each status present', () => {
    render(
      <StatusLegend
        issues={[
          makeIssue({ key: 'A-1', summary: 'a', status: 'complete', due: new Date('2025-01-01') }),
          makeIssue({ key: 'A-2', summary: 'b', status: 'complete', due: new Date('2025-01-02') }),
          makeIssue({ key: 'A-3', summary: 'c', status: 'blocked', due: new Date('2025-01-03') }),
        ]}
      />,
    );

    const complete = screen.getByText('Complete').closest('li') as HTMLElement;
    expect(within(complete).getByText('2')).toBeInTheDocument();

    const blocked = screen.getByText('Blocked').closest('li') as HTMLElement;
    expect(within(blocked).getByText('1')).toBeInTheDocument();
  });

  test('orders statuses by the legend order (complete before blocked)', () => {
    render(
      <StatusLegend
        issues={[
          makeIssue({ key: 'B-1', summary: 'a', status: 'blocked', due: new Date('2025-01-01') }),
          makeIssue({ key: 'B-2', summary: 'b', status: 'complete', due: new Date('2025-01-02') }),
        ]}
      />,
    );

    const labels = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(labels[0]).toContain('Complete');
    expect(labels[1]).toContain('Blocked');
  });
});

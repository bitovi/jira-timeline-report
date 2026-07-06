import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { PlanningCard } from './PlanningCard';
import { planningIssues } from '../../fixtures';

const rows = planningIssues.map((issue) => ({ key: issue.key, name: issue.summary, issue }));

describe('PlanningCard', () => {
  test('renders a Planning header and the issue names', () => {
    render(<PlanningCard planning={rows} />);
    expect(screen.getByText('Planning')).toBeTruthy();
    expect(screen.getByText('Future initiative')).toBeTruthy();
    expect(screen.getByText('Unscoped idea')).toBeTruthy();
  });

  test('renders nothing when there are no planning issues', () => {
    const { container } = render(<PlanningCard planning={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('clicking a row invokes onIssueClick', () => {
    const onIssueClick = vi.fn();
    render(<PlanningCard planning={rows} onIssueClick={onIssueClick} />);
    fireEvent.click(screen.getByText('Future initiative'));
    expect(onIssueClick).toHaveBeenCalledTimes(1);
    expect(onIssueClick.mock.calls[0][1].summary).toBe('Future initiative');
  });
});

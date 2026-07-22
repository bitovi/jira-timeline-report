import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Back the route-data hook with a mutable store so we can seed values and observe write-backs
// without wiring the real can route-data (same idiom as TableReportControls.test.tsx).
let store: Record<string, any>;
vi.mock('../../../hooks/useRouteData', () => ({
  useRouteData: (key: string) => [store[key], (v: any) => { store[key] = v; }],
}));

import SelectHierarchyRange from './SelectHierarchyRange';

const HIERARCHY = [
  { name: 'Outcome', hierarchyLevel: 4 },
  { name: 'Initiative', hierarchyLevel: 3 },
  { name: 'Epic', hierarchyLevel: 2 },
  { name: 'Story', hierarchyLevel: 1 },
];

const openPopup = () => fireEvent.click(screen.getByTestId('hierarchy-trigger'));

beforeEach(() => {
  store = {
    selectedIssueType: 'Outcome',
    toIssueType: 'Story',
    issueHierarchy: HIERARCHY,
  };
});
afterEach(() => cleanup());

describe('<SelectHierarchyRange />', () => {
  test('shows a loading trigger until the hierarchy resolves', () => {
    store.issueHierarchy = null;
    render(<SelectHierarchyRange />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('summarises the full range as "Full" on the trigger', () => {
    // From = top (Outcome), To = deepest (Story) ⇒ full.
    render(<SelectHierarchyRange />);
    expect(screen.getByTestId('hierarchy-trigger')).toHaveTextContent('Full');
  });

  test('summarises a single level as just that level name', () => {
    store.selectedIssueType = 'Epic';
    store.toIssueType = 'Epic';
    render(<SelectHierarchyRange />);
    expect(screen.getByTestId('hierarchy-trigger')).toHaveTextContent('Epic');
    expect(screen.getByTestId('hierarchy-trigger')).not.toHaveTextContent('Full');
  });

  test('summarises a range as From-To', () => {
    store.selectedIssueType = 'Outcome';
    store.toIssueType = 'Epic';
    render(<SelectHierarchyRange />);
    expect(screen.getByTestId('hierarchy-trigger')).toHaveTextContent('Outcome-Epic');
  });

  test('the popup From select offers every level; To offers only levels at or below From', () => {
    store.selectedIssueType = 'Initiative';
    store.toIssueType = 'Story';
    render(<SelectHierarchyRange />);
    openPopup();

    const from = screen.getByTestId('hierarchy-from') as HTMLSelectElement;
    expect([...from.options].map((o) => o.value)).toEqual(['Outcome', 'Initiative', 'Epic', 'Story']);

    const to = screen.getByTestId('hierarchy-to') as HTMLSelectElement;
    // Outcome is above From (Initiative) and must not be offered as a cap.
    expect([...to.options].map((o) => o.value)).toEqual(['Initiative', 'Epic', 'Story']);
  });

  test('choosing a From level writes back to selectedIssueType', () => {
    render(<SelectHierarchyRange />);
    openPopup();
    fireEvent.change(screen.getByTestId('hierarchy-from'), { target: { value: 'Initiative' } });
    expect(store.selectedIssueType).toBe('Initiative');
  });

  test('capping To at an intermediate level writes that level to toIssueType', () => {
    render(<SelectHierarchyRange />);
    openPopup();
    fireEvent.change(screen.getByTestId('hierarchy-to'), { target: { value: 'Epic' } });
    expect(store.toIssueType).toBe('Epic');
  });

  test('selecting the deepest level clears the cap', () => {
    store.toIssueType = 'Epic';
    render(<SelectHierarchyRange />);
    openPopup();
    fireEvent.change(screen.getByTestId('hierarchy-to'), { target: { value: 'Story' } });
    expect(store.toIssueType).toBe('');
  });

  test('"Show full hierarchy" is unchecked when narrowed and clears both params when toggled on', () => {
    store.selectedIssueType = 'Initiative';
    store.toIssueType = 'Epic';
    render(<SelectHierarchyRange />);
    openPopup();
    const checkbox = screen.getByRole('checkbox', { name: 'Show full hierarchy' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(store.selectedIssueType).toBe('');
    expect(store.toIssueType).toBe('');
  });

  test('"Show full hierarchy" is checked when the range is full', () => {
    render(<SelectHierarchyRange />);
    openPopup();
    const checkbox = screen.getByRole('checkbox', { name: 'Show full hierarchy' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});

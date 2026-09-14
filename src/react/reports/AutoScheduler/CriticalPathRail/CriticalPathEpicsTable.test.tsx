import type { PathFrequency } from '../scheduler/critical-path-accumulator';
import type { CriticalPathEpicRow } from './build-critical-path-epics';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { routeId } from './criticalPathSelection';
import { CriticalPathEpicsTable } from './CriticalPathEpicsTable';

const makeRows = (count: number): CriticalPathEpicRow[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `EPIC-${i}`,
    summary: `Epic ${i}`,
    url: `https://example.test/EPIC-${i}`,
    teamName: 'ORDER',
    daysAdded: (count - i) / 2,
    onPathIndex: (count - i) / count,
  }));

function renderTable(overrides: Partial<React.ComponentProps<typeof CriticalPathEpicsTable>> = {}) {
  const onSelectEpic = vi.fn();
  render(
    <CriticalPathEpicsTable
      rows={overrides.rows ?? makeRows(16)}
      routes={[]}
      selection={null}
      onSelectEpic={onSelectEpic}
      disabled={false}
      {...overrides}
    />,
  );
  return { onSelectEpic };
}

const epicRows = () => screen.getAllByRole('button').filter((button) => button.dataset.epicRow !== undefined);

describe('CriticalPathEpicsTable', () => {
  it('shows ten epics and folds the rest into a residual row', () => {
    renderTable();
    expect(epicRows()).toHaveLength(10);
    expect(screen.getByRole('button', { name: /6 other epics/ })).toBeInTheDocument();
  });

  it('omits the residual row when everything fits', () => {
    renderTable({ rows: makeRows(10) });
    expect(epicRows()).toHaveLength(10);
    expect(screen.queryByText(/other epics/)).not.toBeInTheDocument();
  });

  it('sums the days added of the folded tail', () => {
    // makeRows(16) gives the last six 3, 2.5, 2, 1.5, 1 and 0.5 days.
    renderTable();
    expect(screen.getByRole('button', { name: /6 other epics/ })).toHaveTextContent('10.5');
  });

  it('disables row selection while the simulation is still running, and does not call onSelectEpic', async () => {
    const { onSelectEpic } = renderTable({ disabled: true });
    expect(epicRows().every((row) => row.hasAttribute('disabled'))).toBe(true);

    await userEvent.click(epicRows()[0]);
    expect(onSelectEpic).not.toHaveBeenCalled();
  });

  it('re-enables row selection once the simulation completes', () => {
    renderTable({ disabled: false });
    expect(epicRows().every((row) => row.hasAttribute('disabled'))).toBe(false);
  });

  it('expands and collapses the residual in place', async () => {
    renderTable();
    await userEvent.click(screen.getByRole('button', { name: /6 other epics/ }));
    expect(epicRows()).toHaveLength(16);
    await userEvent.click(screen.getByRole('button', { name: /6 other epics/ }));
    expect(epicRows()).toHaveLength(10);
  });

  it('does not restate the floor as a total footer', () => {
    renderTable();
    expect(screen.queryByText(/critical path length/i)).not.toBeInTheDocument();
  });

  it('explains the floor in a tooltip instead of a caption', () => {
    renderTable();
    expect(screen.queryByText('Days each epic adds to the dependency floor')).not.toBeInTheDocument();
    expect(screen.getByLabelText('About epics on the critical path')).toBeInTheDocument();
  });

  it('emits the epic key when a row is clicked', async () => {
    const { onSelectEpic } = renderTable();
    await userEvent.click(epicRows()[0]);
    expect(onSelectEpic).toHaveBeenCalledWith('EPIC-0');
  });

  it('lights the selected epic and dims no other, because this is a ranking', () => {
    renderTable({ selection: { kind: 'epic', key: 'EPIC-3' } });
    const rows = epicRows();
    expect(rows[3]).toHaveAttribute('data-lit');
    for (const row of rows) expect(row).not.toHaveClass('opacity-40');
  });

  it('dims the epics that are not on the selected route', () => {
    const routes: PathFrequency[] = [{ keys: ['EPIC-1', 'EPIC-2'], count: 10 }];
    renderTable({ routes, selection: { kind: 'route', id: routeId(routes[0].keys) } });
    const rows = epicRows();
    expect(rows[1]).not.toHaveClass('opacity-40');
    expect(rows[2]).not.toHaveClass('opacity-40');
    expect(rows[0]).toHaveClass('opacity-40');
  });

  it('dims nothing when there is no selection', () => {
    renderTable();
    for (const row of epicRows()) expect(row).not.toHaveClass('opacity-40');
  });
});

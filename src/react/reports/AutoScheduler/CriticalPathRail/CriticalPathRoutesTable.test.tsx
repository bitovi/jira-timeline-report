import type { PathFrequency } from '../scheduler/critical-path-accumulator';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { routeId } from './criticalPathSelection';
import { CriticalPathRoutesTable } from './CriticalPathRoutesTable';

const makeRoutes = (count: number): PathFrequency[] =>
  Array.from({ length: count }, (_, i) => ({ keys: [`EPIC-${i}`, `EPIC-${i}-b`], count: 10 - i }));

function renderTable(overrides: Partial<React.ComponentProps<typeof CriticalPathRoutesTable>> = {}) {
  const onSelectRoute = vi.fn();
  const routes = overrides.routes ?? makeRoutes(9);
  render(
    <CriticalPathRoutesTable
      routes={routes}
      iterations={100}
      labelFor={(keys) => keys.join(' → ')}
      selection={null}
      onSelectRoute={onSelectRoute}
      disabled={false}
      {...overrides}
    />,
  );
  return { onSelectRoute, routes };
}

const routeRows = () => screen.getAllByRole('button').filter((button) => button.dataset.routeRow !== undefined);

describe('CriticalPathRoutesTable', () => {
  it('shows five routes and folds the rest into a residual row', () => {
    renderTable();
    expect(routeRows()).toHaveLength(5);
    expect(screen.getByRole('button', { name: /4 other routes/ })).toBeInTheDocument();
  });

  it('omits the residual row when everything fits', () => {
    renderTable({ routes: makeRoutes(5) });
    expect(routeRows()).toHaveLength(5);
    expect(screen.queryByText(/other routes/)).not.toBeInTheDocument();
  });

  it('disables row selection while the simulation is still running, and does not call onSelectRoute', async () => {
    const { onSelectRoute } = renderTable({ disabled: true });
    expect(routeRows().every((row) => row.hasAttribute('disabled'))).toBe(true);

    await userEvent.click(routeRows()[0]);
    expect(onSelectRoute).not.toHaveBeenCalled();
  });

  it('re-enables row selection once the simulation completes', () => {
    renderTable({ disabled: false });
    expect(routeRows().every((row) => row.hasAttribute('disabled'))).toBe(false);
  });

  it('expands and collapses the residual in place', async () => {
    renderTable();
    await userEvent.click(screen.getByRole('button', { name: /4 other routes/ }));
    expect(routeRows()).toHaveLength(9);
    await userEvent.click(screen.getByRole('button', { name: /4 other routes/ }));
    expect(routeRows()).toHaveLength(5);
  });

  it('states the share of every iteration, not of the rows shown', () => {
    renderTable({ routes: [{ keys: ['A'], count: 41 }], iterations: 10_000 });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('explains the chains in a tooltip instead of a caption', () => {
    renderTable();
    expect(screen.queryByText(/How often each chain was the longest one/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('About most common critical paths')).toBeInTheDocument();
  });

  it('emits the joined route id when a row is clicked', async () => {
    const { onSelectRoute, routes } = renderTable();
    await userEvent.click(routeRows()[0]);
    expect(onSelectRoute).toHaveBeenCalledWith(routeId(routes[0].keys));
  });

  it('lights the selected route and dims the others', () => {
    const routes = makeRoutes(9);
    renderTable({ routes, selection: { kind: 'route', id: routeId(routes[1].keys) } });
    const rows = routeRows();
    expect(rows[1]).not.toHaveClass('opacity-40');
    expect(rows[0]).toHaveClass('opacity-40');
  });

  it('lights every route containing the selected epic', () => {
    const routes: PathFrequency[] = [
      { keys: ['STORE-17', 'ORDER-23'], count: 65 },
      { keys: ['STORE-17', 'MARKETING-5'], count: 16 },
      { keys: ['MARKETING-6'], count: 3 },
    ];
    renderTable({ routes, selection: { kind: 'epic', key: 'STORE-17' } });
    const rows = routeRows();
    expect(rows[0]).not.toHaveClass('opacity-40');
    expect(rows[1]).not.toHaveClass('opacity-40');
    expect(rows[2]).toHaveClass('opacity-40');
  });

  it('dims nothing when there is no selection', () => {
    renderTable();
    for (const row of routeRows()) expect(row).not.toHaveClass('opacity-40');
  });
});

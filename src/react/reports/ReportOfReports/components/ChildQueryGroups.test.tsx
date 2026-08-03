import type { Reports } from '../../../../jira/reports';

import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChildQueryGroupsProvider, useChildFieldsOverride } from './ChildQueryGroups';
import { savedReportNode } from '../model/sections';

const ORDER_JQL = 'project = ORDER';

const params = (entries: Record<string, string>) => new URLSearchParams(entries).toString();

const TABLE_PARAMS = params({
  jql: ORDER_JQL,
  primaryReportType: 'table',
  tableColumns: JSON.stringify([{ sourceId: 'field:customfield_1' }]),
});

const GANTT_PARAMS = params({ jql: ORDER_JQL, primaryReportType: 'start-due' });

const reports: Reports = {
  table: { id: 'table', name: 'Table', queryParams: TABLE_PARAMS },
  gantt: { id: 'gantt', name: 'Gantt', queryParams: GANTT_PARAMS },
};

const sections = [savedReportNode('table'), savedReportNode('gantt')];

/** Every value `useChildFieldsOverride` handed back, so identity across renders is inspectable. */
let seen: Array<string[] | null> = [];

const Consumer = ({ queryParams }: { queryParams: string }) => {
  const override = useChildFieldsOverride(queryParams);

  seen.push(override);

  return <span data-testid="override">{override ? override.join(',') : 'none'}</span>;
};

/**
 * Stands in for `Document`, which holds the hover state AND renders the provider inline — so an
 * unrelated state change re-renders the provider itself, not just an ancestor of it. `sections` and
 * `reports` are module constants here for the same reason they're stable in production: they come
 * from `useReportLayout` / `useAllReports`, which a hover doesn't touch.
 */
const Harness = () => {
  const [, setTick] = useState(0);

  return (
    <>
      <button onClick={() => setTick((tick) => tick + 1)}>re-render</button>
      <ChildQueryGroupsProvider sections={sections} reports={reports}>
        <Consumer queryParams={GANTT_PARAMS} />
      </ChildQueryGroupsProvider>
    </>
  );
};

describe('useChildFieldsOverride', () => {
  beforeEach(() => {
    seen = [];
  });

  it('gives a grouped report the union of its group', () => {
    render(
      <ChildQueryGroupsProvider sections={sections} reports={reports}>
        <Consumer queryParams={GANTT_PARAMS} />
      </ChildQueryGroupsProvider>,
    );

    expect(screen.getByTestId('override')).toHaveTextContent('customfield_1');
  });

  it('gives an ungrouped report nothing, so it behaves exactly as before', () => {
    render(
      <ChildQueryGroupsProvider sections={[savedReportNode('gantt')]} reports={reports}>
        <Consumer queryParams={GANTT_PARAMS} />
      </ChildQueryGroupsProvider>,
    );

    expect(screen.getByTestId('override')).toHaveTextContent('none');
  });

  it('returns the empty roster with no provider above it', () => {
    render(<Consumer queryParams={GANTT_PARAMS} />);

    expect(screen.getByTestId('override')).toHaveTextContent('none');
  });

  /**
   * The memoization trap, and the reason this hook exists rather than a plain call.
   *
   * `ChildReport` feeds this array into the `useMemo` that builds its `ChildReportConfig`. A fresh
   * array per render would rebuild the config — and with it `rawIssuesRequestData` and the child's
   * whole fetch — on every render, and a document re-renders on every hover change. That would turn
   * a change about *reducing* requests into an unbounded request loop, which the cache would then
   * partly absorb and hide. Identity is load-bearing, so it is asserted rather than assumed.
   */
  it('returns a referentially stable array across unrelated re-renders', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 're-render' }));
    await userEvent.click(screen.getByRole('button', { name: 're-render' }));

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});

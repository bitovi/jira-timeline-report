import React from 'react';
import { render, screen } from '@testing-library/react';

import { computeSteps, type StepView } from './LoadingProgress';
import { LoadingProgressContainer } from './LoadingProgressContainer';

const byKey = (steps: StepView[]) => Object.fromEntries(steps.map((s) => [s.key, s])) as Record<string, StepView>;

describe('computeSteps (step-state logic)', () => {
  it('shows only primary + history while loading primary (children hidden until seen)', () => {
    const steps = computeSteps({ status: 'pending', phase: 'primary', issuesRequested: 342, issuesReceived: 120 });
    expect(steps.map((s) => s.key)).toEqual(['primary', 'history']);

    const { primary, history } = byKey(steps);
    expect(primary.status).toBe('active');
    expect(primary.detail).toBe('120 of 342');
    expect(primary.barValue).toBeCloseTo((120 / 342) * 100, 1);
    // history is pending until a changelog total is known; its bar is an empty gray track until
    // changelog fetching starts.
    expect(history.status).toBe('pending');
    expect(history.barValue).toBe(0);
  });

  it('shows an empty primary bar while the scope is still being estimated', () => {
    const { primary } = byKey(computeSteps({ status: 'pending', phase: 'primary' }));
    expect(primary.status).toBe('active');
    expect(primary.detail).toBe('estimating scope…');
    expect(primary.barValue).toBe(0);
  });

  it('marks primary done and shows children scoped to just the children once discovery starts', () => {
    const steps = computeSteps({
      status: 'pending',
      phase: 'children',
      primaryRequested: 342,
      primaryReceived: 342,
      issuesRequested: 822,
      issuesReceived: 474,
      changeLogsRequested: 660,
      changeLogsReceived: 512,
    });
    expect(steps.map((s) => s.key)).toEqual(['primary', 'children', 'history']);

    const { primary, children, history } = byKey(steps);
    expect(primary.status).toBe('done');
    expect(primary.detail).toBe('342 work items');

    // Child counts subtract the primary snapshot: 474-342 = 132 of 822-342 = 480.
    expect(children.status).toBe('active');
    expect(children.detail).toBe('132 of ~480 found');
    expect(children.barValue).toBeCloseTo((132 / 480) * 100, 1);

    expect(history.status).toBe('active');
    expect(history.detail).toBe('512 of 660');
  });

  it('clamps child counts so a slightly-high snapshot never produces a negative (backward) count', () => {
    const { children } = byKey(
      computeSteps({
        status: 'pending',
        phase: 'children',
        primaryRequested: 400,
        primaryReceived: 400,
        issuesRequested: 350,
        issuesReceived: 342,
      }),
    );
    expect(children.detail).toBe('0 of ~0 found');
    expect(children.barValue).toBe(0);
  });

  it('checks every step off when resolved with children', () => {
    const steps = computeSteps({
      status: 'resolved',
      phase: 'children',
      primaryRequested: 342,
      primaryReceived: 342,
      issuesRequested: 1282,
      issuesReceived: 1282,
      changeLogsRequested: 1282,
      changeLogsReceived: 1282,
    });
    expect(steps.map((s) => s.key)).toEqual(['primary', 'children', 'history']);
    expect(steps.every((s) => s.status === 'done')).toBe(true);
    // Done steps keep a full bar (rendered green) so row height doesn't shift on completion.
    expect(steps.every((s) => s.barValue === 100)).toBe(true);

    const { children, history } = byKey(steps);
    expect(children.detail).toBe('940 children');
    expect(history.detail).toBe('1,282 histories');
  });

  it('shows two done steps when resolved on the no-children path', () => {
    const steps = computeSteps({
      status: 'resolved',
      issuesRequested: 342,
      issuesReceived: 342,
      changeLogsRequested: 342,
      changeLogsReceived: 342,
    });
    expect(steps.map((s) => s.key)).toEqual(['primary', 'history']);
    expect(byKey(steps).primary.detail).toBe('342 work items');
    expect(steps.every((s) => s.status === 'done')).toBe(true);
  });

  it('shows "waiting…" for history before any changelog has been requested', () => {
    const { history } = byKey(
      computeSteps({ status: 'pending', phase: 'primary', issuesRequested: 342, issuesReceived: 10 }),
    );
    expect(history.detail).toBe('waiting…');
  });

  it('uses the container projection for the children bar + detail when provided', () => {
    const { children } = byKey(
      computeSteps({
        status: 'pending',
        phase: 'children',
        primaryRequested: 342,
        primaryReceived: 342,
        issuesRequested: 822, // childReq = 480 discovered — should be ignored in favor of the projection
        issuesReceived: 474, // childRec = 132
        childrenBarValue: 42,
        childrenProjectedTotal: 600,
      }),
    );
    expect(children.barValue).toBe(42);
    expect(children.detail).toBe('132 of ~600');
  });
});

describe('<LoadingProgressContainer> primary snapshot', () => {
  it('snapshots the primary totals at the primary→children transition and never rewinds them', () => {
    const { rerender } = render(
      <LoadingProgressContainer
        loadingState={{
          status: 'pending',
          phase: 'primary',
          issuesRequested: 342,
          issuesReceived: 342,
          changeLogsRequested: 342,
          changeLogsReceived: 342,
        }}
      />,
    );

    // Transition: parents are fully loaded, no child counts added yet — snapshot = 342 / 342.
    rerender(
      <LoadingProgressContainer
        loadingState={{
          status: 'pending',
          phase: 'children',
          issuesRequested: 342,
          issuesReceived: 342,
          changeLogsRequested: 342,
          changeLogsReceived: 342,
        }}
      />,
    );

    // Discovery grows the global totals; the primary step stays fixed and children counts derive from the snapshot.
    rerender(
      <LoadingProgressContainer
        loadingState={{
          status: 'pending',
          phase: 'children',
          issuesRequested: 822,
          issuesReceived: 474,
          changeLogsRequested: 660,
          changeLogsReceived: 512,
        }}
      />,
    );

    expect(screen.getByText('342 work items')).toBeInTheDocument();
    expect(screen.getByText('132 of ~480 found')).toBeInTheDocument();
  });

  it('smooths the children bar with a running-average projection (your example) and never rewinds', () => {
    const base = { status: 'pending' as const, changeLogsRequested: 0, changeLogsReceived: 0 };
    const childBarWidth = () => {
      const li = screen.getByText('Loading children').closest('li') as HTMLElement;
      return (li.querySelector('div[style*="width"]') as HTMLElement)?.style.width;
    };

    // Primary done (20 top-level parents), then enter the children phase (snapshot primary = 20/20).
    const { rerender } = render(
      <LoadingProgressContainer
        loadingState={{ ...base, phase: 'primary', issuesRequested: 20, issuesReceived: 20 }}
      />,
    );
    rerender(
      <LoadingProgressContainer
        loadingState={{
          ...base,
          phase: 'children',
          parentsToProcess: 20,
          parentsProcessed: 0,
          issuesRequested: 20,
          issuesReceived: 20,
        }}
      />,
    );

    // First parent's subtree finishes: 20 children received for 1 parent ⇒ project 20 × 20 = 400.
    rerender(
      <LoadingProgressContainer
        loadingState={{
          ...base,
          phase: 'children',
          parentsToProcess: 20,
          parentsProcessed: 1,
          issuesRequested: 40,
          issuesReceived: 40,
        }}
      />,
    );
    expect(screen.getByText('20 of ~400')).toBeInTheDocument();
    expect(childBarWidth()).toBe('5%'); // 20 / 400

    // More children stream in before the next completion (childRec 20 → 80); bar rises, projection held.
    rerender(
      <LoadingProgressContainer
        loadingState={{
          ...base,
          phase: 'children',
          parentsToProcess: 20,
          parentsProcessed: 1,
          issuesRequested: 100,
          issuesReceived: 100,
        }}
      />,
    );
    expect(childBarWidth()).toBe('20%'); // 80 / 400

    // Second completion re-projects UP (20 × 80/2 = 800) ⇒ raw would drop to 10%, but the bar holds at 20%.
    rerender(
      <LoadingProgressContainer
        loadingState={{
          ...base,
          phase: 'children',
          parentsToProcess: 20,
          parentsProcessed: 2,
          issuesRequested: 100,
          issuesReceived: 100,
        }}
      />,
    );
    expect(screen.getByText('80 of ~800')).toBeInTheDocument();
    expect(childBarWidth()).toBe('20%'); // monotonic — never rewinds
  });
});

import React, { Suspense } from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease } from './types';
import { spacedIssues, collidingIssues, mixedMissingDueIssues, makeIssue } from './fixtures';

// Mock the measurement hook so jsdom's width-0 doesn't collapse the layout. Inject a fixed
// width per label so positioning/packing is deterministic.
vi.mock('./hooks/useMeasuredTextWidths', () => ({
  useMeasuredTextWidths: (config: { texts: string[] }) => ({
    widthsByText: new Map(config.texts.map((t) => [t, 120])),
    isMeasured: true,
  }),
}));

import { ScatterTimeline } from './ScatterTimeline';

/** Minimal stub matching the CanObservable surface the hook reads. */
const obs = <T,>(value: T): CanObservable<T> => {
  let current = value;
  const handlers = new Set<() => void>();
  return {
    value: current,
    getData: () => current,
    get: () => current,
    set: (v: T) => {
      current = v;
      handlers.forEach((h) => h());
    },
    on: (h: () => void) => handlers.add(h),
    off: (h: () => void) => handlers.delete(h),
  } as unknown as CanObservable<T>;
};

const renderScatter = (issues: IssueOrRelease[], roundTo = 'day') =>
  render(
    <Suspense fallback="loading">
      <ScatterTimeline
        primaryIssuesOrReleasesObs={obs(issues)}
        allIssuesOrReleasesObs={obs(issues)}
        roundToObs={obs(roundTo)}
      />
    </Suspense>,
  );

beforeEach(() => {
  // Stub a non-zero container width for deterministic layout.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1230 });
});

afterEach(() => {
  cleanup();
});

describe('ScatterTimeline', () => {
  test('renders quarter and month headers', () => {
    renderScatter(spacedIssues);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
  });

  test('renders a today line', () => {
    renderScatter(spacedIssues);
    expect(screen.getByTestId('today-line')).toBeInTheDocument();
  });

  test('renders a marker for each issue with a due date', () => {
    renderScatter(spacedIssues);
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Beta release')).toBeInTheDocument();
  });

  test('omits issues without a rollup due date', () => {
    renderScatter(mixedMissingDueIssues);
    expect(screen.getByText('Has a due date')).toBeInTheDocument();
    expect(screen.getByText('Also has a due date')).toBeInTheDocument();
    expect(screen.queryByText('No due date')).not.toBeInTheDocument();
  });

  test('applies status color classes to markers', () => {
    renderScatter(spacedIssues);
    const markers = screen.getAllByTestId('status-marker');
    const classes = markers.map((m) => m.className).join(' ');
    expect(classes).toContain('color-text-and-bg-complete');
    expect(classes).toContain('color-text-and-bg-ontrack');
    expect(classes).toContain('color-text-and-bg-behind');
  });

  test('packs colliding issues into multiple rows (still renders all markers)', () => {
    renderScatter(collidingIssues);
    expect(screen.getByText('Payments milestone alpha')).toBeInTheDocument();
    expect(screen.getByText('Payments milestone beta')).toBeInTheDocument();
    expect(screen.getByText('Payments milestone gamma')).toBeInTheDocument();
  });

  test('renders an empty grid (headers + today line only) with no issues', () => {
    renderScatter([]);
    expect(screen.getByTestId('today-line')).toBeInTheDocument();
    expect(screen.queryAllByTestId('status-marker')).toHaveLength(0);
  });

  test('applies density optimizations for > 20 issues (smaller markers)', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      makeIssue({ key: `D-${i}`, summary: `Dense ${i}`, due: new Date(2025, 1, (i % 27) + 1) }),
    );
    renderScatter(many);
    const marker = screen.getAllByTestId('status-marker')[0];
    // radius 6 → diameter 12px when dense (vs 16px normally).
    expect(marker.style.width).toBe('12px');
  });
});

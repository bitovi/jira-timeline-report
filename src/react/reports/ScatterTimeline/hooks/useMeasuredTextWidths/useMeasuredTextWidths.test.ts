import { describe, test, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { measureTextWidths } from './measureTextWidths';
import { useMeasuredTextWidths } from './useMeasuredTextWidths';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('measureTextWidths', () => {
  test('returns a width entry for every unique text (+3px margin)', () => {
    const widths = measureTextWidths({ texts: ['Alpha', 'Beta'], isLotsOfIssues: false });
    expect(widths.has('Alpha')).toBe(true);
    expect(widths.has('Beta')).toBe(true);
    // jsdom reports 0 for getBoundingClientRect().width, so measured = 0 + 3.
    expect(widths.get('Alpha')).toBe(3);
  });

  test('de-duplicates repeated texts', () => {
    const widths = measureTextWidths({ texts: ['Same', 'Same', 'Same'], isLotsOfIssues: false });
    expect(widths.size).toBe(1);
  });

  test('handles empty text list', () => {
    const widths = measureTextWidths({ texts: [], isLotsOfIssues: false });
    expect(widths.size).toBe(0);
  });

  test('batches writes then reads: single container attach/detach (one reflow)', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    measureTextWidths({ texts: ['A', 'B', 'C', 'D'], isLotsOfIssues: false });

    // Exactly one container is attached to and removed from the body, regardless of count.
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  test('cleans up the off-screen container after measuring', () => {
    const before = document.body.childNodes.length;
    measureTextWidths({ texts: ['X', 'Y'], isLotsOfIssues: true });
    expect(document.body.childNodes.length).toBe(before);
  });
});

describe('useMeasuredTextWidths', () => {
  test('reports isMeasured=true after layout effect and returns measured widths', () => {
    const { result } = renderHook(() => useMeasuredTextWidths({ texts: ['One', 'Two'], isLotsOfIssues: false }));
    expect(result.current.isMeasured).toBe(true);
    expect(result.current.widthsByText.get('One')).toBe(3);
  });

  test('does not re-measure when config is unchanged (stable cache key)', () => {
    const spy = vi.spyOn(document.body, 'appendChild');
    const { rerender } = renderHook((props) => useMeasuredTextWidths(props), {
      initialProps: { texts: ['A', 'B'], isLotsOfIssues: false },
    });
    const callsAfterFirst = spy.mock.calls.length;
    // Re-render with an equivalent (but new-reference) config.
    rerender({ texts: ['A', 'B'], isLotsOfIssues: false });
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });

  test('re-measures when texts change', () => {
    const spy = vi.spyOn(document.body, 'appendChild');
    const { rerender } = renderHook((props) => useMeasuredTextWidths(props), {
      initialProps: { texts: ['A'], isLotsOfIssues: false },
    });
    const callsAfterFirst = spy.mock.calls.length;
    rerender({ texts: ['A', 'C'], isLotsOfIssues: false });
    expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  test('re-measures when density (isLotsOfIssues) changes', () => {
    const spy = vi.spyOn(document.body, 'appendChild');
    const { rerender } = renderHook((props) => useMeasuredTextWidths(props), {
      initialProps: { texts: ['A'], isLotsOfIssues: false },
    });
    const callsAfterFirst = spy.mock.calls.length;
    rerender({ texts: ['A'], isLotsOfIssues: true });
    expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});

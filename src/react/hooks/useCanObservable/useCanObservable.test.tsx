import type { CanObservable } from './useCanObservable';

import React from 'react';
import { render, screen, act } from '@testing-library/react';

import { useCanObservable } from './useCanObservable';

/**
 * A test double for the one CanJS behaviour this hook has to survive: a lazy observable holds no
 * value until something binds to it, and binding *materializes* the current value without
 * announcing it — there is no change event, because from the observable's point of view nothing
 * changed. `on` here stands in for that moment.
 */
const lazyObservable = (unbound: string, onBind: string) => {
  const handlers = new Set<() => void>();
  let current = unbound;

  return {
    get value() {
      return current;
    },
    on(handler: () => void) {
      handlers.add(handler);
      current = onBind;
    },
    off(handler: () => void) {
      handlers.delete(handler);
    },
    publish(next: string) {
      current = next;
      handlers.forEach((handler) => handler());
    },
  } as unknown as CanObservable<string> & { publish: (next: string) => void };
};

const Probe = ({ observable }: { observable: CanObservable<string> }) => (
  <span data-testid="value">{useCanObservable(observable)}</span>
);

describe('useCanObservable', () => {
  it('renders the observable’s value', () => {
    const observable = lazyObservable('only', 'only');

    render(<Probe observable={observable} />);

    expect(screen.getByTestId('value')).toHaveTextContent('only');
  });

  it('re-renders when the observable publishes', () => {
    const observable = lazyObservable('first', 'first');

    render(<Probe observable={observable} />);

    act(() => observable.publish('second'));

    expect(screen.getByTestId('value')).toHaveTextContent('second');
  });

  /**
   * The value is read while rendering but the subscription is made in an effect, so there is a gap
   * between the two. Anything that lands in the gap arrives with nobody listening, and a lazy
   * observable will not re-announce it — so the hook has to re-read once it is subscribed, or it
   * keeps the render-time value forever.
   *
   * This is not hypothetical: the gap is normally microseconds, but a report that suspends
   * (`TableReport` calls `useJiraIssueFields`, a `useSuspenseQuery`, AFTER reading its issue
   * observables) has its render thrown away and its effects skipped, stretching the gap across the
   * whole fetch. Its issues landed in that gap and the table rendered headers over an empty body.
   * See `ChildReport.test.tsx`.
   */
  it('re-reads after subscribing, so a value that landed before the subscription is not lost', () => {
    const observable = lazyObservable('render-time', 'landed-before-subscribe');

    render(<Probe observable={observable} />);

    expect(screen.getByTestId('value')).toHaveTextContent('landed-before-subscribe');
  });

  it('re-subscribes when handed a different observable', () => {
    const first = lazyObservable('first', 'first');
    const second = lazyObservable('second', 'second');

    const { rerender } = render(<Probe observable={first} />);
    rerender(<Probe observable={second} />);

    expect(screen.getByTestId('value')).toHaveTextContent('second');

    act(() => second.publish('second updated'));

    expect(screen.getByTestId('value')).toHaveTextContent('second updated');
  });
});

import type { NormalizeIssueConfig } from '../../../../jira/normalized/normalize';

import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CapacityOverridesProvider, useCapacityOverrides } from '../../../services/capacity-overrides';
import { CapacityOverrideApplier, CAPACITY_OVERRIDE_DEBOUNCE_MS } from './CapacityOverrideApplier';

const savedBase = { getVelocity: () => 8, getParallelWorkLimit: () => 4 } as Partial<NormalizeIssueConfig>;
const resolvedBase = { getVelocity: () => 13, getParallelWorkLimit: () => 1 } as Partial<NormalizeIssueConfig>;

const issue = {} as never;
const config = { getTeamKey: () => 'ORDER' } as never;

let written: Array<Partial<NormalizeIssueConfig>> = [];
const writeNormalizeOptions = (next: Partial<NormalizeIssueConfig>) => {
  written.push(next);
};

/** Stands in for the shell: owns the base ref, and replaces it the way a team-settings save does. */
const Harness = () => {
  const baseRef = useRef<Partial<NormalizeIssueConfig> | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);
  const { setTeamOverride } = useCapacityOverrides();

  return (
    <>
      <CapacityOverrideApplier
        baseRef={baseRef}
        baseVersion={baseVersion}
        readNormalizeOptions={() => resolvedBase}
        writeNormalizeOptions={writeNormalizeOptions}
      />
      <button onClick={() => setTeamOverride('ORDER', { velocityPerSprint: 35 })}>override</button>
      <button
        onClick={() => {
          baseRef.current = savedBase;
          setBaseVersion((version) => version + 1);
        }}
      >
        save settings
      </button>
    </>
  );
};

const renderApplier = () =>
  render(
    <CapacityOverridesProvider>
      <Harness />
    </CapacityOverridesProvider>,
  );

const settle = () => act(() => void vi.advanceTimersByTime(CAPACITY_OVERRIDE_DEBOUNCE_MS));

const click = (name: string) => act(() => void fireEvent.click(screen.getByText(name)));

beforeEach(() => {
  written = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CapacityOverrideApplier', () => {
  it('writes nothing while there is no override and no base has been captured', () => {
    renderApplier();
    settle();

    expect(written).toHaveLength(0);
  });

  it('wraps the resolved config once an override lands', () => {
    renderApplier();
    click('override');
    settle();

    expect(written).toHaveLength(1);
    expect(written[0].getVelocity?.(issue, config)).toBe(35);
    expect(written[0].getParallelWorkLimit?.(issue, config)).toBe(1);
  });

  it('coalesces a burst of overrides into a single re-derive', () => {
    renderApplier();
    click('override');
    click('override');
    settle();

    expect(written).toHaveLength(1);
  });

  it('re-wraps a live override onto a base the shell has replaced', () => {
    renderApplier();
    click('override');
    settle();

    click('save settings');
    settle();

    expect(written).toHaveLength(2);
    expect(written[1].getVelocity?.(issue, config)).toBe(35);
    expect(written[1].getParallelWorkLimit?.(issue, config)).toBe(4);
  });
});

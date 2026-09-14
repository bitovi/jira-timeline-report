import { describe, it, expect } from 'vitest';
import { findLongestPath, type PathIssue } from './longest-path';

function makeIssue(key: string, daysOfWork: number): PathIssue {
  return { key, mutableWorkItem: { daysOfWork }, linkedBlocks: [] };
}

/** `blocker` blocks `blocked`. */
function block(blocker: PathIssue, blocked: PathIssue): void {
  blocker.linkedBlocks.push(blocked);
}

describe('findLongestPath', () => {
  it('returns an empty path for no issues', () => {
    expect(findLongestPath([])).toEqual({ keys: [], days: [], totalDays: 0 });
  });

  it('returns the single issue when nothing is linked', () => {
    const a = makeIssue('A', 7);
    expect(findLongestPath([a])).toEqual({ keys: ['A'], days: [7], totalDays: 7 });
  });

  it('picks the longest branch of a diamond', () => {
    // S blocks M1 and M2; both block E. S=10, M1=22, M2=18, E=10.
    const s = makeIssue('S', 10);
    const m1 = makeIssue('M1', 22);
    const m2 = makeIssue('M2', 18);
    const e = makeIssue('E', 10);
    block(s, m1);
    block(s, m2);
    block(m1, e);
    block(m2, e);

    const path = findLongestPath([s, m1, m2, e]);

    expect(path.keys).toEqual(['S', 'M1', 'E']);
    expect(path.days).toEqual([10, 22, 10]);
    expect(path.totalDays).toBe(42);
  });

  it('picks the longest of several disconnected components', () => {
    const a = makeIssue('A', 5);
    const b = makeIssue('B', 5);
    block(a, b); // total 10
    const c = makeIssue('C', 20);
    const d = makeIssue('D', 22);
    block(c, d); // total 42

    const path = findLongestPath([a, b, c, d]);

    expect(path.keys).toEqual(['C', 'D']);
    expect(path.totalDays).toBe(42);
  });

  it('breaks ties between equal branches by issue key so the result does not jitter', () => {
    const s = makeIssue('S', 1);
    const z = makeIssue('Z', 5);
    const a = makeIssue('A', 5);
    block(s, z);
    block(s, a);

    expect(findLongestPath([s, z, a]).keys).toEqual(['S', 'A']);
  });

  it('terminates on a cycle instead of recursing forever', () => {
    const a = makeIssue('A', 3);
    const b = makeIssue('B', 4);
    block(a, b);
    block(b, a); // data error: A blocks B blocks A

    const path = findLongestPath([a, b]);

    expect(path.totalDays).toBeGreaterThan(0);
    expect(new Set(path.keys).size).toBe(path.keys.length); // no key repeats
  });

  it('always reports days that sum to totalDays', () => {
    const a = makeIssue('A', 4.5);
    const b = makeIssue('B', 2.25);
    const c = makeIssue('C', 1.5);
    block(a, b);
    block(b, c);

    const path = findLongestPath([a, b, c]);

    expect(path.days.reduce((sum, d) => sum + d, 0)).toBeCloseTo(path.totalDays, 10);
  });

  it('does not hand back a shared empty path object', () => {
    const first = findLongestPath([]);
    first.keys.push('MUTATED');

    expect(findLongestPath([])).toEqual({ keys: [], days: [], totalDays: 0 });
  });

  // This is why the longest path is recomputed on every Monte Carlo iteration instead of once.
  // See the A/B fixture in spec/024-critical-path/dependency-floor.md section 6.
  it('lets the shorter deterministic branch win once durations are sampled', () => {
    // A: 10 -> [9, 9, 9 in parallel] -> 10, deterministic total 29.
    // B: 10 -> 10 -> 10,               deterministic total 30.
    function buildPlan(sample: (mean: number) => number) {
      const a1 = makeIssue('A1', sample(10));
      const a2 = makeIssue('A2', sample(9));
      const a3 = makeIssue('A3', sample(9));
      const a4 = makeIssue('A4', sample(9));
      const a5 = makeIssue('A5', sample(10));
      for (const parallel of [a2, a3, a4]) {
        block(a1, parallel);
        block(parallel, a5);
      }

      const b1 = makeIssue('B1', sample(10));
      const b2 = makeIssue('B2', sample(10));
      const b3 = makeIssue('B3', sample(10));
      block(b1, b2);
      block(b2, b3);

      return [a1, a2, a3, a4, a5, b1, b2, b3];
    }

    expect(findLongestPath(buildPlan((mean) => mean)).keys[0]).toBe('B1');

    // A deterministic LCG so the assertion below cannot flake. `Math.imul` keeps the multiply
    // inside 32 bits — plain `*` would exceed 2^53 and silently degrade the sequence.
    let seed = 1;
    const sample = (mean: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return mean * (0.5 + (seed / 4294967296) * 1.5); // 0.5x to 2x the mean
    };

    let aWins = 0;
    for (let run = 0; run < 500; run++) {
      if (findLongestPath(buildPlan(sample)).keys[0] === 'A1') aWins++;
    }

    // The exact rate does not matter; that A wins often at all is the whole point. Computing the
    // path once from the means would report B every time and hide branch A completely.
    expect(aWins).toBeGreaterThan(100);
  });
});

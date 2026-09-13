import { describe, it, expect } from 'vitest';
import { buildCriticalPathEpics, highlightKeysFor } from './build-critical-path-epics';
import type { StatsUIData } from '../scheduler/stats-analyzer';

function uiDataWith(
  results: Array<{ key: string; team: string; sequencingDaysAdded: number; sequencingCriticalityIndex: number }>,
): StatsUIData {
  return {
    simulationIssueResults: results.map((result) => ({
      linkedIssue: {
        key: result.key,
        summary: `Summary of ${result.key}`,
        url: `#${result.key}`,
        team: { name: result.team },
      },
      sequencingDaysAdded: result.sequencingDaysAdded,
      sequencingCriticalityIndex: result.sequencingCriticalityIndex,
    })),
    criticalPath: null,
  } as unknown as StatsUIData;
}

describe('buildCriticalPathEpics', () => {
  it('ranks epics by days added, not by how often they are on the path', () => {
    const uiData = uiDataWith([
      { key: 'CHECKOUT', team: 'Alpha', sequencingDaysAdded: 7.8, sequencingCriticalityIndex: 0.68 },
      { key: 'PAYMENTS', team: 'Beta', sequencingDaysAdded: 11.8, sequencingCriticalityIndex: 0.41 },
      { key: 'SEARCH', team: 'Gamma', sequencingDaysAdded: 6.0, sequencingCriticalityIndex: 0.26 },
    ]);

    expect(buildCriticalPathEpics(uiData).map((row) => row.key)).toEqual(['PAYMENTS', 'CHECKOUT', 'SEARCH']);
  });

  it('carries summary, url and team through to the row', () => {
    const uiData = uiDataWith([
      { key: 'PAYMENTS', team: 'Beta', sequencingDaysAdded: 11.8, sequencingCriticalityIndex: 0.41 },
    ]);

    expect(buildCriticalPathEpics(uiData)[0]).toEqual({
      key: 'PAYMENTS',
      summary: 'Summary of PAYMENTS',
      url: '#PAYMENTS',
      teamName: 'Beta',
      daysAdded: 11.8,
      onPathIndex: 0.41,
    });
  });

  it('keeps epics that never reach the critical path, ordered last', () => {
    const uiData = uiDataWith([
      { key: 'RATINGS', team: 'Gamma', sequencingDaysAdded: 0, sequencingCriticalityIndex: 0 },
      { key: 'PAYMENTS', team: 'Beta', sequencingDaysAdded: 11.8, sequencingCriticalityIndex: 0.41 },
    ]);

    expect(buildCriticalPathEpics(uiData).map((row) => row.key)).toEqual(['PAYMENTS', 'RATINGS']);
  });

  it('breaks ties on key so the order does not jitter between batches', () => {
    const uiData = uiDataWith([
      { key: 'ZULU', team: 'Alpha', sequencingDaysAdded: 5, sequencingCriticalityIndex: 0.5 },
      { key: 'ALPHA', team: 'Alpha', sequencingDaysAdded: 5, sequencingCriticalityIndex: 0.5 },
    ]);

    expect(buildCriticalPathEpics(uiData).map((row) => row.key)).toEqual(['ALPHA', 'ZULU']);
  });
});

describe('highlightKeysFor', () => {
  const paths = [
    { keys: ['IDENTITY', 'CHECKOUT', 'PAYMENTS'], count: 41 },
    { keys: ['SELLER', 'SEARCH'], count: 26 },
    { keys: ['IDENTITY', 'CHECKOUT', 'FRAUD'], count: 18 },
  ];

  it('returns every epic on every path containing the clicked epic', () => {
    expect(highlightKeysFor(paths, 'CHECKOUT')).toEqual(new Set(['IDENTITY', 'CHECKOUT', 'PAYMENTS', 'FRAUD']));
  });

  it('returns just the one path when the epic sits on only one', () => {
    expect(highlightKeysFor(paths, 'SEARCH')).toEqual(new Set(['SELLER', 'SEARCH']));
  });

  it('falls back to the epic alone when it is never on a critical path', () => {
    expect(highlightKeysFor(paths, 'RATINGS')).toEqual(new Set(['RATINGS']));
  });
});

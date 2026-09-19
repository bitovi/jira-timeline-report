import { describe, expect, it } from 'vitest';
import { highlightKeysForSelection, isEpicLit, isRouteLit, routeId } from './criticalPathSelection';

const routes = [
  { keys: ['STORE-17', 'STORE-18', 'ORDER-23'], count: 65 },
  { keys: ['STORE-17', 'MARKETING-5'], count: 16 },
  { keys: ['MARKETING-6'], count: 3 },
];

describe('criticalPathSelection', () => {
  it('lights nothing when there is no selection', () => {
    expect(isRouteLit(null, routes[0])).toBe(false);
    expect(isEpicLit(null, 'STORE-17', routes)).toBe(false);
    expect(highlightKeysForSelection(null, routes)).toBeNull();
  });

  it('lights every route containing the selected epic', () => {
    const selection = { kind: 'epic', key: 'STORE-17' } as const;
    expect(isRouteLit(selection, routes[0])).toBe(true);
    expect(isRouteLit(selection, routes[1])).toBe(true);
    expect(isRouteLit(selection, routes[2])).toBe(false);
  });

  it('lights every epic on the selected route', () => {
    const selection = { kind: 'route', id: routeId(routes[0].keys) } as const;
    expect(isEpicLit(selection, 'ORDER-23', routes)).toBe(true);
    expect(isEpicLit(selection, 'MARKETING-5', routes)).toBe(false);
  });

  it('highlights the whole chain for a route selection', () => {
    const selection = { kind: 'route', id: routeId(routes[1].keys) } as const;
    expect(highlightKeysForSelection(selection, routes)).toEqual(new Set(['STORE-17', 'MARKETING-5']));
  });

  it('highlights the union of every route through a selected epic', () => {
    const selection = { kind: 'epic', key: 'STORE-17' } as const;
    expect(highlightKeysForSelection(selection, routes)).toEqual(
      new Set(['STORE-17', 'STORE-18', 'ORDER-23', 'MARKETING-5']),
    );
  });

  it('falls back to the epic alone when it is on no route', () => {
    const selection = { kind: 'epic', key: 'NEVER-ON-A-PATH' } as const;
    expect(highlightKeysForSelection(selection, routes)).toEqual(new Set(['NEVER-ON-A-PATH']));
  });

  it('lights the selected epic itself, and dims no other epic', () => {
    const selection = { kind: 'epic', key: 'STORE-17' } as const;
    expect(isEpicLit(selection, 'STORE-17', routes)).toBe(true);
    expect(isEpicLit(selection, 'MARKETING-6', routes)).toBe(false);
  });

  it('lights no route when the selected route id matches nothing', () => {
    const selection = { kind: 'route', id: routeId(['GONE-1']) } as const;
    expect(isRouteLit(selection, routes[0])).toBe(false);
    expect(highlightKeysForSelection(selection, routes)).toBeNull();
  });
});

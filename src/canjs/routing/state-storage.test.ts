// @ts-expect-error — state-storage is untyped legacy JS on its way out with route-data.js (spec/011).
import { deleteUrlParam, pushStateObservable } from './state-storage';

/**
 * The once-armed keys `deleteUrlParam` borrows to amend a history entry instead of pushing one.
 * Read straight off the observable because leaving a key armed is the failure this file exists to
 * catch: the next change to it would become a `replaceState` too, costing the report-of-reports
 * document its back/forward history.
 */
const armedKeys = () => (pushStateObservable as unknown as { replaceStateOnceKeys: string[] }).replaceStateOnceKeys;

const search = () => window.location.search;

const setSearch = (value: string) => {
  window.history.replaceState({}, '', value || window.location.pathname);
};

describe('deleteUrlParam', () => {
  beforeEach(() => {
    setSearch('');
    armedKeys().length = 0;
  });

  it('removes the param and leaves the rest of the query alone', () => {
    setSearch('?report=doc&sections=%5B%5D&primaryReportType=start-due');

    deleteUrlParam('sections');

    expect(new URLSearchParams(search()).get('sections')).toBeNull();
    expect(new URLSearchParams(search()).get('report')).toBe('doc');
    expect(new URLSearchParams(search()).get('primaryReportType')).toBe('start-due');
  });

  it('removes the last param, leaving no stray "?"', () => {
    setSearch('?sections=%5B%5D');

    deleteUrlParam('sections');

    expect(search()).toBe('');
  });

  it('spends the replaceState arming it took out', () => {
    setSearch('?sections=%5B%5D');

    deleteUrlParam('sections');

    expect(armedKeys()).toEqual([]);
  });

  it('does nothing at all when the param is already gone', () => {
    setSearch('?report=doc');

    deleteUrlParam('sections');

    expect(search()).toBe('?report=doc');
    expect(armedKeys()).toEqual([]);
  });
});

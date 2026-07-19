import { renderHook, act, waitFor } from '@testing-library/react';

// @ts-ignore - can.js has loose types
import { ObservableObject, value } from '../../../can';
import { useReportLoadingState } from './useReportLoadingState';

// F2 (see spec/011-react-rewrite/testing/explore.md): the hook accepts an injectable `rd` store
// (default = routeData). Here we pass a hand-built fake whose shape mirrors
// `routeData.derivedIssuesRequestData` — `{ issuesPromise, progressData: value.with(...) }` — so this
// runs the REAL observation path (incl. the `.value` segment that regressed) against controlled data,
// with no backend. This is the test that would have caught the frozen-counter bug.
function makeFakeStore() {
  class Store extends (ObservableObject as any) {
    static props = { derivedIssuesRequestData: { default: null } };
  }
  const progressData = (value as any).with(null);
  let resolveFn: (v?: unknown) => void = () => {};
  let rejectFn: (r?: unknown) => void = () => {};
  const issuesPromise = new Promise((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  issuesPromise.catch(() => {}); // avoid unhandled-rejection noise in the reject test
  const rd: any = new Store();
  rd.derivedIssuesRequestData = { issuesPromise, progressData };
  return { rd, progressData, resolve: resolveFn, reject: rejectFn };
}

describe('useReportLoadingState', () => {
  it('goes pending, tracks the growing progress counter, then resolves', async () => {
    const { rd, progressData, resolve } = makeFakeStore();
    const { result } = renderHook(() => useReportLoadingState(rd));

    await waitFor(() => expect(result.current.status).toBe('pending'));

    act(() => {
      progressData.value = { issuesRequested: 10, issuesReceived: 3 };
    });
    expect(result.current.issuesRequested).toBe(10);
    expect(result.current.issuesReceived).toBe(3);

    // The total climbs as child issues are discovered mid-load.
    act(() => {
      progressData.value = { issuesRequested: 22, issuesReceived: 15 };
    });
    expect(result.current.issuesRequested).toBe(22);
    expect(result.current.issuesReceived).toBe(15);

    await act(async () => {
      resolve([]);
    });
    await waitFor(() => expect(result.current.status).toBe('resolved'));
  });

  it('surfaces the rejection reason', async () => {
    const { rd, reject } = makeFakeStore();
    const { result } = renderHook(() => useReportLoadingState(rd));

    await waitFor(() => expect(result.current.status).toBe('pending'));

    await act(async () => {
      reject({ type: 'no-licensing' });
    });

    await waitFor(() => expect(result.current.status).toBe('rejected'));
    expect(result.current.rejectReason).toEqual({ type: 'no-licensing' });
  });
});

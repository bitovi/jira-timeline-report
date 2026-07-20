import { useEffect, useMemo, useState } from 'react';

// @ts-ignore - can.js has loose types
import { value } from '../../../can';
import defaultRouteData from '../../../canjs/routing/route-data';
import { useCanObservable } from '../../hooks/useCanObservable';

export interface ReportLoadingState {
  status: 'idle' | 'pending' | 'resolved' | 'rejected';
  /** Total issues the request expects — GROWS as child issues are discovered mid-load. */
  issuesRequested?: number;
  /** Issues received so far. */
  issuesReceived?: number;
  /**
   * Which part of the load is running: `'primary'` (root JQL) then `'children'` (deep-children
   * discovery). Stays `undefined` on the no-children path. `'history'` is not a phase — it runs
   * concurrently and is derived from the `changeLogs*` counts.
   */
  phase?: 'primary' | 'children';
  /** Total changelogs (history) requested — GROWS in step with child discovery. */
  changeLogsRequested?: number;
  /** Changelogs (history) received so far. */
  changeLogsReceived?: number;
  /** Top-level parents whose children are being loaded (children phase). */
  parentsToProcess?: number;
  /** Top-level parents whose entire subtree has finished — drives the smoothed children bar. */
  parentsProcessed?: number;
  /** Rejection value when `status === 'rejected'` (carries `.type` / `.errorMessages`). */
  rejectReason?: any;
}

/**
 * Derives the report request's loading state from the routeData request stream.
 *
 * `rd` defaults to the real `routeData` singleton (production) and is injectable for tests — the
 * default-prop dependency-injection pattern. A test passes a hand-built fake store so this exact
 * observation code runs against controlled data (see useReportLoadingState.test.tsx). This same
 * decoupling is also groundwork for the route-data keystone migration.
 *
 * Notes on the two CanJS gotchas this encapsulates:
 * - The request `issuesPromise` is a native promise; its `isResolved`/`isPending`/`isRejected` are
 *   can-stache *template* affordances, not real properties. So we subscribe to the promise directly.
 * - `progressData` is a `value.with` observable whose `{issuesRequested, issuesReceived}` data lives
 *   under `.value` and is replaced each tick; `value.from` does NOT auto-unwrap it, so the key path
 *   must include the explicit `.value` segment.
 */
export function useReportLoadingState(rd: any = defaultRouteData): ReportLoadingState {
  const issuesPromiseObs = useMemo(
    () => value.from<Promise<unknown> | undefined>(rd, 'derivedIssuesRequestData.issuesPromise'),
    [rd],
  );
  const issuesPromise = useCanObservable(issuesPromiseObs);

  const issuesRequestedObs = useMemo(
    () => value.from<number | undefined>(rd, 'derivedIssuesRequestData.progressData.value.issuesRequested'),
    [rd],
  );
  const issuesRequested = useCanObservable(issuesRequestedObs);

  const issuesReceivedObs = useMemo(
    () => value.from<number | undefined>(rd, 'derivedIssuesRequestData.progressData.value.issuesReceived'),
    [rd],
  );
  const issuesReceived = useCanObservable(issuesReceivedObs);

  const phaseObs = useMemo(
    () => value.from<'primary' | 'children' | undefined>(rd, 'derivedIssuesRequestData.progressData.value.phase'),
    [rd],
  );
  const phase = useCanObservable(phaseObs);

  const changeLogsRequestedObs = useMemo(
    () => value.from<number | undefined>(rd, 'derivedIssuesRequestData.progressData.value.changeLogsRequested'),
    [rd],
  );
  const changeLogsRequested = useCanObservable(changeLogsRequestedObs);

  const changeLogsReceivedObs = useMemo(
    () => value.from<number | undefined>(rd, 'derivedIssuesRequestData.progressData.value.changeLogsReceived'),
    [rd],
  );
  const changeLogsReceived = useCanObservable(changeLogsReceivedObs);

  const parentsToProcessObs = useMemo(
    () => value.from<number | undefined>(rd, 'derivedIssuesRequestData.progressData.value.parentsToProcess'),
    [rd],
  );
  const parentsToProcess = useCanObservable(parentsToProcessObs);

  const parentsProcessedObs = useMemo(
    () => value.from<number | undefined>(rd, 'derivedIssuesRequestData.progressData.value.parentsProcessed'),
    [rd],
  );
  const parentsProcessed = useCanObservable(parentsProcessedObs);

  const [state, setState] = useState<{ status: ReportLoadingState['status']; reason?: any }>({
    status: 'idle',
  });

  useEffect(() => {
    if (!issuesPromise) {
      setState({ status: 'idle' });
      return;
    }
    let active = true;
    setState({ status: 'pending' });
    Promise.resolve(issuesPromise).then(
      () => active && setState({ status: 'resolved' }),
      (reason) => active && setState({ status: 'rejected', reason }),
    );
    return () => {
      active = false;
    };
  }, [issuesPromise]);

  return {
    status: state.status,
    issuesRequested,
    issuesReceived,
    phase,
    changeLogsRequested,
    changeLogsReceived,
    parentsToProcess,
    parentsProcessed,
    rejectReason: state.reason,
  };
}

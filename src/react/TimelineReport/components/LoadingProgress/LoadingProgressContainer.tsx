import type { FC } from 'react';
import React, { useRef } from 'react';

import type { ReportLoadingState } from '../../hooks/useReportLoadingState';
import { LoadingProgress } from './LoadingProgress';

export interface LoadingProgressContainerProps {
  loadingState: ReportLoadingState;
}

/**
 * Thin stateful wrapper around the presentational {@link LoadingProgress}.
 *
 * Two things need cross-render state (held in a ref), so they live here rather than in the pure
 * {@link LoadingProgress}:
 *
 * 1. **Primary snapshot.** `issuesRequested/Received` are GLOBAL cumulative (primary + children). We
 *    snapshot the primary totals the first time the load reports the `'children'` phase — parents are
 *    fully loaded at that transition and no child counts have been added yet, so it's exactly the
 *    primary totals. Child counts are then `global − snapshot`.
 *
 * 2. **Smoothed children projection.** The children total isn't known up front and the raw
 *    approximate-count total arrives in a burst, so a raw `received / discovered` bar spikes then
 *    dips. Instead we project the total from a running average: each time a top-level parent's whole
 *    subtree finishes (`parentsProcessed` ticks up), we re-freeze `projected = topParents × (childRec
 *    / parentsProcessed)` — i.e. avg descendants per completed parent, extrapolated to all parents.
 *    Between completions the estimate is held, so `received / projected` rises smoothly; a monotonic
 *    clamp guarantees the bar never rewinds when the estimate refines. Before the first completion we
 *    fall back to received/discovered (capped, so it can't pin high before a projection exists).
 *
 * No routeData/backend dependency — driven entirely by the `loadingState` prop, so it stays
 * credential-free testable (see the react-dependency-injection skill).
 */
export const LoadingProgressContainer: FC<LoadingProgressContainerProps> = ({ loadingState }) => {
  const { status, phase, issuesRequested, issuesReceived, changeLogsRequested, changeLogsReceived } = loadingState;
  const { parentsToProcess, parentsProcessed } = loadingState;

  const snapRef = useRef<{
    sawChildren: boolean;
    primaryRequested?: number;
    primaryReceived?: number;
    lastParentsProcessed: number;
    frozenProjected: number | null;
    maxChildBar: number;
  }>({ sawChildren: false, lastParentsProcessed: 0, frozenProjected: null, maxChildBar: 0 });

  // A fresh load clears progress (progressData → null ⇒ counts + phase undefined). Drop any stale
  // snapshot/projection so the next run recaptures. Idempotent (safe on every render).
  if (status !== 'resolved' && status !== 'rejected' && issuesRequested == null && phase == null) {
    if (
      snapRef.current.sawChildren ||
      snapRef.current.primaryReceived != null ||
      snapRef.current.frozenProjected != null
    ) {
      snapRef.current = { sawChildren: false, lastParentsProcessed: 0, frozenProjected: null, maxChildBar: 0 };
    }
  }

  // Capture the primary totals the first time the children phase is observed.
  if (phase === 'children' && !snapRef.current.sawChildren) {
    snapRef.current.sawChildren = true;
    snapRef.current.primaryRequested = issuesRequested;
    snapRef.current.primaryReceived = issuesReceived;
  }

  let childrenBarValue: number | undefined;
  let childrenProjectedTotal: number | undefined;

  if (snapRef.current.sawChildren) {
    const s = snapRef.current;
    const P = parentsToProcess ?? s.primaryReceived ?? 0;
    const childRec = Math.max(0, (issuesReceived ?? 0) - (s.primaryReceived ?? 0));
    const childReq = Math.max(0, (issuesRequested ?? 0) - (s.primaryRequested ?? 0));
    const pp = parentsProcessed ?? 0;

    // Re-freeze the projection at each completion (a top-level parent's whole subtree finished).
    if (pp > s.lastParentsProcessed && pp > 0 && P > 0) {
      s.frozenProjected = P * (childRec / pp);
      s.lastParentsProcessed = pp;
    }

    // Denominator: the frozen projection once we have one, else discovered-so-far.
    const projected = s.frozenProjected ?? (childReq > 0 ? childReq : null);
    if (projected && projected > 0) {
      // Cap lower pre-projection so a race of received→discovered can't pin the bar near full before
      // a real projection exists.
      const cap = s.frozenProjected != null ? 0.99 : 0.85;
      const raw = Math.min(cap, childRec / projected);
      s.maxChildBar = Math.max(s.maxChildBar, raw); // monotonic — never rewinds when the estimate refines
      childrenBarValue = s.maxChildBar * 100;
    }
    if (s.frozenProjected != null) {
      childrenProjectedTotal = Math.round(s.frozenProjected / 10) * 10; // round to reduce jitter in the label
    }
  }

  return (
    <LoadingProgress
      status={status}
      phase={phase}
      issuesRequested={issuesRequested}
      issuesReceived={issuesReceived}
      changeLogsRequested={changeLogsRequested}
      changeLogsReceived={changeLogsReceived}
      primaryRequested={snapRef.current.primaryRequested}
      primaryReceived={snapRef.current.primaryReceived}
      childrenBarValue={childrenBarValue}
      childrenProjectedTotal={childrenProjectedTotal}
    />
  );
};

export default LoadingProgressContainer;

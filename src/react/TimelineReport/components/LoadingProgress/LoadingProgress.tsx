import type { FC } from 'react';
import React from 'react';

import type { ReportLoadingState } from '../../hooks/useReportLoadingState';

/**
 * The three-step "concurrent meter" report loader (concept B — see spec/013-loader). Ported from
 * `spec/013-loader/mocks/stepper.html` to the app's Tailwind-mimics-Atlaskit conventions. Presentational
 * and fully prop-driven (the `LoadingProgressContainer` supplies the primary snapshot) so every state is
 * story/unit testable with no routeData, backend, or credentials.
 *
 * The three steps are independent LIVE meters, not strictly-gated stages: "Loading history" fills
 * alongside "Loading children" because the pipeline fetches changelogs interleaved with issue discovery.
 * The active step is a blue-ringed EMPTY circle (no spinner) — motion comes from the sub-bar. "Loading
 * children" is hidden entirely when no children are loaded (2 visible steps).
 */

export interface LoadingProgressProps {
  /** Request status. Only `pending` renders in the app; `resolved` (all-done) is used by stories/tests. */
  status: ReportLoadingState['status'];
  /** `'primary'` (root JQL) → `'children'` (deep-children discovery); `undefined` on the no-children path. */
  phase?: 'primary' | 'children';
  /** GLOBAL cumulative issue counts (primary + children). */
  issuesRequested?: number;
  issuesReceived?: number;
  /** GLOBAL cumulative changelog (history) counts. */
  changeLogsRequested?: number;
  changeLogsReceived?: number;
  /** Primary-only counts snapshotted at the primary→children transition (see LoadingProgressContainer). */
  primaryRequested?: number;
  primaryReceived?: number;
  /**
   * Smoothed children projection from the container (see LoadingProgressContainer). `childrenBarValue`
   * is the monotonic fill 0–100 for the children bar; `childrenProjectedTotal` is the estimated total
   * shown in the children detail. Absent ⇒ the children bar/detail fall back to received/discovered.
   */
  childrenBarValue?: number;
  childrenProjectedTotal?: number;
}

type StepStatus = 'pending' | 'active' | 'done';
type StepKey = 'primary' | 'children' | 'history';

export interface StepView {
  key: StepKey;
  label: string;
  status: StepStatus;
  /** Right-aligned sub-count text. */
  detail: string;
  /** Sub-bar fill 0–100. Always a gray track; the fill grows once the step is loading (green when done). */
  barValue: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString();
const clampPct = (ratio: number) => Math.min(100, Math.max(0, ratio * 100));

/**
 * Pure step-state logic (the concurrent-meter rules). Exported for unit testing.
 *
 * - primary: `done` once `phase === 'children'` (or resolved); else `active`.
 * - children: HIDDEN until children are seen (phase reached `'children'`, i.e. a snapshot exists);
 *   `active` while pending, `done` when resolved. Counts are scoped to just the children
 *   (`global − primary snapshot`). The active bar/detail use the container's smoothed projection
 *   (`childrenBarValue` / `childrenProjectedTotal`) when provided, else received/discovered.
 * - history: concurrent live meter — `active` whenever pending, `done` when resolved. Its bar
 *   fills once changelog fetching starts (empty gray track before that).
 *
 * Every step is a plain gray track that fills with a blue bar as it loads (green when done).
 */
export function computeSteps(props: LoadingProgressProps): StepView[] {
  const {
    status,
    phase,
    issuesRequested,
    issuesReceived,
    changeLogsRequested,
    changeLogsReceived,
    primaryRequested,
    primaryReceived,
    childrenBarValue,
    childrenProjectedTotal,
  } = props;

  const resolved = status === 'resolved';
  // Children exist once the load reached the children phase (or its snapshot was captured).
  const sawChildren = phase === 'children' || primaryReceived != null;

  const steps: StepView[] = [];

  // --- Loading primary work items ---
  const primaryReq = sawChildren ? primaryRequested : issuesRequested;
  const primaryRec = sawChildren ? primaryReceived : issuesReceived;
  const primaryStatus: StepStatus = resolved || phase === 'children' ? 'done' : 'active';
  steps.push({
    key: 'primary',
    label: 'Loading primary work items',
    status: primaryStatus,
    detail:
      primaryStatus === 'done'
        ? `${fmt(primaryRec ?? primaryReq ?? 0)} work items`
        : primaryReq
          ? `${fmt(primaryRec ?? 0)} of ${fmt(primaryReq)}`
          : 'estimating scope…',
    barValue: primaryStatus === 'done' ? 100 : primaryReq ? clampPct((primaryRec ?? 0) / primaryReq) : 0,
  });

  // --- Loading children (hidden on the no-children path) ---
  if (sawChildren) {
    const childReq = Math.max(0, (issuesRequested ?? 0) - (primaryRequested ?? 0));
    const childRec = Math.max(0, (issuesReceived ?? 0) - (primaryReceived ?? 0));
    const childStatus: StepStatus = resolved ? 'done' : 'active';
    steps.push({
      key: 'children',
      label: 'Loading children',
      status: childStatus,
      // Prefer the container's smoothed projection (bar + estimated total); fall back to
      // received/discovered before the first parent-subtree completes.
      detail:
        childStatus === 'done'
          ? `${fmt(childRec)} children`
          : childrenProjectedTotal
            ? `${fmt(childRec)} of ~${fmt(childrenProjectedTotal)}`
            : `${fmt(childRec)} of ~${fmt(childReq)} found`,
      barValue:
        childStatus === 'done'
          ? 100
          : childrenBarValue != null
            ? Math.min(100, Math.max(0, childrenBarValue))
            : childReq
              ? clampPct(childRec / childReq)
              : 0,
    });
  }

  // --- Loading history (concurrent; fills once changelog fetching starts) ---
  const historyReq = changeLogsRequested ?? 0;
  const historyRec = changeLogsReceived ?? 0;
  const historyStatus: StepStatus = resolved ? 'done' : 'active';
  steps.push({
    key: 'history',
    label: 'Loading history',
    status: historyStatus,
    detail:
      historyStatus === 'done'
        ? `${fmt(historyRec)} histories`
        : historyReq
          ? `${fmt(historyRec)} of ${fmt(historyReq)}`
          : 'waiting…',
    barValue: historyStatus === 'done' ? 100 : historyReq ? clampPct(historyRec / historyReq) : 0,
  });

  return steps;
}

const CheckIcon: FC = () => (
  <svg
    viewBox="0 0 12 12"
    className="w-3 h-3"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.5 6.5 5 9l4.5-5" />
  </svg>
);

const iconClassFor = (status: StepStatus) => {
  // NB: keep exactly one background utility per state — a base `bg-white` plus a `bg-green-400`
  // override both compile with equal specificity, and stylesheet order (not class order) decides
  // the winner, so the done circle would render white with an invisible white check.
  const base = 'w-6 h-6 rounded-full grid place-items-center border-2 z-[1]';
  if (status === 'done') return `${base} bg-green-400 border-green-400 text-white`;
  if (status === 'active') return `${base} bg-white border-blue-400 text-neutral-300`;
  return `${base} bg-white border-neutral-41 text-neutral-300`;
};

const labelClassFor = (status: StepStatus) =>
  status === 'pending' ? 'text-sm pt-1 font-normal text-neutral-300' : 'text-sm pt-1 font-medium text-neutral-800';

const Step: FC<{ step: StepView; isLast: boolean }> = ({ step, isLast }) => (
  <li className="relative grid grid-cols-[24px_1fr_auto] items-start gap-x-3.5 py-2">
    {/* connector line between this icon and the next; green once this step is done */}
    {!isLast && (
      <span
        aria-hidden="true"
        className={`absolute left-[11px] top-[24px] -bottom-2 w-[2px] ${step.status === 'done' ? 'bg-green-400' : 'bg-neutral-41'}`}
      />
    )}

    <span className={iconClassFor(step.status)}>{step.status === 'done' && <CheckIcon />}</span>

    <span className={labelClassFor(step.status)}>{step.label}</span>

    <span className="text-xs text-neutral-300 pt-[5px] text-right tabular-nums">{step.detail}</span>

    <div className="col-start-2 col-end-4 mt-2 h-1 overflow-hidden rounded-full bg-neutral-41">
      <div
        className={`h-full rounded-full transition-[width] duration-150 ease-linear ${step.status === 'done' ? 'bg-green-400' : 'bg-blue-400'}`}
        style={{ width: `${step.barValue}%` }}
      />
    </div>
  </li>
);

export const LoadingProgress: FC<LoadingProgressProps> = (props) => {
  const steps = computeSteps(props);

  return (
    <div className="my-2 p-2 h-780 border-box block overflow-hidden color-bg-white">
      <div role="status" aria-live="polite" className="w-full px-8 pt-8">
        <ol className="m-0 list-none p-0">
          {steps.map((step, i) => (
            <Step key={step.key} step={step} isLast={i === steps.length - 1} />
          ))}
        </ol>
      </div>
    </div>
  );
};

export default LoadingProgress;

/**
 * Work Breakdown–specific TypeScript types.
 *
 * Like the Scatter Timeline report, this report reads only a small, well-defined slice of the
 * rolled-up issue/release shape. We model that slice locally so the pure layout/status helpers
 * stay decoupled from the full pipeline and are trivial to test with inline fixtures.
 */

import type React from 'react';
import type { AdfBlock } from './helpers/adfToBlocks';

/** The four work types, in display order (matches the pipeline's `workType` order). */
export const WORK_TYPES = ['design', 'dev', 'qa', 'uat'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/** Single-letter symbol shown for each work type in the matrix header. */
export const WORK_TYPE_SYMBOLS: Record<WorkType, string> = {
  design: 'd',
  dev: 'D',
  qa: 'Q',
  uat: 'U',
};

/** Human-readable name for each work type, shown in the issue popup. */
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  design: 'Design',
  dev: 'Dev',
  qa: 'QA',
  uat: 'UAT',
};

/** The prior period's dates for a rollup/work-type, used to detect date slips. */
export interface LastPeriod {
  due?: Date | null;
  start?: Date | null;
}

/** Why a rollup/work-type landed on its current status — mirrors the pipeline's `statusFrom`. */
export interface StatusFrom {
  message: string;
  warning?: boolean;
}

/** The driving child issue for a start/due date, plus why it was chosen. */
export interface DateDrivenBy {
  message: string;
  reference?: { url?: string; summary?: string };
}

/** The rolled-up status/dates for a single work type on an issue. */
export interface WorkTypeRollup {
  status?: string;
  due?: Date | null;
  start?: Date | null;
  issueKeys?: string[];
  lastPeriod?: LastPeriod | null;
  statusFrom?: StatusFrom;
  startFrom?: DateDrivenBy;
  dueTo?: DateDrivenBy;
}

/** The overall rolled-up status/dates for an issue. */
export interface RollupStatus {
  status: string;
  due?: Date | null;
  start?: Date | null;
  lastPeriod?: LastPeriod | null;
  statusFrom?: StatusFrom;
  startFrom?: DateDrivenBy;
  dueTo?: DateDrivenBy;
  /** Has a start date on/before today that it didn't have (or hadn't reached) as of Compare-to. */
  newlyStarted?: boolean;
  /** Has a due date on/before today that hadn't passed yet as of Compare-to. */
  newlyCompleted?: boolean;
  /** Had no start/due at all as of Compare-to, but has one now. */
  newlyDated?: boolean;
}

/** The `rollupStatuses` slice the report reads: the overall rollup + per-work-type rollups. */
export interface RollupStatuses {
  rollup: RollupStatus;
  design?: WorkTypeRollup;
  dev?: WorkTypeRollup;
  qa?: WorkTypeRollup;
  uat?: WorkTypeRollup;
}

/** Minimal issue/release shape the Work Breakdown report reads. */
export interface IssueOrRelease {
  key: string;
  summary: string;
  /** Jira issue link — used for the "Open in Jira" action and popup title link. */
  url?: string;
  /** Issue type name (e.g. "Epic") — shown as a badge in the issue popup. */
  type?: string;
  reportingHierarchy?: { childKeys: string[] };
  rollupStatuses: RollupStatuses;
  /** Raw value of the configured "Status Summary" field (ADF object or plain string). */
  statusSummary?: string | Record<string, unknown> | null;
}

/** Which secondary view is active — mirrors `routeData.secondaryReportType`. */
export type SecondaryReportMode = 'status' | 'breakdown';

/** Handler invoked when an issue row/card is clicked (wired to the legacy issue tooltip). */
export type IssueClickHandler = (event: React.MouseEvent, issue: IssueOrRelease) => void;

/** Density tier, derived from the number of cards (ports the legacy `columnDensity`). */
export type Density = 'light' | 'medium' | 'high' | 'absurd';

/**
 * A single matrix cell's state:
 * - `'na'` — the issue has no work of this type (blank outline swatch).
 * - `'nodate'` — work exists but has no dates (tan ∅ swatch).
 * - otherwise — a rollup status string (colored swatch).
 */
export type CellState = 'na' | 'nodate' | (string & {});

/** Direction a date moved relative to the prior period. */
export interface DateSlip {
  kind: 'none' | 'slipped' | 'improved';
  /** Formatted prior-period date shown as a parenthetical (only when `kind` != `'none'`). */
  label?: string;
}

/**
 * A per-card work-type header cell: the card's own rollup status/date for one work type. The set
 * of columns (which work types) is shared board-wide via {@link Board.workTypes}; the status/date
 * shown in each header cell is specific to the card.
 */
export interface WorkTypeColumn {
  type: WorkType;
  symbol: string;
  status: string;
  due?: Date | null;
  slip: DateSlip;
}

/** A child row in the status-mode single column. */
export interface StatusRow {
  key: string;
  name: string;
  issue: IssueOrRelease;
  /** Rollup status used to color the child's swatch. */
  status: CellState;
}

/** A child row in the breakdown-mode matrix (one cell per work-type column). */
export interface MatrixRow {
  key: string;
  name: string;
  issue: IssueOrRelease;
  /** One cell per {@link Board.workTypeColumns}, in the same order. */
  cells: CellState[];
}

/** A planning-issue row (fallback card). */
export interface PlanningRow {
  key: string;
  name: string;
  issue: IssueOrRelease;
}

/** A single primary-issue card. */
export interface Card {
  key: string;
  title: string;
  issue: IssueOrRelease;
  /** Rollup status used to color the card header bubble. */
  status: string;
  due?: Date | null;
  slip: DateSlip;
  /** Narrative status summary shown above the child status rows, when present. */
  statusSummary?: { blocks: AdfBlock[] };
  /** Per-card work-type header cells (one per {@link Board.workTypes}, same order). */
  headerColumns: WorkTypeColumn[];
  /** Rows for status mode. */
  statusRows: StatusRow[];
  /** Rows for breakdown mode. */
  matrixRows: MatrixRow[];
}

/** The render-ready view model produced by `buildBoard`. */
export interface Board {
  mode: SecondaryReportMode;
  /** Work types present across the board (columns shown in breakdown mode), in display order. */
  workTypes: WorkType[];
  cards: Card[];
  planning: PlanningRow[];
  density: Density;
}

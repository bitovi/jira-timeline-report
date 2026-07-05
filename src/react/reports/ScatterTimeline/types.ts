/**
 * Scatter-specific TypeScript types.
 *
 * The scatter timeline only reads a small, well-defined slice of the rolled-up
 * issue/release shape, so we model that slice locally rather than depending on the
 * full pipeline types. This keeps the pure layout math decoupled and easy to test.
 */

/** Minimal issue/release shape the scatter report reads. */
export interface IssueOrRelease {
  key: string;
  summary: string;
  names?: {
    shortVersion?: string | null;
    semver?: string | null;
    name?: string | null;
  };
  rollupDates: {
    start?: Date | null;
    startFrom?: Date | null;
    due?: Date | null;
    dueTo?: Date | null;
  };
  rollupStatuses: {
    rollup: {
      status: string;
      due?: Date | null;
      start?: Date | null;
    };
  };
  status?: string;
}

// Canonical calendar types live with the date utility that produces them; re-export so
// scatter modules can import them from the local `types` barrel.
export type { Month, Quarter, QuartersAndMonths } from '../../../utils/date/compute-quarters-and-months';

export interface Range {
  start: number;
  end: number;
}

export interface PositionConfig {
  roundedDueDate: Date;
  textWidth: number;
  widthOfArea: number;
  firstDay: Date;
  lastDay: Date;
}

export interface IssuePosition {
  leftPercentStart: number;
  rightPercentEnd: number;
  endPercentFromRight: number;
  widthInPercent: number;
  /** True when the label would clip off the left edge and should flip to the right of the marker. */
  overflowsLeft: boolean;
}

export interface PlottedIssue extends IssuePosition {
  key: string;
  issue: IssueOrRelease;
  statusColorClass: string;
  textSize: string;
  markerRadius: number;
}

export interface Row {
  items: PlottedIssue[];
}

export interface MeasureConfig {
  /** Issue labels to measure (shortVersion || summary). */
  texts: string[];
  /** Affects font size / class used during measurement. */
  isLotsOfIssues: boolean;
}

export interface TextWidthMeasurements {
  widthsByText: Map<string, number>;
  isMeasured: boolean;
}

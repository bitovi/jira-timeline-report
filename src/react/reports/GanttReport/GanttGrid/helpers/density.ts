import { shouldUseDensityOptimizations } from '../../../shared/timeline/helpers/density';

/**
 * `lotsOfIssues`, forced `false` in breakdown mode (Gantt-specific — breakdown bars are thin
 * enough that density optimizations aren't needed).
 *
 * Replaces gantt-grid.js's `lotsOfIssues` getter.
 */
export const computeDensity = (issueCount: number, isBreakdown: boolean): boolean =>
  !isBreakdown && shouldUseDensityOptimizations(issueCount);

export interface DensityClasses {
  textSize: string;
  bigBarSize: string;
  shadowBarSize: string;
  expandPadding: string;
}

/**
 * Derived class tokens for dense (>20 issues) vs normal layouts.
 *
 * Values port gantt-grid.js's `textSize`/`bigBarSize`/`shadowBarSize`/`expandPadding` getters
 * verbatim ([gantt-grid.js#L192-L207](src/canjs/reports/gantt-grid.js#L192-L207)).
 *
 * NOTE (plan §Known issues #5): legacy circle-size classes were a no-op
 * (`fewerIssuesClasses === lotsOfIssueClasses`), so circle sizing is intentionally NOT varied
 * here — only text/bar sizes vary, matching the legacy visual result exactly.
 */
export const densityClasses = (isDense: boolean): DensityClasses =>
  isDense
    ? { textSize: 'text-xs', bigBarSize: 'h-2', shadowBarSize: 'h-4', expandPadding: '' }
    : { textSize: '', bigBarSize: 'h-4', shadowBarSize: 'h-6', expandPadding: 'pt-1 pb-0.5' };

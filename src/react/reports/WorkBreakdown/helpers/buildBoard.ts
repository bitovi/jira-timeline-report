import type {
  Board,
  Card,
  IssueOrRelease,
  MatrixRow,
  SecondaryReportMode,
  StatusRow,
  WorkType,
  WorkTypeColumn,
} from '../types';
import { WORK_TYPE_SYMBOLS } from '../types';
import { workTypePresence } from './workTypePresence';
import { cellState } from './cellState';
import { childRollup } from './childRollup';
import { dateSlip } from './dateSlip';
import { density } from './density';
import { adfToBlocks } from './adfToBlocks';
import { matchesAllFilterRows } from '../../../../jira/rollup/filter-rows/filter-rows';
import type { FilterRow } from '../../../../jira/rollup/filter-rows/filter-rows';

/**
 * Compose the pure helpers into a render-ready {@link Board} view model. The component just maps
 * this to JSX — all status/date/density math lives here and in the small helpers it calls.
 *
 * @param primaryIssues The cards to render (each with `reportingHierarchy.childKeys`).
 * @param allIssues Every issue/release, used to look up children by key.
 * @param mode Which secondary view is active (`status` vs `breakdown`).
 * @param planningIssues Issues shown in the "Planning" fallback card; excluded from card children.
 * @param filterRows The secondary report's own filter rows — decide whether a CARD shows at all,
 *   evaluated against the card/primary issue only (children are not considered).
 * @param childFilterRows A second, independent set of filter rows — decide which children (if
 *   any) render within an already-shown card, evaluated against each child only. Doesn't affect
 *   whether the card itself shows; a card with zero matching children still renders (with an
 *   empty child list).
 */
export const buildBoard = (
  primaryIssues: IssueOrRelease[],
  allIssues: IssueOrRelease[],
  mode: SecondaryReportMode,
  planningIssues: IssueOrRelease[] = [],
  filterRows: FilterRow[] = [],
  childFilterRows: FilterRow[] = [],
): Board => {
  const byKey = new Map(allIssues.map((issue) => [issue.key, issue]));
  const planningKeys = new Set(planningIssues.map((issue) => issue.key));
  const workTypes: WorkType[] = workTypePresence(primaryIssues).hasWorkList.map((wt) => wt.type);

  const cards: Card[] = primaryIssues.flatMap((primary) => {
    if (!matchesAllFilterRows(primary, filterRows)) {
      return [];
    }

    const allChildren = (primary.reportingHierarchy?.childKeys ?? [])
      .map((key) => byKey.get(key))
      .filter((issue): issue is IssueOrRelease => Boolean(issue))
      .filter((issue) => !planningKeys.has(issue.key));

    const children = allChildren.filter((child) => matchesAllFilterRows(child, childFilterRows));

    const headerColumns: WorkTypeColumn[] = workTypes.map((type) => {
      const wt = primary.rollupStatuses[type];
      return {
        type,
        symbol: WORK_TYPE_SYMBOLS[type],
        status: wt?.status ?? 'unknown',
        due: wt?.due ?? null,
        slip: dateSlip({ status: wt?.status, due: wt?.due, lastPeriod: wt?.lastPeriod }),
      };
    });

    const matrixRows: MatrixRow[] = children.map((child) => ({
      key: child.key,
      name: child.summary,
      issue: child,
      cells: workTypes.map((type) => cellState(child.rollupStatuses[type])),
    }));

    const statusRows: StatusRow[] = children.map((child, i) => ({
      key: child.key,
      name: child.summary,
      issue: child,
      // Prefer the child's authoritative rollup status; fall back to a computed rollup only when
      // no rollup status is available (Question #5 → Option A).
      status: child.rollupStatuses.rollup?.status ?? childRollup(matrixRows[i].cells),
    }));

    const statusSummaryBlocks = adfToBlocks(primary.statusSummary);

    return [
      {
        key: primary.key,
        title: primary.summary,
        issue: primary,
        status: primary.rollupStatuses.rollup.status,
        due: primary.rollupStatuses.rollup.due ?? null,
        slip: dateSlip(primary.rollupStatuses.rollup),
        statusSummary: statusSummaryBlocks.length ? { blocks: statusSummaryBlocks } : undefined,
        headerColumns,
        statusRows,
        matrixRows,
      },
    ];
  });

  return {
    mode,
    workTypes,
    cards,
    planning: planningIssues.map((issue) => ({ key: issue.key, name: issue.summary, issue })),
    density: density(primaryIssues.length),
  };
};

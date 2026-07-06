/**
 * Shared mock issues/releases for Work Breakdown tests and stories.
 *
 * The builders reproduce the three-card board from `option-a-status-matrix.html`, including
 * `nodate`/`na` cells and both a slipped and an "ahead" (pulled-earlier) date, so unit tests
 * and Storybook render predictable output.
 */
import type { IssueOrRelease, WorkTypeRollup } from './types';
import { WORK_TYPES } from './types';

/** Short date builder — `d('2025-03-09')`. */
const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** Per-work-type child cell input: a status string, `'nodate'`, or `null` (no work of this type). */
export type CellInput = string | 'nodate' | null;

/** Priority used to derive a child's single rollup status from its work-type cells. */
const ROLLUP_PRIORITY = ['blocked', 'behind', 'warning', 'ahead', 'ontrack', 'complete', 'notstarted'];

const rollupFromStates = (states: CellInput[]): string => {
  const present = states.filter((s): s is string => s !== null);
  if (!present.length) return 'notstarted';
  const real = present.filter((s) => s !== 'nodate');
  if (!real.length) return 'unknown';
  for (const p of ROLLUP_PRIORITY) if (real.includes(p)) return p;
  return real[0];
};

const cellToWorkTypeRollup = (key: string, state: CellInput, due: Date | null): WorkTypeRollup | undefined => {
  if (state === null) return undefined; // no work of this type → cell is `na`
  if (state === 'nodate') return { status: 'unknown', issueKeys: [key], due: null };
  return { status: state, issueKeys: [key], due };
};

interface MakeChildOptions {
  key: string;
  summary: string;
  /** `[design, dev, qa, uat]` cell inputs. */
  states: [CellInput, CellInput, CellInput, CellInput];
  /** Optional due date used for colored (dated) work-type cells. */
  due?: Date | null;
}

/** Build a child issue whose per-work-type rollups yield the given matrix cells. */
export const makeChild = ({ key, summary, states, due = d('2025-03-01') }: MakeChildOptions): IssueOrRelease => {
  const rollupStatuses: IssueOrRelease['rollupStatuses'] = {
    rollup: { status: rollupFromStates(states), due },
  };
  WORK_TYPES.forEach((type, i) => {
    const wt = cellToWorkTypeRollup(key, states[i], due);
    if (wt) rollupStatuses[type] = wt;
  });
  return { key, summary, rollupStatuses };
};

interface MakePrimaryOptions {
  key: string;
  summary: string;
  status: string;
  due?: Date | null;
  /** Prior-period rollup due date (drives the header slip parenthetical). */
  wasDue?: Date | null;
  /** Per-work-type header rollups. */
  workTypes?: Partial<Record<(typeof WORK_TYPES)[number], WorkTypeRollup>>;
  childKeys: string[];
}

/** Build a primary (card) issue with a rollup status, header work-type rollups, and child keys. */
export const makePrimary = ({
  key,
  summary,
  status,
  due = null,
  wasDue = null,
  workTypes = {},
  childKeys,
}: MakePrimaryOptions): IssueOrRelease => {
  const rollupStatuses: IssueOrRelease['rollupStatuses'] = {
    rollup: { status, due, lastPeriod: wasDue ? { due: wasDue } : null },
    ...workTypes,
  };
  return { key, summary, reportingHierarchy: { childKeys }, rollupStatuses };
};

// ---- Card 1: "100 Stores" — on track ----
const card1Children = [
  makeChild({ key: 'S-1', summary: 'Digital menu board', states: ['complete', 'complete', 'ontrack', null] }),
  makeChild({ key: 'S-2', summary: 'Digital orders', states: ['complete', 'complete', 'behind', null] }),
  makeChild({ key: 'S-3', summary: 'Delivery aggregators', states: ['complete', 'ontrack', 'nodate', null] }),
  makeChild({ key: 'S-4', summary: 'Promotions', states: ['ontrack', 'ontrack', null, null] }),
  makeChild({ key: 'S-5', summary: 'National menu', states: ['ontrack', 'behind', 'nodate', 'nodate'] }),
];
const card1 = makePrimary({
  key: 'C-1',
  summary: '100 Stores',
  status: 'ontrack',
  due: d('2025-03-09'),
  workTypes: {
    design: { status: 'complete', due: d('2025-02-12'), issueKeys: ['S-1', 'S-2'] },
    dev: { status: 'ontrack', due: d('2025-03-09'), issueKeys: ['S-1', 'S-2'] },
    qa: { status: 'behind', due: null, issueKeys: ['S-1', 'S-2'] },
    uat: { status: 'unknown', due: null, issueKeys: ['S-5'] },
  },
  childKeys: card1Children.map((c) => c.key),
});

// ---- Card 2: "Outcome A" — complete, with an "ahead" (pulled-earlier) QA date ----
const card2Children = [
  makeChild({ key: 'O-1', summary: 'Epic Analysis', states: ['complete', 'complete', 'complete', 'ontrack'] }),
  makeChild({ key: 'O-2', summary: 'Pet Photo Sharing', states: ['complete', 'complete', 'ahead', 'nodate'] }),
  makeChild({ key: 'O-3', summary: 'Favorite sharing', states: ['complete', 'ahead', 'nodate', null] }),
  makeChild({ key: 'O-4', summary: 'Pets corner', states: ['ontrack', 'behind', null, null] }),
  makeChild({ key: 'O-5', summary: 'Internationalization', states: ['behind', 'blocked', null, null] }),
  makeChild({ key: 'O-6', summary: 'Order Playback', states: ['nodate', 'nodate', null, null] }),
];
const card2 = makePrimary({
  key: 'C-2',
  summary: 'Outcome A',
  status: 'complete',
  due: d('2025-10-22'),
  workTypes: {
    design: { status: 'complete', due: d('2025-08-20'), issueKeys: ['O-1'] },
    dev: { status: 'complete', due: d('2025-09-25'), issueKeys: ['O-1'] },
    qa: { status: 'ahead', due: d('2025-10-03'), issueKeys: ['O-1'], lastPeriod: { due: d('2025-10-10') } },
    uat: { status: 'ontrack', due: d('2025-10-22'), issueKeys: ['O-1'] },
  },
  childKeys: card2Children.map((c) => c.key),
});

// ---- Card 3: "Digital Channel sales - 5% increase" — behind, with a slipped dev date ----
const card3Children = [
  makeChild({ key: 'D-1', summary: 'Shared orders (for offices)', states: ['complete', 'ontrack', null, null] }),
  makeChild({ key: 'D-2', summary: 'Discounts for bigger carts', states: ['complete', 'behind', null, null] }),
  makeChild({ key: 'D-3', summary: 'Tasty images', states: ['ontrack', 'warning', null, null] }),
  makeChild({ key: 'D-4', summary: 'Upsell Recommendations', states: ['ontrack', 'behind', null, null] }),
];
const card3 = makePrimary({
  key: 'C-3',
  summary: 'Digital Channel sales - 5% increase',
  status: 'behind',
  due: d('2025-07-24'),
  wasDue: d('2025-06-19'),
  workTypes: {
    design: { status: 'complete', due: d('2025-06-05'), issueKeys: ['D-1'] },
    dev: { status: 'behind', due: d('2025-07-24'), issueKeys: ['D-1'], lastPeriod: { due: d('2025-06-19') } },
    qa: { status: 'unknown', due: null, issueKeys: [] },
    uat: { status: 'unknown', due: null, issueKeys: [] },
  },
  childKeys: card3Children.map((c) => c.key),
});

/** The three primary cards from the mock. */
export const primaryIssues: IssueOrRelease[] = [card1, card2, card3];

/** Every child issue, keyed for lookup by `buildBoard`. */
export const childIssues: IssueOrRelease[] = [...card1Children, ...card2Children, ...card3Children];

/** Primary + child issues — pass as the `allIssuesOrReleases` observable. */
export const allIssues: IssueOrRelease[] = [...primaryIssues, ...childIssues];

/** Planning-issue fallback rows. */
export const planningIssues: IssueOrRelease[] = [
  { key: 'P-1', summary: 'Future initiative', rollupStatuses: { rollup: { status: 'unknown' } } },
  { key: 'P-2', summary: 'Unscoped idea', rollupStatuses: { rollup: { status: 'unknown' } } },
];

/** A large board (> 20 cards) to exercise the `absurd` density tier. */
const denseChildren = Array.from({ length: 3 }, (_, i) =>
  makeChild({ key: `X-${i}`, summary: `Child ${i}`, states: ['complete', 'ontrack', 'behind', null] }),
);
export const densePrimaryIssues: IssueOrRelease[] = Array.from({ length: 22 }, (_, i) =>
  makePrimary({
    key: `DC-${i}`,
    summary: `Card ${i + 1}`,
    status: ['ontrack', 'behind', 'complete', 'warning', 'blocked'][i % 5],
    due: d('2025-05-15'),
    workTypes: {
      design: { status: 'complete', due: d('2025-04-01'), issueKeys: ['X-0'] },
      dev: { status: 'ontrack', due: d('2025-05-15'), issueKeys: ['X-1'] },
      qa: { status: 'behind', due: null, issueKeys: ['X-2'] },
    },
    childKeys: denseChildren.map((c) => c.key),
  }),
);
export const denseAllIssues: IssueOrRelease[] = [...densePrimaryIssues, ...denseChildren];

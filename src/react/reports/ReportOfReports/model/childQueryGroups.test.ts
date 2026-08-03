import type { Reports } from '../../../../jira/reports';
import type { LayoutNode } from './sections';

import { describe, expect, it } from 'vitest';

import { childQueryGroups, overrideFor } from './childQueryGroups';
import { inlineReportNode, inlineValueNode, savedReportNode, sectionNode } from './sections';
import { queryKeyOf } from '../../../../stateful-data/raw-issues-cache-key';

const ORDER_JQL = 'project = ORDER';

const params = (entries: Record<string, string>) => new URLSearchParams(entries).toString();

const columns = (...sourceIds: string[]) => JSON.stringify(sourceIds.map((sourceId) => ({ sourceId })));

const report = (id: string, queryParams: string) => ({ id, name: id, queryParams });

const reports: Reports = {
  gantt: report('gantt', params({ jql: ORDER_JQL, primaryReportType: 'start-due' })),
  ganttCopy: report('ganttCopy', params({ jql: ORDER_JQL, primaryReportType: 'start-due' })),
  table: report('table', params({ jql: ORDER_JQL, primaryReportType: 'table', tableColumns: columns('field:cf1') })),
  table2: report('table2', params({ jql: ORDER_JQL, primaryReportType: 'table', tableColumns: columns('field:cf2') })),
  deepGantt: report('deepGantt', params({ jql: ORDER_JQL, loadChildren: 'true' })),
  childJql: report('childJql', params({ jql: ORDER_JQL, childJQL: 'type = Bug' })),
  billing: report('billing', params({ jql: 'project = BILLING' })),
};

const groupFor = (nodes: LayoutNode[], queryParams: string) =>
  overrideFor(childQueryGroups(nodes, reports), queryParams);

const doc = (...reportIds: string[]) => reportIds.map(savedReportNode);

describe('childQueryGroups', () => {
  it('unions the field ids of every report asking the same question', () => {
    const groups = childQueryGroups(doc('gantt', 'table', 'table2'), reports);

    expect(groups.get(queryKeyOf({ jql: ORDER_JQL, childJQL: '', loadChildren: false }))).toEqual(['cf1', 'cf2']);
  });

  it('sorts the union, so it does not depend on tree order', () => {
    const forwards = childQueryGroups(doc('table2', 'table'), reports);
    const backwards = childQueryGroups(doc('table', 'table2'), reports);

    expect([...forwards.values()]).toEqual([...backwards.values()]);
  });

  it('returns one shared array per group — the identity ChildReport memoizes on', () => {
    const groups = childQueryGroups(doc('gantt', 'table', 'table2'), reports);

    expect(groupFor(doc('gantt', 'table', 'table2'), reports.table!.queryParams)).toEqual(['cf1', 'cf2']);
    // Every member of a group reads the *same* array instance, not an equal copy.
    expect(overrideFor(groups, reports.table!.queryParams)).toBe(overrideFor(groups, reports.gantt!.queryParams));
  });

  describe('a report with nobody to share with gets no override', () => {
    it('excludes a singleton group', () => {
      expect(childQueryGroups(doc('gantt'), reports).size).toBe(0);
    });

    it('excludes a report whose JQL nothing else uses', () => {
      expect(groupFor(doc('gantt', 'ganttCopy', 'billing'), reports.billing!.queryParams)).toBeNull();
    });
  });

  describe('what counts as the same question', () => {
    it.each([
      ['loadChildren', 'deepGantt'],
      ['childJQL', 'childJql'],
      ['jql', 'billing'],
    ])('%s splits the group', (_label, otherId) => {
      const groups = childQueryGroups(doc('gantt', otherId), reports);

      // Two reports, two distinct questions, so no group reaches two members.
      expect(groups.size).toBe(0);
    });
  });

  describe('nodes that never fetch', () => {
    it('walks into nested sections', () => {
      const nodes = [savedReportNode('gantt'), sectionNode('Q3', [sectionNode('Detail', [savedReportNode('table')])])];

      expect(groupFor(nodes, reports.table!.queryParams)).toEqual(['cf1']);
    });

    it('ignores inline values', () => {
      expect(childQueryGroups([savedReportNode('gantt'), inlineValueNode('count')], reports).size).toBe(0);
    });

    it('ignores unknown nodes written by a newer client', () => {
      const unknown = { id: 'u', type: 'unknown', params: { originalType: 'chart', raw: {} } } as LayoutNode;

      expect(childQueryGroups([savedReportNode('gantt'), unknown], reports).size).toBe(0);
    });

    /**
     * An unresolvable id renders `MissingReportNote` instead of a `ChildReport`, so it never fetches.
     * Counting it would turn a lone report into a "group" and hand it an override for no reason.
     */
    it('skips a reportId no saved report answers to', () => {
      expect(childQueryGroups(doc('gantt', 'deleted'), reports).size).toBe(0);
    });
  });

  /**
   * An inline report renders a `ChildReport` exactly as a saved-report node does, so it issues exactly
   * the same request and has to be grouped with everything else asking the same question. This is the
   * shape the secondary-slot migration produces — two inline reports over one JQL
   * (spec/018-card-report/alt-plan.md).
   */
  describe('inline reports', () => {
    const cards = params({ jql: ORDER_JQL, primaryReportType: 'cards', cardsMode: 'status' });
    const chart = params({ jql: ORDER_JQL, primaryReportType: 'start-due' });

    it('groups two inline reports over one JQL', () => {
      const nodes = [inlineReportNode(chart), inlineReportNode(cards)];

      expect(childQueryGroups(nodes, reports).get(queryKeyOf({ jql: ORDER_JQL }))).toEqual([]);
      expect(groupFor(nodes, cards)).toEqual([]);
    });

    it('groups an inline report with a saved-report child asking the same question', () => {
      const nodes = [savedReportNode('table'), inlineReportNode(cards)];

      // The Table's column field is loaded by both, so their requests stay byte-identical.
      expect(groupFor(nodes, cards)).toEqual(['cf1']);
      expect(groupFor(nodes, reports.table!.queryParams)).toEqual(['cf1']);
    });

    it('leaves an inline report asking a different question on its own', () => {
      const nodes = [savedReportNode('billing'), inlineReportNode(cards)];

      expect(childQueryGroups(nodes, reports).size).toBe(0);
    });

    it('finds an inline report nested in a section', () => {
      const nodes = [savedReportNode('table'), sectionNode('Q3', [inlineReportNode(cards)])];

      expect(groupFor(nodes, cards)).toEqual(['cf1']);
    });
  });

  /**
   * Every child parses to at least one column because `tableColumns` has a non-empty default, so if
   * that default required a field it would silently widen every group in every document.
   */
  it('contributes nothing for the default identity column', () => {
    expect(childQueryGroups(doc('gantt', 'ganttCopy'), reports).get(queryKeyOf({ jql: ORDER_JQL }))).toEqual([]);
  });

  /**
   * spec/016-report-of-reports/006-url-state Phase 3. What a child actually fetches is its saved
   * `queryParams` *with its node's overrides applied*, so that is what the grouping has to see.
   * Grouping on the saved string instead doesn't throw and doesn't render wrong — the group just
   * splits and costs a fetch, which is the exact failure this module exists to prevent.
   */
  describe('a child with configuration overrides', () => {
    const overridden = (reportId: string, overrides: string) => savedReportNode(reportId, overrides);

    it('groups on the overridden query, not the saved one', () => {
      const nodes = [savedReportNode('gantt'), overridden('billing', params({ jql: ORDER_JQL }))];

      // `billing` is saved against a different project; the override moves it into ORDER's group.
      expect(childQueryGroups(nodes, reports).get(queryKeyOf({ jql: ORDER_JQL }))).toEqual([]);
    });

    it('splits a group when an override changes a member away from it', () => {
      const nodes = [savedReportNode('gantt'), overridden('ganttCopy', params({ jql: 'project = BILLING' }))];

      expect(childQueryGroups(nodes, reports).size).toBe(0);
    });

    it('unions the overridden columns rather than the saved ones', () => {
      const nodes = [savedReportNode('gantt'), overridden('table', params({ tableColumns: columns('field:cf9') }))];
      const groups = childQueryGroups(nodes, reports);

      expect(groups.get(queryKeyOf({ jql: ORDER_JQL }))).toEqual(['cf9']);
    });
  });
});

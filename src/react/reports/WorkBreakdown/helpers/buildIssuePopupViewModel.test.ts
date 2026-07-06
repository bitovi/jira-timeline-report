import { describe, test, expect } from 'vitest';
import { buildIssuePopupViewModel } from './buildIssuePopupViewModel';
import type { IssueOrRelease } from '../types';

const d = (s: string) => new Date(s);

describe('buildIssuePopupViewModel', () => {
  test('builds the overall rollup status/date/label', () => {
    const issue: IssueOrRelease = {
      key: 'OUT-142',
      summary: '100 Stores',
      type: 'Epic',
      url: 'https://example.atlassian.net/browse/OUT-142',
      rollupStatuses: {
        rollup: { status: 'ontrack', start: d('2025-02-12'), due: d('2025-03-09') },
      },
    };

    const vm = buildIssuePopupViewModel(issue);

    expect(vm.colorClass).toBe('color-text-and-bg-ontrack');
    expect(vm.statusLabel).toBe('On track');
    expect(vm.dateRangeLabel).toBe('Feb 12 – Mar 9');
    expect(vm.wasLabel).toBeUndefined();
    expect(vm.warningMessage).toBeUndefined();
  });

  test('surfaces a warning message only when statusFrom.warning is true', () => {
    const issue: IssueOrRelease = {
      key: 'OUT-88',
      summary: 'Digital Channel sales',
      rollupStatuses: {
        rollup: {
          status: 'behind',
          start: d('2025-06-05'),
          due: d('2025-07-24'),
          lastPeriod: { due: d('2025-06-19') },
          statusFrom: { message: 'Dev slipped 5 weeks vs last period', warning: true },
        },
      },
    };

    const vm = buildIssuePopupViewModel(issue);

    expect(vm.wasLabel).toBe('was Jun 19');
    expect(vm.warningMessage).toBe('Dev slipped 5 weeks vs last period');
  });

  test('does not surface a non-warning statusFrom message', () => {
    const issue: IssueOrRelease = {
      key: 'OUT-1',
      summary: 'Quiet epic',
      rollupStatuses: {
        rollup: { status: 'complete', statusFrom: { message: 'Own status' } },
      },
    };

    expect(buildIssuePopupViewModel(issue).warningMessage).toBeUndefined();
  });

  test('builds one row per work type, marking types with no work as hasWork: false', () => {
    const issue: IssueOrRelease = {
      key: 'OUT-142',
      summary: '100 Stores',
      rollupStatuses: {
        rollup: { status: 'ontrack' },
        dev: {
          status: 'complete',
          start: d('2025-02-12'),
          due: d('2025-02-28'),
          issueKeys: ['S-1', 'S-2'],
          startFrom: { message: 'sprint start', reference: { url: 'https://x/S-1', summary: 'Digital menu board' } },
          dueTo: { message: 'due date', reference: { url: 'https://x/S-3', summary: 'Delivery aggregators' } },
        },
        qa: { status: 'behind', due: d('2025-03-09'), start: d('2025-03-01'), issueKeys: ['S-1'] },
        uat: { status: 'unknown', due: null, issueKeys: [] },
      },
    };

    const vm = buildIssuePopupViewModel(issue);
    const [design, dev, qa, uat] = vm.workTypeRows;

    expect(design.hasWork).toBe(false);
    expect(design.label).toBe('Design');
    expect(design.symbol).toBe('d');

    expect(dev.hasWork).toBe(true);
    expect(dev.symbol).toBe('D');
    expect(dev.statusLabel).toBe('Complete');
    expect(dev.dateRangeLabel).toBe('Feb 12 – Feb 28');
    expect(dev.start).toEqual({
      date: 'Feb 12',
      url: 'https://x/S-1',
      summary: 'Digital menu board',
      message: 'sprint start',
    });
    expect(dev.due).toEqual({
      date: 'Feb 28',
      url: 'https://x/S-3',
      summary: 'Delivery aggregators',
      message: 'due date',
    });

    expect(qa.hasWork).toBe(true);
    expect(qa.statusLabel).toBe('Behind');
    expect(qa.start).toBeUndefined();
    expect(qa.due).toBeUndefined();

    // uat has a `qa`-like object present but empty issueKeys → no work.
    expect(uat.hasWork).toBe(false);
  });

  test('marks a work-type row with a slipped date', () => {
    const issue: IssueOrRelease = {
      key: 'OUT-88',
      summary: 'Digital Channel sales',
      rollupStatuses: {
        rollup: { status: 'behind' },
        dev: {
          status: 'behind',
          start: d('2025-06-19'),
          due: d('2025-07-24'),
          issueKeys: ['D-1'],
          lastPeriod: { due: d('2025-06-19') },
        },
      },
    };

    const vm = buildIssuePopupViewModel(issue);
    const dev = vm.workTypeRows.find((row) => row.type === 'dev');

    expect(dev?.wasLabel).toBe('was Jun 19');
  });
});

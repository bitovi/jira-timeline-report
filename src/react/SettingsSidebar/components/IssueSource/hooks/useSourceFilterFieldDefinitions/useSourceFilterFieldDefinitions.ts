import { useMemo } from 'react';

import type { FilterFieldDefinition } from '../../../../../ReportControls/components/Filters/components/FilterRowsBuilder';
import type { SourceFilterField } from '../../../../../../jira/rollup/filter-rows/source-filter-rows';

import { value } from '../../../../../../can';
import routeData from '../../../../../../canjs/routing/route-data';
import { allStatusesSorted } from '../../../../../../jira/normalized/normalize';
import { useCanObservable } from '../../../../../hooks/useCanObservable';

type DerivedIssueSlice = { status: string; type: string; labels?: string[] };

const toOptions = (values: string[]) => values.map((value) => ({ label: value, value }));

const sortedUnique = (values: string[]) => [...new Set(values)].sort();

/**
 * Field definitions for the Sources panel's "Filter loaded issues" rules. Options come from the
 * UNFILTERED derived issues, so a value the rules already exclude can still be picked.
 */
export const useSourceFilterFieldDefinitions = (): FilterFieldDefinition<SourceFilterField>[] => {
  const derivedIssues = useCanObservable(value.from<DerivedIssueSlice[] | undefined>(routeData, 'derivedIssues'));

  return useMemo(() => {
    const issues = derivedIssues ?? [];
    return [
      {
        field: 'status',
        label: 'Status',
        operators: ['is', 'is not'],
        options: toOptions(allStatusesSorted(issues)),
      },
      {
        field: 'issueType',
        label: 'Issue type',
        operators: ['is', 'is not'],
        options: toOptions(sortedUnique(issues.map((issue) => issue.type))),
      },
      {
        field: 'labels',
        label: 'Labels',
        operators: ['is', 'is not'],
        options: toOptions(sortedUnique(issues.flatMap((issue) => issue.labels ?? []))),
      },
    ];
  }, [derivedIssues]);
};

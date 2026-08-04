import { describe, it, expect } from 'vitest';

import { getIssueHierarchyUnderType } from './timeline-report-view-model.js';

// The issue-type-config hierarchy (what `issueTimingCalculations` is built from). Level 0 is
// labeled "Story" here regardless of what the loaded JQL data calls it.
const timingCalculations = [
  { type: 'Outcome', hierarchyLevel: 3, calculation: 'widestRange' },
  { type: 'Initiative', hierarchyLevel: 2, calculation: 'widestRange' },
  { type: 'Epic', hierarchyLevel: 1, calculation: 'widestRange' },
  { type: 'Story', hierarchyLevel: 0, calculation: 'widestRange' },
  { type: 'Assignment', hierarchyLevel: -1, calculation: 'parentOnly' },
];

const names = (calcs) => calcs.map((c) => c.type);

describe('getIssueHierarchyUnderType', () => {
  it('slices from the primary level down when the "Report on" label matches the config name', () => {
    const issueHierarchy = [
      { name: 'Epic', hierarchyLevel: 1 },
      { name: 'Story', hierarchyLevel: 0 },
    ];
    const result = getIssueHierarchyUnderType(timingCalculations, 'Epic', undefined, issueHierarchy);
    expect(names(result)).toEqual(['Epic', 'Story', 'Assignment']);
  });

  it('matches by hierarchy LEVEL when the loaded-data label differs from the config name', () => {
    // JQL `type = Risk` loads only Risks, so the data-derived hierarchy labels level 0 "Risk",
    // while the config hierarchy calls level 0 "Story". Matching by name would fail to find "Risk";
    // matching by level must still slice from level 0.
    const issueHierarchy = [{ name: 'Risk', hierarchyLevel: 0 }];
    const result = getIssueHierarchyUnderType(timingCalculations, 'Risk', undefined, issueHierarchy);
    expect(names(result)).toEqual(['Story', 'Assignment']);
  });

  it('caps the descent at the "To" level, resolved by level too', () => {
    const issueHierarchy = [
      { name: 'Outcome', hierarchyLevel: 3 },
      { name: 'Initiative', hierarchyLevel: 2 },
      { name: 'Epic', hierarchyLevel: 1 },
      { name: 'Story', hierarchyLevel: 0 },
    ];
    const result = getIssueHierarchyUnderType(timingCalculations, 'Outcome', 'Epic', issueHierarchy);
    expect(names(result)).toEqual(['Outcome', 'Initiative', 'Epic']);
  });

  it('falls back to name matching when the type is absent from issueHierarchy', () => {
    // Nothing of the primary type was loaded, so it is not in the data-derived hierarchy; the
    // config name still resolves it.
    const result = getIssueHierarchyUnderType(timingCalculations, 'Initiative', undefined, []);
    expect(names(result)).toEqual(['Initiative', 'Epic', 'Story', 'Assignment']);
  });

  it('returns the full list when the primary type cannot be resolved at all', () => {
    const result = getIssueHierarchyUnderType(timingCalculations, 'Nonexistent', undefined, []);
    expect(names(result)).toEqual(['Outcome', 'Initiative', 'Epic', 'Story', 'Assignment']);
  });
});

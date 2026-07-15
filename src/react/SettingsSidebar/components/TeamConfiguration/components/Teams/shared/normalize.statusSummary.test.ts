import { describe, it, expect } from 'vitest';
import { createNormalizeConfiguration } from './normalize';
import type { AllTeamData } from '../services/team-configuration';

const allData = {
  __GLOBAL__: {
    defaults: {
      sprintLength: 10,
      velocityPerSprint: 21,
      tracks: 1,
      spreadEffortAcrossDates: false,
      estimateField: null,
      confidenceField: null,
      startDateField: null,
      dueDateField: null,
      statusSummaryField: 'Status Summary',
    },
  },
} as unknown as AllTeamData;

// `getTeamKey`/`getHierarchyLevel` are supplied by `normalizeIssue`'s `optionsWithDefaults` in the
// real pipeline; stub them here the same way, rather than passing the extractor-only config back
// into itself (which lacks these methods).
const teamKeyConfig = { getTeamKey: () => undefined, getHierarchyLevel: () => 0 } as never;

describe('createNormalizeConfiguration statusSummary', () => {
  it('requests the configured status summary field', () => {
    expect(createNormalizeConfiguration(allData).fields).toContain('Status Summary');
  });

  it('extracts the field value via getStatusSummary', () => {
    const config = createNormalizeConfiguration(allData);
    const issue = { fields: { 'Status Summary': 'Shipping Friday' } } as never;
    expect(config.getStatusSummary?.(issue, teamKeyConfig)).toBe('Shipping Friday');
  });

  it('returns null when the field is unset or the sentinel is used', () => {
    const none = {
      __GLOBAL__: { defaults: { ...allData.__GLOBAL__.defaults, statusSummaryField: 'status-summary-not-used' } },
    } as unknown as AllTeamData;
    const config = createNormalizeConfiguration(none);
    const issue = { fields: { 'Status Summary': 'ignored' } } as never;
    expect(config.getStatusSummary?.(issue, teamKeyConfig)).toBeNull();
  });
});

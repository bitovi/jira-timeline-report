import type { ReportContext } from './index';

// Matches the sample data's hierarchy (Initiative → Epic → Story).
export const MOCK_CONTEXT: ReportContext = {
  rollupLevels: [
    { type: 'Initiative', hierarchyLevel: 2, calculation: 'childrenOnly' },
    { type: 'Epic', hierarchyLevel: 1, calculation: 'widestRange' },
    { type: 'Story', hierarchyLevel: 0, calculation: 'parentOnly' },
  ],
  normalizeConfig: {},
  compareTo: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
};

import { reports } from './reports';

type Feature = {
  name: string;
  subtitle: string;
  featureFlag: string;
  onByDefault: boolean;
};

export const nonReportsFeatures: Feature[] = [
  // `secondaryReport` used to live here. The slot it gated is gone, and its report is now the
  // `cards` entry in `reports.ts` — which derives the `cardsReport` flag below. Anyone who had the
  // old flag on is carried over to the new one by the alias in `jira/features/fetcher.ts`.
  // See spec/018-card-report/alt-plan.md § Delete the slot.
  {
    name: 'Work Breakdowns',
    subtitle: '',
    featureFlag: 'workBreakdowns',
    onByDefault: false,
  },
  // Gates the Storage panel only. Everything behind it — the pointer, the backend seam, the
  // migration — ships regardless; a site that never opens the panel keeps the legacy record it
  // already has. See spec/026-storage-saved-reports.
  {
    name: 'Reports Storage',
    subtitle: 'Choose where saved reports are stored, including one Jira work item per report.',
    featureFlag: 'reportsStorage',
    onByDefault: false,
  },
  // Gates the Sources tab's "Load all blockers recursively" checkbox. The loader itself always
  // ships; a URL that already carries `loadBlockers=true` keeps working with the flag off, the
  // same way a flagged-off report still renders when the URL names it.
  //
  // The flag is `recursiveBlockers`, deliberately NOT `loadBlockers` — that is the route-data param,
  // and two different things sharing a name across two stores would be a trap.
  // See spec/036-load-blockers-recursiveley.
  {
    name: 'Recursive Blockers',
    subtitle: 'Load the work items blocking your JQL results, transitively.',
    featureFlag: 'recursiveBlockers',
    onByDefault: false,
  },
] as const;

export const features = reports
  .filter((report) => !report.onByDefault)
  .map((report) => {
    return {
      name: report.name,
      subtitle: report.featureSubtitle,
      featureFlag: report.featureFlag,
      onByDefault: report.onByDefault,
    };
  })
  .concat(nonReportsFeatures);

export const featureMap: Record<string, Feature> = features.reduce(
  (acc, feature) => {
    acc[feature.featureFlag] = feature;
    return acc;
  },
  {} as Record<string, Feature>,
);

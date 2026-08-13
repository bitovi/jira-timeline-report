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

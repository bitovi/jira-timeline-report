import { reports } from './reports';

type Feature = {
  name: string;
  subtitle: string;
  featureFlag: string;
  onByDefault: boolean;
};

export const nonReportsFeatures: Feature[] = [
  {
    name: 'Secondary Report',
    subtitle: '',
    featureFlag: 'secondaryReport',
    onByDefault: false,
  },
  {
    name: 'Work Breakdowns',
    subtitle: '',
    featureFlag: 'workBreakdowns',
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

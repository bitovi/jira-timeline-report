// This lists all reports and if they are under a feature flag or not.

export type Report = {
  key: string;
  name: string;
  featureSubtitle: string;
  featureFlag: string;
  onByDefault: boolean;
};

export const reports: Report[] = [
  {
    key: 'start-due',
    name: 'Gantt Chart',
    featureSubtitle: '',
    featureFlag: 'ganttChart',
    onByDefault: true,
  },
  {
    key: 'due',
    name: 'Scatter Plot',
    featureSubtitle: '',
    featureFlag: 'scatterPlot',
    onByDefault: true,
  },
  {
    key: 'estimation-progress',
    name: 'Estimation Progress',
    featureSubtitle: '',
    featureFlag: 'estimationProgress',
    onByDefault: false,
  },
  {
    key: 'auto-scheduler',
    name: 'Auto-Scheduler',
    featureSubtitle: '',
    featureFlag: 'autoScheduler',
    onByDefault: false,
  },
  {
    key: 'estimate-analysis',
    name: 'Estimation Analysis',
    featureSubtitle: '',
    featureFlag: 'estimationAnalysis',
    onByDefault: false,
  },
  {
    key: 'table',
    name: 'Estimation Table',
    featureSubtitle: '',
    featureFlag: 'estimationTable',
    onByDefault: false,
  },
] as const;

export type ReportKeys = (typeof reports)[number]['key'];

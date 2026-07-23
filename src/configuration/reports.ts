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
    key: 'grouper',
    name: 'Grouper',
    featureSubtitle: 'A report that groups issues based on various criteria.',
    featureFlag: 'grouper',
    onByDefault: false,
  },
  {
    key: 'table',
    name: 'Estimation Table',
    featureSubtitle: '',
    featureFlag: 'estimationTable',
    onByDefault: false,
  },
  {
    key: 'table2',
    name: 'Table (beta)',
    featureSubtitle: 'Unified table & grouper report',
    featureFlag: 'tableReport',
    onByDefault: false,
  },
  {
    key: 'flow-metrics',
    name: 'Flow Metrics',
    featureSubtitle: 'Cycle time, throughput, and WIP age',
    featureFlag: 'flowMetrics',
    onByDefault: false,
  },
  {
    key: 'time-in-status',
    name: 'Time in Status',
    featureSubtitle: 'Average and median time issues spend in each workflow status',
    featureFlag: 'timeInStatus',
    onByDefault: false,
  },
] as const;

export type ReportKeys = (typeof reports)[number]['key'];

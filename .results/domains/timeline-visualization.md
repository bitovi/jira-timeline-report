# Timeline Visualization Domain

## Overview

The Timeline Visualization Domain provides specialized components for project timeline reporting, including Gantt charts, scatter plots, auto-scheduling with Monte Carlo simulation, and interactive report controls. This domain combines complex mathematical algorithms with rich visual interfaces to deliver sophisticated project management insights.

## Architecture Pattern

The domain follows a **Layered Visualization Architecture**:

- **Control Layer**: React components for user interaction and filtering
- **Visualization Layer**: Both CanJS and React components for rendering charts
- **Algorithm Layer**: Monte Carlo simulation and scheduling algorithms
- **Data Layer**: Processed issue data optimized for timeline display

## Key Components

### 1. Report Control System (`./src/react/ReportControls/`)

**Purpose**: User interface for configuring timeline reports and filters

**Core Pattern**: Conditional rendering based on report type with specialized controls

```tsx
export const ReportControls: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  if (primaryReportType === 'estimation-progress' || primaryReportType === 'grouper') {
    return (
      <>
        <SelectReportType />
        <SelectIssueType />
      </>
    );
  }

  if (primaryReportType === 'auto-scheduler') {
    return (
      <ReportControlsWrapper>
        <AutoSchedulerControls />
      </ReportControlsWrapper>
    );
  }
  // ... other report types
};
```

**Key Controls**:

- `SelectReportType` - Switch between different visualization modes
- `SelectIssueType` - Filter by Jira issue types
- `Filters` - Status, release, and issue type filtering
- `ViewSettings` - Grouping, sorting, and display options
- `CompareSlider` - Temporal comparison controls
- `AutoSchedulerControls` - Monte Carlo simulation parameters

### 2. Gantt Chart Visualization (`./src/canjs/reports/gantt-grid.js`)

**Purpose**: Complex interactive Gantt chart with hierarchical issue display

**Core Pattern**: CanJS StacheElement with observable data binding and DOM manipulation

**Key Features**:

- Hierarchical issue display with parent-child relationships
- Interactive timeline bars with drag-and-drop capabilities
- Real-time tooltip display with issue details
- Date range navigation and zoom controls
- Progress indicators and completion percentages

**Integration with React**:

```javascript
// React components embedded in CanJS templates
import PercentComplete from '../../react/reports/GanttReport/PercentComplete';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

// Render React component within CanJS
const root = createRoot(domElement);
root.render(createElement(PercentComplete, props));
```

### 3. Auto-Scheduler with Monte Carlo Simulation

**Purpose**: Advanced project scheduling using statistical modeling and uncertainty analysis

**Core Pattern**: Asynchronous simulation with batch processing and real-time updates

```typescript
export function runMonteCarlo(
  issues: DerivedIssue[],
  {
    onBatch,
    onComplete,
    batchSize = 20,
    batches = 500,
    timeBetweenBatches = 1,
    probabilisticallySelectIssueTiming = true,
  }: {
    onBatch(BatchResults: { batchData: BatchDatas; percentComplete: number }): void;
    onComplete(): void;
    batchSize?: number;
    batches?: number;
    timeBetweenBatches?: number;
    probabilisticallySelectIssueTiming?: boolean;
  },
) {
  const linkedIssues = linkIssues(issues, probabilisticallySelectIssueTiming);
  // ... simulation logic
}
```

**Algorithm Components**:

- `monte-carlo.ts` - Statistical simulation engine
- `schedule.ts` - Issue scheduling logic with dependencies
- `link-issues.ts` - Dependency graph construction
- `stats-analyzer.ts` - Statistical analysis of simulation results
- `workplan.ts` - Team capacity and work planning

### 4. Scatter Plot Timeline (`./src/canjs/reports/scatter-timeline.js`)

**Purpose**: Scatter plot visualization for issue timeline analysis

**Key Features**:

- Date-based scatter plotting
- Issue clustering and grouping
- Interactive data point selection
- Time range filtering

### 5. Report Rendering Components

**Modern React Reports**:

- `AutoScheduler.tsx` - Monte Carlo scheduling interface
- `EstimateAnalysis.tsx` - Estimation accuracy analysis
- `GroupingReport.tsx` - Hierarchical grouping displays
- `EstimationProgress.tsx` - Progress tracking visualizations

**Legacy CanJS Reports**:

- `status-report.js` - Status distribution charts
- `table-grid.js` - Tabular data display

## Data Binding Patterns

### Observable-Driven Updates

The visualization components use reactive data binding:

```typescript
// React hooks consuming observable data
const useTimelineData = () => {
  const routeData = useCanObservable(canJSRouteData);
  const derivedIssues = routeData.derivedIssues;
  return useMemo(() => processTimelineData(derivedIssues), [derivedIssues]);
};
```

### Real-time Simulation Updates

Monte Carlo simulations provide streaming updates:

```typescript
const [simulationData, setSimulationData] = useState<BatchDatas[]>([]);

const handleBatch = ({ batchData, percentComplete }: BatchResults) => {
  setSimulationData((prev) => [...prev, batchData]);
  setProgress(percentComplete);
};
```

## Interactive Features

### 1. Timeline Navigation

- Date range selection and zoom controls
- Scroll-based timeline navigation
- Keyboard shortcuts for timeline manipulation

### 2. Issue Interaction

- Hover tooltips with detailed issue information
- Click-to-expand hierarchical views
- Drag-and-drop for manual scheduling adjustments

### 3. Filter Integration

- Real-time filtering without page reload
- Multiple simultaneous filter application
- URL-synchronized filter state

### 4. Export Capabilities

- Timeline screenshot generation
- Data export in multiple formats
- Shareable URL generation

## Performance Optimizations

### 1. Virtualization

- Large dataset handling with virtual scrolling
- Lazy loading of timeline segments
- Progressive rendering for complex charts

### 2. Simulation Performance

- Batch processing with configurable batch sizes
- Worker thread utilization for heavy calculations
- Cancellable simulation runs

### 3. Rendering Optimization

- Efficient DOM updates using CanJS observables
- React component memoization
- Canvas-based rendering for complex visualizations

## Mathematical Algorithms

### Monte Carlo Simulation

```typescript
export type BatchIssueData = {
  linkedIssue: LinkedIssue;
  startDays: number[];
  dueDays: number[];
  daysOfWork: number[];
  trackNumbers: number[];
};
```

### Critical Path Analysis

- Dependency graph traversal
- Resource constraint modeling
- Uncertainty propagation through project networks

### Statistical Analysis

- Confidence interval calculations
- Distribution analysis of completion times
- Risk assessment metrics

## Integration Points

### Data Sources

- Processed Jira data from data processing pipeline
- User configuration from settings domain
- Real-time filter state from routing domain

### External Libraries

- D3.js for complex visualizations (legacy components)
- React for modern component architecture
- Canvas API for high-performance rendering

This domain represents the core value proposition of the application, transforming complex project data into actionable visual insights for project management and planning.

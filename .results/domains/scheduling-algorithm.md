# Scheduling Algorithm Domain

## Overview

The Scheduling Algorithm Domain implements advanced project scheduling capabilities using Monte Carlo simulation, critical path analysis, and resource constraint modeling. This domain provides sophisticated mathematical algorithms for project management with uncertainty modeling and statistical analysis.

## Architecture Pattern

The domain follows a **Mathematical Algorithms for Project Management** pattern:

- **Monte Carlo Simulation**: Statistical modeling of project completion uncertainty
- **Dependency Graph**: Issue linking and critical path analysis
- **Resource Scheduling**: Team capacity and parallel work management
- **Statistical Analysis**: Confidence intervals and risk assessment

## Key Components

### 1. Monte Carlo Simulation Engine (`./src/react/reports/AutoScheduler/scheduler/monte-carlo.ts`)

**Purpose**: Run statistical simulations to model project completion uncertainty

**Core Pattern**: Batch-based asynchronous simulation with real-time progress updates

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

  function runBatchAndLoop() {
    const batchData = runBatch(linkedIssues, { batchSize });
    batchesRemaining--;
    onBatch({ batchData, percentComplete: percentComplete() });

    if (batchesRemaining > 0) {
      timer = setTimeout(runBatchAndLoop, timeBetweenBatches);
    } else {
      onComplete();
    }
  }

  return { linkedIssues, runBatchAndLoop, teardown };
}
```

**Simulation Features**:

- **Batch Processing**: Configurable batch sizes for responsive UI updates
- **Probabilistic Timing**: Random sampling from issue estimation distributions
- **Progress Tracking**: Real-time completion percentage reporting
- **Cancellation Support**: Ability to stop long-running simulations

### 2. Issue Dependency System (`./src/react/reports/AutoScheduler/scheduler/link-issues.ts`)

**Purpose**: Build dependency graphs and manage issue relationships

**Core Pattern**: Graph construction with mutable work state for simulation

```typescript
export type LinkedIssue = DerivedIssue & {
  readonly linkedChildren: LinkedIssue[];
  readonly linkedParent: LinkedIssue | null;
  readonly linkedBlocks: LinkedIssue[];
  readonly linkedBlockedBy: LinkedIssue[];
  readonly blocksWorkDepth: number;
  readonly mutableWorkItem: {
    daysOfWork: number;
    startDay: number | null;
    artificiallyDelayed?: boolean;
    track?: number;
  };
};

export function linkIssues(issues: DerivedIssue[], probabilisticallySelectIssueTiming: boolean): LinkedIssue[] {
  const clones = issues.map((issue) => ({
    linkedChildren: [],
    linkedParent: null,
    linkedBlocks: [],
    linkedBlockedBy: [],
    blocksWorkDepth: -1,
    mutableWorkItem: {
      daysOfWork: issue.derivedTiming.deterministicTotalDaysOfWork,
      startDay: null,
    },
    ...issue,
  }));

  const issueByKey = indexByKey(clones, 'key');

  // Build parent-child relationships
  clones.forEach((issue) => {
    if (issue.parentKey && issueByKey[issue.parentKey]) {
      const parent = issueByKey[issue.parentKey];
      issue.linkedParent = parent;
      parent.linkedChildren.push(issue);
    }
  });

  // Build blocking relationships
  // Calculate blocking work depth for critical path

  return clones as LinkedIssue[];
}
```

**Relationship Types**:

- **Parent-Child**: Hierarchical issue relationships
- **Blocking Dependencies**: Issue A must complete before issue B can start
- **Team Assignments**: Resource allocation and capacity constraints
- **Work Depth**: Critical path analysis for scheduling priority

### 3. Resource-Constrained Scheduling (`./src/react/reports/AutoScheduler/scheduler/schedule.ts`)

**Purpose**: Schedule issues within team capacity constraints and dependencies

**Core Pattern**: Recursive scheduling with constraint satisfaction

```typescript
export function scheduleIssues(sortedLinkedIssues: LinkedIssue[]) {
  // Reset all issues to unscheduled state
  sortedLinkedIssues.forEach(resetLinkedIssue);

  // Create team work capacity tracking
  const teamWork = makeTeamWork(sortedLinkedIssues);

  // Schedule each issue respecting dependencies and capacity
  sortedLinkedIssues.forEach((issue) => {
    planIssue(issue, teamWork);
  });

  return teamWork;
}

function planIssue(issue: LinkedIssue, workByTeams: TeamWorkIndex) {
  // Check if all blocking dependencies are scheduled
  if (areAllBlockersScheduled(issue)) {
    if (issue.mutableWorkItem.startDay == null) {
      // Find earliest start time based on dependencies
      const firstDayWorkCouldStartOn = earliestStartTimeFromBlockers(issue);

      // Schedule work within team capacity constraints
      scheduleIssue(issue, firstDayWorkCouldStartOn, workByTeams);

      // Recursively schedule blocked issues
      if (issue.linkedBlocks) {
        issue.linkedBlocks.sort(sortByBlocksWorkDepth).forEach((blockedIssue) => planIssue(blockedIssue, workByTeams));
      }
    }
  }
}
```

**Scheduling Constraints**:

- **Dependency Ordering**: Issues must wait for dependencies to complete
- **Resource Capacity**: Teams can only work on limited parallel tasks
- **Critical Path**: Priority scheduling for path-critical issues
- **Work Distribution**: Load balancing across team capacity

### 4. Work Planning System (`./src/react/reports/AutoScheduler/scheduler/workplan.ts`)

**Purpose**: Manage team capacity and parallel work allocation

**Core Pattern**: Track-based work allocation with capacity limits

```typescript
export class WorkPlans {
  plans: WorkItem[][];

  constructor(public parallelWorkLimit: number) {
    this.plans = Array(parallelWorkLimit)
      .fill(null)
      .map(() => []);
  }

  addWork(workItem: WorkItem, startDay: number): void {
    // Find the track with earliest availability
    const availableTrack = this.findEarliestAvailableTrack(startDay, workItem.daysOfWork);

    // Add work to the selected track
    this.plans[availableTrack].push({
      ...workItem,
      track: availableTrack,
      startDay: this.getActualStartDay(availableTrack, startDay),
    });
  }

  findEarliestAvailableTrack(requestedStartDay: number, daysOfWork: number): number {
    // Algorithm to find optimal track placement
    // Considers existing work and capacity constraints
  }
}
```

**Work Allocation Features**:

- **Parallel Tracks**: Multiple simultaneous work streams per team
- **Capacity Management**: Respect team velocity and sprint constraints
- **Load Balancing**: Distribute work evenly across available capacity
- **Schedule Optimization**: Minimize project duration within constraints

### 5. Statistical Analysis (`./src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts`)

**Purpose**: Analyze simulation results and generate confidence intervals

**Core Pattern**: Statistical aggregation and distribution analysis

```typescript
export type BatchIssueData = {
  linkedIssue: LinkedIssue;
  startDays: number[];
  dueDays: number[];
  daysOfWork: number[];
  trackNumbers: number[];
};

export type BatchDatas = {
  batchIssueData: BatchIssueData[];
  lastDays: number[];
};

export function analyzeSimulationResults(batchResults: BatchDatas[]): AnalysisResults {
  const aggregatedData = aggregateBatchResults(batchResults);

  return {
    projectCompletion: {
      mean: calculateMean(aggregatedData.completionDays),
      median: calculateMedian(aggregatedData.completionDays),
      standardDeviation: calculateStandardDeviation(aggregatedData.completionDays),
      confidenceIntervals: calculateConfidenceIntervals(aggregatedData.completionDays),
    },

    issueAnalysis: aggregatedData.issues.map((issue) => ({
      key: issue.key,
      startDateDistribution: analyzeDistribution(issue.startDays),
      durationDistribution: analyzeDistribution(issue.daysOfWork),
      criticalPathProbability: calculateCriticalPathProbability(issue),
    })),

    riskMetrics: {
      scheduleRisk: calculateScheduleRisk(aggregatedData),
      resourceUtilization: calculateResourceUtilization(aggregatedData),
      bottleneckAnalysis: identifyBottlenecks(aggregatedData),
    },
  };
}
```

**Statistical Metrics**:

- **Completion Distributions**: Project finish date probability curves
- **Confidence Intervals**: 50%, 80%, 90% confidence bounds
- **Critical Path Analysis**: Probability an issue is on critical path
- **Risk Assessment**: Schedule risk and resource utilization metrics

## Mathematical Algorithms

### 1. Monte Carlo Methodology

**Random Sampling**:

```typescript
// Probabilistic work duration selection
function selectProbabilisticDuration(issue: DerivedIssue): number {
  const timing = issue.derivedTiming;

  // Use log-normal distribution for work estimates
  const logMean = Math.log(timing.estimatedDays);
  const logStdDev = timing.uncertaintyFactor;

  return Math.exp(normalRandomSample(logMean, logStdDev));
}
```

**Simulation Convergence**:

- **Sample Size**: Configurable number of simulation runs (default 10,000)
- **Batch Processing**: Real-time updates without blocking UI
- **Convergence Detection**: Monitor statistical stability

### 2. Critical Path Algorithm

**Depth-First Search for Dependencies**:

```typescript
function calculateBlocksWorkDepth(issue: LinkedIssue): number {
  if (issue.blocksWorkDepth !== -1) {
    return issue.blocksWorkDepth; // Memoized result
  }

  if (issue.linkedBlocks.length === 0) {
    issue.blocksWorkDepth = 0; // Leaf node
  } else {
    // Recursive depth calculation
    issue.blocksWorkDepth = 1 + Math.max(...issue.linkedBlocks.map(calculateBlocksWorkDepth));
  }

  return issue.blocksWorkDepth;
}
```

### 3. Resource Optimization

**Team Capacity Modeling**:

```typescript
interface TeamCapacity {
  velocity: number; // Story points per sprint
  sprintLength: number; // Days per sprint
  parallelWorkLimit: number; // Concurrent work items

  // Derived metrics
  pointsPerDay: number; // velocity / sprintLength
  capacityDays: number; // Available work days
}
```

## Performance Optimizations

### 1. Simulation Performance

- **Batch Processing**: Process simulations in configurable batches
- **Worker Threads**: Offload calculations to prevent UI blocking
- **Memory Management**: Efficient data structures for large simulations

### 2. Algorithm Efficiency

- **Memoization**: Cache expensive calculations (blocking depth, critical path)
- **Graph Algorithms**: Efficient dependency traversal
- **Early Termination**: Stop simulation when convergence is achieved

### 3. UI Responsiveness

- **Progressive Updates**: Stream results as they become available
- **Cancellation**: Allow users to stop long-running simulations
- **Progress Indicators**: Real-time feedback on simulation progress

## Integration Points

### Data Sources

- Derived issue data from data processing pipeline
- Team configuration from configuration domain
- User-specified simulation parameters

### Output Consumers

- React components for visualization
- Timeline charts showing probability distributions
- Risk analysis reports and dashboards

This domain provides the mathematical foundation for advanced project management capabilities, enabling users to understand project risks, optimize schedules, and make data-driven planning decisions.

# AutoScheduler Module Overview

This folder contains the main components and utilities for the AutoScheduler feature, which visualizes and simulates issue scheduling, dependencies, and team timelines in a grid-based report.

## Modules in `AutoScheduler/`

- **AutoScheduler.tsx**  
  The main React component for the Auto Scheduler report. It renders the scheduling grid, manages simulation state, and coordinates the display of teams, tracks, and issues. It also draws dependency lines between issues using SVG.

- **IssueSimulationRow.tsx**  
  Renders a single row in the simulation grid for an individual issue. Displays the issue summary, visualizes its scheduled time range, and allows toggling of detailed simulation data for each issue.

- **IssueSimulationDays.tsx**  
  Provides a detailed breakdown of the days associated with an issue’s simulation. Typically shown when a user expands an issue row for more granular scheduling information.

## Modules in `AutoScheduler/scheduler/`

The following starts from the bottom and builds up.

- **link-issues.ts**  
  Prepares `DerivedIssues` for use by the Monte-Carlo module. It sets up
  references between `LinkedIssues` based on parent/child and blockers.
  It also sets up the `mutable` area of a `LinkedIssue` as the same `LinkedIssues` are used across multiple calls to the scheduler to help performance.

- **workplan.ts**  
  Provides utilities and data structures for representing and manipulating work plans. It organizes issues, tracks, and teams into a structured plan that can be used for scheduling and visualization. It uses linked-lists.

- **schedule.ts**  
  Contains the core scheduling logic for issues (along with workplan.ts). Determines how issues are placed on the timeline, calculates work durations, and applies rules for scheduling based on dependencies and team assignments. 

- **monte-carlo.ts**  
  Implements Monte Carlo simulation logic for project scheduling. It runs multiple randomized simulations to estimate possible completion dates and project timelines, helping to quantify uncertainty and risk in scheduling.

- **stats-analyzer.ts**  
  Contains logic for analyzing simulation statistics, such as calculating start and due days for issues, aggregating results, and preparing data for the UI. Defines types and functions for working with simulation results.









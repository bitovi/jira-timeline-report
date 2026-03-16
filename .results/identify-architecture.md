# Architectural Domain Analysis

## Primary Architectural Domains

Based on the comprehensive file categorization and codebase analysis, the jira-timeline-report project exhibits the following key architectural domains:

### 1. **Data Processing Pipeline Domain**

- **Core Purpose**: Transform raw Jira data through multiple processing stages
- **Key Components**:
  - Raw data ingestion (`./src/jira/raw/`)
  - Normalization layer (`./src/jira/normalized/`)
  - Derived data computation (`./src/jira/derived/`)
  - Rollup aggregations (`./src/jira/rollup/`)
  - Final rollup with rollback (`./src/jira/rolledup-and-rolledback/`)
- **Pattern**: Multi-stage data transformation pipeline with clear separation of concerns
- **Files**: 35+ files in the jira data processing categories

### 2. **Hybrid UI Framework Domain**

- **Core Purpose**: Dual framework architecture supporting legacy and modern UI components
- **Key Components**:
  - **Modern React Layer**: 89 React components with hooks-based architecture
  - **Legacy CanJS Layer**: 8 CanJS components for timeline visualizations
  - **Service Integration**: React services layer bridging both frameworks
- **Pattern**: Progressive migration from CanJS to React while maintaining compatibility
- **Files**: 120+ UI-related files across both frameworks

### 3. **Timeline Visualization Domain**

- **Core Purpose**: Specialized components for timeline-based project reporting
- **Key Components**:
  - Gantt chart visualizations (`./src/canjs/reports/gantt-grid.js`)
  - Scatter plot timelines (`./src/canjs/reports/scatter-timeline.js`)
  - Auto-scheduler with Monte Carlo simulation (`./src/react/reports/AutoScheduler/`)
  - Report controls and filtering (`./src/react/ReportControls/`)
- **Pattern**: Domain-specific visualization components with complex data binding
- **Files**: 25+ visualization and reporting components

### 4. **State Management & Routing Domain**

- **Core Purpose**: Centralized state management with URL synchronization
- **Key Components**:
  - RouteData observable object (`./src/canjs/routing/route-data/route-data.js`)
  - State storage utilities (`./src/canjs/routing/state-storage.js`)
  - Dual routing system (web vs plugin)
  - Query parameter synchronization with report data
- **Pattern**: Observable-based state management with URL persistence
- **Files**: 15+ routing and state management files

### 5. **Atlassian Integration Domain**

- **Core Purpose**: Deep integration with Jira ecosystem
- **Key Components**:
  - Jira OIDC authentication helpers (`./src/jira-oidc-helpers/`)
  - Atlassian Connect configuration (`./public/atlassian-connect.json`)
  - Plugin vs web deployment strategies
  - JQL query processing and field mapping
- **Pattern**: Multi-deployment architecture (standalone web app + Jira plugin)
- **Files**: 20+ integration and authentication files

### 6. **Configuration & Persistence Domain**

- **Core Purpose**: Flexible configuration management across deployment modes
- **Key Components**:
  - Team configuration system (`./src/react/SettingsSidebar/components/TeamConfiguration/`)
  - Feature flags (`./src/configuration/features.ts`)
  - Storage abstraction layer (`./src/jira/storage/`)
  - Report persistence (`./src/configuration/reports.ts`)
- **Pattern**: Configurable system with storage abstraction for different environments
- **Files**: 25+ configuration and storage files

### 7. **Scheduling Algorithm Domain**

- **Core Purpose**: Advanced project scheduling with uncertainty modeling
- **Key Components**:
  - Monte Carlo simulation (`./src/react/reports/AutoScheduler/scheduler/monte-carlo.ts`)
  - Critical path analysis (`./src/react/reports/AutoScheduler/CriticalPath.tsx`)
  - Issue dependency linking (`./src/react/reports/AutoScheduler/scheduler/link-issues.ts`)
  - Statistical analysis (`./src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts`)
- **Pattern**: Mathematical algorithms for project management with statistical modeling
- **Files**: 8+ algorithm-specific files

## Architectural Patterns

### 1. **Layered Data Processing Architecture**

The application follows a clear layered approach for data processing:

```
Raw Jira Data → Normalized → Derived → Rolled Up → Rolled Back → UI Presentation
```

### 2. **Hybrid Framework Migration Pattern**

- Legacy CanJS components handle complex visualizations
- New React components with modern hooks for business logic
- Service layer provides bridge between frameworks

### 3. **Multi-Deployment Strategy**

- Single codebase supports both standalone web app and Jira plugin
- Environment-specific entry points and routing configurations
- Shared core logic with deployment-specific adapters

### 4. **Observable State Management**

- Central RouteData object manages application state
- URL synchronization for deep linking and bookmarking
- Event-driven updates across component hierarchy

### 5. **Domain-Driven Component Organization**

Components are organized by business domain rather than technical concerns:

- Report generation and visualization
- Settings and configuration
- User management and authentication
- Data filtering and transformation

## Key Architectural Constraints

1. **Backward Compatibility**: Must maintain CanJS components for existing timeline visualizations
2. **Atlassian Ecosystem**: Deep integration requirements with Jira APIs and deployment models
3. **Performance**: Large dataset processing requires efficient data transformation pipelines
4. **Multi-tenancy**: Support for both cloud-hosted and on-premise Jira instances
5. **Real-time Updates**: State synchronization between URL, local storage, and component state

## Technical Debt Areas

1. **Framework Duplication**: Maintaining both CanJS and React increases complexity
2. **State Management Complexity**: Multiple state synchronization mechanisms
3. **Type Safety**: Mixed JavaScript/TypeScript codebase with inconsistent typing
4. **Testing Coverage**: Limited test coverage across legacy components

This architectural analysis reveals a sophisticated domain-driven design with clear separation of concerns, though the hybrid framework approach introduces some complexity that should be addressed in future iterations.

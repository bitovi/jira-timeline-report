# Configuration & Persistence Domain

## Overview

The Configuration & Persistence Domain provides flexible configuration management and data persistence across different deployment environments. This domain implements a storage abstraction layer, feature flag system, team configuration management, and report persistence to support customizable behavior while maintaining data consistency.

## Architecture Pattern

The domain follows a **Configurable System with Storage Abstraction** pattern:

- **Storage Abstraction**: Environment-agnostic persistence layer
- **Feature Flags**: Runtime behavior configuration
- **Team Configuration**: Hierarchical configuration with inheritance
- **Report Persistence**: Saved report state management

## Key Components

### 1. Storage Abstraction Layer (`./src/jira/storage/`)

**Purpose**: Provide unified storage interface across web and plugin deployments

**Core Pattern**: Factory function creating environment-specific storage implementations

```typescript
export type StorageFactory = (jiraHelper: ReturnType<typeof jiraHelpers>) => {
  get: <TData>(key: string, defaultShape?: unknown) => Promise<TData | null>;
  update: <TData>(key: string, value: TData) => Promise<void>;
  storageInitialized: () => Promise<boolean>;
};

export type AppStorage = ReturnType<StorageFactory>;
```

**Environment Implementations**:

- **Web Storage** (`index.web.ts`): localStorage-based persistence
- **Plugin Storage** (`index.plugin.ts`): Atlassian Connect storage API

### 2. Feature Flag System (`./src/configuration/features.ts`)

**Purpose**: Runtime configuration of application features and report types

**Core Pattern**: Feature definitions with default states and metadata

```typescript
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
];

export const features = reports
  .filter((report) => !report.onByDefault)
  .map((report) => ({
    name: report.name,
    subtitle: report.featureSubtitle,
    featureFlag: report.featureFlag,
    onByDefault: report.onByDefault,
  }))
  .concat(nonReportsFeatures);
```

**Feature Management**:

- **Dynamic Feature Discovery**: Features derived from report configurations
- **Runtime Toggles**: User-controllable feature activation
- **Default Behavior**: Sensible defaults for new installations
- **Feature Metadata**: Display names and descriptions for UI

### 3. Team Configuration System

**Purpose**: Hierarchical configuration system with inheritance for team-specific settings

**Core Pattern**: Multi-level configuration with fallback inheritance

```typescript
// Team configuration with inheritance
export function createFullyInheritedConfig(teamData: TeamData, jiraFields: JiraField[], hierarchyLevels: string[]) {
  // Create configuration that inherits from parent levels
  // Handle field mappings, timing calculations, and team settings
  // Provide defaults for unconfigured values
}

// Field lookup creation
export function createTeamFieldLookup(allTeamData: FullyInheritedConfig) {
  // Generate field mapping lookup tables
  // Support custom field resolution
  // Handle team-specific field overrides
}
```

**Configuration Hierarchy**:

1. **Global Defaults**: System-wide default values
2. **All Teams Config**: Organization-level settings
3. **Team-Specific**: Individual team overrides
4. **Hierarchy Level**: Issue type-specific configuration

**Configuration Categories**:

- **Field Mappings**: Custom field to standard field mapping
- **Timing Calculations**: Team-specific estimation approaches
- **Velocity Settings**: Sprint and capacity configurations
- **Status Mappings**: Team-specific status workflows

### 4. Report Configuration (`./src/configuration/reports.ts`)

**Purpose**: Define available report types and their configuration

**Core Pattern**: Report registry with metadata and feature flags

```typescript
export const reports = [
  {
    key: 'gantt',
    name: 'Gantt Chart',
    featureFlag: 'ganttChart',
    onByDefault: true,
    featureSubtitle: 'Timeline visualization',
  },
  {
    key: 'auto-scheduler',
    name: 'Auto Scheduler',
    featureFlag: 'autoScheduler',
    onByDefault: false,
    featureSubtitle: 'Monte Carlo simulation',
  },
  // ... additional report types
];
```

**Report Properties**:

- **Unique Keys**: Stable identifiers for URL routing
- **Display Metadata**: User-facing names and descriptions
- **Feature Integration**: Linkage with feature flag system
- **Default Availability**: Control over out-of-box enabled features

### 5. Persistent Storage Patterns

**Web Environment Storage**:

```typescript
// localStorage-based implementation
export const createWebStorage = (jiraHelpers) => ({
  async get<TData>(key: string, defaultShape?: unknown): Promise<TData | null> {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultShape || null;
  },

  async update<TData>(key: string, value: TData): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  },

  async storageInitialized(): Promise<boolean> {
    return typeof localStorage !== 'undefined';
  },
});
```

**Plugin Environment Storage**:

```typescript
// Atlassian Connect storage API
export const createPluginStorage = (jiraHelpers) => ({
  async get<TData>(key: string, defaultShape?: unknown): Promise<TData | null> {
    return new Promise((resolve) => {
      AP.storage.get(key, (data) => {
        resolve(data || defaultShape || null);
      });
    });
  },

  async update<TData>(key: string, value: TData): Promise<void> {
    return new Promise((resolve) => {
      AP.storage.set(key, value, resolve);
    });
  },
});
```

## Configuration Data Types

### 1. Team Configuration Structure

```typescript
interface TeamConfig {
  // Field mappings
  fieldMappings: Record<string, string>;

  // Timing calculations per hierarchy level
  timingCalculations: Record<string, TimingMethod>;

  // Velocity and capacity settings
  velocity: {
    pointsPerSprint: number;
    sprintLength: number;
    parallelWorkLimit: number;
  };

  // Status workflow mappings
  statusMappings: {
    planningStatuses: string[];
    completedStatuses: string[];
    excludedStatuses: string[];
  };
}
```

### 2. Report State Persistence

```typescript
interface SavedReport {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;

  // Complete application state snapshot
  configuration: {
    primaryReportType: string;
    jql: string;
    filters: ReportFilters;
    viewSettings: ViewSettings;
    teamConfig: TeamConfig;
    // ... all other route data
  };
}
```

### 3. Feature Flag State

```typescript
interface FeatureState {
  [featureFlag: string]: boolean;
}

// Persisted feature settings
interface UserFeatureSettings {
  enabledFeatures: FeatureState;
  lastUpdated: Date;
  version: string;
}
```

## Storage Lifecycle Management

### 1. Initialization

```typescript
export async function initializeStorage(storage: AppStorage) {
  // Check if storage is available
  const isInitialized = await storage.storageInitialized();

  if (!isInitialized) {
    throw new Error('Storage not available');
  }

  // Load default configurations
  await loadDefaultConfigurations(storage);
}
```

### 2. Migration and Versioning

```typescript
export async function migrateStorageVersion(storage: AppStorage, currentVersion: string) {
  const storedVersion = await storage.get('configVersion');

  if (!storedVersion || storedVersion !== currentVersion) {
    await runMigrations(storage, storedVersion, currentVersion);
    await storage.update('configVersion', currentVersion);
  }
}
```

### 3. Backup and Recovery

```typescript
export async function createConfigurationBackup(storage: AppStorage) {
  const allConfigs = await storage.get('allConfigurations');
  const backup = {
    timestamp: new Date(),
    configurations: allConfigs,
    version: CONFIG_VERSION,
  };

  await storage.update('configurationBackup', backup);
}
```

## Integration Patterns

### 1. React Hooks Integration

```typescript
// Hook for accessing team configuration
export const useTeamConfiguration = () => {
  const [config, setConfig] = useState<TeamConfig | null>(null);
  const storage = useContext(StorageContext);

  useEffect(() => {
    const loadConfig = async () => {
      const teamConfig = await storage.get<TeamConfig>('teamConfiguration');
      setConfig(teamConfig);
    };

    loadConfig();
  }, [storage]);

  const updateConfig = async (newConfig: TeamConfig) => {
    await storage.update('teamConfiguration', newConfig);
    setConfig(newConfig);
  };

  return [config, updateConfig] as const;
};
```

### 2. RouteData Integration

```typescript
// Storage-backed properties in RouteData
get allTeamDataPromise() {
  return getAllTeamData(this.storage);
}

get reportData() {
  if (this.report && this.reportsData) {
    return this.reportsData[this.report];
  }
}
```

## Performance Considerations

### 1. Lazy Loading

- Configuration data loaded on-demand
- Progressive configuration resolution
- Cached configuration objects

### 2. Efficient Storage Operations

- Batched storage updates
- Debounced save operations
- Optimistic UI updates

### 3. Memory Management

- Configuration data cleanup
- Storage size monitoring
- Automatic cleanup of old data

This domain enables the application to maintain user preferences, team-specific configurations, and report state across sessions while adapting to different deployment environments and providing flexible feature management.

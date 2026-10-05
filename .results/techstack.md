# Techstack Analysis: Jira Timeline Report

## Core Technology Analysis

**Programming Language(s):**

- **JavaScript (ES2020+)** - Primary language for most application logic
- **TypeScript** - Used for newer components, React code, and type definitions
- **Mixed JS/TS architecture** - Legacy CanJS components in JS, modern React components in TS

**Primary Framework:**

- **CanJS** - Legacy custom component framework for the main application structure
- **React 18** - Modern UI components and newer features
- **Hybrid Architecture** - CanJS handles routing and main app shell, React handles specific UI components

**Secondary/Tertiary Frameworks:**

- **Vite** - Build tool and development server
- **Express.js** - Backend server for OAuth handling and token management
- **TailwindCSS** - Utility-first CSS framework for styling
- **Atlassian Design System (@atlaskit)** - Extensive use of Atlassian UI components

**State Management Approach:**

- **CanJS Observables** - Legacy state management for main application
- **TanStack React Query** - Modern data fetching and caching for React components
- **Local Storage** - Persistent client-side storage for user preferences and tokens
- **URL State** - Route-based state management for report parameters

**Other Relevant Technologies:**

- **Atlassian Connect** - Jira plugin/add-on integration framework
- **OAuth 2.0** - Authentication with Jira APIs
- **Docker** - Containerization for deployment
- **Playwright** - End-to-end testing framework
- **Vitest** - Unit testing framework
- **Winston + CloudWatch** - Logging infrastructure
- **Sentry** - Error monitoring and tracking

## Domain Specificity Analysis

**Problem Domain:**
This application is a **Jira project timeline and status reporting tool** that generates visual reports and analytics for Jira projects. It's specifically designed to create "PowerPoint-style" status reports from Jira data.

**Core Business Concepts:**

- **Timeline Visualization** - Gantt charts, scatter plots, and timeline views of Jira issues
- **Status Reporting** - Automated generation of executive-level status reports
- **Issue Analytics** - Statistical analysis of Jira issues (estimation accuracy, progress tracking)
- **Rollup Calculations** - Hierarchical aggregation of issue data up organizational structures
- **Project Forecasting** - Auto-scheduling and timeline prediction based on historical data

**User Interaction Types:**

- **Report Configuration** - Users configure filters, date ranges, and visualization parameters
- **Data Exploration** - Interactive timeline manipulation and drill-down capabilities
- **Export/Sharing** - Generation of branded reports for stakeholder consumption
- **Administrative Setup** - OAuth authentication, project selection, and feature toggles

**Primary Data Types:**

- **Jira Issues** - Core entity with hierarchical relationships (Epic → Story → Task)
- **Timeline Data** - Date ranges, milestones, and scheduling information
- **Status Metadata** - Work states, transitions, and progress indicators
- **Report Configurations** - Saved filter sets and visualization preferences
- **Theme/Branding Data** - Custom styling and organizational branding

## Application Boundaries

**Features Clearly Within Scope:**

- Jira API integration and data fetching
- Multiple report types (Gantt, scatter plots, status reports, estimation analysis)
- OAuth authentication and token management
- Report saving and sharing capabilities
- Responsive timeline visualization
- Atlassian Connect plugin integration
- Multi-tenant support (hosted vs. plugin modes)

**Architecturally Inconsistent Features:**

- **Non-Jira integrations** - Architecture is heavily coupled to Jira's data model and APIs
- **Real-time collaboration** - Current architecture is single-user focused with static data snapshots
- **Complex data editing** - Application is read-only focused on visualization rather than data manipulation
- **Non-timeline visualizations** - Core architecture assumes time-based data relationships

**Domain Constraints:**

- **Atlassian Ecosystem Lock-in** - Heavy dependency on @atlaskit components and Atlassian Connect APIs
- **CanJS Legacy Dependencies** - Core routing and state management tied to older CanJS framework
- **Timeline-Centric Data Model** - All features assume issues have temporal relationships and scheduling data
- **OAuth Token Management** - Security model assumes Atlassian OAuth flows and token refresh patterns

The domain analysis reveals this is a specialized **Jira reporting and analytics platform** rather than a general-purpose project management tool. New features should focus on enhanced Jira data analysis, improved timeline visualizations, or extended reporting capabilities rather than expanding beyond the Jira ecosystem.

# Tech Stack Analysis

## Core Technology Analysis

**Programming Languages:**

- **Primary**: TypeScript (main application logic)
- **Secondary**: JavaScript (legacy CanJS components, build scripts, server)

**Primary Framework:**

- **React 18.3.1** - Main UI framework using functional components, hooks, and modern React patterns
- **CanJS** - Legacy framework bundled in `/src/can.js` used for state management and some components, being phased out in favor of React

**Secondary/Tertiary Frameworks:**

- **Vite** - Build tool and dev server
- **Express.js** - Server-side framework for OAuth and API proxy
- **Atlassian Design System (@atlaskit/**)\*\* - Comprehensive UI component library from Atlassian
- **TailwindCSS** - Utility-first CSS framework for styling
- **Playwright** - End-to-end testing framework
- **Vitest** - Unit testing framework

**State Management Approach:**

- **@tanstack/react-query** - Server state management for API calls and caching
- **React Hook Form** - Form state management
- **CanJS Observable** - Legacy state management (being phased out)
- **React Context** - Local state sharing via JiraProvider

**Other Relevant Technologies:**

- **OAuth 2.0** - Authentication with Jira Cloud API
- **Recharts** - Data visualization library for timeline charts
- **AWS SDK** - Cloud storage and deployment
- **Sentry** - Error tracking and monitoring
- **Winston** - Server-side logging

## Domain Specificity Analysis

**Problem Domain:**
This application is a **Jira Timeline Report Generator** - a specialized tool for creating visual status reports and timeline visualizations for Jira projects. It serves as both a standalone web application and an Atlassian Connect app.

**Core Business Concepts:**

- **Timeline Visualization**: Gantt chart-style displays of issue progress over time
- **Status Reporting**: Automated generation of branded progress reports
- **Jira Integration**: Deep integration with Jira Cloud APIs for issue tracking
- **Project Analytics**: Statistical analysis of project timelines, estimations, and completion rates
- **Auto-scheduling**: Algorithmic scheduling of issues based on dependencies and capacity

**User Interaction Types:**

- **Report Configuration**: Users customize timeline views, filters, and report parameters
- **OAuth Authentication**: Secure connection to Jira Cloud instances
- **Data Visualization Manipulation**: Interactive timeline charts with zoom, filter, and drill-down capabilities
- **Export/Save Workflows**: Saving and sharing configured reports
- **Real-time Data Synchronization**: Live updates from Jira API

**Primary Data Types and Structures:**

- **Jira Issues**: Complex nested objects with fields, changelogs, and metadata
- **Timeline Data**: Temporal data structures for Gantt chart rendering
- **Report Configurations**: Serializable settings for saved reports
- **Authentication Tokens**: OAuth access/refresh token management
- **Field Mappings**: Dynamic Jira field definitions and custom field handling

## Application Boundaries

**Features/Functionality Clearly Within Scope:**

- Timeline visualization of Jira issues
- Custom report generation and branding
- Integration with Jira Cloud APIs
- OAuth-based authentication
- Report saving and sharing
- Auto-scheduling algorithms
- Statistical analysis of project data
- Sample data for demos

**Architecturally Inconsistent Feature Types:**

- **Non-Jira Integrations**: The app is tightly coupled to Jira's data model
- **Real-time Collaboration**: Architecture is designed for single-user report generation
- **Custom Issue Creation/Editing**: App is read-heavy with minimal write operations to Jira
- **Complex Multi-tenant Architecture**: Currently designed for single-instance deployments

**Specialized Libraries and Domain Constraints:**

- **Atlassian Connect Framework**: Constrains app structure for Jira marketplace distribution
- **Jira REST API**: All data operations must conform to Jira's API limitations
- **OAuth 2.0 Flow**: Authentication patterns are locked to Atlassian's OAuth implementation
- **React + CanJS Hybrid**: Legacy constraint requiring careful state management between frameworks
- **Recharts Visualization**: Chart types and interactions are limited to Recharts capabilities

The application is specifically designed for Jira-centric project management workflows and would not easily extend to other project management platforms without significant architectural changes.

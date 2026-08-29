# Atlassian Integration Domain

## Overview

The Atlassian Integration Domain provides deep integration with the Jira ecosystem, supporting both standalone web deployment and Jira plugin installation. This domain handles authentication, API communication, field mapping, and deployment-specific configurations to ensure seamless operation across different Atlassian environments.

## Architecture Pattern

The domain follows a **Multi-Deployment Integration** pattern:

- **Dual Authentication**: OIDC for web app, Atlassian Connect for plugin
- **API Abstraction**: Unified interface for Jira REST API calls
- **Environment Detection**: Runtime adaptation to deployment context
- **Configuration Management**: Environment-specific settings and permissions

## Key Components

### 1. Authentication System (`./src/jira-oidc-helpers/auth.ts`)

**Purpose**: Handle OAuth2/OIDC authentication flow for standalone web deployment

**Core Pattern**: Authorization code flow with token refresh management

```typescript
export const fetchAuthorizationCode = (config: Config) => () => {
  const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${
    config.env.JIRA_CLIENT_ID
  }&scope=${config.env.JIRA_SCOPE}&redirect_uri=${
    config.env.JIRA_CALLBACK_URL
  }&response_type=code&prompt=consent&state=${encodeURIComponent(encodeURIComponent(window.location.search))}`;

  window.location.href = url;
};

export const refreshAccessToken =
  (config: Config) =>
  async (accessCode?: string): Promise<string | undefined> => {
    const response = await fetchJSON(`${config.env.JIRA_API_URL}/?code=${accessCode}`);
    const { accessToken, expiryTimestamp, refreshToken } = response;

    saveInformationToLocalStorage({
      accessToken,
      refreshToken,
      expiryTimestamp,
    });

    return accessToken;
  };
```

**Authentication Features**:

- **Token Management**: Automatic token refresh before expiration
- **Local Storage**: Secure credential persistence
- **State Preservation**: Maintain application state through auth flow
- **Consent Management**: Handle user permission flows

### 2. Atlassian Connect Configuration (`./public/atlassian-connect.json`)

**Purpose**: Define Jira plugin capabilities and integration points

**Core Pattern**: Declarative configuration for Atlassian marketplace deployment

```json
{
  "description": "Create stunning, branded status reports for your Jira projects...",
  "vendor": { "name": "Bitovi", "url": "http://bitovi.com" },
  "authentication": { "type": "none" },
  "apiVersion": 1,
  "scopes": ["read", "write"],
  "enableLicensing": true,
  "modules": {
    "generalPages": [
      {
        "url": "/connect.html",
        "key": "main",
        "location": "system.top.navigation.bar",
        "name": { "value": "Status Reports for Jira" }
      }
    ],
    "jiraProjectPages": [
      {
        "key": "project",
        "url": "/connect.html?jql=project%3D'${project.key}'&primaryIssueType%3DInitiative",
        "weight": 1
      }
    ]
  }
}
```

**Integration Points**:

- **Navigation Integration**: Top navigation bar placement
- **Project Context**: Automatic project filtering when accessed from project pages
- **Deep Linking**: URL parameter prefixing for Jira navigation state
- **Licensing**: Atlassian marketplace licensing integration

### 3. Jira API Abstraction (`./src/jira-oidc-helpers/`)

**Purpose**: Unified interface for Jira REST API operations across deployment modes

**Core Pattern**: Environment-aware API client with consistent interface

```typescript
// Fetch wrapper with authentication
export default async function fetchJSON(url: string, options: RequestInit = {}): Promise<any> {
  const token = getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }

  return response.json();
}

// Field mapping and data processing
export const fetchAllJiraIssuesWithJQLAndFetchAllChangelog = async (jql: string, fields: string[]) => {
  // Paginated issue fetching with changelog
  // Handles large datasets with automatic pagination
  // Processes field mappings and custom field resolution
};
```

**API Capabilities**:

- **Issue Querying**: JQL-based issue retrieval with pagination
- **Field Mapping**: Dynamic field resolution and custom field handling
- **Changelog Processing**: Historical data retrieval for timeline analysis
- **Server Info**: Instance metadata and capability detection

### 4. Environment-Specific Request Helpers

**Web Deployment** (`./src/request-helpers/hosted-request-helper.js`):

```javascript
// Standalone web app request handling
export const hostedRequestHelper = {
  makeRequest: (url, options) => {
    // Direct API calls with OIDC authentication
  },
  getBaseUrl: () => config.jiraBaseUrl,
  isPlugin: () => false,
};
```

**Plugin Deployment** (`./src/request-helpers/connect-request-helper.js`):

```javascript
// Atlassian Connect request handling
export const connectRequestHelper = {
  makeRequest: (url, options) => {
    // AP.request() for authenticated calls within Jira
  },
  getBaseUrl: () => AP.context.getContext().baseUrl,
  isPlugin: () => true,
};
```

### 5. Storage Abstraction (`./src/jira-oidc-helpers/storage.ts`)

**Purpose**: Handle credential and data storage across environments

**Core Pattern**: Environment-aware storage with security considerations

```typescript
export const saveInformationToLocalStorage = (data: {
  accessToken: string;
  refreshToken: string;
  expiryTimestamp: number;
}) => {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('expiryTimestamp', data.expiryTimestamp.toString());
};

export const clearAuthFromLocalStorage = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('expiryTimestamp');
};
```

## Deployment Strategies

### 1. Standalone Web Application

**Characteristics**:

- OIDC authentication flow
- Direct Jira REST API calls
- Independent hosting and domain
- Full control over user experience

**Configuration**:

```typescript
const webConfig = {
  env: {
    JIRA_CLIENT_ID: process.env.JIRA_CLIENT_ID,
    JIRA_SCOPE: 'read:jira-user read:jira-work',
    JIRA_CALLBACK_URL: 'https://app.example.com/oauth-callback',
    JIRA_API_URL: 'https://api.example.com/jira-auth',
  },
  deployment: 'web',
};
```

### 2. Jira Plugin (Atlassian Connect)

**Characteristics**:

- No additional authentication (inherits Jira session)
- AP.request() for API calls within Jira security context
- Embedded iframe within Jira interface
- Atlassian marketplace distribution

**Configuration**:

```typescript
const pluginConfig = {
  deployment: 'plugin',
  atlassianConnect: {
    key: 'bitovi.status-report',
    authentication: { type: 'none' },
    scopes: ['read', 'write'],
  },
};
```

## Integration Features

### 1. Deep Linking

**Plugin Mode**: URL parameters are prefixed for Jira navigation state

```typescript
// In plugin: ac.{appKey}.{paramName}=value
const prefixedParams = Object.fromEntries(
  Object.entries(queryParamsObject).map(([key, value]) => [`ac.${appKey}.${key}`, value]),
);
```

**Web Mode**: Standard query parameters

```typescript
// In web app: paramName=value
const standardParams = queryParamsObject;
```

### 2. Context Integration

**Project-Aware URLs**: Automatic filtering based on current Jira project

```json
{
  "url": "/connect.html?jql=project%3D'${project.key}'&primaryIssueType%3DInitiative"
}
```

**Navigation Integration**: Placement in Jira's navigation structure

```json
{
  "location": "system.top.navigation.bar",
  "weight": 1
}
```

### 3. Permission Management

**API Scopes**: Declared permissions for data access

```json
{
  "scopes": ["read", "write"],
  "apiVersion": 1
}
```

**Licensing Integration**: Atlassian marketplace licensing support

```json
{
  "enableLicensing": true
}
```

## Security Considerations

### 1. Token Security

- Access tokens stored in localStorage (web mode)
- No token storage needed in plugin mode (AP.request handles auth)
- Automatic token refresh before expiration
- Secure token transmission over HTTPS

### 2. CSRF Protection

- State parameter validation in OAuth flow
- Request origin validation
- Secure cookie handling in plugin mode

### 3. Data Privacy

- Minimal data storage
- Respect for Jira's data governance
- Compliance with Atlassian security requirements

## Performance Optimizations

### 1. API Efficiency

- Paginated requests for large datasets
- Field-specific queries to minimize data transfer
- Changelog batching for historical analysis

### 2. Caching Strategy

- Local storage for authentication state
- Intelligent field mapping caching
- Server info caching to reduce redundant calls

This domain enables the application to operate seamlessly across different Atlassian deployment scenarios while maintaining security, performance, and user experience standards.

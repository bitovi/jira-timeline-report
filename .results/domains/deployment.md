# Deployment Domain Analysis

## Overview

The deployment architecture supports dual deployment modes: Atlassian Connect apps for Jira integration and standalone hosted deployments, with environment-specific configuration management.

### Atlassian Connect Integration

Support for deployment as Atlassian Connect app:

```javascript
// server.js - Express server with Connect endpoints
app.get('/atlassian-connect.json', (req, res) => {
  res.json({
    key: process.env.JIRA_APP_KEY,
    name: 'Status Reports for Jira',
    description: 'Create stunning timeline reports',
    vendor: {
      name: 'Bitovi',
      url: 'https://www.bitovi.com',
    },
    baseUrl: process.env.BASE_URL,
    authentication: {
      type: 'jwt',
    },
    lifecycle: {
      installed: '/installed',
      uninstalled: '/uninstalled',
    },
    modules: {
      generalPages: [
        {
          key: 'timeline-report',
          location: 'system.top.navigation.bar',
          name: {
            value: 'Timeline Reports',
          },
          url: '/timeline-report?project_key={project.key}',
        },
      ],
    },
  });
});
```

### Hosted Deployment Configuration

Standalone deployment with OAuth configuration:

```typescript
// web.main.ts - Web application entry point
async function main() {
  return mainHelper(
    {
      JIRA_CLIENT_ID: import.meta.env.VITE_JIRA_CLIENT_ID,
      JIRA_SCOPE: import.meta.env.VITE_JIRA_SCOPE,
      JIRA_CALLBACK_URL: import.meta.env.VITE_JIRA_CALLBACK_URL,
      JIRA_API_URL: import.meta.env.VITE_JIRA_API_URL,
    },
    {
      host: 'hosted',
      createStorage: createWebAppStorage,
      configureRouting: (route) => route.start(),
      createLinkBuilder: createWebLinkBuilder,
      isAlwaysLoggedIn: false,
    },
  );
}
```

### Environment Configuration

Environment-specific settings and build configuration:

```javascript
// Docker configuration
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Key Deployment Principles

1. **Dual Environment**: Support for both Connect and hosted deployments
2. **Security**: Secure OAuth handling in both deployment modes
3. **Scalability**: Deployment supports multiple tenants and concurrent users
4. **Configuration**: Environment variables for deployment-specific settings
5. **Monitoring**: Comprehensive logging and error tracking with Sentry integration

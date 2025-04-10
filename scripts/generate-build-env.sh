#!/bin/bash
set -e

# Required env vars
: "${VITE_COMMIT_SHA?Need to set VITE_COMMIT_SHA}"
: "${VITE_AUTH_SERVER_URL?Need to set VITE_AUTH_SERVER_URL}"
: "${VITE_JIRA_CLIENT_ID?Need to set VITE_JIRA_CLIENT_ID}"
: "${VITE_JIRA_SCOPE?Need to set VITE_JIRA_SCOPE}"
: "${VITE_JIRA_CALLBACK_URL?Need to set VITE_JIRA_CALLBACK_URL}"
: "${VITE_JIRA_API_URL?Need to set VITE_JIRA_API_URL}"
: "${VITE_JIRA_APP_KEY?Need to set VITE_JIRA_APP_KEY}"

# Add back once deployment is ready... change new-staging to staging etc.
# echo "CLIENT_STATUS_REPORTS_ENV=new-staging" >> .env
# echo "CLIENT_FRONTEND_SENTRY_DSN=https://c8f8aad7cbf776a99570cd163a5c86b1@o4508721931616256.ingest.us.sentry.io/4508733956947968" >> .env
# echo "BACKEND_SENTRY_DSN=https://26de5611d04fde803427885bdb82a7bc@o4508721931616256.ingest.us.sentry.io/4508721935351808" >> .env

cat <<EOF > .env
VITE_COMMIT_SHA=$VITE_COMMIT_SHA
VITE_AUTH_SERVER_URL=$VITE_AUTH_SERVER_URL
VITE_JIRA_CLIENT_ID=$VITE_JIRA_CLIENT_ID
VITE_JIRA_SCOPE=$VITE_JIRA_SCOPE
VITE_JIRA_CALLBACK_URL=$VITE_JIRA_CALLBACK_URL
VITE_JIRA_API_URL=$VITE_JIRA_API_URL
VITE_JIRA_APP_KEY=$VITE_JIRA_APP_KEY
EOF

# Need repo_env for ec2-deploy
cp .env repo_env

echo ".env and repo_env created at $(pwd)"
cat .env

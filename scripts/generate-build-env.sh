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
: "${VITE_STATUS_REPORTS_ENV?Need to set VITE_STATUS_REPORTS_ENV}"
: "${BACKEND_SENTRY_DSN?Need to set BACKEND_SENTRY_DSN}"

# UNUSED AT RUNTIME — candidates for removal.
#
# These existed for one reason: server/logger.js shipped a winston-cloudwatch transport that wrote
# each web-app user's Jira site URL to the `status-reports-for-jira` log group. That logging was
# removed, and with it the only code in server/ that read these variables. Nothing the EC2 API runs
# today authenticates to AWS.
#
# They are still required and written here (rather than deleted along with the logger) because this
# script's `:?` guards are load-bearing for three callers, and dropping the variables is a
# coordinated change across all of them. Before removing, address each:
#
#   1. .github/workflows/deploy-prod.yaml    — drop AWS_{ACCESS_KEY_ID,SECRET_ACCESS_KEY} from the
#                                              "Generate .env and repo_env" step's `env:` block.
#                                              Leave the `aws_access_key_id:` inputs on the
#                                              bitovi/github-actions-deploy-* steps alone — those
#                                              are the deploy actions' own credentials and are
#                                              unrelated to this file.
#   2. .github/workflows/deploy-staging.yaml — same step, same two lines.
#   3. .github/workflows/ci.yaml             — same step; CI passes empty strings purely to satisfy
#                                              the guards below, so those lines go too.
#
# Then delete the two `:?` guards and the two `.env` lines here. Doing it in the other order breaks
# every build, because `set -e` plus an unset guard aborts the script.
#
# Separately, and outside this repo: the IAM user behind these keys should be reviewed. The keys
# were copied into the EC2 instance's repo_env on every deploy, so rotating/revoking them is worth
# doing whether or not this cleanup lands.
: "${AWS_SECRET_ACCESS_KEY?Need to set AWS_SECRET_ACCESS_KEY}"
: "${AWS_ACCESS_KEY_ID?Need to set AWS_ACCESS_KEY_ID}"

cat <<EOF > .env
# Unused at runtime since the CloudWatch domain logging was removed — see the note above.
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
VITE_COMMIT_SHA=$VITE_COMMIT_SHA
VITE_AUTH_SERVER_URL=$VITE_AUTH_SERVER_URL
VITE_JIRA_CLIENT_ID=$VITE_JIRA_CLIENT_ID
VITE_JIRA_SCOPE=$VITE_JIRA_SCOPE
VITE_JIRA_CALLBACK_URL=$VITE_JIRA_CALLBACK_URL
VITE_JIRA_API_URL=$VITE_JIRA_API_URL
VITE_JIRA_APP_KEY=$VITE_JIRA_APP_KEY
VITE_STATUS_REPORTS_ENV=$VITE_STATUS_REPORTS_ENV
VITE_FRONTEND_SENTRY_DSN=$VITE_FRONTEND_SENTRY_DSN
BACKEND_SENTRY_DSN=$BACKEND_SENTRY_DSN
EOF

# Need repo_env for ec2-deploy
cp .env repo_env

echo ".env and repo_env created at $(pwd)"

#!/usr/bin/env bash
# One-time local setup for Status Reports for Jira.
# Verifies Node, creates .env, installs dependencies, and prints next steps.
set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

bold "==> Checking Node version"
required="$(cat .nvmrc 2>/dev/null | tr -d 'v[:space:]')"
current="$(node -v 2>/dev/null | tr -d 'v' || true)"
if [ -z "$current" ]; then
  red "Node.js is not installed. Install Node ${required:-22.9.0} (e.g. via nvm) and re-run."
  exit 1
fi
required_major="${required%%.*}"
current_major="${current%%.*}"
if [ -n "$required_major" ] && [ "$current_major" != "$required_major" ]; then
  yellow "Node $current is installed but this project expects $required (see .nvmrc)."
  yellow "If you use nvm, run: nvm install && nvm use"
else
  green "Node $current OK"
fi

bold "==> Ensuring .env exists"
if [ -f .env ]; then
  green ".env already exists — leaving it untouched"
else
  cp .env.example .env
  green "Created .env from .env.example"
fi

bold "==> Installing dependencies"
npm install
green "Dependencies installed"

bold "==> Checking Jira credentials"
missing=0
for var in VITE_JIRA_CLIENT_ID JIRA_CLIENT_SECRET; do
  value="$(grep -E "^${var}=" .env | head -n1 | cut -d= -f2- || true)"
  if [ -z "$value" ]; then
    yellow "  $var is not set"
    missing=1
  fi
done
if [ "$missing" -eq 1 ]; then
  yellow ""
  yellow "The full app needs Jira OAuth credentials. We use a shared dev OAuth app —"
  yellow "ask in the team room for VITE_JIRA_CLIENT_ID and JIRA_CLIENT_SECRET, then add"
  yellow "them to .env. (You can create your own app instead — see CONTRIBUTING.md.)"
  yellow ""
  yellow "No credentials? You can still work on UI with mock data:"
  yellow "  npm run storybook   ->  http://localhost:6006"
else
  green "Jira credentials present"
fi

bold "==> Done!"
echo ""
echo "Next steps:"
echo "  npm run dev         # web app at http://localhost:5173 (needs credentials)"
echo "  npm run storybook   # component explorer at http://localhost:6006 (no credentials)"
echo ""
echo "Prefer Docker? Run:  npm run docker:dev"

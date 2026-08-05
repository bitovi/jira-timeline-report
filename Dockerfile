# Production image — runs the Express auth server only.
# For local development with live-reload, use docker-compose.dev.yaml instead
# (`npm run docker:dev`).
FROM node:22-bookworm-slim
ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /app

# Install production dependencies only. The auth server (server/*) needs just
# eight runtime packages; everything frontend-only (Vite, Storybook, Playwright,
# Atlaskit, React, ...) lives in devDependencies so it never reaches this image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

EXPOSE $PORT
CMD npm run start-local

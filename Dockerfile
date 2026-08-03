# Production image — runs the Express auth server only.
# For local development with live-reload, use docker-compose.dev.yaml instead
# (`npm run docker:dev`).
FROM node:22-bookworm
ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /app

# Install production dependencies only. The auth server (server/*) uses just a
# handful of runtime deps; devDependencies (Vite, Storybook, Playwright, Atlaskit,
# React, ...) are frontend-only and would balloon the image and the deploy VM's disk.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE $PORT
CMD npm run start-local

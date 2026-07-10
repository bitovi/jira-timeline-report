# Production image — runs the Express auth server only.
# For local development with live-reload, use docker-compose.dev.yaml instead
# (`npm run docker:dev`).
FROM node:22-bookworm
ENV PORT=3000

WORKDIR app
COPY . .

COPY package.json .
COPY package-lock.json .
RUN npm ci

EXPOSE $PORT
CMD npm run start-local

const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: "https://26de5611d04fde803427885bdb82a7bc@o4508721931616256.ingest.us.sentry.io/4508721935351808",
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.CLIENT_STATUS_REPORTS_ENV,
});

Sentry.profiler.startProfiler();

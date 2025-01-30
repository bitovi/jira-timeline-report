import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://c8f8aad7cbf776a99570cd163a5c86b1@o4508721931616256.ingest.us.sentry.io/4508733956947968",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.CLIENT_STATUS_REPORTS_ENV,
});

window.addEventListener("error", (error) => Sentry.captureException(error));

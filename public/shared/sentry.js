import * as Sentry from "@sentry/react";

export const initSentry = ({ FRONTEND_SENTRY_DSN, STATUS_REPORTS_ENV }) => {
  Sentry.init({
    dsn: process.env.FRONTEND_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    enabled: !!process.env.FRONTEND_SENTRY_DSN,
    environment: process.env.STATUS_REPORTS_ENV,
  });

  window.addEventListener("error", (error) => Sentry.captureException(error));
};

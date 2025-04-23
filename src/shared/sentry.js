import * as Sentry from "@sentry/react";

export const initSentry = ({ FRONTEND_SENTRY_DSN, STATUS_REPORTS_ENV }) => {
  Sentry.init({
    dsn: FRONTEND_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.feedbackIntegration({
        autoInject: false,
      }),
    ],
    tracesSampleRate: 1.0,
    enabled: !!FRONTEND_SENTRY_DSN,
    environment: STATUS_REPORTS_ENV,
  });

  window.addEventListener("error", (error) => Sentry.captureException(error));
};

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Pilot-scale traffic — sample everything rather than tune a rate blind.
  tracesSampleRate: 1,
  // No session replay: this app handles consultant PII (DOB, visa type,
  // contact info) on-screen; recording sessions is a privacy step we
  // haven't opted into.
});

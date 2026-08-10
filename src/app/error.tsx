"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="page-title text-2xl">Something went wrong</h1>
      <p className="max-w-md text-[var(--color-ink-soft)]">
        An unexpected error occurred. Try again, or come back to this page later.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-strong)]"
      >
        Try again
      </button>
    </div>
  );
}

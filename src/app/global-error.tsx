"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Catches errors thrown by the root layout itself, so it can't depend on
// that layout's fonts/CSS — must render its own <html>/<body> per Next.js docs.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "6rem 1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#faf7f2",
          color: "#211c16",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ maxWidth: "28rem", color: "#6b6259" }}>
          An unexpected error occurred. Try again, or come back to this page later.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            borderRadius: "0.375rem",
            background: "#b5651d",
            color: "#fff",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

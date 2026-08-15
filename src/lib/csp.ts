// Extracted from src/proxy.ts so the policy string itself is unit-testable
// without pulling in next/server. See proxy.ts for why the CSP is built
// per-request (a fresh nonce every time) rather than as a static header in
// next.config.ts, and why style-src still allows 'unsafe-inline'.
export function buildCsp(nonce: string, isProduction: boolean): string {
  // React's dev mode uses eval() for debugging features (reconstructing
  // callstacks) and explicitly never does in production, so 'unsafe-eval'
  // is only added outside production rather than weakening the real policy.
  const scriptSrc = isProduction
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // No <img> element exists anywhere in the app today (Video.thumbnailUrl
    // is stored/edited but never rendered as an image) — 'self' + data: is
    // the actual footprint, not a broad https: allowance for a feature that
    // doesn't exist yet. Widen this if that changes.
    "img-src 'self' data:",
    "font-src 'self' data:",
    // Public Forms file uploads go directly from the browser to Vercel Blob
    // storage (client-side upload via @vercel/blob/client), bypassing this
    // server entirely for the large file bytes themselves.
    "connect-src 'self' https://*.blob.vercel-storage.com",
    "frame-src https://drive.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

"use client";

import { useState } from "react";

export function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-[var(--color-muted-soft)] px-2 py-1 text-xs text-[var(--color-ink)]">
        /f/{slug}
      </code>
      <button
        type="button"
        className="link-action"
        onClick={async () => {
          const url = `${window.location.origin}/f/${slug}`;
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

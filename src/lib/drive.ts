/**
 * Converts a normal Google Drive share link into an embeddable preview URL.
 * Per Technical Implementation Blueprint.md §9 — only URL parsing, no Drive
 * API call (MVP decision: metadata like thumbnail/duration stays manual/blank).
 */

const DRIVE_FILE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]{10,})/, // https://drive.google.com/file/d/<id>/view
  /[?&]id=([a-zA-Z0-9_-]{10,})/, // https://drive.google.com/open?id=<id> or uc?id=<id>
];

export type DriveLinkParseResult =
  | { valid: true; fileId: string; embedUrl: string }
  | { valid: false; error: string };

export function parseDriveLink(rawUrl: string): DriveLinkParseResult {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "That doesn't look like a valid URL." };
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "drive.google.com") {
    return { valid: false, error: "Link must be a drive.google.com file link." };
  }

  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = `${url.pathname}${url.search}`.match(pattern);
    if (match?.[1]) {
      const fileId = match[1];
      return {
        valid: true,
        fileId,
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      };
    }
  }

  return {
    valid: false,
    error: "Couldn't find a file ID in that link. Paste the standard 'Share' link for a Drive file.",
  };
}

# Video hosting & content protection — decision record

**Date:** 2026-08-16
**Status:** Platform decision OPEN — reopened after discovering Cloudflare Stream has no DRM
**Scope:** How training videos are stored and served, and what protection is achievable

> This is both the research record and the implementation plan. Nothing in §8 has been
> built yet — the platform choice in §7 is still open. Update §7 and this Status line
> once it is settled.

---

## 1. The problem

Consultants can open devtools and read the Google Drive URL of any training video, then
share it or hit it directly.

The cause is architectural, not a bug. Videos are not stored by this app at all. The
`Video` row holds a `driveFileId` and a derived `embedUrl`
(`https://drive.google.com/file/d/{id}/preview`), and the player at
`src/app/(app)/my-courses/[courseId]/[videoId]/page.tsx:34` is a bare iframe pointed at
Drive.

Authorization is enforced on the **page** (`getResolvedVideoDetail`), never on the
**media**. Once the embed URL reaches the client it is a permanent, credential-free handle
to the video for anyone who obtains it.

**Drive's "disable download" setting does not help.** It hides the download button and
blocks right-click-save. The `/preview` player still fetches the real video stream over
HTTPS, and those requests are plainly visible in the Network tab. It stops the polite; it
stops no one else.

---

## 2. Threat model — what is and is not achievable

Stated goals were: stop casual sharing, stop downloading entirely, and hide that the
backend is Drive.

| Goal | Achievable? | By what |
|---|---|---|
| Stop casual link sharing | **Yes, fully** | Signed, expiring, IP- and origin-locked URLs |
| Hide that it's Google Drive | **Yes, fully** | Migrate off Drive entirely |
| Stop `yt-dlp`-style stream ripping | **Largely** | DRM only — see §5 |
| Stop screen recording | **No** | Not solvable on the web — see §5 |

### The unavoidable residue

Serving from a CDN edge means a consultant inspecting the Network tab **will still see a
URL**. That is inherent — the alternative (proxying every byte through our own server)
was priced and rejected in §4. The achievable goal is that the URL is **worthless to
anyone else**, not that it is invisible.

And nothing has ever stopped a phone camera pointed at a monitor. Any plan that claims
otherwise is selling something.

---

## 3. Volume parameters

- Library: **~250 GB / ~240 hours** (~14,400 minutes stored)
- Audience: **100 consultants × ~130 h/month** ≈ **800,000 delivered minutes/month**
- Geography: **US today**, possibly India later

Delivery dominates storage roughly **10:1**. Optimising storage is wasted effort; every
meaningful decision is about delivered minutes/bytes.

---

## 4. Vendor comparison

At 14,400 min stored / 800,000 min delivered per month:

| Provider | Storage | Delivery | DRM | **Total/mo** |
|---|---|---|---|---|
| **Bunny Stream** | ~$8 | $47–93 | Media Cage (unverified) | **~$55–100** |
| **Mux 720p + DRM** | $35 | $560 | $178 | **~$773** |
| **Cloudflare Stream** | $72 | $800 | **None available** | **~$872** |
| **Mux 1080p + DRM** | $43 | $700 | $178 | **~$921** |
| **Vercel Blob proxy** | $6 | ~$675 | None | **~$680** |
| **Drive proxy via Vercel** | $0 | ~$1,875+ | None | **~$2,000–2,500** |

### How each bills — this is why the spread is so wide

- **Cloudflare** — $5/1k min stored, $1/1k min delivered. Resolution- and
  bitrate-independent, **flat worldwide**. Utterly predictable.
- **Mux** — $0.0024/min storage, $0.0008/min delivery, first 100k min/month free, with a
  resolution multiplier (1080p = 1.25×, 4K = 4×). DRM is $100/mo + $0.003/play; ~26,000
  plays/month assumed (100 consultants × ~260 videos at ~30 min).
- **Bunny** — bills per **GB**, not per minute, which is the whole reason for the 10× gap.
  Adaptive bitrate drags real delivery to ~9.3 TB/month. **Regional**: the quoted rate is
  US/EU; Asia-Pacific is ~3× and Africa/Middle East ~6×.
- **Vercel (either flavour)** — no adaptive bitrate at all, so all ~13.5 TB go out at full
  source bitrate. The Drive variant additionally holds a serverless function open for all
  13,333 hours of streaming, and **Google Drive enforces per-file daily download caps** —
  it is a document store, not a CDN, and would throttle long before the invoice arrived.

### Rejected outright

**Same-origin proxying (Drive or Vercel Blob).** This was the first approach considered,
and it is the only one that hides the URL *completely*. It does not survive this scale:
most expensive option, no ABR, and Drive throttling makes it non-viable regardless of
budget. It was sized for the "pilot scale" described in CLAUDE.md; 100 consultants ×
130 h/month is not pilot scale.

---

## 5. DRM: yt-dlp vs. screen recording

These are **not equally solvable** and should not be discussed as one problem.

### yt-dlp — genuinely stoppable, but only with DRM

Signed URLs do nothing here. yt-dlp runs as the logged-in consultant with their own valid
token; it downloads exactly what the browser would. It works because HLS/DASH segments are
plain files.

With Widevine/FairPlay, segments are CENC-encrypted and keys exist only inside the
browser's CDM. yt-dlp refuses DRM content outright and cannot decrypt it.

**Caveat that must not be lost:** Widevine **L3** — the software CDM used by desktop
Chrome and Firefox — has been publicly broken, and key-extraction tooling exists. DRM
moves this from *"one command a consultant can google in 30 seconds"* to *"specialist
tooling, dumped CDM keys, real effort and intent."* That is a large and real improvement.
It is not absolute. FairPlay (Safari) and Widevine L1 (mobile hardware) are stronger.

### Screen recording — not stoppable, and weakest where most users are

With hardware DRM plus HDCP some platforms black-frame captures: Safari + FairPlay on
macOS blocks QuickTime recording fairly reliably, and Edge/Chrome on Windows can via the
L1 hardware secure path. But desktop Chrome typically falls back to **L3 software**, where
screen recording works normally — and that covers most consultants.

Treat screen recording as permanently open. Plan around it, not against it.

### The finding that reopened the decision

**Cloudflare Stream offers no DRM.** Signed URLs, allowed origins, and IP/country access
rules are the entire toolkit; DRM has been a requested community feature for years and
remains undocumented. Cloudflare was originally selected for flat global pricing — but
that choice forecloses DRM entirely.

**Mux with full DRM costs about the same as, or less than, Cloudflare without it**
(~$773–921 vs ~$872). If stopping yt-dlp is a real requirement, Cloudflare is not viable.

---

## 6. Watermarking — the control that actually works

Burn the consultant's name, user ID, and a live timestamp into the player as a moving
overlay. It prevents nothing. It makes every leak **traceable to one named employee**,
which in an employment context is the deterrent that genuinely changes behaviour.

The two controls compose, and neither is sufficient alone:

- **Watermark alone is weak** — yt-dlp yields a clean copy with no overlay, because the
  overlay is DOM, not baked into the video.
- **DRM alone leaves screen recording untraceable.**
- **Together:** DRM closes the clean-rip path, leaving screen recording as the only
  capture route — which necessarily records the watermark.

Client-side DOM overlay (position drifting so it can't be cropped) is a few hours of work
and costs nothing. Server-side burned-in watermarking survives even a stream rip but needs
per-viewer transcoding — a large cost jump, and unnecessary if DRM is in place.

---

## 7. Open decision

Two questions remain before implementation:

1. **Platform** — Mux + DRM (recommended, cost-neutral vs. Cloudflare and the only option
   meeting the stated requirements); Cloudflare + watermarking only (accepts yt-dlp risk,
   keeps leaks traceable); or verify Bunny's Media Cage DRM, which would be ~5× cheaper if
   it holds up and traffic stays US/EU.
2. **Watermarking** — client-side overlay (recommended), server-side burned-in, or none.

---

## 8. Implementation plan

Written against Cloudflare Stream. **If the platform switches to Mux, §8.1, §8.3 and §8.8
change** (different API, plus DRM configuration); everything else — schema, migration
script, token minting at render, removing the Drive URL from the client, the admin upload
path, the `markVideoCompletedAction` fix — is provider-agnostic and stands either way.

### 8.1 Provider setup (manual, once)

Create the account/API token scoped to video edit only, and a **signing key** for playback
tokens. That signing key is the most sensitive new secret.

New env vars in `.env.local` and Vercel Production: account ID, API token, signing key ID,
signing key PEM, and the public customer/playback subdomain.

### 8.2 Schema — one migration

Add to `Video` in `prisma/schema.prisma`:

```prisma
providerVideoId String? @unique
```

Provider-neutral by name deliberately, so a later swap doesn't require another migration.
Keep `driveFileId` / `driveSourceUrl` as migration provenance and leave `embedUrl` in
place so the change is reversible.

Follow the staging-first procedure in CLAUDE.md: `prisma.config.ts` only auto-loads `.env`
(production), so export `.env.local`'s `DATABASE_URL`/`DIRECT_URL` explicitly before
migrating staging. The pending `20260815221001_add_performance_indexes` migration is still
unapplied on production and will ship alongside this one.

### 8.3 Provider module — `src/lib/video/provider.ts` (new)

Deliberately a thin abstraction rather than raw provider calls scattered through the app.

- `uploadFromStream(readable, { name })` → resumable upload (tus; required above 200 MB,
  which training videos will exceed). Sets "require signed URLs" and an allowed-origins
  allowlist at creation. Returns the provider video ID and the duration the provider
  reports.
- `signPlaybackToken(id, { ip, ttlSeconds })` → signed JWT with subject, expiry, and
  access rules restricting to the viewer's IP.

Mark `server-only`, matching `src/lib/reports.ts` and `content-resolution.ts`.

**Never enable the provider's MP4 download endpoint.** It is opt-in per video, so simply
never call it — enabling it hands out a permanent file URL and undoes this entire effort.

### 8.4 Bulk migration script — `scripts/migrate-videos-to-provider.ts` (new)

Follow `scripts/cleanup-demo.ts` conventions: run via
`node --env-file=.env.local -r tsx/cjs`, **dry-run by default**, `--confirm` to write.

For each `Video` where `providerVideoId IS NULL`: fetch from Drive via a service account
(`drive.readonly`, `files.get?alt=media`), pipe into `uploadFromStream`, write back the ID.
Idempotent and resumable — re-running skips migrated rows, so a 250 GB transfer can be
interrupted safely.

Two side benefits worth taking: the provider returns real duration metadata, so backfill
`durationSeconds` (currently hand-entered and often blank), and it generates thumbnails,
so `thumbnailUrl` can finally be populated.

The Google service account is needed only for migration, never at runtime.

### 8.5 Mint the playback token during page render

No new API route needed. `my-courses/[courseId]/[videoId]/page.tsx` is already a server
component that calls `getResolvedVideoDetail` — the authorization check exists. Mint the
signed token immediately after it, reading the client IP from `headers()`.

TTL ~4 hours: long enough that a long video doesn't die mid-playback (segment requests are
validated against the same token), short enough that a leaked URL rots fast. The IP access
rule is what actually kills sharing — a pasted link fails instantly from another address
regardless of the window.

### 8.6 Stop shipping the Drive URL to the client

In `src/lib/content-resolution.ts`, drop `embedUrl` from the `ResolvedCourseVideo` type and
its projection (~line 127), replacing it with `providerVideoId`. The type already
deliberately drops `driveFileId`, `driveSourceUrl`, and `thumbnailUrl`; `embedUrl` is the
last leak. TypeScript will flag every consumer.

### 8.7 Admin upload path — `src/app/(app)/catalog/videos/`

Replace "paste a Drive link" with direct upload to the provider, so no new video ever
enters via Drive. Use a one-time upload URL minted server-side so bytes go browser →
provider and never through a Vercel function — the same architecture already used in
`src/app/api/forms/[slug]/upload-token/route.ts`, which is the pattern to copy.

`parseDriveLink` in `src/lib/drive.ts` and its tests can then be retired, along with the
duplicated inline copy at `scripts/seed-demo.ts:28-43`.

### 8.8 CSP — `src/lib/csp.ts`

- **Replace** `frame-src https://drive.google.com` with the provider's playback domain.
- **Add** `media-src` for `'self'` plus the provider domain. There is currently no
  `media-src` directive at all.
- Widen `img-src` for provider thumbnails once `thumbnailUrl` is rendered — the existing
  comment in that file already flags this.

Update the CSP unit tests alongside.

### 8.9 Unrelated bug worth fixing while here

`markVideoCompletedAction` in `src/app/(app)/my-courses/actions.ts` checks only
`actor.role === "CONSULTANT"` and `video.status === "ACTIVE"`. It never verifies the video
is actually resolved for that consultant, so any consultant can mark any video complete by
posting an arbitrary `videoId`. It corrupts reporting rather than leaking data, but it's a
one-line fix in a file already being touched.

---

## 9. Verification

1. **The core test.** Log in as a consultant, play a video, open devtools → Network. No
   `drive.google.com` request, no Drive file ID anywhere in the DOM or payloads.
2. **Leaked URL, different machine.** Copy the manifest URL and open it from another IP →
   403. This is the behaviour that actually solves the reported problem.
3. **Leaked URL, expired.** Retain a URL past its TTL → 403.
4. **Embedded elsewhere.** Drop the player URL into a scratch page on another domain →
   blocked by allowed-origins.
5. **Old Drive URL.** After migration, restrict the Drive files and confirm the previous
   `/preview` URL 404s publicly.
6. **Playback quality.** Seek within a long video and confirm ABR switches renditions —
   the main functional regression risk in swapping players.
7. **If DRM ships:** confirm `yt-dlp` against the playback URL fails to decrypt.
8. `npm run test:unit` (new token-signing tests + updated CSP tests), `npm run typecheck`,
   `npm run lint`.
9. Extend `e2e/` with a spec asserting an unauthorized consultant cannot obtain a playback
   token for a video outside their resolved course set.

**After deploy:** check provider analytics for actual delivered minutes in week one. Every
cost figure here rests on 130 h/consultant/month; real behaviour is by far the largest
source of error, dwarfing the difference between vendors.

---

## 10. Future: streaming from India

- **Cloudflare** bills per minute at a flat global rate — India would cost exactly the
  same. That immunity was the original argument for paying its premium.
- **Mux** likewise bills per minute, resolution-scaled but not region-scaled.
- **Bunny** is regional: Asia-Pacific runs ~3× the US/EU rate, so its large cost advantage
  narrows there (though it would likely still lead).

Three things to keep open regardless of choice:

1. **Keep `src/lib/video/provider.ts` the only provider-aware module.** A later swap should
   be one file plus env vars, not a rewrite. This is why the schema column is
   `providerVideoId`, not a vendor-specific name.
2. **Revisit IP-based access rules when India traffic starts.** Mobile networks change IP
   mid-session far more often, which would break playback. Country-scoped rules are the
   softer alternative — weaker against sharing, far fewer false failures.
3. **Data residency.** Neither Cloudflare Stream nor Mux offers regional storage control.
   If Indian data-residency rules ever apply to training content, that becomes a real
   constraint requiring re-evaluation.

---

## Sources

- [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/)
- [Cloudflare Stream — securing your stream](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)
- [Cloudflare community — Stream DRM support](https://community.cloudflare.com/t/cloudflare-stream-drm-support/835626)
- [Mux video pricing](https://www.mux.com/pricing/video)
- [Bunny Stream](https://bunny.net/stream/)

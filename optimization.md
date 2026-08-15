# End-to-end project review: fixes and optimizations

## Context

The user asked for a full end-to-end review of the project with improvement suggestions. Two
exploration passes (app code + infra/DB) plus direct verification of the critical findings
surfaced issues in four tiers, all confirmed against the actual code. The user approved
implementing **all four tiers**. Work happens on the `phase-2` branch (already checked out, clean
tree, 1 commit ahead of `main` with the CrewNex rebrand — that commit merges as part of Tier 4).

Production deploys remain manual (`npx vercel --prod`); a production Prisma migration is needed
for the index changes (bare `prisma migrate deploy` targets production per `prisma.config.ts`;
staging needs the `.env.local` env-override pattern documented in CLAUDE.md).

---

## Tier 1 — Security fixes (Forms feature, live in production)

All in `src/app/(app)/forms/actions.ts` and `src/app/f/[slug]/actions.ts` unless noted.

1. **Cross-form field IDOR** — `updateFieldAction` (line ~280) and `removeFieldAction` (~318)
   authorize against `formId` but then `update`/`delete` by bare client-supplied `fieldId`.
   Fix: verify the field's `formId` matches before mutating (fetch field with
   `where: { id: fieldId, formId }` via `findFirst`, or use `deleteMany/updateMany` scoped by
   both and check count). Same for the `formFieldOption` deletes keyed only on `fieldId`.
2. **Grant-revoke IDOR** — `revokeFormAccessAction` (~392) deletes `formAccessGrant` by bare
   `grantId`. Fix: `deleteMany({ where: { id: grantId, formId } })`.
3. **Trusted client file metadata** — `submitFormResponseAction` (`src/app/f/[slug]/actions.ts:55-77`)
   writes client-supplied `pathname`/`fileName`/`sizeBytes`/`mimeType` verbatim into
   `FormFileUpload`, letting a crafted submission point at another form's blob (readable later
   via the authenticated `/api/forms/files/[fileId]` route). Fix: reject any `pathname` not
   prefixed `forms/{slug}/` (match whatever prefix `api/forms/[slug]/upload-token/route.ts`
   mints tokens for — verify exact prefix there first), cap `fileName` length, validate
   `sizeBytes`/`mimeType` against the field's allowlist.
4. **Per-field upload limits unenforced server-side** — `FormField.maxFiles`/`maxFileSizeMb`
   only checked in `public-form.tsx`; the upload-token route hardcodes 10 MB and ignores the
   field config. Fix: enforce `maxFiles` in `submitFormResponseAction` (truncate/reject beyond
   the field's limit) and pass the field's `maxFileSizeMb` into the token route's constraints.
5. **Unvalidated public answers** — no length cap on `valueText`; DROPDOWN/MULTIPLE_CHOICE/
   CHECKBOXES values aren't checked against the field's actual options (and `isLocationField`
   values against active location IDs — partially done). Fix in `submitFormResponseAction`:
   cap `valueText` (e.g. 5,000 chars) and CHECKBOXES array size, validate choice values against
   `formFieldOption` rows (include options in the existing `fields: true` include).
6. **Silent permission-denied no-ops** — `setFormStatusAction`, `deleteFormAction`,
   `removeFieldAction`, `moveFieldInFormAction` return void on auth failure. Return a
   user-facing error instead (matches the rest of the app's `FormState` pattern).

## Tier 2 — Performance & database

1. **New migration with composite indexes** (one migration, `prisma/schema.prisma`):
   - `User`: `@@index([role, deletedAt])` — the `role` + `deletedAt: null` combo appears in ~32
     queries across list pages/dashboard.
   - `AuditLog`: `@@index([actionType, createdAt])` — serves `/audit-logs` filter+sort+paging.
   - `FormSubmission`: `@@index([formId, submittedAt])`.
   - `FormAccessGrant`: `@@index([grantedToUserId])` — the forms-visibility `some` lookup can't
     use the `[formId, grantedToUserId]` unique.
   - `Session`: `@@index([userId, revokedAt])` — consultant single-session revoke on every login.
   - `Form`: `@@index([createdByUserId])`.
   Apply staging-first (env-override pattern), then production (`npx prisma migrate deploy` bare).
2. **Dashboard double computation** — `dashboard/page.tsx:116` runs `getDashboardAggregates` and
   `getConsultantReportRows` (`src/lib/reports.ts:59` / `:169`), each doing its own scoped
   `user.findMany` + `getConsultantProgressBatch` over the same set. Refactor `reports.ts` to
   compute the consultant list + progress map once and derive both outputs (new combined
   function or shared param), keeping the export route working unchanged.
3. **Paginate `/forms/[id]/submissions`** (`forms/[id]/submissions/page.tsx:35`) — currently
   loads every submission with all answers/files eagerly. Use the same `searchParams`-driven
   `skip`/`take` (50/page) pattern as `audit-logs/page.tsx`, ordered `submittedAt desc` (now
   index-backed).
4. **Expired-session cleanup** — Session rows (with IP/user-agent PII) accumulate forever;
   expiry is read-time only (`session.ts:92`). Add `vercel.json` with a Vercel Cron hitting a
   new `src/app/api/cron/cleanup-sessions/route.ts` (guarded by `CRON_SECRET` env var, Vercel's
   standard pattern) that runs `deleteMany({ expiresAt: { lt: now } })` plus revoked-rows older
   than some window (e.g. 7 days). The `@@index([expiresAt])` already exists to support it.
   `CRON_SECRET` needs adding to Vercel env (I'll generate and set it via `vercel env add`).
5. **Cheap query hygiene** (low-risk touch-ups, skip anything that balloons the diff):
   - `(app)/layout.tsx:16-23` — notification count runs a DB query on every page render for
     CEO/COORDINATOR; leave logic but it rides free once indexes land (no change needed —
     explicitly out of scope).
   - Add `select` to `location-overview/page.tsx:33` and `bulk-reassign/page.tsx:13` so full
     rows (incl. `passwordHash`) stop flowing into RSCs.
   - Parallelize the independent await pairs in `catalog/courses/[id]/page.tsx`,
     `catalog/training-paths/[id]/page.tsx`, `f/[slug]/page.tsx` (and skip the locations query
     when no field uses `optionsSource: LOCATIONS`).

## Tier 3 — Tests & CI

1. **Unit tests for the Tier 1 fixes' logic** where isolable: add `src/lib/validation/forms.test.ts`
   (builder schemas), plus tests for any new pure helpers extracted (e.g. answer-validation or
   pathname-prefix checks — extract these as pure functions precisely so they're testable
   without mocking Prisma, matching the existing "DB-coupled files are E2E's job" convention).
2. **Forms E2E spec** — `e2e/forms.spec.ts`: create form as CEO, add fields, activate, submit
   via public `/f/[slug]`, verify submission appears; verify a second staff user without a grant
   can't see it, then grant and verify they can. Use the `disposableUsername()` pattern.
3. **CI improvements** (`.github/workflows/ci.yml`):
   - Add `"typecheck": "tsc --noEmit"` to `package.json` and run it in CI before build.
   - Trigger on push to all branches (or at least `phase-*`) and PRs — currently `main`-only, so
     phase branches are never gated.
   - Add `playwright-report/` and `tsconfig.tsbuildinfo` to `.gitignore` (both currently
     committed) and remove them from the repo.
4. **Rate-limiter E2E bypass** — `src/lib/rateLimit.ts`: skip limiting when
   `process.env.RATE_LIMIT_DISABLED === "true"` (never set in Vercel prod; set it in
   `playwright.config.ts`'s `webServer.env` for local E2E runs). Fixes the documented
   full-suite lockout (CLAUDE.md "Testing" gotcha / Next Steps item 13).

## Tier 4 — Cleanup & docs

1. **Merge + deploy the rebrand**: merge `phase-2` (commit `a45ee80`, CrewNex UI strings) along
   with all the above work into `main`, push `origin main` (confirm with user first), migrate
   prod, deploy `npx vercel --prod`. Also fix `src/app/layout.tsx:19` description
   ("Private training portal" → CrewNex wording) as part of the rebrand.
2. **Stale error copy**: `catalog/courses/actions.ts:20,46`, `catalog/training-paths/actions.ts:20,52`
   ("Only the CEO can manage…" — the gate allows Location Manager too). Check
   `locations/actions.ts:13` / `locations/page.tsx:22` copy is actually correct there (Locations
   IS CEO-only — likely fine, verify before touching).
3. **Delete orphaned legacy list routes**: `src/app/(app)/users/{managers,location-managers,coordinators,consultants,ceos}/page.tsx`
   — replace each with a `redirect("/users/management")` (safer than deletion for bookmarks).
   Keep `/users/consultants/[id]` (real feature). Check `UserTable.tsx` usages first — if only
   legacy pages used it, it may be removable too (verify `showLearningLink` consumers).
4. **CSP touch-ups** (`src/lib/csp.ts`, `src/proxy.ts`): remove the dead `x-nonce` request
   header (no consumers); tighten `img-src 'self' data: https:` → `'self' data:` plus the
   specific hosts actually used (Drive thumbnails — check what `thumbnailUrl` domains exist
   before tightening; if arbitrary admin-entered thumbnail URLs are a feature, leave `https:`
   and note why).
5. **Docs refresh**: update `docs/Getting-Started.md`, `docs/Admin-Guide.md`,
   `docs/Build-Progress.md` — CrewNex name, `crewnex.vercel.app` URL, post-rename role names
   (Location Manager/Location Admin), mention of the 4 offshore/placement roles. Add a **Forms
   feature section to `CLAUDE.md`** (models, routes, RBAC mechanisms, upload flow) — two source
   files already cite "CLAUDE.md's Forms notes" that don't exist. Update CLAUDE.md's Known
   Limitations/Next Steps for everything this plan fixes (rate-limiter item 13, session cleanup,
   stale-copy item 1, orphaned routes item 2).

## Sequencing

Tier 1 first (security, deploy ASAP — potentially as its own merge/deploy before the rest),
then Tier 2 (includes the one migration), Tier 3, Tier 4. All work on `phase-2`; user
confirmation before each `git push origin main`, production migration, and production deploy.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` green after each tier (175 existing
  tests must stay green; new forms/validation tests added in Tier 3).
- Tier 1: manual exploit checks against staging — attempt cross-form field edit with a forged
  `fieldId`, forged blob `pathname`, out-of-options dropdown value; all must be rejected.
- Tier 2: `prisma migrate status` clean on staging then prod; `/dashboard` and
  `/forms/[id]/submissions` render correctly; confirm cron route returns 401 without
  `CRON_SECRET` and deletes expired rows with it (staging test).
- Tier 3: full `npm run test:e2e` against staging with `RATE_LIMIT_DISABLED=true` — the suite
  should now run start-to-finish (previously impossible per the rate-limit lockout).
- Tier 4: legacy user-list URLs redirect; live site smoke test post-deploy (login, /dashboard,
  /forms, public /f/[slug]).

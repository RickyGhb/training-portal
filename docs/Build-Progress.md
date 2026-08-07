# Training Portal — Build Progress

Living log, updated after each build phase. Full plan: `.claude/plans/i-m-planning-to-build-dreamy-floyd.md` (in this session). Source specs: `Prompt.md`, `Business-Friendly Product Blueprint.md`, `Technical Implementation Blueprint.md` in this folder.

**Code lives at:** `~/Documents/Sync-Shared/Projects/training-portal` (moved 2026-08-07 to a Syncthing-synced folder so it's available on both laptops — `node_modules`/`.next` are excluded from the sync, run `npm install` fresh after pulling on a new machine).

**Local dev:** `cd ~/Documents/Sync-Shared/Projects/training-portal && npm run dev` → http://localhost:3000

**Hosting accounts set up:**
- Vercel: logged in as `rickyb7999-8701` (free tier for now)
- Supabase project: "Training-Project" (free tier for now), region us-west-2
- CEO login: username `CEOAdmin`, password `IamAdminCeo@123$` — **change this after first real login**

**Live:** https://training-portal-flame.vercel.app (deployed 2026-08-07 during Phase 6). See `Admin-Guide.md` in this folder for day-to-day operation, deployment, and troubleshooting.

---

## Phase 1: Foundation — ✅ Complete

- Next.js (TypeScript, App Router, Tailwind) scaffolded
- Full Prisma schema covering the entire data model (users, locations, training paths, courses, videos, assignments, completions, sessions, audit logs, notifications)
- Credentials auth: argon2id password hashing, server-side sessions, HTTP-only cookies, single-session enforcement for consultants
- Central authorization module (`src/lib/auth/rbac.ts`) — every future route checks permissions through this one place
- Google Drive link → embeddable preview URL converter
- Login page, role-aware sidebar layout, base dashboard
- CEO account bootstrapped via a one-time seed script
- Database migrated and connected to Supabase; **login verified working end-to-end**

## Phase 2: User management — ✅ Complete (pending your click-through test)

- **Locations** page (CEO only): create locations, archive/reactivate
- **Managers** page (CEO only): create/list Manager accounts
- **Location Managers** page (CEO, Manager): create/list, tied to one location
- **Coordinators** page (CEO, Manager, Location Manager): create/list — CEO can leave a coordinator "independent" (no location), matching the flexible org model in the spec
- **Consultants** page (everyone except Consultant): create/list, each owned by one coordinator, location inherited from that coordinator
- Every list/create/edit action is scoped server-side by role and location/ownership — not just hidden in the UI
- Username change, password reset (signs out existing sessions), deactivate/reactivate, and delete (soft delete, keeps history) — all behind confirmation modals
- Password resets and consultant deletions log an audit entry and queue a CEO notification (the notification inbox screen itself is Phase 5, but the data's being captured now)
- **Bulk Reassignment** page: move multiple consultants to a different coordinator at once, scoped to what the actor is allowed to touch

**To test:** log in at http://localhost:3000/login as `CEOAdmin`, then try the sidebar links — Locations, Managers, Location Managers, Coordinators, Consultants, Bulk Reassignment.

## Phase 3: Catalog (training paths, courses, videos) — ✅ Complete (pending your click-through test)

- **Training Paths** page (CEO only): create/rename, archive/reactivate, delete (with a warning if consultants are currently assigned to it)
- **Training Path detail** page: attach/detach courses, reorder with up/down controls
- **Courses** page (CEO only): create/rename, archive/reactivate, delete (with a warning covering both training-path usage and extra-course assignments)
- **Course detail** page: attach/detach videos, reorder with up/down controls
- **Videos** page (CEO, Manager, Location Manager — matches `canManageVideos` in the RBAC module): add via a Google Drive share link (validated and converted to an embeddable preview URL, duplicate Drive files rejected), edit metadata, archive/reactivate, delete (with a "used in N courses" warning)
- Courses and videos are reusable/many-to-many by design — the same course can sit in multiple training paths, the same video in multiple courses
- Every create/update/delete writes an audit log entry using the existing `AuditActionType` enum values
- Nav updated: Training Paths/Courses/Videos links now enabled for CEO; Videos link also enabled for Manager and Location Manager (previously only CEO/Manager had it in the nav, which didn't match the RBAC module — fixed for consistency)
- Verified: `tsc --noEmit` clean, ESLint clean, production build succeeds, and a direct-to-Supabase smoke test confirmed create/read/relations/cascading-delete all work correctly (temporary test rows created and cleaned up)
- **Not yet verified:** live click-through in the browser (same limitation as Phase 2 — no browser automation available in this session)

**To test:** log in as `CEOAdmin`, then Training Paths / Courses / Videos in the sidebar. Try: create a course, create a video from a real Drive share link, open a course's detail page and attach the video, create a training path and attach the course, reorder items, then archive/delete to see the warnings.

## Phase 4: Assignments and learning experience — ✅ Complete (pending your click-through test)

- **Content resolution library** (`src/lib/content-resolution.ts`, `server-only`): a consultant's resolved courses = primary training path courses UNION extra assigned courses; resolved videos = all videos mapped to those courses. Archived courses/videos are excluded. This is the one place that logic lives — every page and the dashboard reads through it instead of re-deriving it.
- **Consultant detail page** (`/users/consultants/[id]`, reached via a new "Training & progress" link on the Consultants list): profile summary, progress tile row (completion %, completed/pending videos, assigned courses), assign/change primary training path (confirmation modal shows the current path before replacing it), add/remove extra courses, and a live list of resolved courses labeled "Assigned by path" / "Extra course" / both — gated by the existing `canAssignTrainingPath` / `canAssignExtraCourses` / `canManageUser` RBAC checks, so a Coordinator only sees this for their own consultants.
- **My Courses** (`/my-courses`, consultant-only): lists resolved courses with completion counts and the assignment-source label.
- **Course detail** (`/my-courses/[courseId]`): ordered video list with per-video completion state; 404s if the course isn't actually in that consultant's resolved set (server-side check, not just hidden nav).
- **Video player** (`/my-courses/[courseId]/[videoId]`): embeds the Drive preview URL in an iframe, "Mark as Completed" button (consultant marking their own video only, per spec — no admin-on-behalf marking), prev/next navigation within the course, 404s the same way if unresolved.
- **Consultant dashboard**: now shows their primary training path name and the same progress tiles, with a link into My Courses. Staff dashboards are unchanged (full reporting dashboards are Phase 5).
- Every assignment/removal writes an audit log entry (`TRAINING_PATH_ASSIGNED`/`TRAINING_PATH_CHANGED`/`EXTRA_COURSE_ASSIGNED`/`EXTRA_COURSE_REMOVED`); none of these trigger a CEO notification, matching §15 of the technical blueprint (only report exports, password resets, and consultant deletions do).
- Nav: "My Courses" enabled for Consultant.
- Verified: `tsc --noEmit` clean, ESLint clean, production build succeeds. Two direct-to-Supabase smoke tests (temporary rows created and cleaned up) confirmed: catalog relations/cascades (Phase 3 re-check) and the full assignment flow — primary path + extra course resolve to the correct UNION, progress percentage math is correct, and the `(consultantUserId, videoId)` unique constraint correctly rejects a duplicate completion.
- **Not yet verified:** live click-through in the browser (same limitation as Phases 2–3 — no browser automation available in this session)

**To test:** as `CEOAdmin`, open a consultant's "Training & progress" page, assign a training path, add an extra course. Then log in as that consultant and check My Courses — you should see courses from both sources labeled correctly, be able to open a video, mark it complete, and see the dashboard/progress numbers update.

## Phase 5: Reporting, audit, notifications, exports — ✅ Complete (pending your click-through test)

- **Reports** (`/reports` — CEO, Manager, Location Manager, Coordinator): dashboard tiles (total/active/deactivated/deleted consultants), breakdowns (consultants by training path / coordinator / location, average completion by path / coordinator), and a filterable consultant metrics table (location, coordinator, training path, status). Scoped server-side the same way as everywhere else — a Coordinator only ever sees their own consultants.
- **Reporting library** (`src/lib/reports.ts`, `server-only`): the dashboard aggregates and per-consultant report rows both build on the Phase 4 content-resolution/progress logic rather than re-deriving completion math.
- **Exports** (`/reports/exports` — CEO, Manager, Location Manager, matching `canExportReports`): filter form with two download buttons hitting a new route handler, `GET /api/reports/export?format=csv|xlsx`. CSV is hand-written (properly escaped); XLSX uses `exceljs` (new dependency). Every export writes a `REPORT_EXPORTED` audit entry with the filters and row count used, and — per §15 of the technical blueprint — a Manager's export also queues a CEO notification (Location Manager and CEO exports do not).
- **Audit Logs** (`/audit-logs` — CEO only): paginated (50/page), filterable by action type and date range, showing actor, action, target, location, and raw metadata for every sensitive action across the portal.
- **Notifications** (`/notifications` — CEO only): inbox of everything routed to the CEO (password resets, consultant deletions, Manager exports), mark-one-read and mark-all-read actions, plus an unread-count badge on the sidebar nav item.
- Nav: Reports/Exports/Notifications/Audit Logs enabled for the appropriate roles; Coordinator's old disabled "Progress" placeholder replaced with a working "Reports" link (their own scoped view).
- Verified: `tsc --noEmit` clean, ESLint clean, production build succeeds (25 routes total now). A direct-to-Supabase smoke test confirmed scoped aggregate counts, audit log write/read, and notification unread-count/mark-read all work. Additionally — since this is the first phase with a plain REST route instead of only server actions — I created a real signed-in session directly in the database and hit `/api/reports/export` over actual HTTP for both `format=csv` and `format=xlsx`: got back a correctly-headered, valid CSV and a valid `.xlsx` file (confirmed via `file`), and confirmed the resulting `REPORT_EXPORTED` audit rows landed in the database with the right metadata. All test rows/sessions/audit entries were cleaned up afterward.
- **Not yet verified:** live click-through in the browser (same limitation as Phases 2–4 — no browser automation available in this session)

**To test:** as `CEOAdmin`, open Reports to see the dashboard tiles and filters, then Exports to download a CSV/XLSX. Check Audit Logs for the export entry. Log in as a Manager and export something — a notification should show up in the CEO's Notifications inbox with an unread badge in the sidebar.

## Phase 6: Hardening and launch — ✅ Complete

- **Permissions review** across every server action and page. Found and fixed one real bug: `getConsultantReportRows()` (used by both `/reports` and `/api/reports/export`) merged the RBAC visibility scope and user-supplied filters into one object via spread — since `coordinatorId`/`locationId` can appear in both, the filter silently **overwrote** the scope. A Coordinator or Location Manager could edit the URL's query string (`?coordinatorId=<someone else>`) and see or export consultants outside their scope. Fixed by combining scope and filters with Prisma's `AND` instead of a merge, so a filter can only narrow within scope, never widen it — verified against the real database that the exploit now returns zero rows instead of leaking data. Commit `e0f646a`.
- **Session/security hardening**: confirmed cookie flags (httpOnly, secure-in-production, sameSite=lax), 12-hour session TTL, session revocation on password reset/deactivation/deletion, and that every route is covered by either the `(app)` layout's auth gate or an inline check in the one REST route. Closed a minor login timing side-channel — the password hash comparison was skipped entirely when a username didn't exist, making "no such user" distinguishable from "wrong password" by response time; login now always runs a real argon2 comparison (against a fixed dummy hash when there's no valid account).
- **Full-repo QA**: `tsc --noEmit`, ESLint, and `next build` all clean across the entire codebase (not just phase-scoped files); confirmed no Prisma migration drift (`prisma migrate status`); confirmed no `enabled: false` nav placeholders remain — every planned page from all 5 phases is live and linked.
- **Deployed to production**: linked a new Vercel project (`ricky-s-team1/training-portal`), set `DATABASE_URL`/`DIRECT_URL` as Production environment variables without ever printing the secret values to the terminal, and ran `vercel --prod`. Live at **https://training-portal-flame.vercel.app**. Verified for real — not just "build succeeded" — by creating a genuine signed-in session directly in the production database and hitting `/dashboard`, `/reports`, and `/api/reports/export` over actual HTTPS: all returned 200 with a valid session cookie and 307 (redirect to login) without one. Test session and the one audit-log row it generated were cleaned up afterward.
- **Admin handoff**: wrote `Admin-Guide.md` in this folder — role hierarchy, day-to-day operations, deployment/redeploy instructions, and an honest list of accepted limitations for pilot scale (no login rate-limiting, no self-service password change, shared dev/prod database, the export route's GET-based CSRF exposure and why its impact is limited to log noise not data leakage).
**Live browser click-through — ✅ done (2026-08-07, after Chrome extension was connected):** logged in as CEO, created a location, an independent coordinator, and a consultant; built a full Training Path → Course → Video chain with a real Drive link; assigned the path to the consultant; logged in as that consultant and completed the video; confirmed the dashboard, Reports page, and Audit Logs all reflected it correctly. Found and fixed 4 real bugs this only surfaces by actually clicking through, all in commit `4b17799`:
- **Crash creating an independent coordinator** — leaving "Location" blank sent `locationId: ""` instead of `null`/undefined (a zod schema gap: `.optional()` alone doesn't reject `""`, only an extra constraint like `.email()` did — so this same gap affected `phone`, `description`, `locationManagerId`, `managerId` too), which hit a raw Postgres foreign-key error. Fixed with a proper `optionalTrimmedString()` preprocessor.
- **That crash leaked a raw Prisma error message to the browser.** Three catch blocks in `users/actions.ts` returned `err.message` directly. Added a `UserFacingError` class so only errors we deliberately throw with a safe message get shown; everything else now says "Something went wrong."
- **All typed text in every form input was nearly invisible** — light gray on white. Root cause: a leftover `create-next-app` dark-mode CSS override that flips global text color near-white on `prefers-color-scheme: dark`, but nothing else in the app has a dark variant. Removed it.
- **Two spots of stale copy** (dashboard placeholder text, a consultant-creation hint) still described Phase 3/4 as not-yet-built.

All test data created during the pass (fake location, coordinator, consultant, training path, course, video) was deleted afterward — production database is back to a clean slate.

**What's left, by choice, not oversight:** self-service password change/reset, login rate-limiting, and a separate staging database are called out in `Admin-Guide.md` as things worth doing before a wider (non-pilot) rollout, but weren't in the original phase plan — say the word if you want any of them built now.

# Training Portal — Complete Application Documentation

## Project Overview

**Training Portal** is a private enterprise training management system built to facilitate organizational training paths, course management, and consultant progress tracking. It provides role-based access control across **nine** permission tiers and enables structured training delivery across distributed teams, from initial course assignment through a post-training placement pipeline (Trainer demo feedback + independent Otter Team sign-off) into "In Marketing" status.

Two parallel role hierarchies exist side by side:
- **Location hierarchy** (the original five): CEO, Location Manager, Location Admin, Coordinator, Consultant — scoped by the `Location` model and `locationId` chain.
- **Offshore/placement roles** (added 2026-08-09): Offshore Manager, Offshore Team Lead, Trainer, Otter Team — scoped by the separate `OffshoreOffice` enum (`LOCATION_1`/`LOCATION_2`) and direct per-consultant assignment FKs, not by `locationId`. See "Role-Based Access Control" below for why these are deliberately kept as a separate scoping axis rather than folded into the location hierarchy.

**Current Version:** 0.1.0
**Status:** Live in production, pilot scale
**Repository:** Git. **`origin`** → `https://github.com/RickyGhb/training-portal` (private) — the only remote, sole source of truth as of 2026-08-10: `git push origin main`. The remote URL has a fine-grained personal access token embedded (local-only, in `.git/config`, never committed) scoped to just this repo, Contents+Workflows read/write, expiring 2026-09-09 — rotate it (regenerate token on GitHub, update the remote URL) before then or pushes will start failing with an auth error. **GitLab is gone**: the project at `gitlab.evr-tec.com/ricky/training-portal` was permanently deleted by explicit user decision on 2026-08-10 (0 issues/MRs/forks existed there, nothing else was lost), and the local `gitlab` remote was removed from `.git/config` the same day. Any doc or script still referencing a `gitlab` remote is stale.
**Live URL:** https://crewnex.vercel.app — renamed 2026-08-14 (Vercel project itself renamed `training-portal` → `worksphere`; `worksphere.vercel.app`/`workaxis.vercel.app`/`crewsphere.vercel.app` were all already taken by other Vercel users, `crewnex.vercel.app` is what got claimed). The old `training-portal-flame.vercel.app` alias is being kept live in parallel as a safety net and is scheduled for removal Monday evening (2026-08-17) — don't be surprised if both URLs still resolve until then.

This file is the deep-reference doc. For narrative/onboarding versions of the same information, see `docs/Getting-Started.md` (mental model, orientation), `docs/Admin-Guide.md` (day-to-day operations, deployment), and `docs/Build-Progress.md` (phase-by-phase build history). `README.md` is a short pointer to all of these plus the quick-start commands.

---

## Tech Stack

**Frontend & Framework:**
- Next.js 16.3.0 (App Router, Turbopack build), React 19.2.8
- TypeScript 5, strict mode
- Tailwind CSS 4 (`@tailwindcss/postcss`)
- Custom design system — warm paper/ink palette, one amber accent, no dark-mode variant (deliberately: see comment in `src/app/globals.css`, a dark-scheme override previously made form input text unreadable)
- Fonts: Fraunces (display/serif headings), IBM Plex Sans (body)

**Backend & Data:**
- Node.js, `server-only` guarded modules
- PostgreSQL hosted on Supabase (project "Training-Project", region us-west-2)
- Prisma ORM 7.9.1 with the `@prisma/adapter-pg` driver adapter (`src/lib/prisma.ts`) — pooled `DATABASE_URL` (Supabase Transaction Pooler) for runtime queries, direct `DIRECT_URL` for migrations (`prisma.config.ts`)
- **Separate staging and production Supabase projects** (staging added 2026-08-10, project "Training-Project-Staging", same region) — local dev's `.env.local` points at staging by default, so local testing no longer writes real rows into the database the live app reads (see Known Limitations)

**Authentication & Security:**
- Custom session-based auth: 32-byte random tokens, SHA256-hashed before storage, httpOnly cookies, 12-hour TTL, `secure` flag in production, `sameSite=lax`
- Argon2id password hashing (`argon2` v0.45.1, OWASP-minimum params)
- Single-active-session enforcement for CONSULTANT role only (other roles may hold multiple concurrent sessions)
- Login timing side-channel closed: password comparison always runs, even for a nonexistent username (against a fixed dummy hash), so response time can't reveal whether a username exists

**Utilities & Libraries:**
- Zod 4 (validation, `src/lib/validation/`)
- ExcelJS 4.4.0 (XLSX report export)
- Playwright (`@playwright/test`) — E2E suite
- Vitest (added 2026-08-10) — unit test suite, `src/**/*.test.ts`, see "Testing" below
- ESLint 9 (`eslint-config-next`)
- tsx (TypeScript execution for one-off scripts, outside the Next.js build)
- `@sentry/nextjs` (added 2026-08-10, error monitoring) — manual (non-wizard) setup: `src/instrumentation-client.ts` (browser), `sentry.server.config.ts`/`sentry.edge.config.ts` loaded via `src/instrumentation.ts`'s `register()`, plus `onRequestError` wired there so uncaught Server Component/action/route-handler errors report automatically. `src/app/error.tsx`/`global-error.tsx` call `Sentry.captureException` directly. The one catch-and-swallow error path in the app — `toFormError()` in `src/app/(app)/users/actions.ts`, the only `catch` block across all server action files — also reports to Sentry before returning its generic message. DSN lives in `NEXT_PUBLIC_SENTRY_DSN` (public by design, write-only). **Source-map upload enabled 2026-08-14**: `next.config.ts` now wraps its export with `withSentryConfig` (org `rbc-th`, project `javascript-nextjs`, `silent: true`, `widenClientFileUpload: true`); `SENTRY_AUTH_TOKEN` (scope `project:releases`) is set in Vercel Production + Preview env, never committed to a file. Verified live — a `npm run build` created a matching release in Sentry with uploaded artifacts, confirmed via the Sentry releases API.

---

## Database Schema

Source of truth: `prisma/schema.prisma`. Migration history in `prisma/migrations/`: `20260807051647_init` (full initial schema), `20260808212645_rename_manager_roles` (the `Role` enum rename, via `ALTER TYPE ... RENAME VALUE` — renames existing rows in place, no data migration needed), and `20260809190852_add_offshore_trainer_otter_roles` (the four new roles, their self-relation FKs, `TrainerFeedback`/`OtterFeedback`, `MarketingStatus`).

### Core Entities

**User**
- Roles: `CEO`, `LOCATION_MANAGER`, `LOCATION_ADMIN`, `COORDINATOR`, `CONSULTANT`, `OFFSHORE_MANAGER`, `OFFSHORE_TEAM_LEAD`, `TRAINER`, `OTTER_TEAM`
- Status: `ACTIVE`, `DEACTIVATED`, `DELETED` (soft delete — `deletedAt` timestamp set, row kept for audit/reporting)
- Location-hierarchy self-relations: `managerId` (→ a user's Location Manager supervisor), `locationManagerId` (→ a user's Location Admin supervisor), `coordinatorId` (→ a consultant's owning Coordinator). **These FK column names predate the 2026-08-08 role rename and were deliberately left as-is** — `managerId` still means "the Location Manager above this user," not literally a role called "Manager."
- Offshore/placement self-relations (added 2026-08-09), each `onDelete: SetNull` at the User-level FK: `offshoreTeamLeadId` (→ the Offshore Team Lead a Consultant is assigned to), `trainerUserId` (→ the one Trainer assigned to a Consultant — explicitly single-assignment, not a technology-match lookup), `otterTeamUserId` (→ the one Otter Team member assigned to a Consultant). Offshore Manager/Team Lead's own office assignment uses `offshoreOffice` directly (no self-relation), same field the Consultant uses.
- `usernameLower` is a separate enforced-lowercase mirror column (unique) so username lookups/uniqueness are case-insensitive without needing a citext extension.
- Consultant-only fields (added earlier on 2026-08-09, before the role work): `offshoreOffice` (`OffshoreOffice?`: `LOCATION_1`/`LOCATION_2`), `technology` (free string — also used non-Consultant by Trainer, to record which technology they teach), `visaType` (`VisaType?`), `dateOfBirth` (`DateTime?`).
- `calendlyLink` (`String?`, all roles but practically only set by Trainer/Coordinator) — self-service, validated to `https?://` only (see the XSS note under Known Limitations/fixed issues below).
- `marketingStatus` (`MarketingStatus`, default `IN_TRAINING`) — Consultant-only in practice; see "Post-Training Placement Pipeline" below.
- Fields: id, firstName, lastName, username, usernameLower, passwordHash, email, phone, status, locationId, managerId, locationManagerId, coordinatorId, offshoreOffice, offshoreTeamLeadId, trainerUserId, otterTeamUserId, calendlyLink, marketingStatus, technology, visaType, dateOfBirth, createdByUserId, createdAt, updatedAt, deletedAt

**Location**
- Business units/branches. Only CEO can create/archive them (`/locations`).
- Fields: id, name, code (unique), status (`ACTIVE`/`ARCHIVED`), createdByUserId, timestamps

**TrainingPath**
- Ordered collection of Courses (via `TrainingPathCourse` join, `sortOrder`). No `locationId` — global/shared, not location-scoped.
- `technology` (`String?`, added 2026-08-13, `@@index([technology])`) — optional tag matching a value from `TECHNOLOGY_OPTIONS`, set by whoever creates/edits the path (CEO/Location Manager). Purely advisory: used only to sort the "Assign training path" picker on `/users/consultants/[id]` (technology-matching paths first), never enforced — every path stays assignable to every consultant.
- Fields: id, name, description, technology, status, createdByUserId, timestamps

**Course**
- Container for Videos (via `CourseVideo` join, `sortOrder`). Also no `locationId` — global/shared, reusable across multiple Training Paths.
- Fields: id, name, description, status, createdByUserId, timestamps

**Video**
- A Google Drive file, embedded. No `locationId` — global/shared catalog entity.
- Fields: id, title, description, driveSourceUrl, driveFileId (unique), embedUrl, thumbnailUrl, durationSeconds, status, createdByUserId, updatedByUserId, timestamps

**Assignments & Progress**
- **ConsultantTrainingAssignment**: primary Training Path per consultant, unique per consultant (`onDelete: Cascade` from the consultant side)
- **ConsultantExtraCourse**: ad-hoc course assignments, unique per (consultant, course) pair, cascades from both consultant and course
- **VideoCompletion**: one row per (consultant, video) completion, cascades from both consultant and video

**Post-Training Placement Pipeline (added 2026-08-09)**
- **TrainerFeedback**: `id, consultantUserId (Cascade), trainerUserId (Restrict), verdict (FeedbackVerdict), notes, createdAt`. One row per demo attempt — history is kept, never overwritten; the pipeline always reads the *latest* row per consultant (`orderBy createdAt desc, take 1`).
- **OtterFeedback**: identical shape (`consultantUserId`, `otterUserId`, `verdict`, `notes`, `createdAt`) — the second, independent sign-off.
- Both feedback tables cascade on the consultant side but **Restrict** on the trainer/otter side (the feedback author) — an active Trainer/Otter Team account can't be deleted while their feedback history still references it.
- See "Post-Training Placement Pipeline" under Key Features for the full rollup logic (`src/lib/marketingReadiness.ts`).

**Forms — public data collection (see "Forms" under Key Features for the full picture)**
- **Form**: id, title, description, slug (unique, public URL `/f/{slug}`), status, createdByUserId, timestamps
- **FormField**: formId (Cascade), label, helpText, type (`FormFieldType`), required, sortOrder, optionsSource (`FormFieldOptionsSource`), maxFiles/maxFileSizeMb (FILE_UPLOAD only), isLocationField
- **FormFieldOption**: fieldId (Cascade), label, sortOrder — only populated when optionsSource = CUSTOM
- **FormSubmission**: formId (Cascade), locationId (resolved from the isLocationField answer, if any), submittedAt, respondentIp
- **FormAnswer**: submissionId (Cascade), fieldId (**Restrict** — see Cascade cheat sheet), valueText/valueJson
- **FormFileUpload**: submissionId (Cascade), fieldId (Restrict), fileName, storagePathname (Vercel Blob pathname — never a public URL), fileSizeBytes, mimeType
- **FormAccessGrant**: formId (Cascade), grantedToUserId/grantedByUserId (Restrict — a staff account with a grant history can't be deleted while it's referenced), unique per (formId, grantedToUserId)

**Audit & Notifications**
- **AuditLog**: 34 `AuditActionType` values (see enum below). `actorUserId`/`targetUserId`/`locationId`/`trainingPathId`/`courseId`/`videoId`/`formId` are all **optional FKs with no `onDelete` clause (Postgres default: Restrict)** — meaning any of those referenced rows (a user, location, course, form, etc.) cannot be deleted while an AuditLog row still points to it. Deleting such rows (e.g. cleanup scripts) must delete/reassign the referencing AuditLog rows first. `MARKETING_STATUS_CHANGED` rows are written with `actorUserId: null` (system-triggered, not a direct user action); so are `FORM_SUBMITTED` rows (anonymous public submitter).
- **Notification**: five types — `REPORT_EXPORTED`, `PASSWORD_RESET`, `USER_DELETED`, `PROFILE_CHANGE_REQUESTED`, `MARKETING_READY`. `sourceAuditLogId` is also Restrict (not cascade), same caveat. (`PROFILE_CHANGE_REQUESTED` belongs to a self-service profile-change-request feature — `/profile-requests`, `src/app/(app)/profile-requests/` — that predates this Forms documentation pass and is not yet written up here; see the note at the end of this file.)
- **Session**: token-hash storage (`onDelete: Cascade` from the user side — deleting a user auto-clears their sessions).

**Enums:**
- `Role`: CEO, LOCATION_MANAGER, LOCATION_ADMIN, COORDINATOR, CONSULTANT, OFFSHORE_MANAGER, OFFSHORE_TEAM_LEAD, TRAINER, OTTER_TEAM
- `UserStatus`: ACTIVE, DEACTIVATED, DELETED
- `ContentStatus`: ACTIVE, ARCHIVED
- `OffshoreOffice`: LOCATION_1, LOCATION_2 — deliberately **not** the `Location` model (business-unit branches); this is a separate, simpler two-value split used only by the offshore/placement roles and the Consultant's own office assignment
- `VisaType`: CPT, INITIAL_OPT, STEM_OPT, H1B, H4EAD, GC, US_CITIZEN
- `MarketingStatus`: IN_TRAINING, IN_MARKETING
- `FeedbackVerdict`: READY, NOT_READY
- `AuditActionType` (34): USER_CREATED, USERNAME_CHANGED, PASSWORD_RESET, USER_DEACTIVATED, USER_REACTIVATED, USER_DELETED, TRAINING_PATH_ASSIGNED, TRAINING_PATH_CHANGED, EXTRA_COURSE_ASSIGNED, EXTRA_COURSE_REMOVED, CONSULTANT_REASSIGNED (defined but not currently written by any code path — `CONSULTANTS_BULK_REASSIGNED` is used instead for the actual bulk-reassign feature), CONSULTANTS_BULK_REASSIGNED, LOCATION_CREATED, LOCATION_UPDATED, TRAINING_PATH_CREATED, TRAINING_PATH_UPDATED, TRAINING_PATH_DELETED, COURSE_CREATED, COURSE_UPDATED, COURSE_DELETED, VIDEO_CREATED, VIDEO_UPDATED, VIDEO_DELETED, REPORT_EXPORTED, LOGIN_SUCCEEDED, LOGIN_FAILED, PROFILE_CHANGE_REQUESTED, PROFILE_UPDATED (see the profile-requests note above — undocumented feature, not further detailed here), TRAINER_FEEDBACK_SUBMITTED, OTTER_FEEDBACK_SUBMITTED, MARKETING_STATUS_CHANGED, TEAM_LEAD_REASSIGNED, FORM_CREATED, FORM_UPDATED, FORM_DELETED, FORM_SUBMITTED
- `NotificationType`: REPORT_EXPORTED, PASSWORD_RESET, USER_DELETED, PROFILE_CHANGE_REQUESTED, MARKETING_READY

### Cascade behavior cheat sheet (matters when writing any deletion logic)

**Corrected 2026-08-13** — this section previously claimed several FKs were `Restrict` (no `onDelete` clause in `schema.prisma`, which defaults to Prisma-level `Restrict`) based on a plain read of `schema.prisma`. That's what Prisma *would* generate on a fresh migration, but it does not match what's actually deployed: `prisma/migrations/20260807051647_init/migration.sql` was hand-verified line-by-line and nearly every one of those FKs is `ON DELETE SET NULL` in the real database, not Restrict. Trust the migration SQL over a schema.prisma read when reasoning about deletion behavior — the two have drifted (the schema.prisma `onDelete` clauses may have been added/removed after `init` was generated, without a corresponding migration). This was discovered by reproducing `deleteCourseAction`/`deleteVideoAction` live and finding they never actually throw — see the P2003 note below.

- **Cascades automatically** on User delete: Session, VideoCompletion (consultant side), ConsultantTrainingAssignment (consultant side), ConsultantExtraCourse (consultant side), TrainerFeedback/OtterFeedback (consultant side only), Notification (recipient side).
- **Cascades automatically** on Course/Video/TrainingPath delete: CourseVideo, TrainingPathCourse, ConsultantExtraCourse (course side, `ON DELETE CASCADE`), VideoCompletion (video side, `ON DELETE CASCADE`) — meaning deleting an in-use Course/Video silently destroys consultant extra-course assignments / completion history, with no DB-level block. The confirm-modal usage-count warning (courses-in-path, videos-in-course, extra-course-assignment count) is the *only* guard against this; there's no FK safety net.
- **`SET NULL`, not Restrict** (verified against the real migration SQL, contra earlier docs): every AuditLog FK (`actorUserId`, `targetUserId`, `locationId`, `trainingPathId`, `courseId`, `videoId`), `Notification.sourceAuditLogId`, the User self-relations (`managerId`/`locationManagerId`/`coordinatorId`/`createdByUserId`), `offshoreTeamLeadId`/`trainerUserId`/`otterTeamUserId`, and every `*_assignedByUserId`/`markedByUserId`/`updatedByUserId` audit-style FK. Deleting any of these referenced rows just nulls out the pointer — it never blocks.
- **Actually Restrict (the only three in the whole schema)**: `ConsultantTrainingAssignment.trainingPathId` (a TrainingPath currently assigned as someone's primary path can't be hard-deleted — this is the real cause of the `deleteTrainingPathAction` P2003 documented below, not the AuditLog reference the original report assumed), `TrainerFeedback.trainerUserId`, `OtterFeedback.otterUserId` (an active Trainer/Otter Team account with feedback history can't be deleted while referenced as the feedback *author*).
- Practical consequence: `deleteCourseAction`/`deleteVideoAction` (`src/app/(app)/catalog/courses/actions.ts`, `src/app/(app)/catalog/videos/actions.ts`) now also wrap their `delete()` in try/catch for a P2003 (matching `deleteTrainingPathAction`'s pattern, see below) as defensive code, but as of this writing there's no live Restrict FK that can actually trigger it for a Course or Video — verified live 2026-08-13 by creating and deleting throwaway courses referenced by a real `AuditLog.courseId` row; both deleted cleanly, no error.

---

## Authentication & Authorization

### Session Management (`src/lib/auth/session.ts`)

- Session tokens: 32-byte random base64url strings, SHA256-hashed before storing (`Session.sessionTokenHash`)
- TTL: 12 hours (`SESSION_TTL_MS`)
- Cookie: `tp_session`, httpOnly, `secure` in production, `sameSite=lax`
- Consultant enforcement: `createSession()` revokes every other active session for that user first, but only when `role === "CONSULTANT"` — other roles can be logged in on multiple devices/browsers simultaneously
- `getCurrentUser()` returns a `SessionUser` (id, role, status, firstName, lastName, username, locationId, managerId, locationManagerId, coordinatorId) or `null` — re-derived from the DB on every call (no JWT/stateless claims), so a revoked session or deactivated account is rejected immediately, not just at next-login

### Role-Based Access Control (RBAC)

Central authorization in `src/lib/auth/rbac.ts` — every server action and page must gate through these functions; the frontend nav hiding an item is never the actual security boundary.

**Role Rank Hierarchy:**
```
Location hierarchy:   CEO (4) > LOCATION_MANAGER (3) > LOCATION_ADMIN (2) > COORDINATOR (1) > CONSULTANT (0)
Offshore hierarchy:   OFFSHORE_MANAGER (1) > OFFSHORE_TEAM_LEAD (0)
No-report roles:      TRAINER (0), OTTER_TEAM (0) — manage no one, ranked at the Consultant tier
```

> **Renamed 2026-08-08:** the old `MANAGER` role is now `LOCATION_MANAGER` ("Location Manager"), and the old `LOCATION_MANAGER` role is now `LOCATION_ADMIN` ("Location Admin"). At rename time each kept its own prior permission set; Location Manager's permissions were then further changed the same day to be location-scoped (previously org-wide/unscoped) and to gain catalog structure access (previously CEO-only).

> **Added 2026-08-09 — Offshore Manager / Offshore Team Lead / Trainer / Otter Team.** These four are **deliberately not folded into the single `ROLE_RANK`/`canManageUser`/`userVisibilityFilter` hierarchy** the five location roles share — that hierarchy is built entirely around the `locationId` chain, and these roles are scoped by `offshoreOffice` or by a direct per-consultant assignment FK instead. Offshore Manager → Offshore Team Lead *is* a small hierarchy of its own (mirrors Coordinator → Consultant), which is why those two alone get non-zero, non-equal `ROLE_RANK` values — that lets `canCreateRole`/rank-comparison logic work between just that pair. Trainer and Otter Team manage no one and sit at the Consultant tier. Each of the four gets its own dedicated `canViewAsX` function below rather than overloading `canManageUser`.

**Creatable Roles by Actor** (`CREATABLE_ROLES`, via `canCreateRole`/`creatableRoles`):
- CEO: all nine roles
- LOCATION_MANAGER: Location Admin, Coordinator, Consultant
- LOCATION_ADMIN: Coordinator, Consultant
- COORDINATOR: Consultant
- CONSULTANT: none
- OFFSHORE_MANAGER: Offshore Team Lead
- OFFSHORE_TEAM_LEAD, TRAINER, OTTER_TEAM: none

**User Management Scope** (`canManageUser`):
- CEO: everyone
- LOCATION_MANAGER: everyone ranked below them (Location Admin, Coordinator, Consultant), **but only within their own assigned `locationId`** — a Location Manager with no location assigned manages no one (explicit null-guard, not an accidental "sees everyone" bug)
- LOCATION_ADMIN: Coordinators/Consultants within the same `locationId`, same null-guard
- COORDINATOR: only Consultants where `coordinatorId === actor.id`
- OFFSHORE_MANAGER: only Offshore Team Leads where `offshoreOffice === actor.offshoreOffice` — **any** Offshore Manager in an office can manage **any** Team Lead in that office, not just the one who created them (Team Leads are reassignable between Offshore Managers by design)
- CONSULTANT, OFFSHORE_TEAM_LEAD, TRAINER, OTTER_TEAM: no one (all explicit `false` — none of these roles manage other users; a Consultant's self-service actions are gated separately, not through `canManageUser`)

**Key Authorization Functions** (`src/lib/auth/rbac.ts`):
- `isHigherOrEqualRank(a, b)` — rank comparison
- `canCreateRole(actorRole, targetRole)` / `creatableRoles(actorRole)` — role creation matrix
- `canManageUser(actor, target)` — the core scope check described above; `actor.id === target.id` always returns true (self-management, e.g. self-service password change, is allowed independent of rank)
- `canViewAsOffshoreManager(actor, target)` — target is a Consultant, `target.offshoreOffice === actor.offshoreOffice`. Read access only — no edit/delete rights flow from this function.
- `canManageTeamLead(actor, target)` — actor is `OFFSHORE_MANAGER`; delegates to `canManageUser` (same office-scope rule above), used for create/reassign/manage actions on Offshore Team Leads
- `canViewAsTeamLead(actor, target)` — target is a Consultant explicitly assigned via `target.offshoreTeamLeadId === actor.id`
- `canViewAsTrainer(actor, target)` — target is a Consultant explicitly assigned via `target.trainerUserId === actor.id`. **Direct-assignment check, not a technology-match lookup** — a Trainer only sees consultants assigned specifically to them, even if other consultants share their technology.
- `canViewAsOtterTeam(actor, target)` — target is a Consultant explicitly assigned via `target.otterTeamUserId === actor.id`
- `canAssignExtraCourses(actor, target)` — target must be a Consultant; Coordinator/Consultant actors excluded; otherwise delegates to `canManageUser`
- `canAssignTrainingPath(actor, target)` — target must be a Consultant; Consultant actor excluded; otherwise delegates to `canManageUser`
- `canExportReports(actorRole)` — CEO, Location Manager, Location Admin. The actual row-level scoping for exports comes from `consultantScopeFilter()` in `src/lib/reports.ts`, not from this function.
- `canBulkReassign(actorRole)` — same three roles; actual scoping again comes from `userVisibilityFilter`/`canManageUser` inside `bulkReassignAction`, not this function.
- `canManageCatalogStructure(actorRole)` — CEO, Location Manager. Deliberately global/unscoped (Course/TrainingPath have no `locationId`).
- `canManageVideos(actorRole)` — CEO, Location Manager, Location Admin. Also global/unscoped.
- `isCeo(actorRole)` — gates Audit Logs and Notifications (CEO-only recipient/viewer)
- `userVisibilityFilter(actor)` — the Prisma `where` clause for "which users can this actor see" in list endpoints. CEO → `{}` (no filter). Location Manager/Location Admin → `{ locationId: actor.locationId, role: { notIn: [...] } }`, with an explicit `if (!actor.locationId) return { id: "__none__" }` guard so a location-less actor sees nobody rather than the Prisma `locationId: null` footgun (which would otherwise match every location-less user in the system). Coordinator → their own consultants. Consultant → only themselves. **Caveat:** this function's `role` key is a `{ notIn: [...] }` clause, not a single value — any caller that spreads `userVisibilityFilter(user)` into a `where` object *after* setting its own `role: "SOME_ROLE"` key will have that explicit role filter silently clobbered (spread-order footgun; see the `role: "COORDINATOR"` fix in `dashboard/page.tsx` for the pattern to follow — spread `userVisibilityFilter(user)` *first*, then set the specific `role` key last).
- `locationAssignmentModeFor(actorRole, targetRole)` — returns `"none" | "required" | "optional" | "inherit"`. Drives both whether `CreateUserForm` shows a location picker for a given target role, and (in `createStaffUserAction`) whether the server requires/accepts/auto-inherits a location. `"inherit"` means the new user silently gets the actor's own `locationId` with no picker shown (e.g. a Location Manager creating a Location Admin or Coordinator always lands them in the Location Manager's own location). Returns `"none"` for all four offshore/placement roles (they use `offshoreOfficeAssignmentModeFor` instead).
- `offshoreOfficeAssignmentModeFor(actorRole, targetRole)` — same return type, but governs the `OffshoreOffice` enum instead of the `Location` model. Offshore Manager → `"required"` (CEO must pick an office). Offshore Team Lead → `"inherit"` when created by an Offshore Manager (silently gets the creating manager's office), `"required"` otherwise. Everything else → `"none"`. (A Consultant's own `offshoreOffice` field is handled separately, hardcoded in `CreateUserForm`'s consultant branch and validated in `createConsultantSchema` — this function is never called for `role: "CONSULTANT"`.)

**Type `ScopeSubject`** — the minimal shape needed by the scope-check functions (`id`, `role`, `locationId`, `coordinatorId`, `locationManagerId`, `managerId`, plus optional `offshoreOffice`, `offshoreTeamLeadId`, `trainerUserId`, `otterTeamUserId`); used to pass a partial Prisma `User` row without over-fetching.

---

## Application Structure

```
src/
├── app/
│   ├── page.tsx                      # Root: redirects to /dashboard or /login based on session
│   ├── layout.tsx                    # Root HTML layout (fonts, metadata, no dark-mode CSS)
│   ├── login/
│   │   ├── page.tsx, login-form.tsx  # Public login page
│   │   └── actions.ts                # loginAction — generic error message + constant-time password check regardless of failure reason; writes LOGIN_SUCCEEDED/LOGIN_FAILED directly (not via logAudit())
│   ├── (app)/                        # Everything behind the auth-gated layout
│   │   ├── layout.tsx                # Sidebar shell — reads getCurrentUser(), redirects to /login if none, renders navItemsForRole()
│   │   ├── actions.ts                # logoutAction (App-wide)
│   │   ├── dashboard/page.tsx        # Role-aware: Consultant gets a personal progress view; every other role gets the full org/scoped reporting dashboard (Reports was merged into this page — there is no separate /reports route anymore)
│   │   ├── locations/                # CEO-only: create/archive locations
│   │   ├── users/
│   │   │   ├── management/page.tsx   # THE live user list — consolidated, filterable by role, searchable, paginated. This is what "User Management" in the nav actually links to.
│   │   │   ├── new/page.tsx          # Create User — role picker (only roles the actor can create), location field driven by locationAssignmentModeFor
│   │   │   ├── actions.ts            # createStaffUserAction, createConsultantAction, updateUsernameAction, resetPasswordAction, setUserStatusAction, deleteUserAction, changeOwnPasswordAction, bulkReassignAction
│   │   │   ├── bulk-reassign/        # Move multiple consultants to a different coordinator at once
│   │   │   ├── consultants/[id]/     # Per-consultant detail: progress tiles, assign/change primary path, add/remove extra courses — linked directly from /users/management now (fixed 2026-08-13, see "Orphaned routes" below)
│   │   │   ├── managers/, location-managers/, coordinators/, consultants/, ceos/   # Each now just `redirect("/users/management")` (fixed 2026-08-15) — kept only so old bookmarks/links land somewhere useful. consultants/[id]/ above is unaffected (different route segment).
│   │   ├── catalog/
│   │   │   ├── training-paths/       # CEO + Location Manager: create/edit/archive/delete; [id]/ = attach/reorder courses
│   │   │   ├── courses/              # CEO + Location Manager: create/edit/archive/delete; [id]/ = attach/reorder videos
│   │   │   └── videos/               # CEO + Location Manager + Location Admin: create/edit/archive/delete (Google Drive link → embeddable preview)
│   │   ├── my-courses/                # Consultant-only: resolved course list → course detail → video player + mark-complete
│   │   ├── reports/exports/page.tsx  # Filter form + CSV/XLSX download buttons (CEO, Location Manager, Location Admin)
│   │   ├── notifications/            # CEO-only inbox
│   │   ├── audit-logs/page.tsx       # CEO-only, paginated (50/page), filterable by action type + date range
│   │   ├── location-overview/page.tsx # CEO (office dropdown) / Location Manager / Location Admin / Coordinator: In-Training vs. In-Marketing consultant split — see "Post-Training Placement Pipeline" below
│   │   ├── offshore/
│   │   │   ├── actions.ts            # assignConsultantToTeamLeadAction, reassignTeamLeadOfficeAction
│   │   │   ├── consultants/page.tsx  # "Consultant Data" — Offshore Manager (own office) + CEO (any office); read-only except the per-row Team Lead assign dropdown
│   │   │   ├── team-leads/page.tsx   # Offshore Manager (own office) + CEO (office picker): create/manage Offshore Team Leads, reassign their office
│   │   │   └── my-consultants/page.tsx # Offshore Team Lead-only: consultants assigned to them
│   │   ├── trainer/
│   │   │   ├── actions.ts            # submitTrainerFeedbackAction
│   │   │   └── consultants/page.tsx  # Trainer-only: consultants assigned to them, verdict + notes form
│   │   ├── otter/
│   │   │   ├── actions.ts            # submitOtterFeedbackAction
│   │   │   └── consultants/page.tsx  # Otter Team-only: consultants assigned to them, verdict + notes form
│   │   ├── profile-requests/         # Self-service profile-change-request workflow — undocumented here, see the Forms section's note
│   │   └── forms/                    # Every role but Consultant: build/manage forms — see "Forms" under Key Features
│   │       ├── actions.ts            # createFormAction, updateFormAction, setFormStatusAction, deleteFormAction, addFieldAction, updateFieldAction, removeFieldAction, moveFieldInFormAction, grantFormAccessAction, revokeFormAccessAction
│   │       ├── page.tsx              # /forms — list + create
│   │       └── [id]/edit/, [id]/submissions/  # Builder UI; paginated (50/page) responses view
│   ├── f/[slug]/                     # PUBLIC, unauthenticated form-fill surface — see "Forms" under Key Features. actions.ts's submitFormResponseAction is the only unauthenticated write path in the app besides login.
│   └── api/
│       ├── reports/export/route.ts   # The one plain REST route among the original app's routes (GET, not a server action) — streams CSV or XLSX
│       ├── forms/[slug]/upload-token/route.ts  # Mints a short-lived Vercel Blob client-upload token for public form file uploads
│       ├── forms/files/[fileId]/route.ts       # Authenticated download of an uploaded form file — gated by the same visibility rules as the form itself
│       └── cron/cleanup-sessions/route.ts      # Vercel Cron (daily, see vercel.json), CRON_SECRET-gated — deletes expired/long-revoked Session rows (added 2026-08-15)
├── lib/
│   ├── auth/
│   │   ├── session.ts                # Session creation/verification, getCurrentUser()
│   │   ├── rbac.ts                   # Authorization matrix — see RBAC section above
│   │   └── password.ts               # Argon2id hash/verify, strength validation, constant-time-safe comparison
│   ├── prisma.ts                     # Prisma client singleton with the pg driver adapter
│   ├── nav.ts                        # navItemsForRole() — role-aware sidebar nav
│   ├── roleLabels.ts                 # ROLE_LABELS — single source of truth for human-readable role names, imported everywhere a role is displayed (added 2026-08-08 to de-duplicate 3 copies)
│   ├── content-resolution.ts         # getPrimaryTrainingPath/getResolvedCourses/getResolvedCourseDetail/getResolvedVideoDetail/getConsultantProgress — the "what can this consultant actually see" union logic
│   ├── drive.ts                      # parseDriveLink() — Drive share URL → { fileId, embedUrl }, no Drive API call (URL parsing only)
│   ├── audit.ts                      # logAudit(), notifyCeos(), notifyUser()
│   ├── marketingReadiness.ts         # evaluateMarketingReadiness(consultantUserId) — the Trainer+Otter dual sign-off rollup, see Key Features below
│   ├── offshoreOfficeLabels.ts       # OFFSHORE_OFFICE_LABELS — display labels for LOCATION_1/LOCATION_2
│   ├── visaTypeLabels.ts             # VISA_TYPE_LABELS — display labels for VisaType enum
│   ├── reports.ts                    # getDashboardData() (added 2026-08-15 — computes the batched consultant-progress map once for the union of the aggregates+rows consultant sets, replacing two separate getConsultantProgressBatch calls per dashboard render), getDashboardAggregates(), getConsultantReportRows() — scope (consultantScopeFilter) and user filters combined via Prisma AND, never merged, so a filter can only narrow within scope, never widen it
│   ├── rateLimit.ts                  # checkLoginRateLimit(), checkFormSubmissionRateLimit() — Upstash-backed, fails open if unconfigured; RATE_LIMIT_DISABLED env escape hatch for local E2E only (added 2026-08-15)
│   ├── csp.ts                        # buildCsp() — the CSP policy-string builder, unit-testable separately from proxy.ts
│   ├── errors.ts                     # UserFacingError — only errors deliberately thrown with this class get their .message shown to the client
│   └── validation/
│       ├── user.ts                   # optionalTrimmedString() (blank-string-to-undefined preprocessor), usernameSchema, nameSchema, createStaffUserSchema, createConsultantSchema, createLocationSchema, assignTrainerSchema, assignOtterTeamSchema, submitFeedbackSchema, calendlyLinkSchema (https?:// scheme-allowlisted, see security note below)
│       ├── catalog.ts                # trainingPathSchema, courseSchema, videoSchema, videoEditSchema
│       └── forms.ts                  # formSchema, formFieldSchema, grantFormAccessSchema (builder input) + isAllowedUploadPathname(), MAX_ANSWER_TEXT_LENGTH, etc. (public-submission validation, added 2026-08-15 alongside the Forms IDOR fixes)
└── components/
    ├── ui/
    │   ├── Badge.tsx                 # StatusBadge — color-coded by ACTIVE/DEACTIVATED/DELETED/ARCHIVED
    │   ├── ConfirmButton.tsx         # Yes/no confirmation modal wrapper, used for every destructive/high-impact action
    │   └── FormModalButton.tsx       # Modal containing real form fields (vs. ConfirmButton's plain yes/no)
    └── users/
        ├── UserRowActions.tsx        # Edit username / reset password / deactivate-reactivate / delete, all via FormModalButton/ConfirmButton
        ├── CreateUserForm.tsx        # One form for every creatable role; location field driven by locationAssignmentModeFor, offshore office field driven by offshoreOfficeAssignmentModeFor, optional Trainer/Otter Team pickers in the Consultant fragment
        ├── TrainerAssignForm.tsx     # Reassign a Consultant's Trainer (consultant detail page)
        ├── OtterAssignForm.tsx       # Reassign a Consultant's Otter Team member (consultant detail page)
        └── ChangePasswordButton.tsx  # Self-service password change (sidebar) — signs the user out everywhere including the current session
```

Also: `src/app/(app)/profile/CalendlyLinkForm.tsx` — self-service Calendly link editor, rendered on `/profile` for Trainer/Coordinator; the Consultant's own `/profile` shows a "Schedule your demo" link-out to their assigned Trainer's link instead (read-only from the Consultant's side).

### Orphaned routes (real, worth knowing before changing nav or user-list logic)

The "Merge Dashboard/Reports, add consolidated User Management" work (2026-08-07) introduced `/users/management` and `/users/new` as the real UI entry points, but did not initially delete or redirect the older per-role pages.

- ~~`/users/managers`, `/users/location-managers`, `/users/coordinators`, `/users/consultants`, `/users/ceos` — each still works (role-gated, queries by role + `userVisibilityFilter`), but nothing in the current UI links to them.~~ — **fixed 2026-08-15**: each of these is now a plain `redirect("/users/management")`, with the role-scoped query logic and `UserRowActions`/`UserTable`-rendering removed entirely (`UserTable.tsx` itself deleted — it had no other callers). Kept as redirects rather than deleted outright so old bookmarks/links still land somewhere useful.
- `/users/consultants/[id]` (the per-consultant "Training & progress" detail page — assign path, manage extra courses) **is** still a real, actively-designed feature, unaffected by the above (`/users/consultants/page.tsx`, the list, redirects; `/users/consultants/[id]/page.tsx`, the detail route, does not). `/users/management/page.tsx` links to it directly (fixed 2026-08-13, see below) — discoverable from the main nav for every role that can reach `/users/management`, including Coordinators.
- ~~`/users/management`'s row actions don't currently link to it~~ — **fixed 2026-08-13**: `/users/management/page.tsx` now renders the same "Training & progress" link (gated to `role === "CONSULTANT" && status !== "DELETED"`) as a sibling to `UserRowActions` on each Consultant row.

---

## Key Features & Workflows

### 1. User Management
- Five-role hierarchy, each creating/managing only roles below it (see RBAC section)
- Consultant: single-active-session enforcement
- Login is rate-limited (`src/lib/rateLimit.ts`, Upstash Redis): 20 attempts/10min per IP and 8 attempts/15min per username, both must pass or `loginAction` returns a generic "too many attempts" error before ever touching the DB. Fails open if Upstash isn't configured. `RATE_LIMIT_DISABLED=true` (added 2026-08-15, set only in `playwright.config.ts`'s local `webServer.env`, never in Vercel) bypasses both this and the form-submission limiter entirely — fixes the full-E2E-suite lockout documented under "Testing" below.
- Status lifecycle: ACTIVE → DEACTIVATED (reversible, blocks login) → DELETED (soft delete, reversible only by direct DB action, kept for audit/reporting under "Deleted (archived)")
- Bulk consultant reassignment between coordinators, scoped to the actor's manageable set
- Self-service password change (`ChangePasswordButton` in the sidebar) — verifies current password, signs out every session including the current one, redirects to `/login`
- Admin-initiated password reset — signs out all of the target's existing sessions, logs `PASSWORD_RESET`, notifies CEOs
- Username changes, deactivate/reactivate, soft delete — all behind confirmation modals

### 2. Training Catalog
- Hierarchy: Training Path → Courses (many-to-many via `TrainingPathCourse`) → Videos (many-to-many via `CourseVideo`), both reusable — the same Course can sit in multiple Paths, the same Video in multiple Courses
- CEO + Location Manager: create/edit/archive/delete Training Paths and Courses
- CEO + Location Manager + Location Admin: create/edit/archive/delete Videos
- Video metadata: title, description, Google Drive share link (parsed into an embeddable preview URL), optional thumbnail URL, optional duration in seconds
- Sort order maintained via up/down swap actions (no drag-and-drop)
- Deleting a Course/Training Path/Video that's still in use shows a warning with the actual usage count (courses-in-path, videos-in-course, extra-course-assignment count) before confirming
- **`TrainingPath.technology`** (added 2026-08-13, `String?`, `@@index([technology])`) — an optional tag set by CEO/Location Manager when creating/editing a Training Path via `/catalog/training-paths` (a `<select>` sourced from `TECHNOLOGY_OPTIONS`, plus a "— General (no technology) —" blank option). Purely a soft signal, not an enforced constraint: any Training Path remains assignable to any Consultant regardless of a technology mismatch. See "Training Assignment" below for how it's used.

### 3. Training Assignment
- Exactly one primary Training Path per consultant (`ConsultantTrainingAssignment`, unique per consultant)
- Any number of "extra courses" independent of the primary path (`ConsultantExtraCourse`)
- A consultant's actual resolved content = primary-path courses **UNION** extra courses (deduped; each course labeled "Assigned by path" / "Extra course" / "Assigned by path + Extra")
- Gated by `canAssignTrainingPath`/`canAssignExtraCourses`. **Corrected 2026-08-13**: `canAssignTrainingPath` does *not* exclude Coordinators — a Coordinator can already assign/change the primary path for their own consultants (delegates to `canManageUser`, same as every other permitted role); only `canAssignExtraCourses` excludes Coordinators, by design, not yet enabled (see the asymmetry note in the RBAC section above). The stale claim that Coordinators can't assign either was never actually true for the primary path in the current codebase — the real gap (fixed 2026-08-13) was that no page in a Coordinator's reachable UI linked to `/users/consultants/[id]`, where the working "Assign training path" button lives; see "Orphaned routes" above.
- **Technology-aware picker** (added 2026-08-13): the "Assign training path" dropdown on `/users/consultants/[id]` soft-sorts the active catalog so paths whose `technology` matches the consultant's own `User.technology` appear first (in a "Recommended for {technology}" `<optgroup>`), with every other path still listed and pickable below ("Other Training Paths"). Consultants with no technology set, or when nothing matches, get the flat ungrouped list unchanged. Nothing is enforced server-side — `assignTrainingPathAction` only ever reads `trainingPathId`.

### 4. Progress Tracking
- `VideoCompletion` rows, one per (consultant, video), unique-constrained
- Consultant marks their own videos complete only — no admin-on-behalf marking
- Dashboard/report metrics: completion %, completed/pending video counts, last-completed item + date — all derived from `getConsultantProgress()` in `content-resolution.ts`, never re-derived ad hoc

### 5. Reporting & Exports
- **Reports live inside the Dashboard page now** — for any non-Consultant role, `/dashboard` renders stat tiles, five breakdown panels (by training path / coordinator / location, avg. completion by path / coordinator), a filter form, and the full consultant metrics table, all scoped server-side. **`getDashboardData()`** (added 2026-08-15, `src/lib/reports.ts`) computes both the tiles/breakdowns (unfiltered-by-user-filters aggregates) and the table rows (filtered) in one call, sharing a single batched consultant-progress computation over the union of both consultant sets — the two previously ran fully independently, each paying for its own `getConsultantProgressBatch` call. `getDashboardAggregates()`/`getConsultantReportRows()` still exist standalone (the export route at `/api/reports/export` still calls the latter directly, since it never needs aggregates).
- Export (`/reports/exports`, CEO/Location Manager only as of 2026-08-10 — Location Admin no longer has export access): same filters, two buttons hitting `GET /api/reports/export?format=csv|xlsx`. CSV is hand-escaped; XLSX via ExcelJS. Every export logs `REPORT_EXPORTED`; a Location Manager's export (not CEO's) additionally queues a CEO notification.
- **CSRF-protected** (added 2026-08-10, `src/lib/csrf.ts`) — the export route is a plain `GET` (not a Server Action), so it doesn't get Next.js's automatic Server Action CSRF protection on its own. A synchronizer-token pattern closes this: `getCsrfToken()` derives a token from the session's own httpOnly cookie value (no separate secret needed — the attacker can force the cookie to be *sent* cross-site, but same-origin policy still stops them from *reading* the exports page's HTML to learn the token), embedded as a hidden field in the export form and verified via `verifyCsrfToken()` (timing-safe compare) before the route does any work.

### 6. Audit Logging
- 34 `AuditActionType` values, every sensitive mutation across the app writes one via `logAudit()` (or, for login events, a direct `prisma.auditLog.create` call in `src/app/login/actions.ts`, which intentionally bypasses `logAudit()`)
- CEO-only viewer (`/audit-logs`), paginated 50/page, filterable by action type + date range
- Every AuditLog row optionally carries actor, target user, location, training path, course, and/or video context, plus a free-form `metadataJson` blob

### 7. Notifications
- CEO-only *viewer* (`/notifications`), but **not** the only recipient role anymore — see Placement Pipeline notifications below, which go to Offshore Manager/Team Lead/Location Manager/Location Admin, not CEO. The CEO's own inbox still only fires on: a Location Manager exporting a report, any password reset (self or admin-initiated), any consultant deletion.
- Unread-count badge in the sidebar nav item, mark-one-read / mark-all-read actions

### 8. Post-Training Placement Pipeline (added 2026-08-09)
Two independent, required sign-offs move a Consultant from `IN_TRAINING` to `IN_MARKETING`:
- **Trainer feedback** (`/trainer/consultants`): each Trainer sees only the Consultants explicitly assigned to them (`trainerUserId`, one Trainer per Consultant — not a technology-based pool). After a demo, records a `READY`/`NOT_READY` verdict + optional notes (`TrainerFeedback`, history kept, never overwritten).
- **Otter Team feedback** (`/otter/consultants`): same shape, same one-assignee-per-Consultant model, via `otterTeamUserId` (`OtterFeedback`).
- **Rollup** (`src/lib/marketingReadiness.ts`, `evaluateMarketingReadiness()`): runs after every feedback submission. Re-derives from scratch (reads the *latest* Trainer verdict and *latest* Otter verdict for that Consultant) rather than tracking partial state — cheap enough at pilot scale. Flips `marketingStatus` to `IN_MARKETING` only when **both** latest verdicts are `READY` — no third sign-off, by design. Logs `MARKETING_STATUS_CHANGED` with `actorUserId: null` (system-triggered).
- **Notification fan-out** on flip: every `ACTIVE` Offshore Manager matching the Consultant's `offshoreOffice`, the Consultant's `offshoreTeamLeadId` (if assigned), and every `ACTIVE` Location Manager/Location Admin matching the Consultant's `locationId` — all via `NotificationType.MARKETING_READY`. CEO is **not** a direct recipient of this one; they see aggregate state via `/location-overview` instead.
- **Scheduling**: Consultants don't book inside the app. Trainer/Coordinator each paste their own Calendly link (`calendlyLink`, self-service via `/profile`, validated to an `https?://` scheme — see security note below) and the Consultant's `/profile` shows a "Schedule your demo" link-out to their assigned Trainer's link. No webhook, no booking record synced back — Zoom/Meet link generation (if any) is a Calendly-side setting on the Trainer's own Calendly account, entirely outside this app.
- **Location Overview** (`/location-overview`): CEO gets an office dropdown (`LOCATION_1`/`LOCATION_2`) plus In-Training/In-Marketing counts and lists for the selected office; Location Manager/Location Admin/Coordinator get the same split pre-scoped to their own manageable consultants (no dropdown). Consultant sees only their own status, inline on their personal `/dashboard` — never a list of others.

**Security note (found + fixed 2026-08-09):** `calendlyLinkSchema` originally used a bare `z.string().url()`, which validates that a string parses as *some* URL but not its *scheme* — a `javascript:`/`data:` URI passed that check and would have rendered unsanitized into an `<a href>` on the Consultant's profile (stored XSS). Fixed with an explicit `/^https?:\/\//i` `.refine()` in `src/lib/validation/user.ts`. Verified both that the old check let the payload through and that the fix rejects it.

### 9. Forms — public data collection (added before 2026-08-14, documented here 2026-08-15)
Every role except Consultant can build a form (`canCreateForm`) whose public link (`/f/{slug}`, a random-suffixed slugified title) anyone can fill out with no login — the one deliberately unauthenticated write surface in the app besides `/login` itself.

- **Builder** (`/forms`, `/forms/[id]/edit`): create/edit a form's title+description, add/edit/remove/reorder questions (`FormField` — `SHORT_TEXT`, `PARAGRAPH`, `DATE`, `DROPDOWN`, `MULTIPLE_CHOICE`, `CHECKBOXES`, `FILE_UPLOAD`), share it with a specific named person (`FormAccessGrant`, upsert-by-username), delete (blocked once it has responses — see Cascade cheat sheet — archive instead) or archive/reactivate. Choice-type fields source their options from a custom newline-separated list, the live `Location` list, or the live technology list (`TECHNOLOGY_OPTIONS`) — the last two stay in sync automatically as those change, never copied at field-creation time.
- **Location routing**: exactly one `DROPDOWN` field sourced from Locations can be marked `isLocationField` per form; the submitted value resolves `FormSubmission.locationId`, which is what location-scoped viewers (Mechanism B below) match against. Forms with no such field leave every submission's `locationId` null.
- **Public fill** (`/f/[slug]`, `src/app/f/[slug]/`): anonymous, no CSRF token (Server Actions get Next's built-in protection regardless; a session-cookie-keyed synchronizer token doesn't apply to a visitor with no session) — abuse is mitigated by rate limiting (`checkFormSubmissionRateLimit`, both IP- and slug-keyed) plus a hidden honeypot field. Server-side validates (not just client-side, added 2026-08-15 alongside the IDOR fixes below): text-answer length, choice values against the field's real option set, per-field `maxFiles`/`maxFileSizeMb`, and that uploaded file pathnames actually belong to this form+field (`isAllowedUploadPathname` in `src/lib/validation/forms.ts`).
- **File uploads**: browser uploads bytes directly to Vercel Blob (`@vercel/blob/client`, `access: "private"`) via a short-lived token minted by `POST /api/forms/[slug]/upload-token` — file bytes never transit this server. The token route enforces that specific field's configured `maxFileSizeMb` (parsed off the `{fieldId}-{uuid}-{filename}` pathname the client always generates) rather than one blanket limit for every field. Reading an uploaded file back requires authentication — `GET /api/forms/files/[fileId]`, gated by the same visibility rules as the form itself, never a public Blob URL.
- **Visibility — three independent mechanisms**, in `src/lib/auth/rbac.ts`:
  - **A. Creator hierarchy** (`canViewFormsByCreator`) — a role sees forms built by its own organizational subordinates (e.g. a Location Manager sees forms built by Location Admins/Coordinators in their own location).
  - **B. Per-submission location matching** (folded into `canViewSubmission`) — a Location Manager/Admin/Coordinator whose own `locationId` matches a *specific submission's* resolved `locationId` can see that one submission, independent of who built the form or any grant.
  - **C. Explicit per-person grants** (`FormAccessGrant`, `canGrantFormAccess` — CEO or the form's own creator only can grant).
  - Owning the form or being CEO always grants full access. `formsListWhereClause` (Mechanisms A+C only — B never surfaces a whole form in the `/forms` list, only individual submissions within one already otherwise visible) drives the list page; `canViewForm`/`canViewSubmission` drive the edit and submissions pages.
- **Security fixes (2026-08-15)**: `updateFieldAction`/`removeFieldAction`/`revokeFormAccessAction` originally scoped their mutation by a bare client-supplied `fieldId`/`grantId` without also checking it belonged to the authorized `formId` — an editor of one form could edit/delete a field or revoke a grant belonging to a *different* form. Fixed by scoping every mutation by both ids together.
- Fields: id, title, description, slug (unique), status, createdByUserId, timestamps. `FormField`: label, helpText, type, required, sortOrder, optionsSource, maxFiles/maxFileSizeMb (FILE_UPLOAD only), isLocationField. `FormSubmission`: formId, locationId, submittedAt, respondentIp. `FormAnswer`: submissionId, fieldId, valueText/valueJson. `FormFileUpload`: submissionId, fieldId, fileName, storagePathname, fileSizeBytes, mimeType. `FormAccessGrant`: formId, grantedToUserId, grantedByUserId (unique per formId+grantedToUserId).
- Not yet covered: `docs/*.md` (see the note at the end of this file).

---

## User Roles & Permissions

### CEO
- **Management:** all users, locations, training paths, courses, videos
- **Reporting:** full access — reports (via Dashboard), exports, audit logs, notifications
- **Constraints:** none
- **Navigation:** 9 items — Dashboard, Locations, User Management, Training Paths, Courses, Videos, Exports, Notifications, Audit Logs

### LOCATION_MANAGER (Location Manager — renamed from MANAGER, 2026-08-08)
- **Management:** Location Admins, Coordinators, Consultants — **within their own assigned location only** (not other Location Managers, not CEO, not any other location's data)
- **Reporting:** report/export access, scoped to their own location
- **Bulk Reassignment:** yes, within their location
- **Video Management:** yes — global/unscoped (videos aren't location-tied)
- **Catalog Structure:** yes — can create/edit/archive/delete Training Paths and Courses, global/unscoped for the same reason
- **Constraints:** must be assigned exactly one location at creation (a location-less Location Manager manages/sees nobody, deliberately); cannot create another Location Manager or CEO; cannot create/archive Locations
- **Navigation:** 6 items — Dashboard, User Management, Training Paths, Courses, Videos, Exports

### LOCATION_ADMIN (Location Admin — renamed from LOCATION_MANAGER, 2026-08-08)
- **Management:** Coordinators and Consultants in their assigned location only
- **Reporting:** location-scoped reports and exports
- **Bulk Reassignment:** yes, within their location
- **Video Management:** yes — global/unscoped
- **Constraints:** single location scope; no Training Path/Course creation (Location Manager or CEO only)
- **Navigation:** 4 items — Dashboard, User Management, Videos, Exports

### COORDINATOR
- **Management:** their own assigned Consultants only
- **Training Assignment:** cannot assign paths or extra courses (not yet enabled — see Known Limitations)
- **Reporting:** their own consultants' progress only (via Dashboard)
- **Constraints:** no user creation of any other role, no catalog management
- **Navigation:** 2 items — Dashboard, User Management

### CONSULTANT
- **Training:** view and complete their own assigned courses/videos
- **Dashboard:** personal progress overview (completion %, videos completed/pending, last activity) plus their own `marketingStatus` (In Training / In Marketing) — never the org-wide report
- **My Courses:** resolved course list → course detail → video player, "Mark as Completed"
- **Profile:** self-service field-change requests, plus (once assigned) a "Schedule your demo" link-out to their Trainer's Calendly link
- **Constraints:** single active session; cannot see any other user; no administrative access at all
- **Navigation:** 2 items — My Dashboard, My Courses

### OFFSHORE_MANAGER (Offshore Manager — added 2026-08-09)
- **Management:** none over Consultants (read-only); creates and manages Offshore Team Lead accounts within their own office, and can move a Consultant's assigned Team Lead
- **Data access:** full read access to every field on Consultants whose `offshoreOffice` matches their own — name, contact info, DOB, visa type, technology, everything — but no edit/delete rights on Consultants themselves
- **Constraints:** must be assigned exactly one `offshoreOffice` at creation (CEO-only creation); cannot see the other office's consultants; no catalog, export, or audit-log access
- **Navigation:** 3 items — Dashboard, Consultant Data, Team Leads

### OFFSHORE_TEAM_LEAD (Offshore Team Lead — added 2026-08-09)
- **Management:** none — pure read access to the Consultants explicitly assigned to them by an Offshore Manager (`offshoreTeamLeadId`)
- **Reassignment:** a Team Lead's own `offshoreOffice`, and which consultants are assigned to them, can both be changed by any Offshore Manager in their office — not permanently tied to whoever created them
- **Constraints:** cannot create users, no catalog/export/audit-log access
- **Navigation:** 2 items — Dashboard, My Consultants

### TRAINER (added 2026-08-09)
- **Management:** none — read access + feedback rights only, for Consultants explicitly assigned to them (`trainerUserId`, one Trainer per Consultant)
- **Feedback:** records a `READY`/`NOT_READY` verdict + optional notes per demo (history kept)
- **Scheduling:** self-service Calendly link on `/profile`, which the assigned Consultant(s) see as a "Schedule your demo" link-out
- **Assigned a `technology`** at creation (which technology they teach) — informational/for the picker UI, not itself the basis of consultant visibility (that's the direct `trainerUserId` assignment)
- **Constraints:** cannot create users, no catalog/export/audit-log access
- **Navigation:** 2 items — Dashboard, My Consultants

### OTTER_TEAM (Otter Team — added 2026-08-09)
- **Management:** none — read access + feedback rights only, for Consultants explicitly assigned to them (`otterTeamUserId`, one Otter Team member per Consultant)
- **Feedback:** records a `READY`/`NOT_READY` verdict + optional notes — the second, independent sign-off required (alongside Trainer) before a Consultant flips to "In Marketing"
- **Constraints:** cannot create users, no catalog/export/audit-log access
- **Navigation:** 2 items — Dashboard, My Consultants

---

## Navigation Structure

Defined in `src/lib/nav.ts` (`navItemsForRole(role)`). No `enabled: false` placeholders remain — every item currently in the nav is a live, working page. **Updated 2026-08-15** — a `Forms` item was added to every non-Consultant role's nav and a `Profile Requests` item to Coordinator's, neither previously reflected here:

- **CEO (12):** Dashboard, Locations, User Management, Training Paths, Courses, Videos, Forms, Exports, Offshore Data, Location Overview, Notifications, Audit Logs
- **LOCATION_MANAGER — Location Manager (8):** Dashboard, User Management, Training Paths, Courses, Videos, Forms, Exports, Location Overview
- **LOCATION_ADMIN — Location Admin (5):** Dashboard, User Management, Videos, Forms, Location Overview
- **COORDINATOR (5):** Dashboard, User Management, Profile Requests, Forms, Location Overview
- **CONSULTANT (2):** My Dashboard, My Courses
- **OFFSHORE_MANAGER — Offshore Manager (4):** Dashboard, Consultant Data, Team Leads, Forms
- **OFFSHORE_TEAM_LEAD — Offshore Team Lead (3):** Dashboard, My Consultants, Forms
- **TRAINER (3):** Dashboard, My Consultants, Forms
- **OTTER_TEAM — Otter Team (3):** Dashboard, My Consultants, Forms

Bulk Reassignment and per-consultant detail are reachable by link-from-page or direct URL but are not top-level nav items. The legacy per-role user-list pages (`/users/managers` etc.) are not nav items either — they now redirect to `/users/management`, see "Orphaned routes" above. For the four offshore/placement roles, "Dashboard" in the nav is `/dashboard`, which immediately redirects to their real landing page (`/offshore/consultants`, `/offshore/my-consultants`, `/trainer/consultants`, `/otter/consultants` respectively) — `/dashboard` itself is built around the location-hierarchy reporting view these roles aren't part of. `Profile Requests` (Coordinator only) belongs to the self-service profile-change-request feature — see the undocumented-feature note under "Forms" above.

---

## Development Setup & Commands

### Environment Setup
1. PostgreSQL database on Supabase — `.env.local` needs `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations). As of 2026-08-10 this points at the **staging** project ("Training-Project-Staging"), not production — see "Staging vs. production" below.
2. `.env.local` also needs `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` for login rate limiting to actually enforce (optional — login rate limiting fails open without them).
3. Node.js 18+, npm
4. First time on a new machine: `npm install` before `npm run dev`/`npm run build` (this repo lives in a Syncthing-synced folder; `node_modules`/`.next` are excluded from sync, see `docs/Getting-Started.md`)

### Staging vs. production (added 2026-08-10)
Two separate Supabase projects now exist: **Training-Project** (production, `us-west-2`) and **Training-Project-Staging** (same region). `.env.local` — the file `npm run dev` and every `--env-file=.env.local` script use — points at staging. `.env` still holds the original production connection strings as a reference/backup but is not read by the app or by any script (Next.js prefers `.env.local` when both are present; scripts explicitly pass `--env-file=.env.local`). **Caveat:** `prisma.config.ts` uses plain `dotenv/config`, which only auto-loads `.env`, not `.env.local` — so running `npx prisma migrate deploy`/`db:migrate` bare (without an explicit env override) targets **production**, not staging. To run a migration against staging, either export `DATABASE_URL`/`DIRECT_URL` from `.env.local` into the shell first, or use a small script that reads `.env.local` and spawns the Prisma CLI with those values explicitly set (this is how the 8 existing migrations were applied to staging on 2026-08-10). Staging has its own bootstrap CEO account (`staging.ceo`, seeded via `npm run seed:ceo`) — unrelated to production's CEO account.

### Scripts (`package.json`)
```bash
npm run dev              # next dev — local dev server, http://localhost:3000
npm run build             # prisma generate && next build
npm start                 # next start — production server
npm run lint               # eslint
npm run postinstall       # prisma generate (auto-runs after npm install)
npm run db:migrate        # prisma migrate dev (interactive, local schema changes)
npm run db:deploy         # prisma migrate deploy (apply pending migrations, non-interactive — use this in prod)
npm run db:studio         # prisma studio
npm run seed:ceo          # scripts/seed-ceo.ts — one-time bootstrap of the first CEO account (env-var driven, idempotent)
npm run seed:demo         # scripts/seed-demo.ts — populates a full fake org for demos (locations, hierarchy, catalog, progress); safe to re-run (upserts). The demo dataset this created on 2026-08-07 was fully removed on 2026-08-08 via scripts/cleanup-demo.ts. Requires a CEO account named exactly "tempadmin" to already exist (aborts otherwise) — run `CEO_USERNAME=tempadmin CEO_PASSWORD=... npm run seed:ceo` first on a fresh database (this is how staging got its demo data on 2026-08-10; the earlier `staging.ceo` bootstrap account from when staging was first created is separate and still exists too).
npm run test:e2e          # playwright test
npm run test:e2e:ui       # playwright test --ui
npm run test:unit         # vitest run — see "Testing" below
npm run test:unit:watch   # vitest (watch mode)
```

### Scripts without a package.json entry (run directly)
```bash
node --env-file=.env.local -r tsx/cjs scripts/cleanup-demo.ts             # dry run (default) — counts only, no writes
node --env-file=.env.local -r tsx/cjs scripts/cleanup-demo.ts --confirm    # actually deletes the seed-demo.ts dataset by exact identity (usernames/location codes/course+path names/video driveFileIds), in a single transaction, respecting the cascade rules above; also resets the CEO's password (seed-demo.ts overwrites it with a shared demo password)
node --env-file=.env.local -r tsx/cjs scripts/e2e-cleanup-disposable-users.ts   # deletes every User whose username starts with "e2e-" — called automatically by e2e/fixtures.ts after mutating Playwright tests
```

### Testing (added/expanded 2026-08-10)

**Unit tests** (`npm run test:unit`, Vitest, `vitest.config.mts`): 262 tests across 15 files in
`src/lib/`, started as an N+1-queries/no-RBAC-tests/no-new-role-E2E audit finding (2026-08-10) and
expanded 2026-08-15 alongside the Forms IDOR fixes.
- **`src/lib/auth/rbac.ts`** — the RBAC matrix, all exported functions including the Forms
  visibility mechanisms (`canCreateForm`, `canViewFormsByCreator`, `canGrantFormAccess`,
  `canViewForm`, `canViewSubmission`). This file has zero runtime imports (only type-only ones),
  so it needs no mocking at all.
- Other pure files with dedicated tests: `drive.ts`, `validation/user.ts`, `validation/catalog.ts`,
  `validation/forms.ts` (added 2026-08-15 — currently just `isAllowedUploadPathname()`, the
  pathname-prefix check used to close the Forms file-upload cross-form-reference gap),
  `nav.ts`, `roleLabels.ts`/`offshoreOfficeLabels.ts`/`visaTypeLabels.ts` (combined in
  `labels.test.ts`), `technologyOptions.ts`.
- Files needing light mocking (`vi.mock` on `@/lib/prisma`, `@/lib/audit`, or `next/headers`):
  `reports.ts` (had to export the previously-private `consultantScopeFilter` — one-line change,
  no behavior change), `marketingReadiness.ts`, `content-resolution.ts`, `csrf.ts`.
- Deliberately **not** unit-tested (DB/session-coupled with little isolable logic — better left to
  E2E): `auth/session.ts`, `audit.ts`, `rateLimit.ts`, `prisma.ts`.
- **Two config gotchas, both already solved in `vitest.config.mts`, worth knowing before adding
  more test files:** (1) any file that does `import "server-only"` (`reports.ts`,
  `marketingReadiness.ts`, `content-resolution.ts`, `csrf.ts`) throws under plain Vitest/Node
  unless `server-only` is aliased to its own no-op `empty.js` stub — Next's bundler normally does
  this via the `react-server` export condition, which Vitest doesn't set. (2) `src/lib/prisma.ts`
  constructs its client eagerly at import time and throws if `DATABASE_URL` is unset, even in
  test files that only mock prisma calls and never really connect — `vitest.config.mts` sets a
  dummy `DATABASE_URL` for the whole test run to work around this (never a real DB URL).
- Wired into CI: `.github/workflows/ci.yml` runs `npm run lint` → `npm run typecheck` (added
  2026-08-15, `tsc --noEmit`) → `npm run test:unit` → `npm run build`. Triggers on push to `main`
  and `phase-*` branches (widened 2026-08-15 — previously `main`-only, so in-progress branch work
  was never gated) plus PRs against `main`. Still no E2E step (needs staging DB + Upstash
  credentials as GitHub Actions secrets, not yet set up).

**E2E** (`npm run test:e2e`, Playwright, staging DB): added `e2e/offshore.spec.ts`,
`e2e/trainer-otter.spec.ts`, `e2e/marketing-pipeline.spec.ts` (added 2026-08-10) covering the four
2026-08-09 offshore/placement roles end to end — Team Lead creation/assignment, Trainer/Otter
feedback submission, and the full dual-sign-off pipeline (`evaluateMarketingReadiness`) flipping a
consultant to "In Marketing" only once **both** verdicts are READY, not just one. Added
`e2e/forms.spec.ts` (2026-08-15): builds a form as CEO, confirms a staff user with no relationship
to it is redirected away from its responses, grants access, submits the form publicly and
anonymously, then confirms the granted user can see the response — cleans up via a new
`scripts/e2e-cleanup-disposable-forms.ts`/`deleteDisposableForms()`, which must run *before* the
existing `deleteDisposableUsers()` in any test using both (a disposable user still referenced by a
`FormAccessGrant` can't be deleted first — Restrict FK). All disposable users are created via the
existing `disposableUsername()`/`deleteDisposableUsers()` pattern — no new seed data.

Two shared-fixture bugs in `e2e/fixtures.ts`'s `loginAs()` were found and fixed while writing these
(both fixes are strictly safer for every existing spec too, not just the new ones):
1. `/login` redirects an already-authenticated visitor straight to `/dashboard` (see
   `src/app/login/page.tsx`) — switching identity within one test (e.g. CEO → a role it just
   created) used to hang forever waiting for a login form that never rendered. Fixed by clearing
   cookies before every `loginAs()` call.
2. `loginAs()` used to hard-assert `toHaveURL(/\/dashboard/)`, but `OFFSHORE_MANAGER`/
   `OFFSHORE_TEAM_LEAD`/`TRAINER`/`OTTER_TEAM` get redirected *past* `/dashboard` straight to their
   own landing page (see the redirect map in `dashboard/page.tsx`) — this old assertion was too
   strict for those four roles. Fixed to just assert the visitor left `/login`, whatever they
   landed on. A test asserting an RBAC redirect for one of these four roles must expect the
   *final* destination (e.g. `/offshore/my-consultants`), not `/dashboard` itself, since the
   redirect chains through it.

**Operational gotcha found running the full suite for the first time against staging (2026-08-10),
fixed 2026-08-15:** the login rate limiter (`src/lib/rateLimit.ts`, 8 attempts/15min per username)
and the E2E suite were in real tension — nearly every spec file's first action is
`loginAs(page, DEMO_USERS.ceo.username)`, and running all spec files back to back exhausted the CEO
account's rate-limit budget partway through, cascading into unrelated-looking failures for every
test after that point (stuck on `/login`). Fixed with a `RATE_LIMIT_DISABLED=true` escape hatch in
`rateLimit.ts`, set only in `playwright.config.ts`'s `webServer.env` (i.e. only for the local dev
server Playwright itself boots) — never set in Vercel Production/Preview.

**Known pre-existing gaps surfaced by this being staging's first full E2E run (not caused by
2026-08-10's changes, not yet fixed):**
- `e2e/auth.spec.ts`'s sign-out test intermittently fails locally — Next's dev-mode overlay
  widget (`<nextjs-portal>`) can intercept the "Sign out" button's click, a dev-server rendering
  artifact rather than an app bug.
- `e2e/user-management.spec.ts`'s self-lockout test expects a demo CEO account named "CEOAdmin"
  that `scripts/seed-demo.ts` does not create — a pre-existing mismatch between that one test and
  the seed script, invisible until staging (with only the seed script's data, no manually-added
  extra accounts) actually ran this suite for the first time.

### Database Migrations
- `prisma/migrations/20260807051647_init/` — full initial schema
- `prisma/migrations/20260808212645_rename_manager_roles/` — `ALTER TYPE "Role" RENAME VALUE 'LOCATION_MANAGER' TO 'LOCATION_ADMIN'` then `ALTER TYPE "Role" RENAME VALUE 'MANAGER' TO 'LOCATION_MANAGER'` (order matters — renaming `LOCATION_MANAGER` out of the way first avoids a collision)
- `prisma/migrations/20260809190852_add_offshore_trainer_otter_roles/` — adds `OFFSHORE_MANAGER`/`OFFSHORE_TEAM_LEAD`/`TRAINER`/`OTTER_TEAM` to `Role`, the `offshoreTeamLeadId`/`trainerUserId`/`otterTeamUserId` self-relations (`SetNull`), `calendlyLink`/`marketingStatus`, `TrainerFeedback`/`OtterFeedback` tables, `MarketingStatus`/`FeedbackVerdict` enums, and the 4 new `AuditActionType`/1 new `NotificationType` values
- `prisma/migrations/20260813190923_add_training_path_technology/` — adds nullable `TrainingPath.technology` + `@@index([technology])`
- (An unlisted-here migration adds the Forms feature's 7 models, `FormFieldType`/`FormFieldOptionsSource` enums, and the 4 `FORM_*` `AuditActionType` values — added before 2026-08-14, not yet cross-referenced in this list.)
- `prisma/migrations/20260815221001_add_performance_indexes/` — adds 6 composite indexes found missing during a 2026-08-15 performance review: `User[role,deletedAt]`, `AuditLog[actionType,createdAt]`, `FormSubmission[formId,submittedAt]`, `FormAccessGrant[grantedToUserId]`, `Session[userId,revokedAt]`, `Form[createdByUserId]`. Applied to staging same day; **not yet applied to production** as of this writing — see Deployment below.
- The build does **not** run migrations automatically — after any schema change, run `prisma migrate deploy` by hand (locally or in CI) before/after deploying the dependent code. **Caveat, learned the hard way 2026-08-13:** `prisma.config.ts` only auto-loads `.env` (production), never `.env.local` (staging) — running `npm run db:migrate`/`prisma migrate deploy` bare therefore applies to **production first**, not staging, the opposite of the intended order. Always export `.env.local`'s `DATABASE_URL`/`DIRECT_URL` explicitly (or use a small script that does so) before migrating staging, and treat a bare invocation as a production action requiring the same care as any other prod write.
- Lock file: `prisma/migrations/migration_lock.toml` (PostgreSQL)

### Deployment
- Hosting: Vercel, project `ricky-s-team1/worksphere` (renamed from `training-portal` 2026-08-14 — see "Live URL" at the top of this file for the domain-alias history). **No GitHub webhook integration** — deploys are manual: `npx vercel --prod` from this folder. Pushing to `origin/main` (GitHub) does NOT redeploy the live app by itself, and CI passing/failing does not gate deploys — this is deliberate scope, not wired up.
- Env vars (`DATABASE_URL`, `DIRECT_URL`) are set in Vercel's Production environment already; rotate via `vercel env rm/add` if the Supabase password changes, then redeploy.
- `.vercel/project.json` (small, not gitignored... actually is present in the synced folder) means `vercel` commands work immediately without re-linking on either machine this repo is synced to.
- **`vercel.json`** (added 2026-08-15) — one Vercel Cron entry, daily at 03:00 UTC, hitting `/api/cron/cleanup-sessions` (deletes expired/long-revoked `Session` rows — see "Known Limitations" for the problem this solves). Guarded by a `CRON_SECRET` env var (generated and set in Vercel Production via `vercel env add` the same day) that Vercel automatically sends as a Bearer token when it triggers the job — the route 401s without it, so it can't be hit by anyone else.

---

## Important Files & Modules Quick Reference

- **`src/lib/auth/session.ts`** — session lifecycle, `getCurrentUser()`
- **`src/proxy.ts`** (added 2026-08-10; Next.js 16 renamed "middleware" to "proxy" — see the file's own comment) — edge-level early auth check, cookie-presence only (no DB access on the Edge runtime). Redirects cookie-less requests to `/login` before a full server render happens; the real session validation (revoked/expired/deactivated) still happens in `getCurrentUser()` as before, unchanged. Imports `SESSION_COOKIE_NAME` from the dependency-free `src/lib/auth/sessionCookieName.ts`, not from `session.ts` directly — `session.ts` pulls in Node's `crypto` and Prisma, both unsupported on the Edge runtime `proxy.ts` runs on. Also builds the per-request CSP nonce (`src/lib/csp.ts`). **Simplified 2026-08-15**: dropped a dead `x-nonce` request header it used to set — nothing in the app ever read it (Next.js picks the nonce off the *response* `Content-Security-Policy` header instead); `img-src` also tightened from `'self' data: https:` to `'self' data:` since the app has no `<img>` element anywhere yet.
- **`src/lib/csrf.ts`** (added 2026-08-10) — synchronizer-token CSRF defense for the one plain-GET route (`/api/reports/export`) that lacks Next.js's automatic Server Action CSRF protection
- **`src/lib/auth/rbac.ts`** — all authorization logic (see RBAC section)
- **`src/lib/auth/password.ts`** — Argon2id hash/verify, strength checks, constant-time comparison helper
- **`src/lib/content-resolution.ts`** — consultant-visible-content resolution (the path+extra-courses union)
- **`src/lib/reports.ts`** — dashboard aggregates + exportable report rows, scope-vs-filter AND'ing (IDOR fix from Phase 6, see Build-Progress.md)
- **`src/lib/nav.ts`** — role-aware sidebar nav
- **`src/lib/roleLabels.ts`** — single source of truth for human-readable role display names
- **`src/lib/audit.ts`** — `logAudit()`, `notifyCeos()`
- **`src/lib/drive.ts`** — Drive share-link parsing (no Drive API call)
- **`src/lib/errors.ts`** — `UserFacingError`, the only error class whose `.message` is safe to show a client
- **`src/lib/validation/`** — Zod schemas, including the `optionalTrimmedString()` preprocessor that fixed a real production bug (blank optional fields silently passing through as `""` instead of `undefined`, hitting a raw Postgres FK error)
- **`prisma/schema.prisma`** — entire data model

### Known small bugs found during a full-codebase read (2026-08-08)
- ~~`src/app/(app)/catalog/courses/actions.ts` and `src/app/(app)/catalog/training-paths/actions.ts` still return the error string `"Only the CEO can manage courses."` / `"Only the CEO can manage training paths."` from their `requireCeo()` helper, even though the actual gate (`canManageCatalogStructure`) has allowed Location Manager too since 2026-08-08.~~ — **fixed 2026-08-15**: both now return `"You don't have permission to manage courses/training paths."`, and the helper itself was renamed `requireCatalogManager` to match what it actually checks.

### Bugs found + fixed during a full 9-role permission audit (2026-08-09)
- **Dashboard "Coordinator" filter dropdown leaked non-Coordinator users.** `src/app/(app)/dashboard/page.tsx`'s coordinators query was `{ role: "COORDINATOR", ...userVisibilityFilter(user) }` — since `userVisibilityFilter` also returns its own `role` key (`{ notIn: [...] }`) for Location Manager/Location Admin, and object spread applies in declaration order, the later spread silently overwrote the explicit `role: "COORDINATOR"`. Result: Location Admins and Consultants appeared as selectable "Coordinator" filter options for those two actor roles (CEO was unaffected — `userVisibilityFilter(CEO)` returns `{}`). Fixed by spreading `userVisibilityFilter(user)` first and setting `role: "COORDINATOR"` last. Verified live with a fresh Location Manager test account. This is now the documented pattern to follow for any future caller that spreads `userVisibilityFilter` alongside its own `role` filter (see the RBAC section's `userVisibilityFilter` caveat above).
- **`/users/management` didn't redirect the 4 new offshore/placement roles.** The page's guard only checked `actor.role === "CONSULTANT"`; Offshore Manager/Team Lead/Trainer/Otter Team could all reach it and see an empty, pointless "User Management" page (no data leak — `visibleRolesFor` already returned `[]` for them — but a dead end, since `/users/new`'s role picker was and is correctly locked down for these roles regardless). Fixed by extending the redirect to all 4, sending them through the existing `/dashboard` redirect chain to their real landing page instead. Verified live with a fresh Offshore Manager test account.

---

## Code Quality & Standards

- **Type Safety:** strict TypeScript, Prisma-generated types throughout (`@/generated/prisma/client` — regenerate with `prisma generate` after any schema change, wired into `postinstall`/`build`)
- **Validation:** Zod schemas at every form/action boundary
- **Authorization:** every server action and page re-checks permissions independently through `rbac.ts` — the frontend nav is never the sole gate
- **Audit Trail:** `logAudit()` called from essentially every mutating action (7 action files, ~28 call sites) plus two direct calls in login
- **Error handling:** `UserFacingError` pattern — anything else caught in a server action's try/catch shows a generic "Something went wrong" instead of leaking a raw Prisma/driver error message
- **Component reuse:** `ConfirmButton`/`FormModalButton`/`StatusBadge` patterns used consistently (`UserTable` — the legacy per-role list pages' shared table — was deleted 2026-08-15 along with those pages, once they became plain redirects; see "Orphaned routes")
- **Tailwind:** utility-first, CSS custom properties for theming (`--color-*` variables in `globals.css`, no dark-mode variant)

---

## Known Limitations & Future Phases

- **Coordinators cannot assign paths/extra courses** (not yet enabled by design, not an oversight)
- **Notifications** are CEO-only recipients for most types (could expand further — `PROFILE_CHANGE_REQUESTED` already goes to Coordinators via the undocumented `/profile-requests` feature, see the note under "Forms" above and under Reference Documentation below)
- **Login rate limiting** (added 2026-08-10, `src/lib/rateLimit.ts`) — two Upstash Redis sliding-window limiters (20/10min per IP, 8/15min per username, both must pass) sit in front of `loginAction`. Fails open (no limiting) if `UPSTASH_REDIS_REST_URL`/`_TOKEN` aren't set, so environments without Upstash configured still work, just unprotected.
- **No "forgot password" self-service flow** — self-service *change* (knowing your current password) exists (`ChangePasswordButton`), but there's no unauthenticated reset-by-email flow; a forgotten password requires another admin to reset it
- **Separate staging Supabase project exists** (added 2026-08-10) but local dev and staging still share one dataset the same way prod alone used to — be careful what you create while testing (see the two temporary-data-then-cleanup patterns in `scripts/cleanup-demo.ts` and `scripts/e2e-cleanup-disposable-users.ts` for the safe way to do this)
- ~~Export route CSRF exposure~~ — fixed 2026-08-10, see Reporting & Exports section above
- **Argon2 is a native Node module** — confirmed working on Vercel; verify native module support first if hosting ever changes
- ~~Orphaned legacy user-list routes~~ — fixed 2026-08-15, see "Orphaned routes" section above (now redirects, `UserTable.tsx` deleted)
- ~~Stale error copy in two catalog actions~~ — fixed 2026-08-15, see "Known small bugs" above
- ~~Session rows never deleted~~ — fixed 2026-08-15: a daily Vercel Cron (`vercel.json` + `/api/cron/cleanup-sessions`) now deletes expired and long-revoked `Session` rows, which previously accumulated forever (including IP/user-agent PII) since expiry was only ever enforced at read time in `getCurrentUser()`.
- **`/profile-requests` (self-service profile-change-request workflow) is undocumented in this file** — real feature (`AuditActionType.PROFILE_CHANGE_REQUESTED`/`PROFILE_UPDATED`, `NotificationType.PROFILE_CHANGE_REQUESTED`, a Coordinator-only nav item, `src/app/(app)/profile-requests/` and `src/app/(app)/profile/ProfileChangeRequestButton.tsx`), surfaced while writing the Forms section on 2026-08-15 but not itself documented — needs its own pass.
- **Six new composite indexes are on staging but not yet on production** — `prisma/migrations/20260815221001_add_performance_indexes/`, see Database Migrations above; run `prisma migrate deploy` against production before/alongside the next deploy.

---

## Glossary & Key Terms

- **ConsultantTrainingAssignment**: the unique primary Training Path per consultant
- **ConsultantExtraCourse**: ad-hoc course assignment outside the primary path
- **VideoCompletion**: marker when a consultant has watched and marked a video complete
- **TrainingPathCourse** / **CourseVideo**: join models with `sortOrder`, both `onDelete: Cascade` from both sides
- **AuditLog**: immutable-in-practice record of sensitive actions (no update path exists in the code; only ever created, and only deleted by the demo-cleanup script under tightly matched conditions)
- **Session**: server-side session record, hashed token, TTL, IP/user-agent metadata
- **ContentStatus**: ACTIVE or ARCHIVED (soft-delete pattern for catalog entities)
- **UserStatus**: ACTIVE, DEACTIVATED, or DELETED
- **"Resolved" courses/videos**: the actual computed set a consultant can see, per `content-resolution.ts` — primary path ∪ extra courses, minus archived items

---

## Reference Documentation

- `docs/Getting-Started.md` — onboarding narrative, the three-places mental model (code/Vercel/Supabase), role hierarchy in plain terms
- `docs/Admin-Guide.md` — day-to-day operations, deployment/redeploy steps, troubleshooting, security review notes
- `docs/Build-Progress.md` — phase-by-phase build log (Phases 1–6, all complete)
- `AGENTS.md` — Next.js 16 has breaking changes vs. training data; read `node_modules/next/dist/docs/` before writing framework-adjacent code. This file is regenerated by `next dev` — commit it as-is if it reappears in a diff.
- **Note (2026-08-15):** the three `docs/*.md` files above got a partial refresh this date — post-rename role names, the offshore/placement hierarchy, the CrewNex name/URL, and (in `Getting-Started.md`/`Admin-Guide.md`) a pointer to the Forms feature and current deployment/staging details. `Build-Progress.md`'s Phase 1–6 log itself was deliberately left as originally written (a historical record) with a forward-pointing note added at the top instead of being rewritten. None of the three attempt the same depth as this file — `CLAUDE.md` remains authoritative on any conflict, and still has an acknowledged gap of its own: the `/profile-requests` self-service feature (see Known Limitations above) isn't written up anywhere yet, including here.

---

## Next Steps for Development

1. ~~Fix the two stale "Only the CEO can manage..." error strings~~ — done 2026-08-15, see "Known small bugs"
2. ~~Wire the per-consultant "Training & progress" link into the main `/users/management` table~~ — done 2026-08-13, see "Orphaned routes" above. ~~Still open: decide what to do with the other orphaned legacy per-role user-list pages~~ — done 2026-08-15: each now redirects to `/users/management`.
3. Refresh `docs/Getting-Started.md`, `docs/Admin-Guide.md`, `docs/Build-Progress.md` for the role rename + location-scoping + the 2026-08-09 offshore/placement roles + the CrewNex rebrand + Forms (currently only this file reflects all of it) — **partially done 2026-08-15**, see the Reference Documentation note below for what's still outstanding
3a. Write up the `/profile-requests` self-service feature in this file — surfaced but not documented while writing the 2026-08-15 Forms section, see Known Limitations above
4. ~~Consider a separate staging database before wider rollout~~ — done 2026-08-10 ("Training-Project-Staging")
5. A self-service "forgot password" flow, if/when moving past pilot scale (login rate limiting is done, see Key Features)
6. Expand Coordinator permissions (path/extra-course assignment) if the product calls for it
7. Expand CEO-inbox Notification triggers beyond report-export/password-reset/deletion, if useful (the Placement Pipeline's `MARKETING_READY` notifications already go to non-CEO roles, see Key Features)
8. Revisit Vercel/Supabase tier as usage grows past pilot scale — more roles and a placement pipeline mean more concurrent sessions and writes
9. ~~Wire up CI (lint/build on every push)~~ — done 2026-08-10 via GitHub Actions (`.github/workflows/ci.yml`), verified green (run #1, 1m22s). The original attempt was GitLab CI, but that project's only registered runner had a 2-year-stale heartbeat and no live process anywhere — rather than standing up runner infrastructure, the project moved to GitHub entirely (see Repository above), which doubled as the fix. E2E-in-CI is a further follow-on, needing staging DB + Upstash credentials added as GitHub Actions secrets.
10. ~~Error monitoring (e.g. Sentry)~~ — done 2026-08-10, `@sentry/nextjs` (see Tech Stack)
11. ~~Unit tests for the RBAC matrix~~ — done 2026-08-10, expanded to unit-test coverage across most of `src/lib/` and E2E specs for the 4 offshore/placement roles (see "Testing")
12. ~~N+1 queries in `src/lib/reports.ts`~~ — fixed 2026-08-10. `getDashboardAggregates`/`getConsultantReportRows` previously called `getConsultantProgress` once per consultant (~5 queries each — ~3,500 queries per page load at 700 users). Replaced with `getConsultantProgressBatch()` in `content-resolution.ts`: 5 total queries regardless of N (batched `consultantTrainingAssignment`/`trainingPathCourse`/`consultantExtraCourse`/`courseVideo`/`videoCompletion` lookups, joined in JS via `Map`s). Preserves the exact per-course-sum video-count semantics of the original (no cross-course video dedup). Both call sites in `reports.ts` now build one `Map<consultantUserId, ConsultantProgress>` up front instead of a `Promise.all` of N single-consultant calls; every other caller of `getConsultantProgress` (a consultant's own dashboard, per-consultant detail page, `/my-courses`) is untouched. Covered by new unit tests in `content-resolution.test.ts` (empty-id-list short-circuit, a multi-consultant path+extra+shared-course scenario matching `getConsultantProgress`'s output exactly, and the 0-video 0%-not-NaN case) and verified live against staging (`/dashboard` and `/reports/exports` render correctly, no console errors beyond the known dev-mode Sentry/eval CSP noise).
13. ~~Fix the rate-limiter-vs-E2E-suite tension documented under "Testing"~~ — done 2026-08-15, `RATE_LIMIT_DISABLED` escape hatch, see "Testing"
14. `e2e/user-management.spec.ts`'s self-lockout test expects a "CEOAdmin" demo account that `scripts/seed-demo.ts` doesn't create (see "Testing") — either add that account to the seed script or change the test to use an account the script actually creates
15. Apply the pending `20260815221001_add_performance_indexes` migration to production (already on staging) — see Database Migrations above
16. Merge the Forms IDOR/validation fixes, the performance work, the E2E/CI work, and this cleanup pass from `phase-2` to `main`, push, and deploy — see the top of this file's Repository/Live URL notes for the current branch state at time of writing
17. Consider adding request-scoped `select` clauses to the remaining full-`User`-row list queries not touched in the 2026-08-15 pass (most list pages still pull every column) — the two worst offenders (`location-overview`, `bulk-reassign`) were fixed; others are lower-traffic
18. Add server-side answer-length/option validation coverage to `e2e/forms.spec.ts` beyond the happy path (currently only unit-tests the pathname-prefix check in isolation) — the validation logic itself lives inline in `submitFormResponseAction` rather than as separately-testable pure functions

---

## Contact & Support

For questions about the codebase structure, architectural decisions, or development workflow, refer to comments in key files (`src/lib/auth/rbac.ts`, `prisma/schema.prisma`, etc.) and `docs/Getting-Started.md`.

**Last Updated:** 2026-08-15 — a full end-to-end review pass across four areas, all on the `phase-2` branch (not yet merged to `main` as of this writing): **(1) Security** — fixed two cross-form IDOR bugs in the Forms feature (field edit/delete and access-grant revoke were scoped by a bare client-supplied id, not also the parent form), and added server-side validation of public form submissions (file pathname/size/count against the field's real config, answer length/option values) that previously only existed client-side. **(2) Performance & DB** — added 6 composite indexes (applied to staging, not yet production), stopped the dashboard from computing consultant progress twice per render (`getDashboardData()`), paginated `/forms/[id]/submissions`, and added a daily cron to clean up the previously-immortal `Session` table. **(3) Tests & CI** — added a full Forms E2E spec, a `typecheck` CI step, widened CI to `phase-*` branches, and fixed the rate-limiter-vs-E2E-suite lockout with a local-only bypass. **(4) Cleanup & docs** — fixed stale error copy, turned 5 orphaned legacy user-list pages into redirects (deleting the now-dead `UserTable.tsx`), tightened the CSP, added this file's first real Forms documentation, and gave the three `docs/*.md` files a partial refresh (see "Reference Documentation" above for what that pass did and didn't cover). See `optimization.md` at the repo root for the original review this pass worked from.

**Previously (2026-08-13):** fixed a real discoverability gap: `/users/management` (the only nav-linked user list) never linked to `/users/consultants/[id]`, so the working "Assign training path" feature was unreachable for every role, not just Coordinators, without typing a URL directly (see "Orphaned routes"). Also added an optional `TrainingPath.technology` tag (set by CEO/Location Manager on the catalog pages) used to soft-sort the training-path picker so technology-matching paths surface first, without restricting what's assignable (see "Training Catalog"/"Training Assignment"). Corrected a stale doc claim that Coordinators couldn't assign a primary training path — they always could; only extra-course assignment is Coordinator-restricted.
**Previously (2026-08-10):** enterprise-scale hardening pass: added indexes on the offshore/placement `User` fields, wrapped the marketing-readiness status flip in a transaction, added security headers and top-level error boundaries, added login rate limiting (Upstash Redis), added an edge-level early-auth `proxy.ts`, added CSRF protection to the report-export route, stood up a separate staging Supabase project so local dev no longer writes into the production database, added Sentry error monitoring, fully migrated the repo from GitLab to a private GitHub repo (`origin`, GitLab project deleted outright by explicit user decision), added a Vitest unit test suite (182 tests, mostly `src/lib/`, led by a full RBAC matrix suite), added 3 new E2E specs covering the 4 offshore/placement roles end to end including the dual Trainer+Otter sign-off pipeline, and fixed two bugs in the shared E2E login fixture found while writing those. Restricted report-export access to CEO/Location Manager only (previously included Location Admin). Fixed the N+1 query pattern in `reports.ts` via a new batched `getConsultantProgressBatch()` in `content-resolution.ts` (~5N queries → 5, see Next Steps item 12). See "Repository", "Staging vs. production", "Testing", and the Sentry/rate-limiting/CSRF notes under Tech Stack, User Management, and Reporting & Exports for details.
**Previously (2026-08-09):** added the Offshore Manager / Offshore Team Lead / Trainer / Otter Team roles and the full post-training placement pipeline (dual Trainer+Otter sign-off, marketing-readiness rollup, Calendly link-out scheduling, Location Overview dashboard); documented the Consultant `technology`/`visaType`/`dateOfBirth`/`offshoreOffice` fields that were added earlier the same day but missed in the previous pass; fixed and documented two bugs found during a full 9-role permission audit (dashboard Coordinator-filter leak, `/users/management` dead-end for the new roles).
**Generated by:** Cowork Claude Documentation Generator

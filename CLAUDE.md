# Training Portal — Complete Application Documentation

## Project Overview

**Training Portal** is a private enterprise training management system built to facilitate organizational training paths, course management, and consultant progress tracking. It provides role-based access control with five permission tiers (CEO, Location Manager, Location Admin, Coordinator, Consultant) and enables structured training delivery across distributed teams.

**Current Version:** 0.1.0
**Status:** Live in production, pilot scale
**Repository:** Git, remote `gitlab` → `ssh://git@gitlab.endeavourtech.io:33/ricky/training-portal.git`
**Live URL:** https://training-portal-flame.vercel.app

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
- **Single shared database for local dev and production** — no separate staging DB (see Known Limitations)

**Authentication & Security:**
- Custom session-based auth: 32-byte random tokens, SHA256-hashed before storage, httpOnly cookies, 12-hour TTL, `secure` flag in production, `sameSite=lax`
- Argon2id password hashing (`argon2` v0.45.1, OWASP-minimum params)
- Single-active-session enforcement for CONSULTANT role only (other roles may hold multiple concurrent sessions)
- Login timing side-channel closed: password comparison always runs, even for a nonexistent username (against a fixed dummy hash), so response time can't reveal whether a username exists

**Utilities & Libraries:**
- Zod 4 (validation, `src/lib/validation/`)
- ExcelJS 4.4.0 (XLSX report export)
- Playwright (`@playwright/test`) — E2E suite
- ESLint 9 (`eslint-config-next`)
- tsx (TypeScript execution for one-off scripts, outside the Next.js build)

---

## Database Schema

Source of truth: `prisma/schema.prisma`. Single migration history in `prisma/migrations/`: `20260807051647_init` (full initial schema) and `20260808212645_rename_manager_roles` (the `Role` enum rename, via `ALTER TYPE ... RENAME VALUE` — renames existing rows in place, no data migration needed).

### Core Entities

**User**
- Roles: `CEO`, `LOCATION_MANAGER`, `LOCATION_ADMIN`, `COORDINATOR`, `CONSULTANT`
- Status: `ACTIVE`, `DEACTIVATED`, `DELETED` (soft delete — `deletedAt` timestamp set, row kept for audit/reporting)
- Hierarchy self-relations: `managerId` (→ a user's Location Manager supervisor), `locationManagerId` (→ a user's Location Admin supervisor), `coordinatorId` (→ a consultant's owning Coordinator). **These FK column names predate the 2026-08-08 role rename and were deliberately left as-is** — `managerId` still means "the Location Manager above this user," not literally a role called "Manager."
- `usernameLower` is a separate enforced-lowercase mirror column (unique) so username lookups/uniqueness are case-insensitive without needing a citext extension.
- Fields: id, firstName, lastName, username, usernameLower, passwordHash, email, phone, status, locationId, managerId, locationManagerId, coordinatorId, createdByUserId, createdAt, updatedAt, deletedAt

**Location**
- Business units/branches. Only CEO can create/archive them (`/locations`).
- Fields: id, name, code (unique), status (`ACTIVE`/`ARCHIVED`), createdByUserId, timestamps

**TrainingPath**
- Ordered collection of Courses (via `TrainingPathCourse` join, `sortOrder`). No `locationId` — global/shared, not location-scoped.
- Fields: id, name, description, status, createdByUserId, timestamps

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

**Audit & Notifications**
- **AuditLog**: 26 `AuditActionType` values (see enum below). `actorUserId`/`targetUserId`/`locationId`/`trainingPathId`/`courseId`/`videoId` are all **optional FKs with no `onDelete` clause (Postgres default: Restrict)** — meaning any of those referenced rows (a user, location, course, etc.) cannot be deleted while an AuditLog row still points to it. Deleting such rows (e.g. cleanup scripts) must delete/reassign the referencing AuditLog rows first.
- **Notification**: three types — `REPORT_EXPORTED`, `PASSWORD_RESET`, `USER_DELETED`. `sourceAuditLogId` is also Restrict (not cascade), same caveat.
- **Session**: token-hash storage (`onDelete: Cascade` from the user side — deleting a user auto-clears their sessions).

**Enums:**
- `Role`: CEO, LOCATION_MANAGER, LOCATION_ADMIN, COORDINATOR, CONSULTANT
- `UserStatus`: ACTIVE, DEACTIVATED, DELETED
- `ContentStatus`: ACTIVE, ARCHIVED
- `AuditActionType` (26): USER_CREATED, USERNAME_CHANGED, PASSWORD_RESET, USER_DEACTIVATED, USER_REACTIVATED, USER_DELETED, TRAINING_PATH_ASSIGNED, TRAINING_PATH_CHANGED, EXTRA_COURSE_ASSIGNED, EXTRA_COURSE_REMOVED, CONSULTANT_REASSIGNED (defined but not currently written by any code path — `CONSULTANTS_BULK_REASSIGNED` is used instead for the actual bulk-reassign feature), CONSULTANTS_BULK_REASSIGNED, LOCATION_CREATED, LOCATION_UPDATED, TRAINING_PATH_CREATED, TRAINING_PATH_UPDATED, TRAINING_PATH_DELETED, COURSE_CREATED, COURSE_UPDATED, COURSE_DELETED, VIDEO_CREATED, VIDEO_UPDATED, VIDEO_DELETED, REPORT_EXPORTED, LOGIN_SUCCEEDED, LOGIN_FAILED
- `NotificationType`: REPORT_EXPORTED, PASSWORD_RESET, USER_DELETED

### Cascade behavior cheat sheet (matters when writing any deletion logic)

- **Cascades automatically** on User delete: Session, VideoCompletion (consultant side), ConsultantTrainingAssignment (consultant side), ConsultantExtraCourse (consultant side).
- **Cascades automatically** on Course/Video/TrainingPath delete: CourseVideo, TrainingPathCourse, ConsultantExtraCourse (course side), VideoCompletion (video side).
- **No cascade (Restrict), must delete/reassign first**: every AuditLog FK, Notification.sourceAuditLogId, and the User self-relations (managerId/locationManagerId/coordinatorId) — a parent User can't be deleted while a child User row still references it, so bulk user deletion must go leaf-to-root (consultants → coordinators → location admins → location manager).

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
CEO (4) > LOCATION_MANAGER (3) > LOCATION_ADMIN (2) > COORDINATOR (1) > CONSULTANT (0)
```

> **Renamed 2026-08-08:** the old `MANAGER` role is now `LOCATION_MANAGER` ("Location Manager"), and the old `LOCATION_MANAGER` role is now `LOCATION_ADMIN` ("Location Admin"). At rename time each kept its own prior permission set; Location Manager's permissions were then further changed the same day to be location-scoped (previously org-wide/unscoped) and to gain catalog structure access (previously CEO-only).

**Creatable Roles by Actor** (`CREATABLE_ROLES`, via `canCreateRole`/`creatableRoles`):
- CEO: all five roles
- LOCATION_MANAGER: Location Admin, Coordinator, Consultant
- LOCATION_ADMIN: Coordinator, Consultant
- COORDINATOR: Consultant
- CONSULTANT: none

**User Management Scope** (`canManageUser`):
- CEO: everyone
- LOCATION_MANAGER: everyone ranked below them (Location Admin, Coordinator, Consultant), **but only within their own assigned `locationId`** — a Location Manager with no location assigned manages no one (explicit null-guard, not an accidental "sees everyone" bug)
- LOCATION_ADMIN: Coordinators/Consultants within the same `locationId`, same null-guard
- COORDINATOR: only Consultants where `coordinatorId === actor.id`
- CONSULTANT: no one (self-service actions are gated separately, not through `canManageUser`)

**Key Authorization Functions** (`src/lib/auth/rbac.ts`):
- `isHigherOrEqualRank(a, b)` — rank comparison
- `canCreateRole(actorRole, targetRole)` / `creatableRoles(actorRole)` — role creation matrix
- `canManageUser(actor, target)` — the core scope check described above; `actor.id === target.id` always returns true (self-management, e.g. self-service password change, is allowed independent of rank)
- `canAssignExtraCourses(actor, target)` — target must be a Consultant; Coordinator/Consultant actors excluded; otherwise delegates to `canManageUser`
- `canAssignTrainingPath(actor, target)` — target must be a Consultant; Consultant actor excluded; otherwise delegates to `canManageUser`
- `canExportReports(actorRole)` — CEO, Location Manager, Location Admin. The actual row-level scoping for exports comes from `consultantScopeFilter()` in `src/lib/reports.ts`, not from this function.
- `canBulkReassign(actorRole)` — same three roles; actual scoping again comes from `userVisibilityFilter`/`canManageUser` inside `bulkReassignAction`, not this function.
- `canManageCatalogStructure(actorRole)` — CEO, Location Manager. Deliberately global/unscoped (Course/TrainingPath have no `locationId`).
- `canManageVideos(actorRole)` — CEO, Location Manager, Location Admin. Also global/unscoped.
- `isCeo(actorRole)` — gates Audit Logs and Notifications (CEO-only recipient/viewer)
- `userVisibilityFilter(actor)` — the Prisma `where` clause for "which users can this actor see" in list endpoints. CEO → `{}` (no filter). Location Manager/Location Admin → `{ locationId: actor.locationId, role: { notIn: [...] } }`, with an explicit `if (!actor.locationId) return { id: "__none__" }` guard so a location-less actor sees nobody rather than the Prisma `locationId: null` footgun (which would otherwise match every location-less user in the system). Coordinator → their own consultants. Consultant → only themselves.
- `locationAssignmentModeFor(actorRole, targetRole)` — returns `"none" | "required" | "optional" | "inherit"`. Drives both whether `CreateUserForm` shows a location picker for a given target role, and (in `createStaffUserAction`) whether the server requires/accepts/auto-inherits a location. `"inherit"` means the new user silently gets the actor's own `locationId` with no picker shown (e.g. a Location Manager creating a Location Admin or Coordinator always lands them in the Location Manager's own location).

**Type `ScopeSubject`** — the minimal shape (`id`, `role`, `locationId`, `coordinatorId`, `locationManagerId`, `managerId`) needed by the scope-check functions; used to pass a partial Prisma `User` row without over-fetching.

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
│   │   │   ├── consultants/[id]/     # Per-consultant detail: progress tiles, assign/change primary path, add/remove extra courses (reachable today only via the legacy /users/consultants list or a direct URL — see "Orphaned routes" below)
│   │   │   ├── managers/, location-managers/, coordinators/, consultants/, ceos/   # LEGACY per-role list pages — still functional (each queries by role + userVisibilityFilter) but NOT linked from any nav or from /users/management; superseded by the consolidated list. See "Orphaned routes."
│   │   ├── catalog/
│   │   │   ├── training-paths/       # CEO + Location Manager: create/edit/archive/delete; [id]/ = attach/reorder courses
│   │   │   ├── courses/              # CEO + Location Manager: create/edit/archive/delete; [id]/ = attach/reorder videos
│   │   │   └── videos/               # CEO + Location Manager + Location Admin: create/edit/archive/delete (Google Drive link → embeddable preview)
│   │   ├── my-courses/                # Consultant-only: resolved course list → course detail → video player + mark-complete
│   │   ├── reports/exports/page.tsx  # Filter form + CSV/XLSX download buttons (CEO, Location Manager, Location Admin)
│   │   ├── notifications/            # CEO-only inbox
│   │   └── audit-logs/page.tsx       # CEO-only, paginated (50/page), filterable by action type + date range
│   └── api/
│       └── reports/export/route.ts   # The one plain REST route (GET, not a server action) — streams CSV or XLSX
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
│   ├── audit.ts                      # logAudit(), notifyCeos()
│   ├── reports.ts                    # getDashboardAggregates(), getConsultantReportRows() — scope (consultantScopeFilter) and user filters combined via Prisma AND, never merged, so a filter can only narrow within scope, never widen it
│   ├── errors.ts                     # UserFacingError — only errors deliberately thrown with this class get their .message shown to the client
│   └── validation/
│       ├── user.ts                   # optionalTrimmedString() (blank-string-to-undefined preprocessor), usernameSchema, nameSchema, createStaffUserSchema, createConsultantSchema, createLocationSchema
│       └── catalog.ts                # trainingPathSchema, courseSchema, videoSchema, videoEditSchema
└── components/
    ├── ui/
    │   ├── Badge.tsx                 # StatusBadge — color-coded by ACTIVE/DEACTIVATED/DELETED/ARCHIVED
    │   ├── ConfirmButton.tsx         # Yes/no confirmation modal wrapper, used for every destructive/high-impact action
    │   └── FormModalButton.tsx       # Modal containing real form fields (vs. ConfirmButton's plain yes/no)
    └── users/
        ├── UserTable.tsx             # Reusable table (used by the legacy per-role pages)
        ├── UserRowActions.tsx        # Edit username / reset password / deactivate-reactivate / delete, all via FormModalButton/ConfirmButton
        ├── CreateUserForm.tsx        # One form for every creatable role; location field driven by locationAssignmentModeFor
        └── ChangePasswordButton.tsx  # Self-service password change (sidebar) — signs the user out everywhere including the current session
```

### Orphaned routes (real, worth knowing before changing nav or user-list logic)

The "Merge Dashboard/Reports, add consolidated User Management" work (2026-08-07) introduced `/users/management` and `/users/new` as the real UI entry points, but did **not** delete or redirect the older per-role pages. As of this writing:

- `/users/managers`, `/users/location-managers`, `/users/coordinators`, `/users/consultants`, `/users/ceos` — each still works (role-gated, queries by role + `userVisibilityFilter`), but nothing in the current UI links to them. Only reachable by typing the URL directly.
- `/users/consultants/[id]` (the per-consultant "Training & progress" detail page — assign path, manage extra courses) **is** still a real, actively-designed feature, but `/users/management`'s row actions don't currently link to it (only the legacy `/users/consultants` list page's `UserTable` does, via its `showLearningLink` prop). This means the primary-path/extra-course assignment UI is effectively hard to discover from the main nav today — worth fixing if this keeps mattering.

---

## Key Features & Workflows

### 1. User Management
- Five-role hierarchy, each creating/managing only roles below it (see RBAC section)
- Consultant: single-active-session enforcement
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

### 3. Training Assignment
- Exactly one primary Training Path per consultant (`ConsultantTrainingAssignment`, unique per consultant)
- Any number of "extra courses" independent of the primary path (`ConsultantExtraCourse`)
- A consultant's actual resolved content = primary-path courses **UNION** extra courses (deduped; each course labeled "Assigned by path" / "Extra course" / "Assigned by path + Extra")
- Gated by `canAssignTrainingPath`/`canAssignExtraCourses` — Coordinators cannot assign either (by design, not yet enabled)

### 4. Progress Tracking
- `VideoCompletion` rows, one per (consultant, video), unique-constrained
- Consultant marks their own videos complete only — no admin-on-behalf marking
- Dashboard/report metrics: completion %, completed/pending video counts, last-completed item + date — all derived from `getConsultantProgress()` in `content-resolution.ts`, never re-derived ad hoc

### 5. Reporting & Exports
- **Reports live inside the Dashboard page now** — for any non-Consultant role, `/dashboard` renders stat tiles, five breakdown panels (by training path / coordinator / location, avg. completion by path / coordinator), a filter form, and the full consultant metrics table, all scoped server-side.
- Export (`/reports/exports`, CEO/Location Manager/Location Admin): same filters, two buttons hitting `GET /api/reports/export?format=csv|xlsx`. CSV is hand-escaped; XLSX via ExcelJS. Every export logs `REPORT_EXPORTED`; a Location Manager's export (not CEO's or Location Admin's) additionally queues a CEO notification.
- Export route is a plain `GET` (not a server action), so it doesn't get Next.js's Server Action CSRF protection — a crafted link could trigger an unintended export (log noise + a possible false notification), but cannot leak the response to a third party (browser blocks cross-origin reads). Accepted risk at pilot scale; worth a CSRF token if this becomes a concern.

### 6. Audit Logging
- 26 `AuditActionType` values, every sensitive mutation across the app writes one via `logAudit()` (or, for login events, a direct `prisma.auditLog.create` call in `src/app/login/actions.ts`, which intentionally bypasses `logAudit()`)
- CEO-only viewer (`/audit-logs`), paginated 50/page, filterable by action type + date range
- Every AuditLog row optionally carries actor, target user, location, training path, course, and/or video context, plus a free-form `metadataJson` blob

### 7. Notifications
- CEO-only recipients, three trigger events: a Location Manager exporting a report, any password reset (self or admin-initiated), any consultant deletion — nothing else pages the CEO
- Unread-count badge in the sidebar nav item, mark-one-read / mark-all-read actions

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
- **Dashboard:** personal progress overview (completion %, videos completed/pending, last activity) — never the org-wide report
- **My Courses:** resolved course list → course detail → video player, "Mark as Completed"
- **Constraints:** single active session; cannot see any other user; no administrative access at all
- **Navigation:** 2 items — My Dashboard, My Courses

---

## Navigation Structure

Defined in `src/lib/nav.ts` (`navItemsForRole(role)`). No `enabled: false` placeholders remain — every item currently in the nav is a live, working page.

- **CEO (9):** Dashboard, Locations, User Management, Training Paths, Courses, Videos, Exports, Notifications, Audit Logs
- **LOCATION_MANAGER — Location Manager (6):** Dashboard, User Management, Training Paths, Courses, Videos, Exports
- **LOCATION_ADMIN — Location Admin (4):** Dashboard, User Management, Videos, Exports
- **COORDINATOR (2):** Dashboard, User Management
- **CONSULTANT (2):** My Dashboard, My Courses

Bulk Reassignment, per-consultant detail, and the legacy per-role list pages are reachable by link-from-page or direct URL but are not top-level nav items — see "Orphaned routes" above.

---

## Development Setup & Commands

### Environment Setup
1. PostgreSQL database on Supabase — `.env.local` needs `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations)
2. Node.js 18+, npm
3. First time on a new machine: `npm install` before `npm run dev`/`npm run build` (this repo lives in a Syncthing-synced folder; `node_modules`/`.next` are excluded from sync, see `docs/Getting-Started.md`)

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
npm run seed:demo         # scripts/seed-demo.ts — populates a full fake org for demos (locations, hierarchy, catalog, progress); safe to re-run (upserts). The demo dataset this created on 2026-08-07 was fully removed on 2026-08-08 via scripts/cleanup-demo.ts.
npm run test:e2e          # playwright test
npm run test:e2e:ui       # playwright test --ui
```

### Scripts without a package.json entry (run directly)
```bash
node --env-file=.env.local -r tsx/cjs scripts/cleanup-demo.ts             # dry run (default) — counts only, no writes
node --env-file=.env.local -r tsx/cjs scripts/cleanup-demo.ts --confirm    # actually deletes the seed-demo.ts dataset by exact identity (usernames/location codes/course+path names/video driveFileIds), in a single transaction, respecting the cascade rules above; also resets the CEO's password (seed-demo.ts overwrites it with a shared demo password)
node --env-file=.env.local -r tsx/cjs scripts/e2e-cleanup-disposable-users.ts   # deletes every User whose username starts with "e2e-" — called automatically by e2e/fixtures.ts after mutating Playwright tests
```

### Database Migrations
- `prisma/migrations/20260807051647_init/` — full initial schema
- `prisma/migrations/20260808212645_rename_manager_roles/` — `ALTER TYPE "Role" RENAME VALUE 'LOCATION_MANAGER' TO 'LOCATION_ADMIN'` then `ALTER TYPE "Role" RENAME VALUE 'MANAGER' TO 'LOCATION_MANAGER'` (order matters — renaming `LOCATION_MANAGER` out of the way first avoids a collision)
- The build does **not** run migrations automatically — after any schema change, run `prisma migrate deploy` by hand (locally or in CI) before/after deploying the dependent code
- Lock file: `prisma/migrations/migration_lock.toml` (PostgreSQL)

### Deployment
- Hosting: Vercel, project `ricky-s-team1/training-portal`. **No CI/CD, no GitHub/GitLab webhook integration** — deploys are manual: `npx vercel --prod` from this folder. Pushing to `gitlab/main` does NOT redeploy the live app by itself.
- Env vars (`DATABASE_URL`, `DIRECT_URL`) are set in Vercel's Production environment already; rotate via `vercel env rm/add` if the Supabase password changes, then redeploy.
- `.vercel/project.json` (small, not gitignored... actually is present in the synced folder) means `vercel` commands work immediately without re-linking on either machine this repo is synced to.

---

## Important Files & Modules Quick Reference

- **`src/lib/auth/session.ts`** — session lifecycle, `getCurrentUser()`
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

### Known small bugs found during a full-codebase read (2026-08-08), not yet fixed
- `src/app/(app)/catalog/courses/actions.ts` and `src/app/(app)/catalog/training-paths/actions.ts` still return the error string `"Only the CEO can manage courses."` / `"Only the CEO can manage training paths."` from their `requireCeo()` helper, even though the actual gate (`canManageCatalogStructure`) has allowed Location Manager too since 2026-08-08. The permission check itself is correct (delegates to `canManageCatalogStructure`); only the copy is stale, and only reachable if a non-CEO/non-Location-Manager somehow bypasses the page-level redirect and hits the action directly.

---

## Code Quality & Standards

- **Type Safety:** strict TypeScript, Prisma-generated types throughout (`@/generated/prisma/client` — regenerate with `prisma generate` after any schema change, wired into `postinstall`/`build`)
- **Validation:** Zod schemas at every form/action boundary
- **Authorization:** every server action and page re-checks permissions independently through `rbac.ts` — the frontend nav is never the sole gate
- **Audit Trail:** `logAudit()` called from essentially every mutating action (7 action files, ~28 call sites) plus two direct calls in login
- **Error handling:** `UserFacingError` pattern — anything else caught in a server action's try/catch shows a generic "Something went wrong" instead of leaking a raw Prisma/driver error message
- **Component reuse:** `UserTable`/`ConfirmButton`/`FormModalButton`/`StatusBadge` patterns used consistently
- **Tailwind:** utility-first, CSS custom properties for theming (`--color-*` variables in `globals.css`, no dark-mode variant)

---

## Known Limitations & Future Phases

- **Coordinators cannot assign paths/extra courses** (not yet enabled by design, not an oversight)
- **Notifications** are CEO-only recipients (could expand to other roles)
- **No login rate limiting/lockout** — failed logins are logged (`LOGIN_FAILED`) but nothing blocks repeated attempts; fine at ~200 known internal users, would need a proper rate limiter (e.g. Upstash Redis, since Vercel functions are stateless) before wider/internet-facing rollout
- **No "forgot password" self-service flow** — self-service *change* (knowing your current password) exists (`ChangePasswordButton`), but there's no unauthenticated reset-by-email flow; a forgotten password requires another admin to reset it
- **Single shared database for dev and prod** — local testing writes real rows into the same DB the live app reads; be careful what you create while testing (see the two temporary-data-then-cleanup patterns in `scripts/cleanup-demo.ts` and `scripts/e2e-cleanup-disposable-users.ts` for the safe way to do this)
- **Export route CSRF exposure** — see Reporting & Exports section above; log-noise impact only, not a data leak
- **Argon2 is a native Node module** — confirmed working on Vercel; verify native module support first if hosting ever changes
- **Orphaned legacy user-list routes** — see "Orphaned routes" section above
- **Stale error copy in two catalog actions** — see "Known small bugs" above
- **No separate staging database** — worth doing before onboarding real users at volume

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
- **Note (2026-08-08):** the three `docs/*.md` files above still describe the pre-rename role names (Manager/Location Manager rather than Location Manager/Location Admin) and the pre-location-scoping Location Manager permissions — they were not updated in the same pass as this file. Treat this file (`CLAUDE.md`) as authoritative for current role names/permissions until those docs are refreshed too.

---

## Next Steps for Development

1. Fix the two stale "Only the CEO can manage..." error strings (see "Known small bugs")
2. Decide what to do with the orphaned legacy per-role user-list pages — delete them, redirect them to `/users/management`, or wire the per-consultant "Training & progress" link into the main `/users/management` table
3. Refresh `docs/Getting-Started.md`, `docs/Admin-Guide.md`, `docs/Build-Progress.md` for the role rename + location-scoping (currently only this file reflects it)
4. Consider a separate staging database before wider rollout
5. Login rate-limiting and a self-service "forgot password" flow, if/when moving past pilot scale
6. Expand Coordinator permissions (path/extra-course assignment) if the product calls for it
7. Expand Notification recipients beyond CEO-only, if useful

---

## Contact & Support

For questions about the codebase structure, architectural decisions, or development workflow, refer to comments in key files (`src/lib/auth/rbac.ts`, `prisma/schema.prisma`, etc.) and `docs/Getting-Started.md`.

**Last Updated:** 2026-08-08 — full-codebase read and rewrite, following the MANAGER→Location Manager / LOCATION_MANAGER→Location Admin role rename, Location Manager's location-scoped permissions, and removal of the 2026-08-07 demo dataset.
**Generated by:** Cowork Claude Documentation Generator

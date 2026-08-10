# Training Portal — Complete Application Documentation

## Project Overview

**Training Portal** is a private enterprise training management system built to facilitate organizational training paths, course management, and consultant progress tracking. It provides role-based access control across **nine** permission tiers and enables structured training delivery across distributed teams, from initial course assignment through a post-training placement pipeline (Trainer demo feedback + independent Otter Team sign-off) into "In Marketing" status.

Two parallel role hierarchies exist side by side:
- **Location hierarchy** (the original five): CEO, Location Manager, Location Admin, Coordinator, Consultant — scoped by the `Location` model and `locationId` chain.
- **Offshore/placement roles** (added 2026-08-09): Offshore Manager, Offshore Team Lead, Trainer, Otter Team — scoped by the separate `OffshoreOffice` enum (`LOCATION_1`/`LOCATION_2`) and direct per-consultant assignment FKs, not by `locationId`. See "Role-Based Access Control" below for why these are deliberately kept as a separate scoping axis rather than folded into the location hierarchy.

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
- ESLint 9 (`eslint-config-next`)
- tsx (TypeScript execution for one-off scripts, outside the Next.js build)

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

**Post-Training Placement Pipeline (added 2026-08-09)**
- **TrainerFeedback**: `id, consultantUserId (Cascade), trainerUserId (Restrict), verdict (FeedbackVerdict), notes, createdAt`. One row per demo attempt — history is kept, never overwritten; the pipeline always reads the *latest* row per consultant (`orderBy createdAt desc, take 1`).
- **OtterFeedback**: identical shape (`consultantUserId`, `otterUserId`, `verdict`, `notes`, `createdAt`) — the second, independent sign-off.
- Both feedback tables cascade on the consultant side but **Restrict** on the trainer/otter side (the feedback author) — an active Trainer/Otter Team account can't be deleted while their feedback history still references it.
- See "Post-Training Placement Pipeline" under Key Features for the full rollup logic (`src/lib/marketingReadiness.ts`).

**Audit & Notifications**
- **AuditLog**: 30 `AuditActionType` values (see enum below). `actorUserId`/`targetUserId`/`locationId`/`trainingPathId`/`courseId`/`videoId` are all **optional FKs with no `onDelete` clause (Postgres default: Restrict)** — meaning any of those referenced rows (a user, location, course, etc.) cannot be deleted while an AuditLog row still points to it. Deleting such rows (e.g. cleanup scripts) must delete/reassign the referencing AuditLog rows first. `MARKETING_STATUS_CHANGED` rows are written with `actorUserId: null` (system-triggered, not a direct user action).
- **Notification**: four types — `REPORT_EXPORTED`, `PASSWORD_RESET`, `USER_DELETED`, `MARKETING_READY`. `sourceAuditLogId` is also Restrict (not cascade), same caveat.
- **Session**: token-hash storage (`onDelete: Cascade` from the user side — deleting a user auto-clears their sessions).

**Enums:**
- `Role`: CEO, LOCATION_MANAGER, LOCATION_ADMIN, COORDINATOR, CONSULTANT, OFFSHORE_MANAGER, OFFSHORE_TEAM_LEAD, TRAINER, OTTER_TEAM
- `UserStatus`: ACTIVE, DEACTIVATED, DELETED
- `ContentStatus`: ACTIVE, ARCHIVED
- `OffshoreOffice`: LOCATION_1, LOCATION_2 — deliberately **not** the `Location` model (business-unit branches); this is a separate, simpler two-value split used only by the offshore/placement roles and the Consultant's own office assignment
- `VisaType`: CPT, INITIAL_OPT, STEM_OPT, H1B, H4EAD, GC, US_CITIZEN
- `MarketingStatus`: IN_TRAINING, IN_MARKETING
- `FeedbackVerdict`: READY, NOT_READY
- `AuditActionType` (30): USER_CREATED, USERNAME_CHANGED, PASSWORD_RESET, USER_DEACTIVATED, USER_REACTIVATED, USER_DELETED, TRAINING_PATH_ASSIGNED, TRAINING_PATH_CHANGED, EXTRA_COURSE_ASSIGNED, EXTRA_COURSE_REMOVED, CONSULTANT_REASSIGNED (defined but not currently written by any code path — `CONSULTANTS_BULK_REASSIGNED` is used instead for the actual bulk-reassign feature), CONSULTANTS_BULK_REASSIGNED, LOCATION_CREATED, LOCATION_UPDATED, TRAINING_PATH_CREATED, TRAINING_PATH_UPDATED, TRAINING_PATH_DELETED, COURSE_CREATED, COURSE_UPDATED, COURSE_DELETED, VIDEO_CREATED, VIDEO_UPDATED, VIDEO_DELETED, REPORT_EXPORTED, LOGIN_SUCCEEDED, LOGIN_FAILED, TRAINER_FEEDBACK_SUBMITTED, OTTER_FEEDBACK_SUBMITTED, MARKETING_STATUS_CHANGED, TEAM_LEAD_REASSIGNED
- `NotificationType`: REPORT_EXPORTED, PASSWORD_RESET, USER_DELETED, MARKETING_READY

### Cascade behavior cheat sheet (matters when writing any deletion logic)

- **Cascades automatically** on User delete: Session, VideoCompletion (consultant side), ConsultantTrainingAssignment (consultant side), ConsultantExtraCourse (consultant side), TrainerFeedback/OtterFeedback (consultant side only).
- **Cascades automatically** on Course/Video/TrainingPath delete: CourseVideo, TrainingPathCourse, ConsultantExtraCourse (course side), VideoCompletion (video side).
- **`SetNull`** on User delete: `offshoreTeamLeadId`/`trainerUserId`/`otterTeamUserId` on any Consultant that referenced the deleted user — deleting a Trainer/Team Lead/Otter Team member un-assigns their consultants rather than blocking the delete.
- **No cascade (Restrict), must delete/reassign first**: every AuditLog FK, Notification.sourceAuditLogId, the User self-relations (managerId/locationManagerId/coordinatorId), and TrainerFeedback.trainerUserId/OtterFeedback.otterUserId (the feedback *author* side) — a parent User can't be deleted while a child User row still references it, so bulk user deletion must go leaf-to-root (consultants → coordinators → location admins → location manager), and `scripts/e2e-cleanup-disposable-users.ts` clears TrainerFeedback/OtterFeedback/Notification/AuditLog rows before deleting disposable test users for exactly this reason.

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
│   │   │   ├── consultants/[id]/     # Per-consultant detail: progress tiles, assign/change primary path, add/remove extra courses (reachable today only via the legacy /users/consultants list or a direct URL — see "Orphaned routes" below)
│   │   │   ├── managers/, location-managers/, coordinators/, consultants/, ceos/   # LEGACY per-role list pages — still functional (each queries by role + userVisibilityFilter) but NOT linked from any nav or from /users/management; superseded by the consolidated list. See "Orphaned routes."
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
│   │   └── otter/
│   │       ├── actions.ts            # submitOtterFeedbackAction
│   │       └── consultants/page.tsx  # Otter Team-only: consultants assigned to them, verdict + notes form
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
│   ├── audit.ts                      # logAudit(), notifyCeos(), notifyUser()
│   ├── marketingReadiness.ts         # evaluateMarketingReadiness(consultantUserId) — the Trainer+Otter dual sign-off rollup, see Key Features below
│   ├── offshoreOfficeLabels.ts       # OFFSHORE_OFFICE_LABELS — display labels for LOCATION_1/LOCATION_2
│   ├── visaTypeLabels.ts             # VISA_TYPE_LABELS — display labels for VisaType enum
│   ├── reports.ts                    # getDashboardAggregates(), getConsultantReportRows() — scope (consultantScopeFilter) and user filters combined via Prisma AND, never merged, so a filter can only narrow within scope, never widen it
│   ├── errors.ts                     # UserFacingError — only errors deliberately thrown with this class get their .message shown to the client
│   └── validation/
│       ├── user.ts                   # optionalTrimmedString() (blank-string-to-undefined preprocessor), usernameSchema, nameSchema, createStaffUserSchema, createConsultantSchema, createLocationSchema, assignTrainerSchema, assignOtterTeamSchema, submitFeedbackSchema, calendlyLinkSchema (https?:// scheme-allowlisted, see security note below)
│       └── catalog.ts                # trainingPathSchema, courseSchema, videoSchema, videoEditSchema
└── components/
    ├── ui/
    │   ├── Badge.tsx                 # StatusBadge — color-coded by ACTIVE/DEACTIVATED/DELETED/ARCHIVED
    │   ├── ConfirmButton.tsx         # Yes/no confirmation modal wrapper, used for every destructive/high-impact action
    │   └── FormModalButton.tsx       # Modal containing real form fields (vs. ConfirmButton's plain yes/no)
    └── users/
        ├── UserTable.tsx             # Reusable table (used by the legacy per-role pages)
        ├── UserRowActions.tsx        # Edit username / reset password / deactivate-reactivate / delete, all via FormModalButton/ConfirmButton
        ├── CreateUserForm.tsx        # One form for every creatable role; location field driven by locationAssignmentModeFor, offshore office field driven by offshoreOfficeAssignmentModeFor, optional Trainer/Otter Team pickers in the Consultant fragment
        ├── TrainerAssignForm.tsx     # Reassign a Consultant's Trainer (consultant detail page)
        ├── OtterAssignForm.tsx       # Reassign a Consultant's Otter Team member (consultant detail page)
        └── ChangePasswordButton.tsx  # Self-service password change (sidebar) — signs the user out everywhere including the current session
```

Also: `src/app/(app)/profile/CalendlyLinkForm.tsx` — self-service Calendly link editor, rendered on `/profile` for Trainer/Coordinator; the Consultant's own `/profile` shows a "Schedule your demo" link-out to their assigned Trainer's link instead (read-only from the Consultant's side).

### Orphaned routes (real, worth knowing before changing nav or user-list logic)

The "Merge Dashboard/Reports, add consolidated User Management" work (2026-08-07) introduced `/users/management` and `/users/new` as the real UI entry points, but did **not** delete or redirect the older per-role pages. As of this writing:

- `/users/managers`, `/users/location-managers`, `/users/coordinators`, `/users/consultants`, `/users/ceos` — each still works (role-gated, queries by role + `userVisibilityFilter`), but nothing in the current UI links to them. Only reachable by typing the URL directly.
- `/users/consultants/[id]` (the per-consultant "Training & progress" detail page — assign path, manage extra courses) **is** still a real, actively-designed feature, but `/users/management`'s row actions don't currently link to it (only the legacy `/users/consultants` list page's `UserTable` does, via its `showLearningLink` prop). This means the primary-path/extra-course assignment UI is effectively hard to discover from the main nav today — worth fixing if this keeps mattering.

---

## Key Features & Workflows

### 1. User Management
- Five-role hierarchy, each creating/managing only roles below it (see RBAC section)
- Consultant: single-active-session enforcement
- Login is rate-limited (`src/lib/rateLimit.ts`, Upstash Redis): 20 attempts/10min per IP and 8 attempts/15min per username, both must pass or `loginAction` returns a generic "too many attempts" error before ever touching the DB. Fails open if Upstash isn't configured.
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

Defined in `src/lib/nav.ts` (`navItemsForRole(role)`). No `enabled: false` placeholders remain — every item currently in the nav is a live, working page.

- **CEO (11):** Dashboard, Locations, User Management, Training Paths, Courses, Videos, Exports, Offshore Data, Location Overview, Notifications, Audit Logs
- **LOCATION_MANAGER — Location Manager (7):** Dashboard, User Management, Training Paths, Courses, Videos, Exports, Location Overview
- **LOCATION_ADMIN — Location Admin (5):** Dashboard, User Management, Videos, Exports, Location Overview
- **COORDINATOR (3):** Dashboard, User Management, Location Overview
- **CONSULTANT (2):** My Dashboard, My Courses
- **OFFSHORE_MANAGER — Offshore Manager (3):** Dashboard, Consultant Data, Team Leads
- **OFFSHORE_TEAM_LEAD — Offshore Team Lead (2):** Dashboard, My Consultants
- **TRAINER (2):** Dashboard, My Consultants
- **OTTER_TEAM — Otter Team (2):** Dashboard, My Consultants

Bulk Reassignment, per-consultant detail, and the legacy per-role list pages are reachable by link-from-page or direct URL but are not top-level nav items — see "Orphaned routes" above. For the four offshore/placement roles, "Dashboard" in the nav is `/dashboard`, which immediately redirects to their real landing page (`/offshore/consultants`, `/offshore/my-consultants`, `/trainer/consultants`, `/otter/consultants` respectively) — `/dashboard` itself is built around the location-hierarchy reporting view these roles aren't part of.

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
- `prisma/migrations/20260809190852_add_offshore_trainer_otter_roles/` — adds `OFFSHORE_MANAGER`/`OFFSHORE_TEAM_LEAD`/`TRAINER`/`OTTER_TEAM` to `Role`, the `offshoreTeamLeadId`/`trainerUserId`/`otterTeamUserId` self-relations (`SetNull`), `calendlyLink`/`marketingStatus`, `TrainerFeedback`/`OtterFeedback` tables, `MarketingStatus`/`FeedbackVerdict` enums, and the 4 new `AuditActionType`/1 new `NotificationType` values
- The build does **not** run migrations automatically — after any schema change, run `prisma migrate deploy` by hand (locally or in CI) before/after deploying the dependent code
- Lock file: `prisma/migrations/migration_lock.toml` (PostgreSQL)

### Deployment
- Hosting: Vercel, project `ricky-s-team1/training-portal`. **No GitHub/GitLab webhook integration** — deploys are manual: `npx vercel --prod` from this folder. Pushing to `gitlab/main` does NOT redeploy the live app by itself. A `.gitlab-ci.yml` (lint + build) exists as of 2026-08-10 but currently has no live runner to execute it (see Next Steps) — it does not gate or trigger deploys either way.
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
- **Component reuse:** `UserTable`/`ConfirmButton`/`FormModalButton`/`StatusBadge` patterns used consistently
- **Tailwind:** utility-first, CSS custom properties for theming (`--color-*` variables in `globals.css`, no dark-mode variant)

---

## Known Limitations & Future Phases

- **Coordinators cannot assign paths/extra courses** (not yet enabled by design, not an oversight)
- **Notifications** are CEO-only recipients (could expand to other roles)
- **Login rate limiting** (added 2026-08-10, `src/lib/rateLimit.ts`) — two Upstash Redis sliding-window limiters (20/10min per IP, 8/15min per username, both must pass) sit in front of `loginAction`. Fails open (no limiting) if `UPSTASH_REDIS_REST_URL`/`_TOKEN` aren't set, so environments without Upstash configured still work, just unprotected.
- **No "forgot password" self-service flow** — self-service *change* (knowing your current password) exists (`ChangePasswordButton`), but there's no unauthenticated reset-by-email flow; a forgotten password requires another admin to reset it
- **Separate staging Supabase project exists** (added 2026-08-10) but local dev and staging still share one dataset the same way prod alone used to — be careful what you create while testing (see the two temporary-data-then-cleanup patterns in `scripts/cleanup-demo.ts` and `scripts/e2e-cleanup-disposable-users.ts` for the safe way to do this)
- **Export route CSRF exposure** — see Reporting & Exports section above; log-noise impact only, not a data leak
- **Argon2 is a native Node module** — confirmed working on Vercel; verify native module support first if hosting ever changes
- **Orphaned legacy user-list routes** — see "Orphaned routes" section above
- **Stale error copy in two catalog actions** — see "Known small bugs" above

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
- **Note (2026-08-08, still true 2026-08-09):** the three `docs/*.md` files above still describe the pre-rename role names (Manager/Location Manager rather than Location Manager/Location Admin), the pre-location-scoping Location Manager permissions, and predate the 2026-08-09 Offshore Manager/Team Lead/Trainer/Otter Team roles entirely. Treat this file (`CLAUDE.md`) as authoritative for current role names/permissions until those docs are refreshed too.

---

## Next Steps for Development

1. Fix the two stale "Only the CEO can manage..." error strings (see "Known small bugs")
2. Decide what to do with the orphaned legacy per-role user-list pages — delete them, redirect them to `/users/management`, or wire the per-consultant "Training & progress" link into the main `/users/management` table
3. Refresh `docs/Getting-Started.md`, `docs/Admin-Guide.md`, `docs/Build-Progress.md` for the role rename + location-scoping + the 2026-08-09 offshore/placement roles (currently only this file reflects all of it)
4. ~~Consider a separate staging database before wider rollout~~ — done 2026-08-10 ("Training-Project-Staging")
5. A self-service "forgot password" flow, if/when moving past pilot scale (login rate limiting is done, see Key Features)
6. Expand Coordinator permissions (path/extra-course assignment) if the product calls for it
7. Expand CEO-inbox Notification triggers beyond report-export/password-reset/deletion, if useful (the Placement Pipeline's `MARKETING_READY` notifications already go to non-CEO roles, see Key Features)
8. Revisit Vercel/Supabase tier as usage grows past pilot scale — more roles and a placement pipeline mean more concurrent sessions and writes
9. ~~Wire up CI (lint/build on every push)~~ — `.gitlab-ci.yml` added 2026-08-10, but pipelines sit permanently `Pending` because this GitLab instance (`gitlab.evr-tec.com`) has no live runner: the one project runner on record (`#4`, `YGZDobYsd`) shows `Active: Yes` but last checked in 2 years ago — no `gitlab-runner` process is actually running anywhere. The pipeline definition is real and was verified to pass locally (`npm run lint && npm run build`); it just has nowhere to execute until someone installs/registers a live runner (Docker on a dev machine, or a small always-on VPS). E2E-in-CI is a further follow-on beyond that, needing staging DB + Upstash credentials added as GitLab CI/CD variables.
10. Error monitoring (e.g. Sentry) — still absent as of 2026-08-10

---

## Contact & Support

For questions about the codebase structure, architectural decisions, or development workflow, refer to comments in key files (`src/lib/auth/rbac.ts`, `prisma/schema.prisma`, etc.) and `docs/Getting-Started.md`.

**Last Updated:** 2026-08-10 — enterprise-scale hardening pass: added indexes on the offshore/placement `User` fields, wrapped the marketing-readiness status flip in a transaction, added security headers and top-level error boundaries, added login rate limiting (Upstash Redis), and stood up a separate staging Supabase project so local dev no longer writes into the production database. Restricted report-export access to CEO/Location Manager only (previously included Location Admin). See "Staging vs. production" and the rate-limiting note under User Management for details.
**Previously (2026-08-09):** added the Offshore Manager / Offshore Team Lead / Trainer / Otter Team roles and the full post-training placement pipeline (dual Trainer+Otter sign-off, marketing-readiness rollup, Calendly link-out scheduling, Location Overview dashboard); documented the Consultant `technology`/`visaType`/`dateOfBirth`/`offshoreOffice` fields that were added earlier the same day but missed in the previous pass; fixed and documented two bugs found during a full 9-role permission audit (dashboard Coordinator-filter leak, `/users/management` dead-end for the new roles).
**Generated by:** Cowork Claude Documentation Generator

# Training Portal — Complete Application Documentation

## Project Overview

**Training Portal** is a private enterprise training management system built to facilitate organizational training paths, course management, and consultant progress tracking. It provides role-based access control with five permission tiers (CEO, Location Manager, Location Admin, Coordinator, Consultant) and enables structured training delivery across distributed teams.

**Current Version:** 0.1.0  
**Status:** In active development (Phase 1 complete)  
**Repository:** Git (local)

---

## Tech Stack

**Frontend & Framework:**
- Next.js 16.3.0 (React 19.2.8, React DOM 19.2.8)
- TypeScript 5
- Tailwind CSS 4 (with @tailwindcss/postcss)
- Custom design system (CSS variables: `--color-paper`, `--color-shell`, `--font-display`, `--font-sans`)

**Backend & Data:**
- Node.js with server-only modules
- PostgreSQL (hosted on Supabase)
- Prisma ORM 7.9.1 with PostgreSQL adapter
- Connection pooling via Supabase Transaction Pooler

**Authentication & Security:**
- Custom session-based auth (httpOnly cookies, 12-hour TTL)
- Argon2 password hashing (v0.45.1)
- SHA256 session token hashing
- Single-active-session enforcement for CONSULTANT role

**Utilities & Libraries:**
- Zod 4.4.3 (validation)
- ExcelJS 4.4.0 (report exports)
- ESLint 9 (code quality)
- TSX 4.23.10 (TypeScript execution in scripts)

---

## Database Schema

### Core Entities

**User**
- Roles: CEO, LOCATION_MANAGER, LOCATION_ADMIN, COORDINATOR, CONSULTANT
- Status: ACTIVE, DEACTIVATED, DELETED
- Hierarchy: Location Manager → Location Admins/Coordinators/Consultants (within their location); Location Admin → coordinators/consultants (within their location); Coordinator → consultants. Note: the `managerId`/`locationManagerId` FK column names on `User` predate the role rename and were intentionally left as-is — `managerId` points to a user's Location Manager supervisor, `locationManagerId` to their Location Admin supervisor.
- Fields: id, firstName, lastName, username (unique, lowercase mirror), passwordHash, email, phone, status, locationId, managerId, locationManagerId, coordinatorId, createdByUserId, timestamps

**Location**
- Represents physical/organizational locations
- Fields: id, name, code (unique), status (ACTIVE/ARCHIVED), createdByUserId, timestamps

**TrainingPath**
- Ordered collection of courses for structured progression
- Fields: id, name, description, status, createdByUserId, timestamps
- Relations: many courses via TrainingPathCourse (with sortOrder)

**Course**
- Container for related videos
- Fields: id, name, description, status, createdByUserId, timestamps
- Relations: many videos via CourseVideo (with sortOrder)

**Video**
- Individual training content units from Google Drive
- Fields: id, title, description, driveSourceUrl, driveFileId (unique), embedUrl, thumbnailUrl, durationSeconds, status, createdByUserId, updatedByUserId, timestamps

**Assignments & Progress**
- **ConsultantTrainingAssignment**: Primary training path per consultant (unique per consultant)
- **ConsultantExtraCourse**: Ad-hoc course assignments (unique per consultant-course pair)
- **VideoCompletion**: Track individual video completions (unique per consultant-video pair)

**Audit & Notifications**
- **AuditLog**: 22+ action types (USER_CREATED, LOGIN_SUCCEEDED, TRAINING_PATH_ASSIGNED, etc.)
- **Notification**: Three types (REPORT_EXPORTED, PASSWORD_RESET, USER_DELETED)
- **Session**: Secure session storage with token hashing and IP/User-Agent logging

**Enums:**
- Role: CEO, LOCATION_MANAGER, LOCATION_ADMIN, COORDINATOR, CONSULTANT
- UserStatus: ACTIVE, DEACTIVATED, DELETED
- ContentStatus: ACTIVE, ARCHIVED
- AuditActionType: 22 actions
- NotificationType: REPORT_EXPORTED, PASSWORD_RESET, USER_DELETED

---

## Authentication & Authorization

### Session Management

Located in `src/lib/auth/session.ts`:
- Session tokens: 32-byte random base64url strings
- Hashing: SHA256 (never store raw tokens in database)
- TTL: 12 hours
- Cookie: httpOnly, secure (in production), sameSite=lax
- Consultant enforcement: Only one active session per consultant (others revoked on login)

### Role-Based Access Control (RBAC)

Central authorization in `src/lib/auth/rbac.ts` (referenced from Technical Implementation Blueprint §7, §22):

**Role Rank Hierarchy:**
```
CEO (4) > LOCATION_MANAGER (3) > LOCATION_ADMIN (2) > COORDINATOR (1) > CONSULTANT (0)
```

> **Renamed 2026-08-08:** the old `MANAGER` role is now `LOCATION_MANAGER` ("Location Manager"), and the old `LOCATION_MANAGER` role is now `LOCATION_ADMIN` ("Location Admin"). Each renamed role kept its own original permission set at rename time; Location Manager's permissions were then further changed (see below) to be scoped to a single assigned location, matching Location Admin's existing pattern, plus given catalog structure access.

**Creatable Roles by Actor:**
- CEO: Can create all roles
- LOCATION_MANAGER (Location Manager): Can create Location Admin, Coordinator, Consultant
- LOCATION_ADMIN (Location Admin): Can create Coordinator, Consultant
- COORDINATOR: Can create Consultant
- CONSULTANT: Cannot create roles

**User Management Scope:**
- CEO: Manage all users
- LOCATION_MANAGER (Location Manager): Manage all roles below them **within their own assigned location only** (excludes CEO and other Location Managers) — as of 2026-08-08, Location Manager is now assigned exactly one location at creation and is restricted to it, the same way Location Admin already was
- LOCATION_ADMIN (Location Admin): Manage Coordinators and Consultants in same location only
- COORDINATOR: Manage only their assigned Consultants
- CONSULTANT: Self only

**Key Authorization Functions** (`src/lib/auth/rbac.ts`):
- `canCreateRole(actorRole, targetRole)`: Role creation matrix
- `canManageUser(actor, target)`: User scope enforcement — location-scoped for both Location Manager and Location Admin
- `canAssignExtraCourses(actor, target)`: Extra course assignment (not available to Coordinators/Consultants)
- `canAssignTrainingPath(actor, target)`: Primary path assignment (not available to Consultants)
- `canExportReports(actorRole)`: CEO, Location Manager, Location Admin only — export data itself is location-scoped for the latter two via `consultantScopeFilter` in `src/lib/reports.ts`
- `canBulkReassign(actorRole)`: CEO, Location Manager, Location Admin only — scoped the same way via `userVisibilityFilter`/`canManageUser`
- `canManageCatalogStructure(actorRole)`: CEO and Location Manager (create/edit/archive Training Paths and Courses) — deliberately global/unscoped, since neither entity has a `locationId`
- `canManageVideos(actorRole)`: CEO, Location Manager, Location Admin — global/unscoped (Video has no `locationId` either)
- `isCeo(actorRole)`: Audit log and notification visibility (CEO only)
- `userVisibilityFilter(actor)`: Prisma where-filter for list endpoints (scopes results; location-scoped with an explicit null-location guard for Location Manager/Location Admin)
- `locationAssignmentModeFor(actorRole, targetRole)`: returns `"none" | "required" | "optional" | "inherit"` — drives whether the create-user form shows a location picker, and whether the server auto-assigns the actor's own location to a new subordinate

---

## Application Structure

```
src/
├── app/                              # Next.js App Router
│   ├── page.tsx                      # Root: redirects to /dashboard or /login
│   ├── layout.tsx                    # Root layout (fonts, metadata)
│   ├── login/
│   │   ├── page.tsx                  # Login page
│   │   ├── login-form.tsx            # Login form component
│   │   └── actions.ts                # Login/password reset server actions
│   ├── (app)/                        # Protected routes (auth required)
│   │   ├── layout.tsx                # App shell (sidebar nav, user menu)
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Role-specific dashboard
│   │   ├── locations/
│   │   │   ├── page.tsx              # Locations list
│   │   │   ├── location-form.tsx     # Create/edit location
│   │   │   └── actions.ts            # Location CRUD server actions
│   │   ├── users/
│   │   │   ├── managers/             # Location Manager list (folder name predates the rename)
│   │   │   ├── location-managers/    # Location Admin list (folder name predates the rename)
│   │   │   ├── coordinators/         # Coordinator list
│   │   │   ├── consultants/          # Consultant list
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx      # Consultant detail, training path assignment, extra courses
│   │   │   │   │   └── actions.ts    # Assignment server actions
│   │   │   │   └── actions.ts
│   │   │   ├── bulk-reassign/        # Bulk coordinator reassignment
│   │   │   ├── actions.ts            # User management server actions
│   │   │   ├── UserTable.tsx         # Reusable table component
│   │   │   └── CreateConsultantForm.tsx, CreateStaffUserForm.tsx
│   │   ├── catalog/
│   │   │   ├── training-paths/
│   │   │   │   ├── page.tsx          # Training paths list
│   │   │   │   ├── training-path-form.tsx
│   │   │   │   ├── training-path-row-actions.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx      # Path detail, add courses
│   │   │   │   │   ├── path-course-list.tsx
│   │   │   │   │   ├── add-course-form.tsx
│   │   │   │   │   └── actions.ts
│   │   │   │   └── actions.ts
│   │   │   ├── courses/
│   │   │   │   ├── page.tsx          # Courses list
│   │   │   │   ├── course-form.tsx
│   │   │   │   ├── course-row-actions.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx      # Course detail, add videos
│   │   │   │   │   ├── course-video-list.tsx
│   │   │   │   │   ├── add-video-form.tsx
│   │   │   │   │   └── actions.ts
│   │   │   │   └── actions.ts
│   │   │   └── videos/
│   │   │       ├── page.tsx          # Videos list
│   │   │       ├── video-form.tsx
│   │   │       ├── video-row-actions.tsx
│   │   │       └── actions.ts
│   │   ├── my-courses/
│   │   │   ├── page.tsx              # Consultant's assigned courses/paths
│   │   │   ├── [courseId]/
│   │   │   │   ├── page.tsx          # Course content with video list
│   │   │   │   └── [videoId]/
│   │   │   │       └── page.tsx      # Video player, mark complete
│   │   │   └── actions.ts            # Completion tracking
│   │   ├── reports/
│   │   │   ├── page.tsx              # Consultant progress reports, filters
│   │   │   ├── exports/
│   │   │   │   └── page.tsx          # Export history
│   │   │   └── actions.ts            # Report generation, export
│   │   ├── notifications/
│   │   │   ├── page.tsx              # Notification list (CEO only)
│   │   │   └── actions.ts
│   │   ├── audit-logs/
│   │   │   └── page.tsx              # Audit log viewer (CEO only)
│   │   └── actions.ts                # App-wide logout
│   └── api/
│       └── reports/
│           └── export/
│               └── route.ts          # Excel export endpoint
├── lib/
│   ├── auth/
│   │   ├── session.ts                # Session creation/verification, getCurrentUser()
│   │   ├── rbac.ts                   # Authorization matrix
│   │   └── password.ts               # Argon2 hashing (assumed)
│   ├── prisma.ts                     # Prisma client singleton
│   ├── nav.ts                        # navItemsForRole() — role-aware navigation
│   ├── content-resolution.ts         # getPrimaryTrainingPath(), getConsultantProgress()
│   ├── drive.ts                      # Google Drive API integration
│   ├── audit.ts                      # Audit logging utilities
│   ├── reports.ts                    # Report generation, Excel export
│   ├── errors.ts                     # Custom error classes
│   └── validation/
│       ├── catalog.ts                # Zod schemas for catalog entities
│       └── user.ts                   # Zod schemas for user creation/updates
├── components/
│   ├── ui/
│   │   ├── Badge.tsx
│   │   ├── ConfirmButton.tsx         # Confirmation dialog wrapper
│   │   └── FormModalButton.tsx       # Modal form trigger
│   └── users/
│       ├── UserTable.tsx
│       ├── UserRowActions.tsx
│       ├── CreateConsultantForm.tsx
│       └── CreateStaffUserForm.tsx
└── generated/
    └── prisma/
        └── *                         # Auto-generated Prisma types (do not edit)
```

---

## Key Features & Workflows

### 1. User Management
- Multi-role hierarchical system with scope enforcement
- Consultant single-active-session enforcement
- User status tracking (ACTIVE, DEACTIVATED, DELETED)
- Bulk consultant reassignment between coordinators
- Password reset via audit notification
- Location-based scoping for Location Managers

### 2. Training Catalog
- Hierarchical structure: Training Path → Courses → Videos
- CEO and Location Manager can create/edit paths and courses
- CEO/Location Manager/Location Admin can upload/edit videos
- Video metadata: Google Drive integration, thumbnails, duration
- Archive status for soft deletes
- Sort order for course/video sequencing

### 3. Training Assignment
- Primary training path assignment per consultant
- Extra course assignments (ad-hoc, independent of primary path)
- Assignment tracking with actor audit log
- Only CEO, Location Manager, Location Admin can assign paths

### 4. Progress Tracking
- Video completion markers (unique per consultant-video)
- Progress dashboard: completion %, completed/pending counts, last activity
- Consultant-facing view (My Courses section)
- Location Manager/Coordinator view: progress reports with filtering

### 5. Reporting & Exports
- Role-based report access (CEO, Location Manager, Location Admin only)
- ExcelJS-powered XLSX export
- Consultant progress snapshots (assignments, completions, dates)
- Export history and notification (CEO only)

### 6. Audit Logging
- 22+ action types tracked
- Actor, target user, entity (Location/Path/Course/Video), timestamps, metadata
- Full history visibility to CEO only
- Automatic audit creation on all state changes

### 7. Notifications
- Three types: REPORT_EXPORTED, PASSWORD_RESET, USER_DELETED
- CEO-only recipient (initially)
- Unread badge on notification nav item
- Source audit log tracking

---
  
## User Roles & Permissions

### CEO
- **Management:** All users, locations, training paths, courses, videos
- **Reporting:** Full access to reports, exports, audit logs, notifications
- **Constraints:** None
- **Navigation:** 9 items (Dashboard, Locations, User Management, Training Paths, Courses, Videos, Exports, Notifications, Audit Logs)

### LOCATION_MANAGER (Location Manager — renamed from MANAGER, 2026-08-08)
- **Management:** Location Admins, Coordinators, and Consultants — **within their own assigned location only** (not other Managers/CEO, not other locations)
- **Reporting:** Report and export access, scoped to their own location
- **Bulk Reassignment:** Yes, within their location
- **Video Management:** Can add/edit/delete videos (global, not location-scoped — the video catalog is shared)
- **Catalog Structure:** Can create/edit/archive Training Paths and Courses (global — same reason)
- **Constraints:** Assigned to exactly one location at creation; cannot see or manage any other location's users/data; cannot create locations
- **Navigation:** 6 items (Dashboard, User Management, Training Paths, Courses, Videos, Exports)

### LOCATION_ADMIN (Location Admin — renamed from LOCATION_MANAGER, 2026-08-08)
- **Management:** Coordinators and Consultants in assigned location only
- **Reporting:** Location-scoped reports and exports
- **Bulk Reassignment:** Yes (within location)
- **Video Management:** Can add/edit/delete videos (global)
- **Constraints:** Single location scope; no Training Path/Course creation (Location Manager or CEO only)
- **Navigation:** 4 items (Dashboard, User Management, Videos, Exports)

### COORDINATOR
- **Management:** View only own assigned Consultants
- **Training Assignment:** Cannot assign paths or extra courses
- **Reporting:** View own consultants' progress only
- **Constraints:** No user creation, no catalog management
- **Navigation:** 2 items (Dashboard, User Management)

### CONSULTANT
- **Training:** View and complete assigned courses/videos
- **Dashboard:** Progress overview (completion %, last activity)
- **My Courses:** Browse assigned path/extra courses, watch videos, mark complete
- **Constraints:** Single active session; cannot see other users; no management
- **Navigation:** 2 items (My Dashboard, My Courses)

---

## Navigation Structure

Navigation is role-aware and defined in `src/lib/nav.ts`. User Management, Reports, and Bulk Reassignment were consolidated into single pages rather than separate nav items.

**CEO (9 items):**
Dashboard, Locations, User Management, Training Paths, Courses, Videos, Exports, Notifications, Audit Logs

**LOCATION_MANAGER — Location Manager (6 items):**
Dashboard, User Management, Training Paths, Courses, Videos, Exports

**LOCATION_ADMIN — Location Admin (4 items):**
Dashboard, User Management, Videos, Exports

**COORDINATOR (2 items):**
Dashboard, User Management

**CONSULTANT (2 items):**
My Dashboard, My Courses

---

## Core Pages & Their Workflows

### Dashboard (`/dashboard`)
- **Consultant view:** Progress cards (completion %, videos completed/pending, total courses), last activity, link to My Courses
- **Staff view:** Welcome message, link to Reports

### My Courses (`/my-courses`)
- **Consultant only:** Lists assigned training path (primary) and any extra courses
- **Click course:** Navigate to course detail with video list
- **Click video:** Open video player with mark-complete button
- **Backend:** Tracks completions in VideoCompletion model

### Consultants (`/users/consultants`)
- **Role-scoped list:** Shows users visible to current actor
- **Detail view** (`/users/consultants/[id]`):
  - Assign/change primary training path (CEO, Location Manager, Location Admin only)
  - View/add extra courses
  - See training path and progress
  - Full audit trail of assignments

### Training Paths (`/catalog/training-paths`)
- **CEO, Location Manager:** Create, edit, archive paths
- **Detail view** (`/catalog/training-paths/[id]`):
  - Add/reorder courses
  - View associated courses with sort order

### Courses (`/catalog/courses`)
- **CEO, Location Manager:** Create, edit, archive courses
- **Detail view** (`/catalog/courses/[id]`):
  - Add/reorder videos
  - View associated videos

### Videos (`/catalog/videos`)
- **CEO, Location Manager, Location Admin:** Create (with Google Drive file picker), edit, archive
- **Row actions:** Edit, archive
- **Fields:** Title, description, Drive source URL, embed URL, thumbnail, duration

### Reports (`/reports`)
- **Filtered progress view:** Consultants, completion ranges, date ranges
- **Columns:** Consultant name, path assigned, % complete, videos completed/total, last activity
- **Export button:** Generates XLSX via `/api/reports/export`

### Locations (`/locations`) [CEO Only]
- **CRUD:** Create/edit/archive locations
- **Fields:** Name, unique code

### Audit Logs (`/audit-logs`) [CEO Only]
- **Full audit history:** Action type, actor, target, timestamp, metadata
- **Indexed by:** Actor ID, action type, creation date

### Notifications (`/notifications`) [CEO Only]
- **Unread badge:** Shows count in nav
- **List view:** Notifications with title/body, read status
- **Types:** Report exported, password reset, user deleted

### Bulk Reassignment (`/users/bulk-reassign`)
- **CEO, Location Manager, Location Admin:** Upload CSV or select consultants to reassign between coordinators
- **Audit log:** One entry per reassigned consultant

---

## Development Setup & Commands

### Environment Setup
1. PostgreSQL database on Supabase (pooled + direct connections configured in `.env`)
2. Google Drive API credentials (for video picker integration in `src/lib/drive.ts`)
3. Node.js 18+, npm/yarn

### Scripts
```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Build for production (runs Prisma generate first)
npm start                # Start production server
npm run lint             # Run ESLint
npm run db:migrate       # Prisma migrate dev (interactive)
npm run db:deploy        # Prisma migrate deploy (production)
npm run db:studio        # Open Prisma Studio GUI
npm run seed:ceo         # Seed initial CEO user from scripts/seed-ceo.ts
npm run postinstall      # Auto-run: Prisma generate
```

### Database Migrations
- Location: `prisma/migrations/`
- Initial schema: `20260807051647_init` (all models and enums)
- Lock file: `prisma/migrations/migration_lock.toml` (PostgreSQL)

---

## Important Files & Modules

### Authentication & Authorization
- **`src/lib/auth/session.ts`**: Session creation, token hashing, cookie management, `getCurrentUser()`
- **`src/lib/auth/rbac.ts`**: Role rank, creatable roles, scope checks, visibility filters (central authorization)
- **`src/lib/auth/password.ts`**: Argon2 hashing/verification (assumed)

### Core Business Logic
- **`src/lib/content-resolution.ts`**: `getPrimaryTrainingPath()`, `getConsultantProgress()` — content visibility and progress calculation
- **`src/lib/audit.ts`**: Audit log creation helpers (assumed)
- **`src/lib/reports.ts`**: Report generation, filtering, Excel export logic
- **`src/lib/nav.ts`**: `navItemsForRole()` — navigation structure per role

### Database & Validation
- **`src/lib/prisma.ts`**: Singleton Prisma client
- **`src/lib/validation/user.ts`**: Zod schemas for user creation/updates
- **`src/lib/validation/catalog.ts`**: Zod schemas for paths/courses/videos

### Server Actions (Server-Side Workflows)
- **`src/app/login/actions.ts`**: Login, password reset
- **`src/app/(app)/actions.ts`**: Logout
- **`src/app/(app)/users/actions.ts`**: User CRUD
- **`src/app/(app)/users/consultants/[id]/actions.ts`**: Training assignment, extra courses
- **`src/app/(app)/catalog/training-paths/actions.ts`**: Path CRUD
- **`src/app/(app)/catalog/courses/actions.ts`**: Course CRUD, video association
- **`src/app/(app)/catalog/videos/actions.ts`**: Video CRUD
- **`src/app/(app)/locations/actions.ts`**: Location CRUD
- **`src/app/(app)/my-courses/actions.ts`**: Video completion marking
- **`src/app/(app)/reports/actions.ts`**: Report export
- **`src/app/(app)/notifications/actions.ts`**: Notification read status

### UI Components
- **`src/components/ui/Badge.tsx`**: Status/role badge
- **`src/components/ui/ConfirmButton.tsx`**: Confirmation modal for destructive actions
- **`src/components/ui/FormModalButton.tsx`**: Modal form trigger button
- **`src/components/users/UserTable.tsx`**: Reusable user list table
- **`src/components/users/UserRowActions.tsx`**: Edit/delete/reset password actions
- **`src/components/users/CreateConsultantForm.tsx`**: Consultant creation form
- **`src/components/users/CreateStaffUserForm.tsx`**: Staff user creation form

### API Routes
- **`src/app/api/reports/export/route.ts`**: Excel export endpoint (streaming XLSX)

### Configuration
- **`tsconfig.json`**: TypeScript (ES2017, strict mode, path alias `@/*`)
- **`next.config.ts`**: Next.js config (currently minimal)
- **`postcss.config.mjs`**: Tailwind CSS 4 PostCSS config
- **`package.json`**: Dependencies and scripts
- **`prisma/schema.prisma`**: Database schema (source of truth)
- **`.env`**: Database connection strings (Supabase pooler + direct)
- **`.gitignore`**: Ignores node_modules, .next, .env*, Prisma generated code

### Styles
- **`src/app/globals.css`**: Root CSS variables (`--color-paper`, `--color-shell`, `--font-display`, `--font-sans`)
- **Layout fonts:** Fraunces (display), IBM Plex Sans (body)

---

## Code Quality & Standards

- **Type Safety:** Strict TypeScript with Prisma-generated types
- **Validation:** Zod schemas on input (forms, API requests)
- **Authorization:** Centralized RBAC checks before any state mutation
- **Audit Trail:** Automatic logging of all user/content actions
- **Session Security:** httpOnly cookies, token hashing, 12-hour TTL, single-active-session for Consultants
- **Error Handling:** Custom error classes in `src/lib/errors.ts` (assumed)
- **Component Reuse:** UserTable, FormModal, Badge patterns
- **Tailwind**: Utility-first, CSS variables for theming

---

## Known Limitations & Future Phases

- **Coordinators cannot assign paths/extra courses** (to be enabled in Phase 2)
- **Video management** restricted to CEO/Location Manager/Location Admin (may expand)
- **Notifications** currently CEO-only recipients (will expand to other roles)
- **Google Drive integration** present in `src/lib/drive.ts` (implementation details TBD)
- **Navigation placeholders:** Several future features marked `enabled: false` in nav
- **Single primary training path** per consultant (extra courses supplement via ConsultantExtraCourse)

---

## Glossary & Key Terms

- **ConsultantTrainingAssignment**: The unique primary training path per consultant
- **ConsultantExtraCourse**: Ad-hoc course assignment outside the primary path
- **VideoCompletion**: Marker when a consultant has watched and marked a video complete
- **TrainingPathCourse**: Join model linking courses to a training path with sort order
- **CourseVideo**: Join model linking videos to a course with sort order
- **AuditLog**: Immutable record of all system actions (user creation, assignments, deletions, etc.)
- **Session**: Secure server-side session record with hashed token, TTL, and metadata
- **ContentStatus**: ACTIVE or ARCHIVED (soft delete pattern)
- **UserStatus**: ACTIVE, DEACTIVATED, or DELETED

---

## Reference Documentation

- **Technical Implementation Blueprint.md** (external): Mentioned in schema & RBAC comments (§7, §16, §22)
- **Training_Website/Technical Implementation Blueprint.md** (external): Source spec for schema
- **`.claude/plans/`** (internal plans): Design decisions and resolved architecture
- **Prisma Docs:** `node_modules/next/dist/docs/` (checked by AGENTS.md)

---

## Next Steps for Development

1. Review AGENTS.md for Next.js version-specific guidance
2. Implement missing video/image upload via Google Drive picker
3. Add filtering and export to Reports page
4. Implement bulk operations (bulk user creation, bulk video upload)
5. Phase 2: Expand Coordinator permissions
6. Phase 2: Add role-specific reporting dashboards
7. Phase 2: Implement notification recipient expansion
8. Add email/SMS notification delivery
9. Performance optimization: caching, query optimization for large datasets
10. Frontend accessibility audit (WCAG 2.1)

---

## Contact & Support

For questions about the codebase structure, architectural decisions, or development workflow, refer to comments in key files (`src/lib/auth/rbac.ts`, `prisma/schema.prisma`, etc.) and the source spec referenced above.

**Last Updated:** 2026-08-08 — updated for the MANAGER→Location Manager / LOCATION_MANAGER→Location Admin role rename, Location Manager's location-scoped permissions, and removal of the 2026-08-07 demo dataset.  
**Generated by:** Cowork Claude Documentation Generator

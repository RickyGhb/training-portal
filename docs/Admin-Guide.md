# CrewNex — Admin Guide

*(Product name as of 2026-08-14 — this app was called "Training Portal" through most of its build history; the repo, some URLs, and older commits still use that name. See `CLAUDE.md`'s "Project Overview" for the rename history.)*

Handoff doc for whoever runs this day to day. For build history and phase-by-phase detail, see `Build-Progress.md` in this folder. For the deep-reference, always-current doc, see `../CLAUDE.md` — this file lags behind it for anything added since 2026-08-08 (the role rename), most notably the offshore/placement roles, the Forms feature, and the CrewNex rebrand; treat `CLAUDE.md` as authoritative on any conflict.

**Code:** `~/Documents/Sync-Shared/Projects/training-portal`
**Live URL:** https://crewnex.vercel.app
**Local dev:** `cd ~/Documents/Sync-Shared/Projects/training-portal && npm run dev` → http://localhost:3000

---

## First things to do

1. **Log in as CEO and change the password.** Use the "Change password" button in the sidebar (self-service, added later in the build — signs you out of every session including the current one and redirects to `/login`, so you'll need to log back in with the new password right after).
2. **Create your locations** (Locations page) — these are your branches/offices.
3. **Create your Managers / Location Managers / Coordinators** as needed (Users section). CEO can create any role; each role can only create roles below it — see the hierarchy below.
4. **Build the catalog** before assigning anything to consultants:
   - Training Paths → Courses → Videos (in that order, or any order — they're independent until you link them)
   - Add a video by pasting its Google Drive **share link** (the "Share" URL, not the raw file URL) — the app converts it to an embeddable preview automatically
   - Attach videos to Courses, attach Courses to Training Paths, using the "Manage videos" / "Manage courses" links on each list
5. **Assign training** — open a consultant's "Training & progress" page (from the Consultants list) to set their primary Training Path and any extra individual Courses.

---

## Role hierarchy

**Renamed 2026-08-08** — if you see "Manager"/"Location Manager" anywhere older, they map to today's "Location Manager"/"Location Admin" respectively.

```
CEO > Location Manager > Location Admin > Coordinator > Consultant
```

| Role | Can create | Scope |
|---|---|---|
| CEO | Everyone (all nine roles) | Everything, everywhere |
| Location Manager | Location Admin, Coordinator, Consultant | Only their own location; can also manage the training catalog (global) |
| Location Admin | Coordinator, Consultant | Only their own location |
| Coordinator | Consultant | Only their own consultants |
| Consultant | — | Only themselves |

A Coordinator can be **independent** (no location, no Location Admin above them) — the CEO sets this up by leaving the location field blank when creating the coordinator.

A separate, parallel hierarchy handles offshore/placement roles (Offshore Manager, Offshore Team Lead, Trainer, Otter Team) — scoped by office and direct per-consultant assignment rather than the `Location` model above. See `CLAUDE.md`'s RBAC section for the full picture; not duplicated here.

---

## What each role sees

- **CEO** — everything: user management, catalog, reports, exports, audit logs, notifications, forms.
- **Location Manager** — confined to their location; can manage the catalog (Training Paths/Courses/Videos, global) and export reports for their location.
- **Location Admin** — confined to their location; can manage Videos and export reports for it.
- **Coordinator** — only their own consultants; can view reports for just their consultants, no exports.
- **Consultant** — their own dashboard, "My Courses," and video player. Nothing administrative.

Every role but Consultant can also build/manage public forms (`/forms`) — see `CLAUDE.md`'s "Forms" section for how those spread visibility works.

---

## Everyday operations

- **Deactivate vs. Delete**: Deactivate blocks login and hides the account from default lists but keeps everything reversible. Delete is a soft delete (data and history are preserved, but the account is gone from all operational lists — it still shows up in report filters under "Deleted (archived)").
- **Password resets** sign the user out of every existing session immediately.
- **Bulk Reassignment** moves multiple consultants to a different coordinator at once (Users → Bulk Reassignment).
- **Notifications** (CEO only) fire automatically for: a Manager exporting a report, any password reset, and any consultant deletion. Nothing else pages the CEO — routine edits and assignments don't.
- **Audit Logs** (CEO only) has every sensitive action, filterable by type and date.

---

## Deployment

- **Hosting:** Vercel, project `ricky-s-team1/worksphere` (renamed from `training-portal` 2026-08-14)
- **Database:** Supabase project "Training-Project," region us-west-2 for production. **A separate staging project ("Training-Project-Staging") now exists** (added 2026-08-10) — local dev's `.env.local` points there by default, so local testing no longer writes into the database the live app reads. `.env` still holds production's connection strings as a backup reference but isn't read by the app.
- **To redeploy after a code change:**
  ```bash
  cd ~/Documents/Sync-Shared/Projects/training-portal
  npx vercel --prod
  ```
  There's no auto-deploy on push — this manual step is required every time, and CI passing/failing doesn't gate it.
- **Environment variables** (`DATABASE_URL`, `DIRECT_URL`) are already set in Vercel (Production). If you rotate the Supabase password, update both `.env.local` locally and the Vercel env vars (`npx vercel env rm/add DATABASE_URL production`), then redeploy.
- **Database migrations:** `npx prisma migrate dev` locally to create a new migration, then `npx prisma migrate deploy` to apply it — **but note** `prisma.config.ts` only auto-loads `.env` (production), not `.env.local` (staging), so a bare `migrate deploy`/`migrate dev` targets **production first**, the opposite of the safe order. Export `.env.local`'s `DATABASE_URL`/`DIRECT_URL` explicitly (or use a small script that loads them via `dotenv` and spawns the Prisma CLI) to target staging instead. The build doesn't run migrations automatically — run `migrate deploy` by hand after any schema change.
- **A daily Vercel Cron** (`vercel.json`, added 2026-08-15) hits `/api/cron/cleanup-sessions` to delete expired/long-revoked login sessions — see `CLAUDE.md` for detail.

---

## Known limitations (accepted for pilot scale, worth revisiting before a wider rollout)

- ~~No login rate limiting / lockout~~ — fixed 2026-08-10, Upstash Redis-backed (see `CLAUDE.md`).
- **No "forgot password" self-service flow** — self-service *change* (knowing your current password) exists now (sidebar "Change password"), but there's still no unauthenticated reset-by-email flow; a forgotten password requires another admin to reset it.
- ~~Single shared database for dev and prod~~ — fixed 2026-08-10, separate staging Supabase project (see Deployment above).
- ~~CSV/XLSX export endpoint CSRF exposure~~ — fixed 2026-08-10, synchronizer-token pattern (see `CLAUDE.md`'s Reporting & Exports section).
- **Argon2 is a native Node module.** It's deployed fine on Vercel (verified — login/session flows work in production), but if you ever change hosting providers, confirm native module support first.
- **Session rows never used to be cleaned up** — fixed 2026-08-15, daily Vercel Cron.

---

## Troubleshooting

- **"Invalid username or password"** — could be wrong credentials, a deactivated/deleted account, or (for consultants) their session was already revoked by a password reset elsewhere. Check the Audit Logs for `LOGIN_FAILED` entries with that username.
- **A page redirects you straight to the dashboard** — that's the RBAC check working as intended; the logged-in role doesn't have access to that page.
- **Video won't embed** — the Drive link has to be a `drive.google.com` file **share** link (`.../file/d/<id>/view` or `?id=<id>` form). If the file's sharing setting is "Restricted," the embed will show an access-denied message to viewers even though the link parsed fine — check the Drive file's sharing settings.
- **Export downloads an empty file** — check your filters; an empty result set still downloads a valid CSV/XLSX with just the header row.

---

## Security review notes (Phase 6)

A permissions review of every server action and page found and fixed one real issue before this went live: the Reports/Exports filter logic let a role-scoped filter (e.g. `coordinatorId`) silently override the RBAC visibility scope instead of narrowing within it, which could have let a Coordinator or Location Manager view or export data outside their scope by editing the URL's query parameters. Fixed and verified against the real database (see commit `e0f646a`). A minor login timing side-channel (distinguishing "no such user" from "wrong password" by response time) was also closed in the same pass.

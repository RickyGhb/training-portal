# Training Portal — Admin Guide

Handoff doc for whoever runs this day to day. For build history and phase-by-phase detail, see `Build-Progress.md` in this folder. For the original spec, see `Prompt.md`, `Business-Friendly Product Blueprint.md`, `Technical Implementation Blueprint.md`.

**Code:** `~/Documents/Sync-Shared/Projects/training-portal`
**Live URL:** https://training-portal-flame.vercel.app
**Local dev:** `cd ~/Documents/Sync-Shared/Projects/training-portal && npm run dev` → http://localhost:3000

---

## First things to do

1. **Log in as CEO and change the password.** Username `CEOAdmin`, starter password `IamAdminCeo@123$` — this was only ever meant for initial setup. Log in, go to the Consultants/Managers area... actually there's no self-service "change my own password" screen yet (only admins resetting *other* users' passwords). To change the CEO's own password right now, use `Reset Password` from another CEO account, or ask me to add a self-service "change my password" screen if you want one before going live for real.
2. **Create your locations** (Locations page) — these are your branches/offices.
3. **Create your Managers / Location Managers / Coordinators** as needed (Users section). CEO can create any role; each role can only create roles below it — see the hierarchy below.
4. **Build the catalog** before assigning anything to consultants:
   - Training Paths → Courses → Videos (in that order, or any order — they're independent until you link them)
   - Add a video by pasting its Google Drive **share link** (the "Share" URL, not the raw file URL) — the app converts it to an embeddable preview automatically
   - Attach videos to Courses, attach Courses to Training Paths, using the "Manage videos" / "Manage courses" links on each list
5. **Assign training** — open a consultant's "Training & progress" page (from the Consultants list) to set their primary Training Path and any extra individual Courses.

---

## Role hierarchy

```
CEO > Manager > Location Manager > Coordinator > Consultant
```

| Role | Can create | Scope |
|---|---|---|
| CEO | Everyone | Everything, everywhere |
| Manager | Location Manager, Coordinator, Consultant | Everyone except CEO/Manager accounts, no location restriction |
| Location Manager | Coordinator, Consultant | Only their own location |
| Coordinator | Consultant | Only their own consultants |
| Consultant | — | Only themselves |

A Coordinator can be **independent** (no location, no Location Manager above them) — the CEO sets this up by leaving the location field blank when creating the coordinator.

---

## What each role sees

- **CEO** — everything: user management, catalog, reports, exports, audit logs, notifications.
- **Manager** — everything except CEO/Manager account management; can manage videos and export reports.
- **Location Manager** — confined to their location; can manage videos and export reports for their location.
- **Coordinator** — only their own consultants; can view reports for just their consultants, no exports.
- **Consultant** — their own dashboard, "My Courses," and video player. Nothing administrative.

---

## Everyday operations

- **Deactivate vs. Delete**: Deactivate blocks login and hides the account from default lists but keeps everything reversible. Delete is a soft delete (data and history are preserved, but the account is gone from all operational lists — it still shows up in report filters under "Deleted (archived)").
- **Password resets** sign the user out of every existing session immediately.
- **Bulk Reassignment** moves multiple consultants to a different coordinator at once (Users → Bulk Reassignment).
- **Notifications** (CEO only) fire automatically for: a Manager exporting a report, any password reset, and any consultant deletion. Nothing else pages the CEO — routine edits and assignments don't.
- **Audit Logs** (CEO only) has every sensitive action, filterable by type and date.

---

## Deployment

- **Hosting:** Vercel, project `ricky-s-team1/training-portal`, logged in as `rickyb7999-8701`
- **Database:** Supabase project "Training-Project," region us-west-2 — the same database is used for local dev and production right now (no separate staging DB). Be mindful of that when testing locally.
- **To redeploy after a code change:**
  ```bash
  cd ~/Documents/Sync-Shared/Projects/training-portal
  npx vercel --prod
  ```
- **Environment variables** (`DATABASE_URL`, `DIRECT_URL`) are already set in Vercel (Production). If you rotate the Supabase password, update both `.env.local` locally and the Vercel env vars (`npx vercel env rm/add DATABASE_URL production`), then redeploy.
- **Database migrations:** `npx prisma migrate dev` locally to create a new migration, then `npx prisma migrate deploy` (or just redeploy — the build doesn't currently run migrations automatically, so run `migrate deploy` by hand after any schema change, before or right after deploying the code that depends on it).

---

## Known limitations (accepted for pilot scale, worth revisiting before a wider rollout)

- **No login rate limiting / lockout.** Failed logins are logged (`LOGIN_FAILED` in the audit log) but nothing blocks repeated attempts. Fine for ~200 known internal users; would need a proper rate limiter (e.g. Upstash Redis, since Vercel functions are stateless) before this is internet-facing at larger scale.
- **No self-service password change or "forgot password" flow** — by design, per the original spec (no email flow was in scope). All password changes go through an admin's "Reset Password" action, including the CEO's own.
- **Single shared database for dev and prod.** Convenient for a pilot, but means local testing writes real rows into the same DB the live app reads. Consider a separate dev database before onboarding real users at volume.
- **The CSV/XLSX export endpoint is a plain `GET` route** (not a form-submitted server action), so it doesn't get Next.js's built-in Server Action CSRF protection. A malicious link could trick a logged-in admin into triggering an export they didn't intend to (creates a spurious audit log entry, possibly a false "Manager exported a report" CEO notification). It cannot leak the exported data itself to an attacker — the browser blocks cross-origin reads of the response — so the impact is log noise, not a data breach. Worth hardening with a CSRF token if this becomes a concern.
- **Argon2 is a native Node module.** It's deployed fine on Vercel (verified — login/session flows work in production), but if you ever change hosting providers, confirm native module support first.

---

## Troubleshooting

- **"Invalid username or password"** — could be wrong credentials, a deactivated/deleted account, or (for consultants) their session was already revoked by a password reset elsewhere. Check the Audit Logs for `LOGIN_FAILED` entries with that username.
- **A page redirects you straight to the dashboard** — that's the RBAC check working as intended; the logged-in role doesn't have access to that page.
- **Video won't embed** — the Drive link has to be a `drive.google.com` file **share** link (`.../file/d/<id>/view` or `?id=<id>` form). If the file's sharing setting is "Restricted," the embed will show an access-denied message to viewers even though the link parsed fine — check the Drive file's sharing settings.
- **Export downloads an empty file** — check your filters; an empty result set still downloads a valid CSV/XLSX with just the header row.

---

## Security review notes (Phase 6)

A permissions review of every server action and page found and fixed one real issue before this went live: the Reports/Exports filter logic let a role-scoped filter (e.g. `coordinatorId`) silently override the RBAC visibility scope instead of narrowing within it, which could have let a Coordinator or Location Manager view or export data outside their scope by editing the URL's query parameters. Fixed and verified against the real database (see commit `e0f646a`). A minor login timing side-channel (distinguishing "no such user" from "wrong password" by response time) was also closed in the same pass.

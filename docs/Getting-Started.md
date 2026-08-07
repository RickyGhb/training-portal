# Training Portal — Getting Started

This is the "start here" document. It explains what the app is, how it's put together, and how to pick the work back up on a different machine. For day-to-day admin operations (creating users, exporting reports, troubleshooting) see `Admin-Guide.md` in this same folder. For the phase-by-phase build history, see `Build-Progress.md`.

---

## What this is

A training portal for a consulting company. It manages:

- **People**, in a strict role hierarchy (CEO → Manager → Location Manager → Coordinator → Consultant)
- **A training catalog** (Training Paths made of Courses, Courses made of Videos embedded from Google Drive)
- **Assignments** (each Consultant gets one primary Training Path, plus optional extra Courses)
- **Progress tracking** (Consultants mark videos complete; everyone above them can see rollups)
- **Reporting** (dashboards, filtered exports to CSV/XLSX, a full audit log, and CEO notifications for a small set of sensitive actions)

It's a single Next.js application (App Router, TypeScript) with a Postgres database (Supabase), deployed on Vercel.

---

## The mental model: three places, three purposes

This trips people up, so it's worth being explicit:

| Where | What it is | What happens if you close your laptop |
|---|---|---|
| **This folder** (`~/Documents/Sync-Shared/Projects/training-portal`) | The source code. Where you make changes. | Nothing — this is just files on disk. |
| **Vercel** (`training-portal-flame.vercel.app`) | The live, running app. A copy of the code, built and hosted on Vercel's servers. | **Nothing.** The live app keeps running regardless of your laptop's state — it's not connected to your laptop at all once deployed. |
| **Supabase** | The database. Also cloud-hosted, also independent of your laptop. | Nothing. |

**The one-directional link:** code changes only reach the live app when someone explicitly runs `npx vercel --prod` from this folder. There's no auto-deploy, no GitHub Actions, nothing watching for changes. Vercel doesn't know a change happened until you tell it to build and ship one.

**Why this folder now syncs across your two laptops:** the folder lives inside `~/Documents/Sync-Shared/`, which is kept in sync by Syncthing (you'll see a `.stfolder` marker if you look). That means edits made on one laptop show up on the other automatically — but it's a *files* sync, not a *deployment*. Editing a file on Laptop B doesn't touch the live Vercel app until you run the deploy command from wherever you're working.

**`node_modules/` and `.next/` are intentionally excluded from the sync** (see `.gitignore`) — they're regenerable build artifacts, often huge, and can include OS-specific compiled code (this project uses `argon2`, a native module). On a laptop where you haven't run this project yet, do:

```bash
cd ~/Documents/Sync-Shared/Projects/training-portal
npm install
```

before running `npm run dev` or `npm run build` for the first time.

---

## Picking up work on the other laptop

1. Make sure Syncthing has finished syncing (check its tray icon / status — the folder should show as up to date).
2. `cd ~/Documents/Sync-Shared/Projects/training-portal`
3. `npm install` (first time on that machine only, or whenever `package.json` changed)
4. `npm run dev` → http://localhost:3000 for local development, **or**
5. `npx vercel --prod` to ship a change you've already made and tested

The Vercel project link travels with the folder (`.vercel/project.json` is a small file, not excluded from sync), so `vercel` commands work immediately on either machine without re-linking.

**One thing to know:** local dev and the live production app currently point at the *same* Supabase database (see `Admin-Guide.md`'s "Known limitations" section). If you run the app locally and create test data, that data is visible in the real production app too, and vice versa. Be careful what you create while testing.

---

## The role hierarchy, in plain terms

```
CEO
 └─ Manager
     └─ Location Manager
         └─ Coordinator
             └─ Consultant
```

- **CEO** — one person, full access to everything. Only role that can create Locations, Training Paths, and Courses.
- **Manager** — operates across all locations. Can create/manage everyone except other CEOs/Managers.
- **Location Manager** — confined to one location. Manages Coordinators and Consultants within it.
- **Coordinator** — owns a set of Consultants directly. Can be tied to a location, or "independent" (CEO's choice at creation time).
- **Consultant** — the end learner. Sees only their own assigned training. No administrative access at all.

Each role can only create accounts for roles *below* it, and can only see/manage what falls in their own scope — this is enforced on the server for every action, not just hidden in the UI.

---

## The catalog model, in plain terms

Three building blocks, all reusable:

```
Training Path  →  made of one or more Courses (ordered)
Course         →  made of one or more Videos (ordered)
Video          →  a Google Drive file, embedded
```

A Course can belong to multiple Training Paths. A Video can belong to multiple Courses. Build these once, reuse everywhere.

A Consultant's actual assigned content is the union of:
1. Every Course in their **primary Training Path** (exactly one, set by an admin)
2. Any **extra Courses** assigned individually (zero or more)

If a Course shows up both ways, it's just shown once — the app resolves this automatically and labels each Course "Assigned by path," "Extra course," or both, wherever a Consultant's content is displayed.

---

## First login walkthrough (for a brand-new CEO)

1. Go to the live URL, log in with the seeded `CEOAdmin` account (see `Admin-Guide.md` for the starter password).
2. **Locations** — add your branches/offices, if you have more than one. Skip this if everyone's remote/unified.
3. **Managers / Location Managers / Coordinators** — build out your org chart under "Users" in the sidebar. Every account needs a username and password you set (there's no self-service signup or email invite flow — an admin creates every account).
4. **Training Paths, Courses, Videos** — build your curriculum. Order matters for Paths and Courses (drag isn't supported yet — use the up/down arrows). Videos need a Google Drive **share link**; the app converts it automatically.
5. **Assign training** — open any Consultant's "Training & progress" page and set their primary Training Path. Add extra Courses if needed.
6. From here on, day-to-day work is: Coordinators create their own Consultants, everyone reviews progress in Reports, and the CEO occasionally checks Audit Logs / Notifications.

---

## What a Consultant actually experiences

They log in and see two things only: **My Dashboard** (their own progress — percent complete, videos pending, last completed item) and **My Courses** (their assigned Courses, each with a video list). Opening a video shows the embedded Drive player and a "Mark as Completed" button. That's the entire Consultant-facing surface — deliberately minimal.

---

## Where things live in the codebase (quick orientation)

- `src/lib/auth/rbac.ts` — the single source of truth for who can do what. Every server action and page checks permissions through this file.
- `src/lib/content-resolution.ts` — the "what can this Consultant actually see" logic (the union described above).
- `src/lib/reports.ts` — dashboard aggregates and the exportable report row data.
- `src/app/(app)/` — everything behind login, one folder per feature area (`users/`, `catalog/`, `reports/`, etc.). Each has a `page.tsx` (the screen) and usually an `actions.ts` (the server-side mutations, each one re-checking permissions independently).
- `src/app/login/`, `src/app/api/reports/export/` — the two things that aren't behind the standard app layout: the public login page and the one plain REST endpoint (file download).
- `prisma/schema.prisma` — the entire data model in one file.

---

## Questions this doc doesn't answer

- Detailed admin operations (resetting a password, bulk reassignment, reading the audit log) → `Admin-Guide.md`
- What's built vs. not yet, and why specific decisions were made in each phase → `Build-Progress.md`
- The original product/technical specs this was built from → ask for `Prompt.md` and the two blueprint docs (these stay in the Obsidian vault at `Setup-Docs-Vault/Training_Website/`, not duplicated here, since they're planning artifacts rather than living reference docs)

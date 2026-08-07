# Training Portal

A training portal for a consulting company: role-based user management, a reusable training catalog (paths → courses → videos), assignment and progress tracking, and reporting.

**Live:** https://training-portal-flame.vercel.app

## Start here

- **New to this project?** Read [`docs/Getting-Started.md`](docs/Getting-Started.md) first — what this is, how the pieces fit together, and how to pick up work on a different machine.
- **Running this day to day?** See [`docs/Admin-Guide.md`](docs/Admin-Guide.md) — roles, operations, deployment, troubleshooting.
- **Curious what's built and why?** See [`docs/Build-Progress.md`](docs/Build-Progress.md) — the phase-by-phase build log.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll need a `.env.local` with `DATABASE_URL` and `DIRECT_URL` pointed at the Supabase project — ask whoever has access, or see `docs/Admin-Guide.md`.

## Stack

Next.js (App Router, TypeScript) · Prisma + PostgreSQL (Supabase) · Tailwind · argon2 password hashing · deployed on Vercel.

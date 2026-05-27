# CasGrid

Live job & crew scheduling for **Casone Electrical**. Create jobs, assign staff, auto-schedule the
week, and have every change appear instantly on every device — phones, tablets, and office PCs.

Built with **Vite + React 19 + TypeScript + Tailwind**, with **Supabase** (Postgres + Realtime) as
the shared backend. No login — anyone with the link shares the same live data (keep the link
internal to your team).

## Project structure

```
frontend/   → the web app (Vite + React + Tailwind). Run all npm commands here. Holds .env.
backend/    → Supabase database migrations (backend/supabase/migrations/) + a placeholder server/.
vercel.json → tells Vercel to build the app from frontend/.
```

---

## How live sync works

Every device opens the same website and talks to the same Supabase project. When someone saves a
change it's written to Supabase, and Supabase **Realtime** instantly pushes it to every other open
device. If a device loses connection or sleeps, it automatically re-pulls the latest data when it
comes back (a small **Live / Sync… / Offline** indicator sits in the top bar).

---

## First-time setup

### 1. Create the Supabase project (the shared database)

1. Go to <https://supabase.com> → **New project**. Pick a name and a strong database password.
2. Open **SQL Editor → New query**, paste the entire contents of
   [`backend/supabase/migrations/001_initial_schema.sql`](backend/supabase/migrations/001_initial_schema.sql),
   and click **Run**. This creates the tables, permissions, and turns on Realtime.
   > ⚠️ `001` is a full reset — only run it on a fresh/empty project. It erases existing data.
3. Go to **Project Settings → API** and copy two values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### 2. Run it locally (optional, for testing)

```bash
cd frontend
npm install
cp .env.example .env.local      # then paste your Supabase URL + anon key into it
npm run dev
```

Open the printed URL, then click **Settings → Reset to Demo** to load starter data.
(The `.env` / `.env.local` file lives in `frontend/`.)

### 3. Deploy so coworkers can use it (Vercel)

1. Push this code to a GitHub repo you own (see **Moving to your own repo** below).
2. Go to <https://vercel.com> → **Add New → Project** → import that repo. The included `vercel.json`
   tells Vercel to install and build from the `frontend/` folder automatically.
3. Under **Environment Variables**, add the same two values from step 1:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. Vercel gives you a URL (e.g. `casgrid.vercel.app`).
5. Open the URL → **Settings → Reset to Demo** once to seed data, then share the link with your crew.

> Changing env vars later? Vercel only applies them on a new deployment — hit **Redeploy** after edits.

---

## Moving to your own repo

To host it under your own GitHub account:

```bash
git remote add origin https://github.com/<your-username>/casgrid.git
git push -u origin main
```

---

## Troubleshooting

**Changes save but don't appear live on other devices.**
Realtime isn't switched on for the database. In Supabase: **SQL Editor → New query**, paste and run
[`backend/supabase/migrations/002_enable_realtime.sql`](backend/supabase/migrations/002_enable_realtime.sql)
(safe to run anytime — it never deletes data). The query at the end should list all 6 tables. Also
check **Database → Replication** shows the `supabase_realtime` publication with those tables.

**"Database connection failed" / "NetworkError", but the deployed site works.**
Your local network (a corporate firewall or an antivirus that inspects HTTPS) may be blocking the
secure connection to Supabase. Test on a different network (e.g. a **phone hotspot**), or turn off
"HTTPS / SSL scanning" in your antivirus. This only affects your machine — coworkers on normal
networks are unaffected.

**"Database connection failed" on load (env vars).**
The app can't reach Supabase. Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
correctly (in `frontend/.env` locally, or in Vercel's Environment Variables), then redeploy/reload.

**The top-bar indicator says "Offline" or "Sync…".**
"Offline" = this device has no internet (changes save and sync when it returns). "Sync…" =
connecting to live updates. "Live" (green) = everything is syncing in real time.

---

## Scripts

Run these from the `frontend/` folder:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local dev server |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

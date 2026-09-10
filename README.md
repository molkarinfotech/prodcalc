# Family Time Log — SvelteKit + Supabase

A simple, mobile-friendly time tracker for families and kids. Log how long each day goes to routine tasks, with a clear split between **productive** and **non-productive** (screen/leisure) time.

## What's in the app

- **Timer mode** — tap a task to start a live timer, tap again (or hit Stop) to save the logged minutes.
- **Quick entry mode** — pick a task + enter minutes + optional note for end-of-day logging.
- **Per-member logging** — switch between family members (Parent, Kid 1, Kid 2…) so everyone's time stays separate.
- **Day selector** — week strip at the top to flip between today and previous days.
- **Daily summary** — productive vs leisure minutes, percentage split, and a list of today's entries (with delete).

## Tech stack

- **SvelteKit** (SPA mode, `adapter-auto`) — tiny bundles, works as a PWA installable on phones.
- **Supabase** — Postgres `tasks` + `time_entries` tables, client via `@supabase/supabase-js`. Auth is optional; the app works with a shared family setup (RLS allows family members to read/write).
- **No Tailwind** — hand-rolled CSS, mobile-first, big touch targets.

## Supabase setup

1. Create a Supabase project at https://supabase.com
2. Go to **SQL Editor** and run `supabase/schema.sql` (creates `tasks` and `time_entries` tables + default tasks + RLS policies).
3. Copy the project's **URL** and **anon public key** from Settings → API.
4. Create a `.env` file in the project root:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Run `npm run dev` and open http://localhost:5173.

## Env variables

| Variable | Where to get it | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project dashboard → Settings → API | yes |
| `VITE_SUPABASE_ANON_KEY` | Same page, "anon public" key | yes |

Without these, the app falls back to the default task list and shows no entries (offline demo mode).

## Deployment

### Vercel

1. Connect the GitHub repo to a new Vercel project.
2. Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel project settings.
3. Deploy — `vercel.json` is already present; SvelteKit's `adapter-auto` produces a Vercel-friendly build.

### Other static hosts

`npm run build` outputs to `build/` (or `dist/` depending on adapter). Serve the `build/` directory as static files.

## Default tasks

The `tasks` table comes pre-populated with 10 tasks split into productive (Reading, Math, Writing, Science, Exercise, Chores, Music) and non-productive (TV, Games, Social). Edit or add more in the Supabase dashboard.

## File layout

```
time-log-app/
├── src/
│   ├── lib/
│   │   ├── supabase.ts   # Supabase client + data helpers
│   │   ├── tasks.ts      # Default task list
│   │   └── members.ts    # Family member list
│   └── routes/
│       └── +page.svelte  # The whole app (single page)
├── static/
│   ├── manifest.json     # PWA manifest
├── supabase/
│   └── schema.sql        # Run in Supabase SQL Editor
├── .env.example          # Template for env vars
├── vercel.json           # Vercel config
└── svelte.config.js
```

## Next steps (optional)

- Add Supabase Auth (Google login) so each family member has their own row ownership.
- Add a shared family dashboard (read everyone's entries).
- Add weekly summary view.
- Add PWA icons (192/512 PNGs in `static/`).

# Workout Tracker

Mobile-first PWA for following a training program and logging every set. Works offline on the device; optionally syncs between devices through Supabase.

## Run locally

```bash
corepack enable   # once, provides pnpm
pnpm install
pnpm dev          # http://localhost:3000
pnpm dev:phone    # also reachable from a phone on the same Wi-Fi: http://<laptop-ip>:3000
```

Without Supabase settings the app runs fully on the device (localStorage). See `CLAUDE.md` for commands and conventions, and `data/PROJECT_PLAN.md` for the plan.

## Set up sync (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `0002_rls.sql` (or `supabase db push` with the Supabase CLI).
3. **Authentication → URL configuration:** set the Site URL to where the app runs (e.g. `https://your-app.vercel.app`) and add `http://localhost:3000/auth/callback` and `https://your-app.vercel.app/auth/callback` to the redirect URLs.
4. **Authentication → Emails → Magic link:** add the code to the template so sign-in also works from the installed app (where links open in the browser instead):
   ```html
   <p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```
5. Copy `.env.example` to `.env.local` and fill in the project URL and anon/publishable key (Project settings → API).
6. Restart `pnpm dev`, open Settings and sign in. Anything already logged on the device is uploaded on first sign-in.

Row level security restricts every table to its owner; `pnpm test` runs the migrations and RLS checks against an embedded Postgres (PGlite).

## Deploy (Vercel)

1. Push this repository to GitHub and import it at [vercel.com/new](https://vercel.com/new) (framework: Next.js; the defaults are right — Vercel detects pnpm from `pnpm-lock.yaml`).
2. In the Vercel project settings → Environment Variables, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production and Preview), then redeploy.
3. In Supabase → Authentication → URL configuration, set the Site URL to the Vercel URL and add `https://<your-app>.vercel.app/auth/callback` to the redirect URLs.
4. On your phone, open the Vercel URL:
   - **iPhone (Safari):** Share → Add to Home Screen.
   - **Android (Chrome):** menu → Install app.

The service worker only runs in production builds over HTTPS (or on `localhost`). After installing, the app opens and logs workouts without a connection; queued changes sync when you're back online. Each deploy gets a new service-worker version, so the offline copy updates on the next launch.

To check the production build locally: `pnpm build && pnpm start`.

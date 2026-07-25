# Jaune — Production Deploy Checklist (Vercel + Supabase)

Drafted by the PM check-in on 2026-07-23, covering the "webapp to production" window (target: live by Jul 29 — see `PM_PLAYBOOK.md`). This is a working checklist, not committed app code — check items off as you go and delete this file once the deploy is done and folded into the log.

## 0. Prerequisites (bobo to confirm — unknown from the repo)

- [x] Supabase **production** project created — confirmed by bobo 2026-07-23: project ref `evrvllkvhutmlnupaqcg` (dashboard: https://supabase.com/dashboard/project/evrvllkvhutmlnupaqcg)
- [x] Vercel project created and linked to the `jaune` GitHub repo — confirmed by bobo 2026-07-23: `locusai` under the `bnash058-gmailcoms-projects` team (https://vercel.com/bnash058-gmailcoms-projects/locusai)
- [x] Domain live — confirmed 2026-07-23: **jaune.space** resolves, SSL is provisioned, and the landing page (preview mode with template data) renders correctly at both `jaune.space` and `www.jaune.space`; `/login` also loads
- ~~Google Cloud OAuth client for Calendar~~ — **not needed.** Bobo removed the Google Calendar integration entirely on 2026-07-23 (see note below). Google sign-in (`supabase.auth.signInWithOAuth({ provider: 'google' })`) is unaffected — that's configured directly in Supabase's dashboard (Auth → Providers), not via this app's env vars.

## 1. Environment variables

Pulled from `.env.local.example` plus what the code actually reads.

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server Supabase clients | from prod Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only DB writes | **never** expose to client bundle; Vercel "sensitive" env var |
| `ANTHROPIC_API_KEY` | `lib/ai/client.ts`, brief/checkin/retrospective generation | prod key, watch spend once beta users are on |
| `SEED_USER_EMAIL` | `scripts/seed.ts` | dev-only, don't set in Vercel prod env |
| `CRON_SECRET` | not yet used — needed once the cron endpoint exists (see §5) | generate a random 16+ char string now so it's ready for Jul 28 |

Set these in Vercel dashboard → Project → Settings → Environment Variables, scoped to Production (and Preview if you want preview deploys to hit a staging Supabase project instead of prod).

**Status as of 2026-07-23:** all of the above except `CRON_SECRET` are already set on `locusai`. `CRON_SECRET` isn't needed yet (§6). Env var setup for this deploy window is effectively done.

⚠️ Two variables show a **"Needs Attention"** badge in the Vercel UI: `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Vercel's docs don't spell out this badge directly, but the screenshots give a strong clue: both flagged vars are scoped to **All Environments**, while `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (see removal note below — not flagged before removal) were scoped to **Production and Preview** only and marked **Sensitive**. So the badge is very likely Vercel nudging you that these two high-privilege secrets (the service role key bypasses RLS entirely; the Anthropic key controls API spend) are sitting in a scope where they can't be marked Sensitive and are exposed to `vercel env pull` for local/preview dev. **Suggested fix:** narrow both to Production + Preview and enable Sensitive.

**Google Calendar integration removed (2026-07-23):** bobo decided to cut this feature. Removed from the codebase: `lib/google/calendar.ts`, `lib/db/calendar.ts`, `lib/ai/calendar-context.ts`, `app/actions/calendar.ts`, `app/api/calendar/*`, `app/auth/google-calendar/callback/*`, the `CalendarEvent` type, and all references in `lib/ai/context.ts`, `lib/ai/prompts.ts`, and `app/api/pulse/route.ts` (brief/pulse generation no longer queries or mentions calendar events). Also stripped the "Google Calendar data" section and related mentions from `app/privacy/page.tsx` (bumped its Last Updated date), and removed `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXT_PUBLIC_APP_URL` from `.env.local.example` since nothing reads them anymore. **Decided 2026-07-23:** bobo wants to keep `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXT_PUBLIC_APP_URL` on Vercel and the `google_calendar_tokens`/`calendar_events_cache` tables in Supabase — Calendar may come back later, no cleanup needed for now. Everything is uncommitted in the working tree for review before committing.

## 2. Supabase production setup

- [x] Auth → URL Configuration: confirmed 2026-07-23 — Site URL is `https://jaune.space`; Redirect URLs allow-list has `jaune.space/auth/callback` and `jaune.space/reset-password`. Two stale `locusai.space` entries (the pre-rebrand domain) are still in the list — harmless but worth deleting as cleanup so nothing points at a domain you may not control long-term.
- [x] Auth → Providers: Google provider confirmed configured 2026-07-23 (Client ID/Secret entered in the Supabase dashboard, separate from the app's own env vars) — powers `signInWithOAuth({ provider: 'google' })` on the login page.

### Google Cloud OAuth consent screen (Google Auth Platform console)

Set up 2026-07-23: App name set to "Jaune," logo uploaded (rendered from `app/icon.svg` — `jaune-logo-512.png`), home page (`https://jaune.space`) and privacy policy link (`https://jaune.space/privacy`) set, Authorized domains cleaned up to just `jaune.space` and `evrvllkvhutmlnupaqcg.supabase.co`.

- [x] Branding page filled in and saved (app name, logo, home page, privacy policy link, authorized domains) — confirmed 2026-07-23.
- [ ] **Publishing status is currently Testing.** Only emails under Audience → Test users can complete Google sign-in (currently just `borisnikaz@gmail.com`, cap is 100 total, no verification needed at this stage). Everyone else is blocked with an access-denied screen after picking an account — confirmed the account picker itself shows *any* Google account logged into the browser regardless of authorization, so picking a non-test account is the way to verify the block is real. Magic-link email sign-in is unaffected either way.
- [ ] **Correction from earlier in this session:** the "Choose an account to continue to `evrvllkvhutmlnupaqcg.supabase.co`" screen will keep showing the raw Supabase domain instead of "Jaune" regardless of Testing vs. Production status — that only changes once Google approves brand verification (confirmed via Google's own support docs). Don't expect the branding to appear just from saving the Branding page.
- [ ] **Before recruiting beta users:** add each beta tester's email under Audience → Test users (covers up to ~100, plenty for a 10-20 person beta). They'll still see the raw domain + a "Google hasn't verified this app" warning screen — expected, not a bug, and fine for people who already trust you.
- [ ] **Before the Product Hunt public launch — submit for verification.** Steps per Google's official guide ([Submitting your app for verification](https://support.google.com/cloud/answer/13461325)):
  1. Confirm the required APIs are enabled and OAuth consent screen fields are complete (done above).
  2. Confirm scopes are the narrowest needed — Jaune only requests `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, all **non-sensitive**, so this should skip the heavier security-assessment path required for sensitive/restricted scopes (no scope justification or demo video expected, per the guide — the App name/logo/domain review still applies).
  3. Click **Publish app** (Audience tab) to move from Testing to Production — apps in Testing/development aren't eligible for verification submission.
  4. Click **Prepare for Verification**, review the summary of everything configured, **Save and Continue**.
  5. Click **Submit for Verification** to start the review. All correspondence happens by email to the project's owners/editors — keep `borisnikaz@gmail.com`'s access to this Google Cloud project current.
  6. Likely also need to verify ownership of `jaune.space` via Google Search Console if not already linked to this Google Cloud project (flagged in the Branding page's Authorized domains help text).
  - Start this well before the launch date — verification timing isn't guaranteed, budget more than a few days of slack.
- [ ] Email provider: Supabase's built-in SMTP has low sending limits and is not reliable for production magic-link delivery (`login/page.tsx` falls back to `signInWithOtp`) — configure a real SMTP provider (Resend, Postmark, etc.) under Auth → SMTP Settings before real users hit the magic-link path
- [ ] Confirm Row-Level Security is enabled on all tables (should already be true from `002_rls_policies.sql`) — spot check in the Supabase dashboard, don't just trust the migration ran

## 3. Migrations

Repo has 29 migration files in `supabase/migrations/`, correctly ordered by filename (`002b` sorts between `002`/`003`, `019b` between `019`/`020` — no manual reordering needed).

```bash
supabase login
supabase link --project-ref evrvllkvhutmlnupaqcg
supabase db push
```

- [ ] Run `supabase db push` against the prod project and confirm all 29 files applied (check `supabase_migrations.schema_migrations` row count)
- [ ] Do **not** hand-edit the prod schema in the Supabase SQL editor for anything that should be a migration — keep the migration history authoritative (per current Supabase guidance: prefer CI/CD-driven `db push` over local-machine pushes long-term, but for this first deploy a local `db push` is fine)

## 4. Vercel deploy + domain

- [x] Import the repo in Vercel — confirmed 2026-07-23, `locusai` is linked and env vars are populated
- [x] Add environment variables (§1) — done, see status note above
- [x] Deploy, verify build succeeds — confirmed 2026-07-23, `jaune.space` serves the built app (landing/preview page + `/login` both render)
- [x] Attach the custom domain, verify DNS, wait for SSL to provision — confirmed 2026-07-23, `jaune.space` and `www.jaune.space` both resolve over HTTPS
- [x] Confirm Supabase Auth → URL Configuration redirect URLs point at `jaune.space` — confirmed 2026-07-23 (see §2)

## 5. Smoke test (target Jul 27)

Two layers — the repo already has a prompt-quality smoke test but nothing that exercises the deployed app end-to-end yet:

- [ ] **Prompt-level** (existing): `node scripts/smoke-test-prompt.mjs` — runs `tier1`/`tier0`/`retro` scenarios against the real system prompts. Cheap to run again post-deploy since it hits the Anthropic API directly, not the deployed app.
- [ ] **App-level** (manual, do on the live domain): sign up → confirm magic-link/Google OAuth email arrives and completes → onboarding → create a goal + habit → submit a check-in → load Daily Brief and confirm a real Claude-generated brief renders (not a cached/placeholder one) → log a habit → confirm `/api/status` reflects it. (No Calendar connect step anymore — that feature was removed 2026-07-23.)
- [ ] Consider adding a small unauthenticated `/api/health` route (DB connectivity + env var presence check) for uptime monitoring — flagging this as a suggestion, not building it now, since it's a new production surface and not yet an agreed tracker task.

## 6. Cron + logging (target Jul 28–29)

Per `IMPLEMENTATION_PLAN.md`: "Use Vercel Cron to pre-generate briefs; no notification center needed." Nothing exists yet (no `vercel.json`, no cron route) — this is next-run's work, noted here so the design is ready:

- Add `vercel.json` with a `crons` entry (e.g. daily at a fixed UTC hour) hitting a new `app/api/cron/generate-briefs/route.ts`
- Secure it with `CRON_SECRET` (Vercel auto-sends it as the `Authorization` header on cron-triggered requests) — compare against `process.env.CRON_SECRET` in the route
- Vercel Crons only fire on Production deployments, not Preview — fine here since it's prod-only work anyway
- Route should loop active users, generate/cache briefs the same way `app/api/brief/generate/route.ts` does, and log failures per-user rather than aborting the whole run on one user's error
- Logging: Vercel captures `console.log`/`console.error` automatically in the dashboard's Logs tab — no extra setup needed for basic visibility; `IMPLEMENTATION_PLAN.md` Phase 3 mentions "structured logging to Vercel logs" as a nice-to-have, revisit if debugging becomes painful

---

Sources checked (Jul 2026): Vercel Cron Jobs docs, Vercel env var management guides, Supabase CLI migration docs, Supabase's Google login guide, Google's "Submitting your app for verification" support article — noted here since tooling/policy specifics can shift and are worth re-verifying if this checklist is used much later than today.

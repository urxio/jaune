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
| `RESEND_API_KEY` | `lib/email.ts`, feedback form | **added 2026-07-26.** Optional — without it the feedback form still saves to the `feedback` table, it just doesn't email. Mark Sensitive. |
| `EMAIL_FROM` | `lib/email.ts` | `Jaune <feedback@jaune.space>` — `jaune.space` confirmed verified in Resend 2026-07-26, so there's no recipient restriction. Falls back to `onboarding@resend.dev` if unset, which only delivers to the address on the Resend account itself — **not** the feedback inbox. |
| `FEEDBACK_TO_EMAIL` | `app/api/feedback/route.ts` | bobo's feedback inbox — actual value lives in `.env.local` and Vercel, deliberately not in this public repo. If unset, no email is attempted (logged as a warning). |

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

Repo has 30 migration files in `supabase/migrations/`, correctly ordered by filename (`002b` sorts between `002`/`003`, `019b` between `019`/`020` — no manual reordering needed). `030_feedback.sql` was added 2026-07-26 for the feedback form and has **not** been applied yet — the form's API route returns a 500 until it is.

```bash
supabase login
supabase link --project-ref evrvllkvhutmlnupaqcg
supabase db push
```

- [ ] Run `supabase db push` against the prod project and confirm all 30 files applied (check `supabase_migrations.schema_migrations` row count)
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
- [ ] **Deploy-level** (new, added 2026-07-25): `node scripts/smoke-test-deploy.mjs https://jaune.space` — automated pass over the deployed app's unauthenticated surface. Read-only: public pages return 200 and contain expected copy, every API route returns 401 rather than 500 (a 500 there almost always means a missing env var on Vercel), the mobile Bearer path rejects a garbage token, `http://` redirects to `https://`, `www.` resolves, and two known regressions stay fixed (no `locusai.space` in shipped HTML, no Google Calendar text left in the privacy policy — a good proxy for whether the deploy is actually current). No DB writes, no Anthropic tokens; safe against production any time. Exits non-zero on failure, so it can go in CI later.
- [ ] **App-level** (manual, do on the live domain — the script deliberately can't cover this): sign up → confirm magic-link/Google OAuth email arrives and completes → onboarding → create a goal + habit → submit a check-in → load Daily Brief and confirm a real Claude-generated brief renders (not a cached/placeholder one) → log a habit → confirm `/api/status` reflects it. (No Calendar connect step anymore — that feature was removed 2026-07-23.)
- [ ] Consider adding a small unauthenticated `/api/health` route (DB connectivity + env var presence check) for uptime monitoring — flagging this as a suggestion, not building it now, since it's a new production surface and not yet an agreed tracker task.

## 6. Cron + logging (target Jul 28–29)

Per `IMPLEMENTATION_PLAN.md`: "Use Vercel Cron to pre-generate briefs; no notification center needed." Nothing exists yet (no `vercel.json`, no cron route).

**Investigated 2026-07-25 and deliberately not built.** Three findings, in order of how much they hurt:

**a) The data layer can't be called outside a user request.** `buildBriefContext()` fans out to `lib/db/*`, and all 46 of those call sites use `createClient()` from `lib/supabase/server.ts`, which reads `cookies()`/`headers()` and relies on RLS scoping the query to the signed-in user. A cron request has no user, so every one of those queries returns nothing. Pre-generating briefs therefore needs one of:

  - **Refactor** `lib/db/*` and `lib/ai/context.ts` to accept an injected Supabase client, so a service-role client can be passed in. Cleanest and reusable, but it edits ~19 existing lib files — needs bobo's go-ahead per the playbook rails, and shouldn't be done while the webapp window is still open.
  - **Self-call over HTTP**: mint a per-user session server-side (`auth.admin.generateLink` → `verifyOtp`) and POST to the existing `/api/brief/generate` with a `Bearer` token, reusing the mobile auth path added in `5bd8def`. Touches zero existing code, but it burns a magic-link token per user per day and leans on auth internals for a scheduling job. Works; feels like a trap to maintain.

**b) Vercel Hobby allows one cron run per day, fired at any point within the scheduled hour.** Jaune's briefs are per-user-timezone (`getUserLocalDate`), so a single fixed-UTC run lands at a sensible morning hour for one timezone band and the wrong hour for everyone else. Getting "generate at 5am local" needs an hourly cron → Pro plan ($20/mo), or an external hourly trigger (Supabase pg_cron / GitHub Actions) hitting the route. That's a spend decision, not a code one.

**c) The value is thin at beta scale.** Briefs already generate on demand and cache for the day, so pre-generation buys ~5–10s off first load. Against that: it spends Anthropic tokens every morning for users who may never open the app, and it's the machinery most likely to fail quietly at 5am. For a 10–20 person private beta, on-demand generation is the better trade.

**Recommendation: defer the brief-generation cron until after the beta**, and spend the Jul 28–29 window on the beta gating work in `BETA_PLAN.md` instead. Revisit when either (i) users complain about brief load time, or (ii) push notifications arrive — at which point pre-generation stops being a latency optimisation and starts being a prerequisite. If bobo wants it sooner, the refactor in (a) is the right version of it, not the self-call.

For whenever it is built, the mechanics that were verified:

- `vercel.json` with a `crons` entry pointing at `app/api/cron/generate-briefs/route.ts`
- Vercel sends `CRON_SECRET` as `Authorization: Bearer <secret>` — compare against `process.env.CRON_SECRET` and 401 otherwise; also available: an `x-vercel-cron-schedule` header on every invocation
- Crons fire on Production deployments only, not Preview
- Loop users, and catch per-user so one failure doesn't abort the run

**Logging** (the other half of this window, and genuinely cheap): Vercel captures `console.log`/`console.error` in the dashboard's Logs tab with no setup, and the existing routes already `console.error` their failure paths. Adequate for beta. `IMPLEMENTATION_PLAN.md` Phase 3's "structured logging" is a nice-to-have — revisit if debugging gets painful. The one gap worth closing before real users arrive is an alert on 5xx rates, which is a Vercel dashboard setting rather than code.

---

Sources checked (Jul 2026): Vercel Cron Jobs docs, Vercel env var management guides, Supabase CLI migration docs, Supabase's Google login guide, Google's "Submitting your app for verification" support article — noted here since tooling/policy specifics can shift and are worth re-verifying if this checklist is used much later than today.

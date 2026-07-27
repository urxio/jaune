# Jaune PM log

Running log of scheduled PM check-ins. Newest entries on top. Each entry: what was checked, what got done, what's overdue, what needs bobo's decision.

---

## 2026-07-26 (bobo-requested, not a scheduled run) — In-app feedback form built

**Asked for:** a way for users to submit feedback that emails bobo. (Recipient address is configured via `FEEDBACK_TO_EMAIL` in `.env.local`/Vercel — kept out of this public repo on purpose.)

**Built** (all uncommitted, per the no-autonomous-commit rail):
- `supabase/migrations/030_feedback.sql` — `feedback` table (category, message, page, user agent, `emailed_at`). RLS: users insert/select their own only; bobo reads all via the dashboard service role.
- `lib/email.ts` — Resend REST call via plain `fetch`, no new npm dependency. Non-throwing by design.
- `app/api/feedback/route.ts` — auth, validation, rate limit (5/hour/user, counted off the table so it survives serverless cold starts), insert, then best-effort email with `reply_to` set to the submitter so bobo can just hit reply.
- `components/settings/FeedbackSection.tsx` + wired into `SettingsView` between "Your data" and "System".

**Design decision worth keeping:** the row is written *before* the email is attempted, and the route returns 200 once persisted. A provider outage or missing API key never loses a beta tester's report, and the table gives an aggregate view for the beta round in `BETA_PLAN.md` — which the email alone wouldn't.

**Verified:** `tsc --noEmit` clean; eslint clean on the new files (one pre-existing `<img>` warning in `SettingsView`). API returns 401 unauthenticated (not 500) and 405 on GET — matches what `scripts/smoke-test-deploy.mjs` expects. UI rendered and interaction-tested (pills, textarea, enable/disable) in the dev server via a throwaway public route, since `/settings` needs a login; that route was deleted afterwards.

**Resend (confirmed same day):** bobo already had a Resend account (since Apr 2026) with **`jaune.space` already verified** — so there's no recipient restriction and mail reaches the feedback inbox directly. `EMAIL_FROM=Jaune <feedback@jaune.space>` is set. Note the Resend account's own address differs from the feedback inbox, so the `onboarding@resend.dev` fallback sender would *not* reach the intended recipient — the verified domain is what makes it work. Advised against reusing the existing "Onboarding" API key (last used ~11h before, so another project depends on it); a dedicated `jaune-prod` key keeps revocation and Logs attribution clean.

**Migration applied + end-to-end tested (same day):** migration `030_feedback.sql` run via the Supabase SQL editor (CLI needs an interactive browser login Claude can't drive). Discovered while checking: **migrations 001-029 were already applied in prod** — `brief_feedback` and `monthly_retrospectives` both exist — so `DEPLOY_CHECKLIST.md` §3's "unconfirmed" status is now resolved. Because the SQL editor path bypasses Supabase's migration tracking, `030_feedback.sql` was made idempotent (`drop policy if exists` before each `create policy`) so a later `supabase db push` re-running it succeeds instead of erroring.

Tested end-to-end against the real route by minting a session for the `claude@jaune.com` test account (created 2026-07-25) via the admin API's magiclink flow and calling `/api/feedback` with a Bearer token — the mobile auth path, so no password involved. Verified: RLS blocks anonymous reads and inserts, the category check constraint rejects bad values, the row persists, and the email reaches the configured inbox.

**Bug found and fixed during that test:** `emailed_at` was never being stamped. The route used the *user's* Supabase client for the update, but the RLS policies deliberately grant only INSERT and SELECT — so the write was silently rejected, with no error, making a successful send look like a failed one. Fixed by using the service-role client for that stamp, and by checking the returned error. Kept the policies as they are on purpose: giving users UPDATE would let them edit feedback after sending and forge the stamp. Also added `console.warn` on the two silent misconfiguration paths (`FEEDBACK_TO_EMAIL` or `RESEND_API_KEY` unset) — previously a misconfigured deploy would collect feedback and quietly never email anyone.

**Two test rows are sitting in the prod `feedback` table** (`bug` and `praise`, both from the `claude` account) — delete whenever.

**Not done — needs bobo:**
1. **Vercel env vars.** `RESEND_API_KEY` (Production + Preview, marked Sensitive), `EMAIL_FROM`, `FEEDBACK_TO_EMAIL`, then a redeploy. Local `.env.local` is fully set and working; the live site is not.
2. **Migration not applied.** No `supabase` CLI or `psql` on this machine, and `.env.local` points at the *production* project (`evrvllkvhutmlnupaqcg`) — there's no separate dev DB, so a local run would have been a prod schema change. The API route 500s until `supabase db push` runs. Note `DEPLOY_CHECKLIST.md` §3 still shows the initial push as unconfirmed.
3. **Placement.** Settings-only right now. For the beta, reaching it from the dock or user menu would get more submissions.

---

## 2026-07-25 (scheduled run) — Two gaps found in the live site; deploy smoke test written; brief-cron investigated and recommended for deferral

**Checked:** `git log` — bobo committed everything from the last two sessions (`3db1e56` Mac app scaffold + calendar removal, `f9a756a` frosted glass, `a6db3fb` hydration/onboarding/markdown fixes), and `git status` is **clean**. So the Tauri scaffold and the menu-bar/tray work are confirmed shipped and are marked `PM ✓` in the tracker. Also checked: still no `vercel.json`, no cron route, no `ios/`/`expo/` (none due yet), migrations now number 31 (tracker said 29). Could not reach `jaune.space` from this session — outbound fetches are restricted to URLs that appeared in the conversation — so the live site's behaviour is inferred from the repo, not observed.

**Two gaps found, both on the live site, neither previously logged:**

1. **Signup has no invite gate.** `IMPLEMENTATION_PLAN.md` Phase 3 lists "Invite code gate on signup"; it was never built — a repo-wide grep for `invite` returns one unrelated hit. `/signup` calls `supabase.auth.signUp()` with nothing in front of it, and `jaune.space` is publicly resolvable. Every signup that reaches onboarding immediately starts spending Anthropic tokens (onboarding chat, brief, pulse are all live model calls) and there's no rate limit or spend cap anywhere in the app. Google sign-in being in Testing status doesn't help — email+password is unrestricted. Risk is low *today* because nobody has the URL, and goes up the moment anything is posted publicly. Options and a recommendation are in the new `BETA_PLAN.md` §0; the short version is a Supabase-level allowlist now (30 min, no app code) and a real invite gate during the beta window.

2. **The `/landing` waitlist form throws emails away.** `app/landing/page.tsx` (~line 893): the "Get early access" handler is `onClick={() => { if (email) setSubmitted(true) }}` and then renders "You're on the list." Nothing is stored, fetched, or sent. Contained for now — `jaune.space/` serves `app/DemoApp.tsx`, not `/landing`, and every DemoApp CTA points at `/login` — but the Aug 10 "landing page" task points straight at this file. Silently discarding early-access signups during a launch is the kind of thing you find out about afterwards. Not fixed here (it edits an existing file under `app/`); flagged with a fix sketch in `BETA_PLAN.md` §1.

**Built this run** (all uncommitted, per the never-commit rail):

- **`scripts/smoke-test-deploy.mjs`** — the Jul 27 task, automated. Read-only pass over the deployed app's unauthenticated surface: public pages return 200 with expected copy; every API route returns 401 rather than 500 (a 500 there is almost always a missing Vercel env var); the mobile `Bearer` path rejects a garbage token; `http://` redirects to `https://`; `www.` resolves; and two regressions stay fixed — no `locusai.space` in shipped HTML, and no Google Calendar text left in the privacy policy, which doubles as a check that the deploy is actually current. No DB writes, no Anthropic tokens, safe against production any time, exits non-zero so it can go into CI later. Syntax-checked and run against a dead port to confirm the failure path; **not yet run against jaune.space** — that's bobo's, one command.
- **`BETA_PLAN.md`** — the Jul 30–Aug 19 window: the two gaps above, a 15-person recruitment mix biased toward people who'll actually use it daily, three drafts of recruitment copy (DM, email, community post) for bobo to edit, five feedback questions, and a concrete bar to clear before locking a Product Hunt date. The metric proposed as the one that matters: how many beta users reach a *third* check-in.
- **`DEPLOY_CHECKLIST.md`** §5 and §6 rewritten with the smoke-test entry and the cron findings below.

**Cron investigated and deliberately not built.** Three findings, worst first:

- **The data layer can't be called outside a user request.** `buildBriefContext()` fans out to `lib/db/*`, and all 46 of those call sites use `createClient()`, which reads `cookies()`/`headers()` and leans on RLS to scope the query. A cron has no user, so every query returns nothing. Pre-generation needs either a refactor to inject a Supabase client (~19 existing lib files — needs bobo's go-ahead) or a self-call that mints a per-user session and hits `/api/brief/generate` with a Bearer token (touches nothing, but burns a magic-link token per user per day and leans on auth internals for a scheduling job).
- **Vercel Hobby allows one cron run per day, fired anywhere within the scheduled hour.** Briefs are per-user-timezone, so a fixed-UTC run is right for one timezone band and wrong for the rest. "Generate at 5am local" needs an hourly cron → Pro ($20/mo) or an external trigger. Spend decision, not a code one.
- **The value is thin at beta scale.** Briefs already generate on demand and cache for the day, so this buys ~5–10s off first load, against spending tokens every morning for users who may not open the app — and it's the machinery most likely to fail quietly at 5am.

**Recommendation: defer the brief-generation cron until after beta** and spend Jul 28–29 on the invite gate instead. Revisit when brief load time draws a complaint or push notifications arrive, at which point pre-generation stops being a latency optimisation and becomes a prerequisite. The logging half of that window is genuinely cheap and mostly already true: Vercel captures `console.log`/`console.error` with no setup and the routes already log their failure paths; the one gap worth closing before real users is a 5xx alert, which is a dashboard setting.

**Tracker updated.** Added a merge step so future seed changes (new tasks, retitles, PM-verified completions) fold into bobo's board without clobbering his checkmarks — previously seed edits were invisible to anyone who'd already opened it. Also fixed `TODAY`, which was hardcoded to `2026-07-23`, so overdue/due-soon colouring was two days stale.

**On track / at risk:** Jul 25 of the Jul 22–29 window. Domain (due today) is done. **Migrations, due Jul 24, are the one genuinely overdue item** — reported as running on Jul 23 but never confirmed, and unconfirmable from here. Smoke test (Jul 27) now has tooling and needs one command plus a manual authed pass. Mac app is ~2 weeks ahead of schedule. Nothing in the iOS or marketing streams is due yet, but the Aug 5 Apple Developer enrolment wants lead time.

**Needs bobo's decision:**

1. **Invite gate — A (nothing), B (Supabase allowlist), or C (real invite codes)?** Until this is decided, jaune.space accepts unlimited signups that spend tokens. Recommendation: B now, C during the beta window.
2. **Cron — accept the deferral, or approve the `lib/db` client-injection refactor?** The refactor is the right version of it if it's wanted sooner.
3. **Did `supabase db push` actually complete?** Only bobo can confirm; blocks calling the deploy window done.
4. Still open from Jul 23–24: add beta testers to Google's Test users list before inviting them; approve the Google-OAuth deep-link fix for the Mac app; Apple Developer account ($99/yr).

Nothing under `app/`, `lib/`, `components/`, or `supabase/migrations/` was touched this run.

---

## 2026-07-24 (in chat, bobo-initiated) — Mac app scaffolded and building; `Jaune.app` runs

**Context:** bobo asked to start the Mac app. Per the playbook this belongs to the Jul 30–Aug 19 window (Tauri scaffold targeted Aug 3), so this is **ahead of schedule**, started while the webapp window (Jul 22–29) is still open. Flagged but not blocked — the webapp is live at jaune.space and the Tauri work touches no existing app/lib code.

**Discussed before building.** bobo asked what the architecture would be and whether it'd be a true native app. Explained the Tauri model (native Rust shell + WKWebView loading the deployed site) and priced out the native alternative honestly: the backend survives untouched (20 API routes, `lib/ai/*`, `lib/db/*`, all 31 migrations), but the ~11,575 lines of React components across 12 screens would be rewritten in SwiftUI — roughly 2-3 months for an experienced SwiftUI dev with a local-cache sync layer, vs. days for the wrapper. Also noted that SwiftUI would cover Mac *and* iOS from one codebase, potentially replacing both the planned Tauri Mac app and the Expo iOS app — worth revisiting if beta feedback says the web feel is a real complaint. **Decision: ship the wrapper now**, revisit native after beta.

**Built** (all uncommitted, per the never-commit-autonomously rail):

- `desktop/` — self-contained, own `package.json`, Tauri CLI 2.11.4, doesn't touch the Next.js root
- `desktop/src-tauri/src/lib.rs` — the whole native layer: main window, a lazily-created borderless `panel` window for the menu-bar popover (hides on blur, anchored under the tray icon), tray with left-click-toggles-panel and a right-click menu, and a **Cmd+Shift+J** global shortcut
- `BASE_URL` compiles to `localhost:3000` in debug / `jaune.space` in release, mirroring `devUrl`/`frontendDist`
- Icons generated from `app/icon.svg` — a proper macOS rounded-rect app icon (Apple's 824/1024 grid) and a monochrome menu-bar template icon at 1x/2x/3x
- `desktop/README.md` (setup, dev, build, known gaps), `.gitignore` entries for `desktop/target`
- Installed the Rust toolchain (rustup, stable 1.97.1) — wasn't on the machine

**Verified:** release build succeeds; produces `Jaune.app` (10MB) and `Jaune_0.1.0_aarch64.dmg` (3MB), arm64. Launched it and confirmed the webview genuinely loaded production — WebKit spawned WebContent/GPU/Networking processes and recorded `jaune.space` in its resource-load database. bobo installed it to `/Applications` himself mid-session. Could not screenshot it (this process lacks screen-recording permission), so **the visual result is unverified by me** — tray icon appearance, panel positioning, and how the web UI reads at panel width all still need bobo's eyes.

**Dropped `macOSPrivateApi`** from the config. It was set for window transparency but requires a matching Cargo feature and relies on private Apple APIs, which is an App Store rejection risk; not worth it for a first release.

**Known gaps, documented in `desktop/README.md`:**
1. **Google sign-in will likely fail in the app** — Google blocks OAuth in embedded webviews. Email+password is unaffected. Fix is a Tauri-detection branch in `app/(auth)/login/page.tsx` that opens OAuth in the system browser and returns via a `jaune://` deep link. **Not done — this is the one change that touches existing web code, so it needs bobo's go-ahead.**
2. **Unsigned** — Gatekeeper will block it on any other machine. Needs a Developer ID cert ($99/yr Apple Developer account) plus notarization before any beta user can run the `.dmg`. That purchase is bobo's call and is already on the Aug 5 line in the timeline.
3. No auto-update, and no offline mode (it loads a website).

**Needs bobo's decision:**
1. Try the app — does the menu-bar panel land in the right place, and does the web UI read acceptably at 420×640? Panel size is a one-line change.
2. Approve the Google-OAuth deep-link fix, since it edits the login page.
3. Apple Developer account ($99/yr) — blocks handing the `.dmg` to anyone else.

---

## 2026-07-23 (later same-day, in chat) — Google OAuth branding configured; verification path documented

**Did:** Walked bobo through Google Cloud Console → Google Auth Platform → Branding for the "Jaune" OAuth client (formerly showing as "LocusAI" project, still unbranded for Google sign-in). Generated a PNG logo (512×512, from `app/icon.svg`) since Google requires a raster upload — rendered via `sharp` in the sandbox after ImageMagick's built-in SVG delegate silently produced a blank image. Bobo set App name to "Jaune," uploaded the logo, set home page/privacy policy links to `jaune.space`, and cleaned Authorized domains down to `jaune.space` + the required `evrvllkvhutmlnupaqcg.supabase.co` (removed the old `locusai.space` entry from *this* list — note this is separate from Supabase's own redirect-URL allow-list, which still has stale `locusai.space` entries, see §2 of `DEPLOY_CHECKLIST.md`).

**Correction made mid-session:** I initially told bobo that test users in "Testing" publishing status would see the new branding without needing verification — that was wrong. Checked further: the "Choose an account to continue to X" screen shows the raw Supabase project domain regardless of Testing/Production status, and only switches to showing "Jaune" once Google approves brand verification. Testing vs. Production only gates *who* can complete sign-in (named test users only, 100 cap, vs. the general public).

**Documented the verification path** in `DEPLOY_CHECKLIST.md` §2, based on bobo's link to Google's official ["Submitting your app for verification"](https://support.google.com/cloud/answer/13461325) article: Publish app → Prepare for Verification → Submit for Verification. Jaune only requests non-sensitive scopes (openid/email/profile), so this should skip the heavier security-assessment/demo-video path, but likely still needs `jaune.space` ownership verified via Google Search Console. Not started yet — appropriately gated behind "before Product Hunt launch," not urgent today.

**Needs bobo's decision/action, not mine:** add beta testers' emails to Google Auth Platform → Audience → Test users before recruiting them (currently only `borisnikaz@gmail.com` is listed) — otherwise their Google sign-in attempts will be blocked. Actual verification submission should happen with lead time before the launch date, not day-of.

---

## 2026-07-23 (same-day follow-up, in chat) — Vercel/Supabase confirmed live, jaune.space is up, Google Calendar integration removed

**Confirmed live infra:** bobo confirmed the Vercel project (`locusai`, https://vercel.com/bnash058-gmailcoms-projects/locusai) and Supabase project (ref `evrvllkvhutmlnupaqcg`) already existed — saved to memory (`jaune_infra.md`) so future runs don't re-flag this as unknown. Confirmed via screenshots: all required env vars are set on Vercel; domain **jaune.space** is live with SSL, landing page and `/login` render; Supabase Auth redirect URLs are configured for `jaune.space`. Migration push (`supabase db push`) was reported as running by bobo but not yet confirmed complete — check next run.

**Decision: Google Calendar integration cut.** Bobo asked to remove it entirely (not just from the deploy checklist). Deleted from the codebase: `lib/google/calendar.ts`, `lib/db/calendar.ts`, `lib/ai/calendar-context.ts`, `app/actions/calendar.ts`, `app/api/calendar/*`, `app/auth/google-calendar/callback/*`, the `CalendarEvent` type, and all references in `lib/ai/context.ts`, `lib/ai/prompts.ts`, `app/api/pulse/route.ts` (brief/pulse context no longer includes calendar events). Stripped the corresponding sections from `app/privacy/page.tsx` and bumped its "Last updated" date. Removed `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXT_PUBLIC_APP_URL` from `.env.local.example` since nothing reads them now — confirmed via `tsc --noEmit` (clean after clearing the stale `.next` cache) and a repo-wide grep for the removed symbols (no hits). Supabase's Google **sign-in** (separate from Calendar) is untouched — that's configured directly in the Supabase dashboard, not via these env vars.

**Needs bobo's decision:**
1. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXT_PUBLIC_APP_URL` are still set on Vercel and now unused — worth deleting from the dashboard.
2. The `google_calendar_tokens` and `calendar_events_cache` tables (migration `019b_google_calendar.sql`) still exist in the DB schema with no code touching them anymore — left alone since dropping tables/data is a separate, more irreversible decision than removing app code. Flag if you want a follow-up migration to drop them.
3. Two stale `locusai.space` entries in Supabase's redirect URL allow-list (pre-rebrand domain) — harmless, but worth deleting as cleanup.

All changes remain uncommitted in the working tree for review.

---

## 2026-07-23 — First scheduled check-in: deploy checklist drafted

**Checked:** `git log` (no new commits since 2026-07-22 setup), `git status` (clean except this session's edits), filesystem for `vercel.json`/`tauri/`/`ios/`/`expo/` (none exist — expected, none are due yet). Found an existing `app/landing/page.tsx` (landing page already built as an in-app route, ahead of the Aug 10 marketing task) and an existing prompt-quality smoke test (`scripts/smoke-test-prompt.mjs`), which the Jul 27 smoke-test task can reuse. Confirmed all 29 Supabase migrations sort correctly by filename (`002b`, `019b` land in the right place, no reordering needed for `supabase db push`).

**Did:** Researched current (Jul 2026) Vercel + Supabase + Next.js production deploy practices (env var handling, Vercel Cron + `CRON_SECRET` mechanics, `supabase db push` workflow) since this is fresh-enough tooling to double check rather than trust training knowledge. Wrote `DEPLOY_CHECKLIST.md` at repo root — a step-by-step for the "webapp to production" window: prerequisites, full env var table (including `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXT_PUBLIC_APP_URL`/`CRON_SECRET`, which the code uses but `.env.local.example` was missing), Supabase auth/SMTP setup, migration push steps, Vercel deploy + domain steps, the two-layer smoke test plan, and a cron+logging design ready for Jul 28-29. Also updated `.env.local.example` to include the missing env vars found by grepping the calendar OAuth routes. All changes are uncommitted in the working tree for review.

**On track / at risk:** Today (Jul 23) is day 1 of the Jul 22-29 webapp-to-production window. Nothing is overdue yet — "Vercel + env vars" is dated Jul 23-24, "migrations" Jul 24, so there's still runway. No sign yet that the actual Vercel project or prod Supabase project exist (can't verify externally-hosted infra from the repo).

**Needs bobo's decision / can't verify from repo:**
1. Has a production Supabase project and Vercel project actually been created yet? This determines whether Jul 23-24 is still achievable.
2. Does a Google Cloud OAuth client already exist for `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, and is it intended to serve both Supabase's Google sign-in and the Calendar integration, or should these be separate OAuth clients? Flagged in the checklist, not decided here.
3. Domain choice/purchase for the Jul 25 step — not something to pick autonomously.

Did not touch anything under `app/`, `lib/`, `components/`, or `supabase/migrations/` beyond the `.env.local.example` addition (root-level config, not app code).

---

## 2026-07-22 — PM routine set up

Initial setup: PM_PLAYBOOK.md written, jaune-ship-tracker artifact created with target dates, 3x/week (Mon/Wed/Fri, 9am) scheduled check-in configured. Current focus: get the webapp live in production (target Jul 29) — everything else is blocked on it. Nothing yet to report from a run.

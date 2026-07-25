# Jaune PM log

Running log of scheduled PM check-ins. Newest entries on top. Each entry: what was checked, what got done, what's overdue, what needs bobo's decision.

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

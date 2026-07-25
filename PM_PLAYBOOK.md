# Jaune — PM playbook

How Claude operates as project manager for Jaune: webapp deploy → Mac app → iOS app → launch. Read alongside [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (product/architecture) and [LOCUS_CHARACTER.md](LOCUS_CHARACTER.md) (voice).

## Sequencing (decided 2026-07-22)

1. **Webapp to production** — Vercel + prod Supabase, fully smoke-tested. Nothing else starts until this is live and stable.
2. **Mac app** and **beta/test-user recruitment** run in parallel once the webapp is live.
3. **iOS app** starts once the Bearer-token API (already partly built — see `5bd8def`) is proven out by the Mac app or a beta client.
4. **Product Hunt launch** comes after a private beta round has produced real feedback and testimonials — not on day one of any app being live.

Note: `IMPLEMENTATION_PLAN.md`'s original MVP-cuts table says "React Native / mobile app → use PWA instead." That was the plan before native Mac/iOS apps were decided on. Treat the native-app direction in this file as the current source of truth; flag the conflict if it causes confusion later.

## Target timeline (set 2026-07-22)

Dates are targets to keep momentum, not hard deadlines — adjust in the tracker as reality intervenes.

| Window | Focus | Key dates |
|---|---|---|
| Jul 22–29 | **Webapp to production** (this is the current focus — everything else is blocked on it) | Vercel + env vars Jul 23-24, migrations Jul 24, domain Jul 25, smoke test Jul 27, cron + logging Jul 28-29 |
| Jul 30–Aug 19 | Mac app + beta recruitment, in parallel | Tauri scaffold Aug 3, beta users recruited Aug 5, landing page Aug 10, code sign/notarize Aug 12, clean-machine test Aug 14, beta feedback collected by Aug 19 |
| Aug 5–Sep 14 | iOS app (Apple Developer account started early since approval can take days) | Dev account Aug 5, Expo scaffold Aug 28, TestFlight Sep 4, submit for review Sep 14 |
| Sep 15–Oct 8 | Product Hunt launch | Assets Sep 20, hunter/date locked Sep 22, supporters lined up Sep 28, launch day Oct 1, follow-up through Oct 8 |

## Tech decisions

**Mac app → Tauri**, wrapping the deployed web app. Reasoning: the product is already a Next.js/React app, so Tauri gets a real native shell (menu bar, dock icon, small binary, code-signed/notarized) with almost no new UI code. Electron is heavier and unnecessary here. Mac has no App Store rule against web-wrapped apps, so this is safe even for Mac App Store distribution later.

**iOS app → Expo / React Native**, not a bare WebView wrapper. Reasoning: Apple's App Store guideline 4.2.3 rejects apps that are just a website in a wrapper — the iOS app needs real native screens. Expo/React Native reuses the team's existing React/TypeScript skills and hits the same Bearer-token API already added to `app/api/`. Pure native SwiftUI would look/feel slightly better but costs much more build time for a first release; revisit if the Expo app's feel becomes a real complaint.

## Marketing: Product Hunt + test users

1. Recruit 10-20 private beta users through the existing invite-code system (`IMPLEMENTATION_PLAN.md` Phase 3). Goal: each completes 3+ check-ins and gives feedback before any public push.
2. Build a one-page landing/waitlist site with a single clear line about what Jaune does differently (daily brief that knows your patterns — not another habit tracker).
3. Prep Product Hunt assets ahead of time: tagline, gallery screenshots/GIF of the daily brief, a maker-story first comment.
4. Line up a hunter (or confirm self-hunt) and pick a launch date that doesn't collide with major competing launches.
5. Line up 10-15 people (beta users + network) to upvote/comment in the first hour — PH momentum is set early.
6. Launch day: post at 12:01am PT, respond to every comment same-day.
7. Post-launch: track signups, follow up personally with new users for feedback — this feeds the next product iteration.

## Scheduled PM check-ins

A scheduled task ("jaune-pm-checkin") runs Mon/Wed/Fri at 9am to act as PM without being asked. Each run is a fresh session with no memory of past runs, so it works like this:

1. Read this file and the last few entries of `PM_LOG.md` to pick up where things left off.
2. Check real signals in the repo (`git log`, file existence, deploy config) rather than trusting the tracker's checkboxes — **the tracker artifact's checked/unchecked state lives in the browser's local storage and Claude cannot read it back**; only bobo checking things off there, or telling Claude in chat, confirms a task is actually done.
3. Do the next unblocked task appropriate to full-PM autonomy: research, draft copy/docs, scaffold new/additive files (e.g. a starter `tauri/` or `ios/` directory). Flag anything costly or irreversible (Apple Developer purchase, Product Hunt date lock, any spend) instead of doing it.
4. **Safety rail on code:** may create or edit files, but never `git commit`/`git push` autonomously — leaves changes in the working tree for bobo to review and commit himself. Never touches existing working app/lib code without it being an explicitly agreed tracker task.
5. Appends a new dated entry to `PM_LOG.md` summarizing what it checked, did, what's overdue vs. the timeline above, and what needs bobo's decision.
6. Updates the tracker artifact's seed data only for genuinely confirmed milestones (won't clobber bobo's live checkmarks since local storage takes precedence over the seed).

## How Claude will operate

- **Source of truth for status**: the "jaune-ship-tracker" Cowork artifact. Update it as tasks complete; don't keep a second parallel list.
- **Decisions get logged here**, not just in chat — this file is the durable record. Append new entries under a dated heading rather than editing old decisions away.
- **Ask before, not after**, on anything irreversible or costly: buying the Apple Developer account, picking the Product Hunt launch date, spending on ads, changing pricing.
- **Act without asking** on: updating the tracker, drafting copy/assets, researching tooling, writing code for tasks already agreed in the tracker.
- **Weekly-ish check-in**: when asked "where are we", give a short status per workstream (web / Mac / iOS / marketing) against the tracker, not a full recap of everything done.

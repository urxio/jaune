# Jaune — private beta plan

Covers the **Jul 30 – Aug 19** window in `PM_PLAYBOOK.md`: recruit 10–20 users, get each through 3+ check-ins, collect feedback good enough to justify a Product Hunt launch. Drafted 2026-07-25 by the PM check-in; nothing here is decided yet.

---

## 0. Blocking gap found 2026-07-25: signup is wide open

`jaune.space` is live and `/signup` calls `supabase.auth.signUp()` with **no invite gate**. `IMPLEMENTATION_PLAN.md` Phase 3 lists "Invite code gate on signup" as a task — it was never built (repo-wide grep for `invite` returns only an unrelated hit in `app/api/journal/comment/route.ts`).

Why this matters now rather than later:

- Every signup that reaches onboarding starts costing Anthropic tokens immediately (onboarding chat → brief → pulse are all live model calls). There is no rate limit or spend cap in the app.
- "Private beta" is the whole premise of the marketing plan. If the door is open, the beta cohort isn't a cohort.
- Google sign-in is still in Testing publishing status, so only listed test users can use OAuth — but **email+password signup is unrestricted**, so that isn't acting as a gate.

### Options

| | Effort | Notes |
|---|---|---|
| **A. Do nothing** | none | Fine only if the domain stays unshared. Realistic risk is low today (nobody knows the URL), rises the moment anything is posted publicly. |
| **B. Supabase-level allowlist** | ~30 min, no app code | Add a Postgres trigger/hook on `auth.users` insert that rejects emails not present in a `beta_allowlist` table. Zero changes to `app/`. Downside: the signup form shows a raw error rather than a nice "invite only" message. |
| **C. Invite code gate in the app** | ~2–3 h | New `invite_codes` migration + a code field on `/signup` validated server-side. Proper UX, and reusable as a scarcity/waitlist mechanic at launch. Touches `app/(auth)/signup/page.tsx`, so it needs bobo's explicit go-ahead per the playbook rails. |

**Recommendation: B now, C before any public link goes out.** B removes the spend risk today for almost no work and no risk to working code; C is the one worth building during the beta window, not before it.

**Needs bobo's decision** — the PM check-in will not touch `app/(auth)/signup/page.tsx` without it.

---

## 1. Second gap: the `/landing` waitlist form throws emails away

`app/landing/page.tsx` (line ~893) renders an email input and a "Get early access" button whose handler is `onClick={() => { if (email) setSubmitted(true) }}`. It then shows "You're on the list." The email is never sent anywhere — no Supabase write, no fetch, no storage.

Right now this is contained: `jaune.space/` serves `app/DemoApp.tsx`, not `app/landing/page.tsx`, and every DemoApp CTA points at `/login`. So the dead form is only reachable by someone typing `/landing` directly.

It becomes a real problem the moment `/landing` is used as the marketing page — which is exactly what the Aug 10 "landing page" task implies. Silently discarding early-access signups during a launch is the kind of thing you find out about afterwards.

**Fix when the Aug 10 task comes up** (or sooner if `/landing` gets linked anywhere): a `waitlist` table + a small server action. Small job, but it edits an existing file under `app/`, so it's flagged rather than done.

Also worth resolving as part of that task: **which page is the public front door** — `DemoApp` (interactive product demo) or `/landing` (conventional marketing page)? Two maintained landing experiences is one too many.

---

## 2. Who to recruit (target: 15, floor: 10)

Bias toward people who will actually use it daily for two weeks over people who'll say nice things once. The failure mode of a friends-and-family beta is polite silence.

- **5–7 close contacts** who already track goals/habits in some form (Notion, Things, a paper journal). They'll have opinions about what Jaune replaces.
- **4–6 second-degree contacts** — friends of friends, ex-colleagues. Less socially obligated to be nice, which is the point.
- **3–5 strangers** from a relevant community (r/productivity, a Discord, IndieHackers). Closest signal to how a Product Hunt visitor will react cold.

Track them in a simple sheet: name, source, invited date, signed up?, check-ins completed, feedback given?, willing to be quoted?

---

## 3. Recruitment copy — drafts

Short, specific, and honest that it's early. Nothing here goes out without bobo's edit.

### DM / text (close contacts)

> Been building something for the last few months — Jaune. It's a daily brief that learns your patterns: you check in, it notices things like "your energy craters on the days you skip the morning walk," and each morning it tells you the two or three things that actually matter today.
>
> I'm putting 15 people on it before it goes public. Would you use it for two weeks and tell me where it's annoying? Genuinely want the "this is useless because —" version, not the nice version.

### Email (second-degree / cold)

> **Subject:** 15 spots — an AI daily brief that learns your patterns
>
> Hi [name],
>
> I'm [bobo], and I've been building Jaune — an AI companion that turns a two-minute daily check-in into a morning brief that knows *your* rhythm. Not another habit tracker with streaks and guilt: it's closer to a chief-of-staff who's been paying attention.
>
> I'm running a private beta with 15 people before launch. The ask is small — check in most days for two weeks, then a 15-minute call about what didn't work. In return you get it free for life and real influence on what gets built next.
>
> Interested? Reply and I'll send you an invite.
>
> — [bobo]

### Community post

> I built an AI daily brief that learns your patterns instead of tracking your streaks
>
> Most productivity tools ask you to enter data and hand you charts back. Jaune does the opposite: a two-minute check-in, and each morning it tells you what matters today based on what it's noticed about your energy, your goals, and what you keep avoiding.
>
> Looking for ~5 people to break it before I launch. Free, no card, and I'll take blunt feedback over polite feedback.

---

## 4. What we ask beta users to do

1. Complete onboarding (the pattern-learning conversation).
2. Set at least one goal and one habit.
3. Check in on **3+ days** — the brief is worthless without history, and getting them past day 3 is the real test.
4. One 15-minute call, or a written reply, at the end.

The single number that matters for the beta: **how many people complete a third check-in.** Day-3 retention predicts everything downstream and is honest in a way that signups aren't.

## 5. Feedback questions (keep to five)

1. What did the brief tell you that you didn't already know?
2. Was there a morning you opened it and it was *wrong* about you? What did it get wrong?
3. What made you not check in on the days you skipped?
4. If this disappeared tomorrow, what would you miss — or would you not notice?
5. Who else do you know who'd use this? (A real name is the strongest signal you'll get; hesitation is data too.)

Question 4 is the load-bearing one. Question 5's answer is the honest version of "would you recommend this."

## 6. Bar to clear before Product Hunt

The playbook already sequences launch after real beta feedback. Concretely, don't lock a date until:

- [ ] ≥10 users reached a third check-in
- [ ] ≥3 unprompted quotes usable as testimonials
- [ ] Zero known data-loss or auth bugs from the beta
- [ ] Day-3 retention understood well enough to state honestly on the PH page
- [ ] Invite gate (option C) shipped, so launch-day traffic has a controlled front door

---

## Open decisions for bobo

1. **Invite gate: A, B, or C?** — until this is decided, `jaune.space` accepts unlimited signups that spend Anthropic tokens.
2. **Add beta testers' emails to Google Auth Platform → Audience → Test users** *before* inviting them, or their Google sign-in will be blocked (carried over from the 2026-07-23 log entry — still outstanding).
3. **`/` vs `/landing`** — which is the public marketing page? Determines where the Aug 10 work goes.
4. **Anthropic spend ceiling for the beta** — 15 users × ~2 model calls/day is small, but there's no cap in the app today. Worth knowing the number you'd be unhappy to see.

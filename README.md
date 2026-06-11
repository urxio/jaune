# Jaune

An AI companion that helps you build habits, reach your goals, and better understand yourself. Jaune learns your rhythms — energy patterns, what days are harder, which habits stick — and delivers a daily brief that feels like it comes from someone who has been paying attention.

## Concept docs

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — architecture, data model, AI pipeline, and phased roadmap
- [LOCUS_CHARACTER.md](LOCUS_CHARACTER.md) — Jaune's character, voice, and tone rules (the product compass)

## Stack

- **Next.js** (App Router) + React, Tailwind CSS
- **Supabase** — Postgres, auth, RLS (migrations in `supabase/migrations/`)
- **Claude API** (`claude-haiku-4-5`) — daily briefs, check-in conversations, journal reflections, memory insights

## Key directories

| Path | Purpose |
|---|---|
| `lib/ai/` | Prompts, brief context assembly, memory read/write — the core of the product |
| `lib/memory/` | Background memory updates: stats, AI insights, people extraction |
| `app/api/` | Brief generation, check-in chat, journal reflection, pulse, calendar |
| `app/(app)/` | Authenticated app views: home, check-in, goals, habits, journal, review |

## Getting started

```bash
npm install
npm run dev
```

Requires a `.env.local` with Supabase and Anthropic credentials. Apply the SQL files in `supabase/migrations/` in filename order.

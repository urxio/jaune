-- ── priority outcomes ──────────────────────────────────
-- Records what actually happened to each priority Jaune suggested:
-- { "recorded_at": ISO timestamp, "outcomes": [{ "title": text, "outcome": "done" | "partial" | "skipped" }] }
-- An empty outcomes array means the user dismissed the review without answering.
alter table public.briefs
  add column if not exists priority_outcomes jsonb;

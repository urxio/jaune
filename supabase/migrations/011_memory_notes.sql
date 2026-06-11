-- ── memory_notes ───────────────────────────────────────
-- User-authored notes that feed into the AI's working context.
-- Three flavors: time-anchored reminders, ideas, and resources.
--
-- STATUS: UNUSED — no application code reads or writes this table.
-- The planned capture feature (capture UI + lib/db/memory-notes.ts +
-- a MEMORY NOTES section in the brief context) was never built, and the
-- corresponding rule was removed from the brief system prompt in
-- lib/ai/prompts.ts. Kept in place so existing databases stay consistent;
-- safe to build on or drop in a future migration.

create table if not exists public.memory_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  content       text not null,
  type          text not null default 'idea'
                  check (type in ('reminder', 'idea', 'resource')),
  trigger_date  date,                        -- date-based surfacing (reminders)
  ai_tags       text[] not null default '{}', -- topic tags for context-based surfacing
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.memory_notes enable row level security;

create policy "Users manage own memory notes"
  on public.memory_notes
  for all
  using (auth.uid() = user_id);

create index memory_notes_user_date
  on public.memory_notes (user_id, trigger_date)
  where resolved = false;

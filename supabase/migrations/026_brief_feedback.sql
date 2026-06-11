-- ── brief_feedback ─────────────────────────────────────
-- Thumbs up/down (plus optional comment) on a daily brief.
create table if not exists public.brief_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  brief_id    uuid not null references public.briefs(id) on delete cascade,
  brief_date  date not null,
  rating      text not null check (rating in ('up', 'down')),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (user_id, brief_id)
);

alter table public.brief_feedback enable row level security;

create policy "Users manage own brief feedback"
  on public.brief_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── monthly_retrospectives ─────────────────────────────
-- "Here's what I learned about you this month" — one AI-generated
-- narrative per user per calendar month, citing real evidence.
create table if not exists public.monthly_retrospectives (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  month         text not null,            -- 'YYYY-MM' in the user's timezone
  retrospective jsonb not null,           -- { narrative, observations[], looking_ahead }
  generated_at  timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.monthly_retrospectives enable row level security;

create policy "Users manage own retrospectives"
  on public.monthly_retrospectives for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

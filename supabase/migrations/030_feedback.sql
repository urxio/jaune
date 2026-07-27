-- ── feedback ───────────────────────────────────────────
-- Free-form product feedback submitted from Settings. Stored first, emailed
-- second — if the email provider is down or unconfigured, the row survives.
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  category    text not null check (category in ('bug', 'idea', 'confusing', 'praise', 'other')),
  message     text not null check (char_length(message) between 1 and 4000),
  page        text,
  user_agent  text,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_user_created_idx
  on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- Users can file feedback and read their own back; nobody reads anyone else's.
-- Reviewing all feedback happens in the Supabase dashboard (service role).
-- `drop ... if exists` first so this file is safe to run twice — `create policy`
-- has no IF NOT EXISTS, and this was applied by hand before `db push` caught up.
drop policy if exists "Users insert own feedback" on public.feedback;
create policy "Users insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users view own feedback" on public.feedback;
create policy "Users view own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

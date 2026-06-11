-- ── google_calendar_tokens ──────────────────────────────
-- Stores Google OAuth tokens per user (one row per user).
-- access_token is short-lived (~1hr); refresh_token is long-lived.
-- Upserted on connect and on every silent refresh.

create table if not exists public.google_calendar_tokens (
  user_id       uuid primary key references public.users(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

create policy "Users manage own calendar tokens"
  on public.google_calendar_tokens for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── calendar_events_cache ────────────────────────────────
-- Caches the next 7 days of merged calendar events per user.
-- TTL (30 min) is enforced in application code via fetched_at.
-- events column is a JSONB array of CalendarEvent objects.

create table if not exists public.calendar_events_cache (
  user_id      uuid primary key references public.users(id) on delete cascade,
  events       jsonb not null default '[]',
  fetched_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.calendar_events_cache enable row level security;

create policy "Users manage own calendar cache"
  on public.calendar_events_cache for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at auto-triggers
create trigger google_calendar_tokens_updated_at
  before update on public.google_calendar_tokens
  for each row execute function public.handle_updated_at();

create trigger calendar_events_cache_updated_at
  before update on public.calendar_events_cache
  for each row execute function public.handle_updated_at();

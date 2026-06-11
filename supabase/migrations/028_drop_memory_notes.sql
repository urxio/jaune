-- ── drop memory_notes + capture_folders ────────────────
-- These tables (011, 017) were designed for a quick-capture feature
-- (reminders / ideas / resources fed into the AI brief) that was never
-- built — no UI or app code ever read or wrote them. Removing rather
-- than building: dated reminders are covered by the calendar
-- integration, undated ideas by the journal.
drop table if exists public.capture_folders;
drop table if exists public.memory_notes;

-- STATUS: UNUSED — no application code reads or writes users.capture_folders.
-- Added for the never-built capture feature (see 011_memory_notes.sql).
-- Safe to build on or drop in a future migration.
alter table public.users
  add column if not exists capture_folders text[] not null default '{}';

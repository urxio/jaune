-- Migration 002: Habit scheduling — day-of-week + until date
-- Run in Supabase SQL editor

-- Add days_of_week: integer array, e.g. [1,3,5] = Mon/Wed/Fri, NULL = every day
ALTER TABLE habits ADD COLUMN IF NOT EXISTS days_of_week integer[] DEFAULT NULL;

-- Add ends_at: optional habit deadline (ISO date)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS ends_at date DEFAULT NULL;

-- Drop the hard enum constraint so frequency can store display labels
-- (e.g. "Daily", "Weekdays", "Mon · Wed · Fri")
-- Existing rows keep their old values ('daily', '3x_week', 'weekdays') — handled in code
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_frequency_check;

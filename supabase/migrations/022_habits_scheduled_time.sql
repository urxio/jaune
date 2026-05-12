-- Change habits.time_of_day from a slot enum to a specific HH:MM time string.
--
-- Before: CHECK (time_of_day IN ('morning', 'afternoon', 'evening'))
-- After : free text storing times like '07:30', '13:00', '19:00', or NULL

-- 1. Drop the old CHECK constraint (name may vary; try both common names)
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_time_of_day_check;
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_time_of_day_check1;

-- 2. Migrate existing slot names to representative specific times
UPDATE habits SET time_of_day = '08:00' WHERE time_of_day = 'morning';
UPDATE habits SET time_of_day = '13:00' WHERE time_of_day = 'afternoon';
UPDATE habits SET time_of_day = '19:00' WHERE time_of_day = 'evening';

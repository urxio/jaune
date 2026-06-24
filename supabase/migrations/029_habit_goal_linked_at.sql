-- Track when a habit was linked to a goal, so goal progress only counts
-- completions logged from that point forward (not pre-existing history).
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS goal_linked_at TIMESTAMPTZ;

-- Backfill existing links to "now" so current progress doesn't suddenly drop.
UPDATE public.habits
  SET goal_linked_at = now()
  WHERE goal_id IS NOT NULL AND goal_linked_at IS NULL;

-- Native Locus calendar events (no Google Calendar required)
-- Users can create personal events directly in Locus; Google Calendar is additive.

CREATE TABLE IF NOT EXISTS locus_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime   TIMESTAMPTZ NOT NULL,
  is_all_day     BOOLEAN     NOT NULL DEFAULT false,
  location       TEXT,
  description    TEXT,
  color          TEXT,       -- optional hex color, e.g. '#e07060'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row-level security
ALTER TABLE locus_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own locus events"
  ON locus_events FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER locus_events_updated_at
  BEFORE UPDATE ON locus_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for fast range queries (the planner fetches by user + week window)
CREATE INDEX IF NOT EXISTS locus_events_user_start
  ON locus_events (user_id, start_datetime);

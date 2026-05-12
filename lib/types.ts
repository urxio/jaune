export type UserProfile = {
  id: string
  name: string
  avatar_url: string | null
  timezone: string
  onboarded_at: string | null
  created_at: string
}

export type Goal = {
  id: string
  user_id: string
  title: string
  category: 'product' | 'health' | 'learning' | 'financial' | 'wellbeing' | 'other'
  timeframe: 'quarter' | 'year' | 'ongoing'
  target_date: string | null
  progress_pct: number
  status: 'active' | 'completed' | 'paused'
  /** How progress_pct is maintained for this goal. */
  tracking_mode: 'manual' | 'steps' | 'habits'
  created_at: string
  updated_at: string
}

export type Habit = {
  id: string
  user_id: string
  name: string
  emoji: string
  frequency: string           // display label: "Daily", "Weekdays", "Mon · Wed · Fri", etc.
  days_of_week: number[] | null  // 0=Sun … 6=Sat; null or [] = every day
  target_count: number        // expected completions per week
  ends_at: string | null      // ISO date — optional end date
  /** Specific scheduled time as "HH:MM" (e.g. "07:30"), or null if unscheduled. */
  time_of_day: string | null
  goal_id: string | null           // optional link to a goal
  goal_target_count: number | null // completions target for the linked goal (e.g. 30 runs)
  motivation: string | null        // why the user wants this habit — used by AI audit
  created_at: string
}

export type WeeklyPlanBlock = {
  id: string
  user_id: string
  week_start: string
  day_of_week: number
  time_slot: 'morning' | 'afternoon' | 'evening'
  title: string
  type: 'goal' | 'custom'
  reference_id: string | null
  accepted: boolean
  position: number
  created_at: string
}

export type HabitLog = {
  id: string
  habit_id: string
  user_id: string
  logged_date: string
  created_at: string
}

export type CheckIn = {
  id: string
  user_id: string
  checked_in_at: string
  energy_level: number
  mood_note: string | null
  blockers: string[]
  highlight: string | null
  date: string
}

export type BriefPriority = {
  title: string
  category: 'work' | 'health' | 'personal' | 'learning'
  estimated_time: string
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'flexible'
  reasoning: string
}

export type Brief = {
  id: string
  user_id: string
  brief_date: string
  generated_at: string
  model_used: string
  raw_prompt: string | null
  priorities: BriefPriority[]
  insight_text: string
  energy_score: number | null
  tokens_used: number | null
  stale: boolean
}

export type Task = {
  id: string
  user_id: string
  goal_id: string | null
  title: string
  category: string
  estimated_mins: number | null
  status: 'todo' | 'done' | 'skipped'
  due_date: string | null
  created_at: string
  completed_at: string | null
}

export type HabitWithLogs = Habit & {
  logs: HabitLog[]
  streak: number
  weekCompletions: number
  isScheduledToday: boolean   // true if habit is due today based on days_of_week
  linkedGoal: { id: string; title: string; category: Goal['category'] } | null
}

export type GoalStep = {
  id: string
  goal_id: string
  user_id: string
  title: string
  due_date: string | null
  completed: boolean
  completed_at: string | null
  position: number
  created_at: string
}

export type GoalWithSteps = Goal & {
  steps: GoalStep[]
}

export type JournalEntry = {
  id: string
  user_id: string
  date: string
  content: string
  locus_comment: string | null
  created_at: string
  updated_at: string
}

export type MemoryNote = {
  id: string
  user_id: string
  content: string
  type: 'reminder' | 'idea' | 'resource'
  trigger_date: string | null
  ai_tags: string[]
  resolved: boolean
  created_at: string
}

export type PersonGroup = 'friends' | 'acquaintances' | 'work' | 'family' | 'partner'

export type Person = {
  id: string
  user_id: string
  name: string
  notes: string | null
  group: PersonGroup
  want_catchup: boolean
  last_mentioned_at: string | null
  created_at: string
}

export type PersonSuggestion = {
  name: string
  relationship: string
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral'
  context: string
  mentions: number
  last_mentioned: string
}

export type WheelArea = {
  key: string
  label: string
  // Which goal category maps to this area (for AI-suggested scores)
  goalCategory: string | null
}

export const WHEEL_AREAS: WheelArea[] = [
  { key: 'health',        label: 'Health & Energy',    goalCategory: 'health'    },
  { key: 'career',        label: 'Career & Work',      goalCategory: 'product'   },
  { key: 'finances',      label: 'Finances',           goalCategory: 'financial' },
  { key: 'relationships', label: 'Relationships',      goalCategory: null        },
  { key: 'wellbeing',     label: 'Wellbeing & Mind',   goalCategory: 'wellbeing' },
  { key: 'growth',        label: 'Learning & Growth',  goalCategory: 'learning'  },
  { key: 'purpose',       label: 'Purpose & Meaning',  goalCategory: null        },
]

export type CalendarEvent = {
  id: string
  title: string
  start: string        // ISO datetime or date-only for all-day events
  end: string
  isAllDay: boolean
  calendarName: string
  location: string | null
  description: string | null  // truncated to 200 chars
  /** 'locus' = native Locus event (deletable); 'google' = Google Calendar (read-only) */
  source?: 'locus' | 'google'
}

export type LocusEvent = {
  id: string
  user_id: string
  title: string
  start_datetime: string   // ISO with timezone
  end_datetime: string
  is_all_day: boolean
  location: string | null
  description: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export type WheelScores = Record<string, number>

export type WheelSnapshot = {
  id: string
  user_id: string
  snapshot_date: string
  scores: WheelScores
  insight: string | null
  created_at: string
  updated_at: string
}

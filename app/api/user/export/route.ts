import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Every user-owned table worth exporting. Deliberately excluded:
// google_calendar_tokens (OAuth secrets), pulse_cache and
// calendar_events_cache (ephemeral caches, no user-authored content).
const TABLES: Array<{ name: string; orderBy?: string }> = [
  { name: 'users' },
  { name: 'goals', orderBy: 'created_at' },
  { name: 'goal_steps', orderBy: 'created_at' },
  { name: 'habits', orderBy: 'created_at' },
  { name: 'habit_logs', orderBy: 'logged_date' },
  { name: 'check_ins', orderBy: 'date' },
  { name: 'journal_entries', orderBy: 'date' },
  { name: 'briefs', orderBy: 'brief_date' },
  { name: 'brief_feedback', orderBy: 'created_at' },
  { name: 'weekly_reflections' },
  { name: 'wheel_of_life' },
  { name: 'people', orderBy: 'created_at' },
  { name: 'memory_notes', orderBy: 'created_at' },
  { name: 'locus_events', orderBy: 'created_at' },
  { name: 'user_memory' },
  { name: 'tasks', orderBy: 'created_at' },
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const exportData: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    format: 'jaune-export-v1',
    account_email: user.email,
  }

  await Promise.all(TABLES.map(async ({ name, orderBy }) => {
    try {
      // users keys on id, everything else on user_id — RLS enforces ownership either way
      const keyColumn = name === 'users' ? 'id' : 'user_id'
      let query = supabase.from(name).select('*').eq(keyColumn, user.id)
      if (orderBy) query = query.order(orderBy, { ascending: true })
      const { data, error } = await query
      if (error) {
        // Table may not exist in this environment — skip rather than fail the export
        console.error(`[export] ${name}:`, error.message)
        return
      }
      exportData[name] = data ?? []
    } catch (err) {
      console.error(`[export] ${name}:`, err)
    }
  }))

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="jaune-export-${today}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

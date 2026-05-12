import { createClient } from '@/lib/supabase/server'
import { getLocusEvents } from '@/lib/db/locus-events'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/locus/events?start=YYYY-MM-DD&end=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')
  if (!start || !end) return Response.json({ error: 'start and end params required' }, { status: 400 })

  const events = await getLocusEvents(user.id, `${start}T00:00:00Z`, `${end}T23:59:59Z`)
  return Response.json({ events })
}

import { createClient } from '@/lib/supabase/server'
import { getCalendarEventsForAI, createCalendarEvent } from '@/lib/google/calendar'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const events = await getCalendarEventsForAI(user.id)
  return Response.json({ events })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    title?: string
    startDateTime?: string
    endDateTime?: string
    calendarId?: string
    location?: string
    description?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.title?.trim()) return Response.json({ error: 'title is required' }, { status: 400 })
  if (!body.startDateTime)  return Response.json({ error: 'startDateTime is required' }, { status: 400 })
  if (!body.endDateTime)    return Response.json({ error: 'endDateTime is required' }, { status: 400 })

  const result = await createCalendarEvent(user.id, {
    title:         body.title.trim(),
    startDateTime: body.startDateTime,
    endDateTime:   body.endDateTime,
    calendarId:    body.calendarId,
    location:      body.location,
    description:   body.description,
  })

  if (!result.success) {
    const status = result.code === 'insufficient_permissions' ? 403
                 : result.code === 'not_connected'            ? 412
                 : 502
    return Response.json({ error: result.error, code: result.code }, { status })
  }

  return Response.json({ eventId: result.eventId }, { status: 201 })
}

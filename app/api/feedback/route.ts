import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const CATEGORIES = ['bug', 'idea', 'confusing', 'praise', 'other'] as const
type Category = (typeof CATEGORIES)[number]

const CATEGORY_LABEL: Record<Category, string> = {
  bug:       'Bug',
  idea:      'Idea',
  confusing: 'Confusing',
  praise:    'Praise',
  other:     'Other',
}

const MAX_LENGTH = 4000
const RATE_LIMIT = 5          // submissions…
const RATE_WINDOW_MS = 60 * 60 * 1000  // …per hour, per user

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const category = body.category
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const page = typeof body.page === 'string' ? body.page.slice(0, 200) : null

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
  if (message.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Message must be under ${MAX_LENGTH} characters` }, { status: 400 })
  }

  // Rate limit off the table itself — no extra infrastructure, and it survives
  // serverless cold starts the way an in-memory counter wouldn't.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)

  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: 'You have sent a lot of feedback just now — try again in an hour.' },
      { status: 429 }
    )
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 400) ?? null

  const { data: row, error: insertError } = await supabase
    .from('feedback')
    .insert({ user_id: user.id, category, message, page, user_agent: userAgent })
    .select('id')
    .single()

  if (insertError || !row) {
    return NextResponse.json({ error: 'Could not save your feedback' }, { status: 500 })
  }

  // Email is best-effort — the row above is the durable record.
  const to = process.env.FEEDBACK_TO_EMAIL
  if (!to) {
    // Log loudly: a misconfigured deploy would otherwise collect feedback
    // silently and nobody would notice the emails had stopped.
    console.warn('[feedback] FEEDBACK_TO_EMAIL is not set — feedback saved but not emailed')
  } else {
    const { data: profile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single()

    const label = CATEGORY_LABEL[category as Category]
    const result = await sendEmail({
      to,
      subject: `[Jaune feedback · ${label}] ${message.slice(0, 60).replace(/\s+/g, ' ')}`,
      replyTo: user.email,
      text: [
        message,
        '',
        '—',
        `Category:  ${label}`,
        `From:      ${profile?.name ?? 'Unknown'} <${user.email ?? 'no email'}>`,
        `User ID:   ${user.id}`,
        `Page:      ${page ?? 'unknown'}`,
        `Device:    ${userAgent ?? 'unknown'}`,
        `Record:    feedback.id = ${row.id}`,
      ].join('\n'),
    })

    if (result.ok) {
      // Service-role client on purpose: `emailed_at` is server bookkeeping, and
      // the RLS policies deliberately give users no UPDATE on this table — they
      // must not be able to edit feedback after sending or forge this stamp.
      const { error: stampError } = await createAdminClient()
        .from('feedback')
        .update({ emailed_at: new Date().toISOString() })
        .eq('id', row.id)
      if (stampError) console.error('[feedback] could not stamp emailed_at:', stampError.message)
    } else if (result.reason === 'failed') {
      console.error('[feedback] email send failed:', result.detail)
    } else {
      console.warn('[feedback] RESEND_API_KEY is not set — feedback saved but not emailed')
    }
  }

  // Always 200 once persisted — a delivery problem is ours, not the user's.
  return NextResponse.json({ ok: true })
}

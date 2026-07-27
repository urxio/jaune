/**
 * Minimal transactional email sender (Resend REST API, no SDK dependency).
 * Server-only — never import from client code, it reads RESEND_API_KEY.
 *
 * Deliberately non-throwing: callers treat email as best-effort. Anything that
 * matters is persisted to the DB before send is attempted.
 */

type SendArgs = {
  to: string
  subject: string
  text: string
  replyTo?: string
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not-configured' | 'failed'; detail?: string }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function sendEmail({ to, subject, text, replyTo }: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  // Must be an address on a domain verified in Resend. `onboarding@resend.dev`
  // works without a verified domain but can only deliver to the Resend account
  // owner's own address — fine for testing, not for production.
  const from = process.env.EMAIL_FROM ?? 'Jaune <onboarding@resend.dev>'

  if (!apiKey) return { ok: false, reason: 'not-configured' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      // Don't let a slow provider hold the request open.
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, reason: 'failed', detail: `${res.status} ${detail}`.trim() }
    }

    const data = await res.json().catch(() => ({}))
    return { ok: true, id: typeof data?.id === 'string' ? data.id : null }
  } catch (err) {
    return { ok: false, reason: 'failed', detail: err instanceof Error ? err.message : 'unknown' }
  }
}

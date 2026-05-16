import { createClient } from '@/lib/supabase/server'
import { getRecentCheckins } from '@/lib/db/checkins'
import { getRecentJournals } from '@/lib/db/journals'
import CheckinHistory from '@/components/checkin/CheckinHistory'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CheckinHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [checkins, journals] = await Promise.all([
    getRecentCheckins(user.id, 30),
    getRecentJournals(user.id, 30),
  ])

  return (
    <div className="page-pad" style={{ maxWidth: '860px', margin: '0 auto', animation: 'fadeUp 0.3s var(--ease) both' }}>

      {/* Page header */}
      <div style={{ marginBottom: '36px' }}>
        <Link
          href="/checkin"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none',
            letterSpacing: '0.03em', marginBottom: '14px',
          }}
        >
          ← Back to Check-in
        </Link>
        <div style={{
          fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--gold)', fontWeight: 600, marginBottom: '6px', opacity: 0.85,
        }}>
          History
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 400,
          color: 'var(--text-0)', lineHeight: 1.15,
        }}>
          Your <em style={{ fontStyle: 'italic', color: 'var(--text-1)' }}>daily record</em>
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '6px' }}>
          Check-ins and journal entries from the last 30 days.
        </div>
      </div>

      <CheckinHistory checkins={checkins} journals={journals} />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CheckinFlow from './CheckinFlow'
import BriefHistory from '@/components/brief/BriefHistory'
import PostCheckinBrief from '@/components/brief/PostCheckinBrief'
import type { CheckIn, Brief } from '@/lib/types'
import type { UserMemory } from '@/lib/ai/memory'

export type Tab = 'checkin' | 'journal'

type Props = {
  existingCheckin: CheckIn | null
  memory?:         UserMemory | null
  hasBrief?:       boolean
  pastBriefs?:     Brief[]
}

export default function CheckinTabs({
  existingCheckin,
  memory, hasBrief = false, pastBriefs = [],
}: Props) {
  const router = useRouter()
  const [briefReady, setBriefReady] = useState(hasBrief || !!existingCheckin)
  const [briefKey, setBriefKey] = useState(0)

  const handleCheckinSaved = () => {
    if (briefReady) setBriefKey(k => k + 1)
    setBriefReady(true)
  }

  return (
    <div className="page-pad" style={{ maxWidth: '680px', width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
      <CheckinFlow
        existingCheckin={existingCheckin}
        onCheckinSaved={handleCheckinSaved}
        onOpenJournal={() => router.push('/journal')}
      />

      {briefReady && (
        <div style={{ marginTop: '24px' }}>
          <PostCheckinBrief key={briefKey} memory={memory} />
        </div>
      )}

      {pastBriefs.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <BriefHistory briefs={pastBriefs} />
        </div>
      )}
    </div>
  )
}

/* ── Shared tab toggle (used by JournalSection) ──────────────────────────── */
export function TabToggle({
  tab,
  setTab,
  todayJournalHasContent,
}: {
  tab: Tab
  setTab: (t: Tab) => void
  todayJournalHasContent: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: '9px',
      padding: '3px',
      gap: '2px',
      flexShrink: 0,
    }}>
      {(['checkin', 'journal'] as const).map(t => {
        const active = tab === t
        return (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 14px', borderRadius: '7px', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              transition: 'all 0.15s',
              background: active ? 'var(--bg-0)' : 'transparent',
              color: active ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '5px',
              whiteSpace: 'nowrap',
            }}
          >
            {t === 'checkin' ? 'Check-in' : 'Journal'}
            {t === 'journal' && todayJournalHasContent && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--sage)', flexShrink: 0 }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

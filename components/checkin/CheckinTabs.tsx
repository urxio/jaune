'use client'

import { useState } from 'react'
import FullscreenCheckinFlow from './FullscreenCheckinFlow'
import JournalSection from './JournalSection'
import type { CheckIn, JournalEntry, Brief } from '@/lib/types'
import type { UserMemory } from '@/lib/ai/memory'

export type Tab = 'checkin' | 'journal'

type Props = {
  existingCheckin: CheckIn | null
  todayJournal:    JournalEntry | null
  recentJournals:  JournalEntry[]
  memory?:         UserMemory | null
  hasBrief?:       boolean
  pastBriefs?:     Brief[]
  initialTab?:     Tab
}

export default function CheckinTabs({
  existingCheckin, todayJournal, recentJournals,
  memory, hasBrief = false, initialTab = 'checkin',
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div>
      <div style={{ display: tab === 'checkin' ? 'block' : 'none' }}>
        <FullscreenCheckinFlow
          existingCheckin={existingCheckin}
          todayJournal={todayJournal}
          memory={memory}
          hasBrief={hasBrief}
          setTab={setTab}
        />
      </div>

      <div style={{ display: tab === 'journal' ? 'block' : 'none', animation: tab === 'journal' ? 'fadeUp 0.22s var(--ease) both' : 'none' }}>
        <JournalSection
          existing={todayJournal}
          recentJournals={recentJournals}
          tab={tab}
          setTab={setTab}
          todayJournalHasContent={!!todayJournal?.content}
        />
      </div>
    </div>
  )
}

/* ── Shared tab toggle — used by JournalSection ──────────────────────────── */
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

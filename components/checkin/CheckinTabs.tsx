'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CheckinFlow from './CheckinFlow'
import BackfillCheckin from './BackfillCheckin'
import YesterdayPlanReview from './YesterdayPlanReview'
import BriefHistory from '@/components/brief/BriefHistory'
import PostCheckinBrief from '@/components/brief/PostCheckinBrief'
import type { CheckIn, Brief } from '@/lib/types'
import type { UserMemory } from '@/lib/ai/memory'

export type Tab = 'checkin' | 'journal'
type MainTab = 'today' | 'past'

type Props = {
  existingCheckin:    CheckIn | null
  memory?:            UserMemory | null
  hasBrief?:          boolean
  pastBriefs?:        Brief[]
  followupAlreadyDone?: boolean
  recentCheckins?:    CheckIn[]
  /** Yesterday's brief, when its priority outcomes haven't been recorded yet. */
  yesterdayBrief?:    Brief | null
}

export default function CheckinTabs({
  existingCheckin,
  memory, hasBrief = false, pastBriefs = [], followupAlreadyDone = false,
  recentCheckins = [], yesterdayBrief = null,
}: Props) {
  const router = useRouter()
  const [briefReady, setBriefReady] = useState(hasBrief || !!existingCheckin)
  const [briefKey, setBriefKey] = useState(0)
  const [mainTab, setMainTab] = useState<MainTab>('today')

  const handleCheckinSaved = () => {
    if (briefReady) setBriefKey(k => k + 1)
    setBriefReady(true)
  }

  // Count past days (last 6) that are missing a check-in
  const today = new Date()
  const missedCount = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (i + 1))
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return recentCheckins.some(c => c.date === ds) ? 0 as number : 1 as number
  }).reduce((a, b) => a + b, 0)

  return (
    <div className="page-pad" style={{ maxWidth: '680px', width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '9px', padding: '3px', marginBottom: '28px' }}>
        {(['today', 'past'] as const).map(t => {
          const active = mainTab === t
          return (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              style={{
                flex: 1,
                padding: '7px 14px', borderRadius: '7px', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                transition: 'all 0.15s',
                background: active ? 'var(--bg-0)' : 'transparent',
                color: active ? 'var(--text-0)' : 'var(--text-3)',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              {t === 'today' ? "Today's Check-in" : 'Past Days'}
              {t === 'past' && missedCount > 0 && (
                <span style={{
                  minWidth: '18px', height: '18px', borderRadius: '9px',
                  background: active ? 'var(--gold)' : 'var(--gold-dim)',
                  color: active ? '#131110' : 'var(--gold)',
                  fontSize: '10px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px',
                }}>
                  {missedCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {mainTab === 'today' && (
        <>
          {yesterdayBrief && !yesterdayBrief.priority_outcomes && (
            <YesterdayPlanReview brief={yesterdayBrief} />
          )}

          <CheckinFlow
            existingCheckin={existingCheckin}
            onCheckinSaved={handleCheckinSaved}
            onOpenJournal={() => router.push('/journal')}
            followupAlreadyDone={followupAlreadyDone}
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
        </>
      )}

      {mainTab === 'past' && (
        <BackfillCheckin recentCheckins={recentCheckins} />
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

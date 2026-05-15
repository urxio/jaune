'use client'

import { useState } from 'react'
import CheckinFlow from './CheckinFlow'
import JournalSection from './JournalSection'
import BriefHistory from '@/components/brief/BriefHistory'
import PostCheckinBrief from '@/components/brief/PostCheckinBrief'
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
  memory, hasBrief = false, pastBriefs = [], initialTab = 'checkin',
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [briefReady, setBriefReady] = useState(hasBrief || !!existingCheckin)
  const [briefKey, setBriefKey] = useState(0)

  const handleCheckinSaved = () => {
    if (briefReady) setBriefKey(k => k + 1)
    setBriefReady(true)
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Check-in content (always mounted) ── */}
      <div className="page-pad" style={{ maxWidth: '680px', width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
        <CheckinFlow
          existingCheckin={existingCheckin}
          onCheckinSaved={handleCheckinSaved}
          onOpenJournal={() => setTab('journal')}
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

      {/* ── Journal — slides in from the right as a fullscreen panel ── */}
      <div
        aria-hidden={tab !== 'journal'}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          transform: tab === 'journal' ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          background: 'oklch(0.11 0.015 60 / 0.96)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Back button */}
        <div style={{
          flexShrink: 0,
          padding: '20px 28px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <button
            onClick={() => setTab('checkin')}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '9999px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'oklch(0.75 0.01 70)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5"/>
            </svg>
            Check-in
          </button>
        </div>

        {/* Journal content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <JournalSection
            existing={todayJournal}
            recentJournals={recentJournals}
          />
        </div>
      </div>
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

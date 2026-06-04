'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { submitCheckin } from '@/app/actions/checkin'
import { localDateStr } from '@/lib/utils/date'
import type { CheckIn } from '@/lib/types'
import FollowupQuestion from './FollowupQuestion'

const FOLLOWUP_DONE_KEY = 'locus_followupDone'
type StoredFollowupDone = { date: string }

function readFollowupDone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(FOLLOWUP_DONE_KEY)
    if (!raw) return false
    const stored: StoredFollowupDone = JSON.parse(raw)
    const today = new Date().toISOString().split('T')[0]
    return stored.date === today
  } catch { return false }
}

function saveFollowupDone() {
  if (typeof window === 'undefined') return
  try {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(FOLLOWUP_DONE_KEY, JSON.stringify({ date: today }))
  } catch {}
}

const BLOCKERS = [
  'Unclear priorities', 'Low energy', 'Too many meetings',
  'Waiting on others', 'Personal stress', 'Lack of clarity',
  'Distracted environment', 'No blockers today',
]

type Step = 1 | 2 | 3 | 'done'

export default function CheckinFlow({
  existingCheckin,
  onCheckinSaved,
  onOpenJournal,
  followupAlreadyDone = false,
}: {
  existingCheckin: CheckIn | null
  onCheckinSaved?: () => void
  onOpenJournal?: () => void
  followupAlreadyDone?: boolean
}) {
  const [step, setStep] = useState<Step>(existingCheckin ? 'done' : 1)
  const [energy, setEnergy] = useState(existingCheckin?.energy_level ?? 7)
  const [moodNote, setMoodNote] = useState(existingCheckin?.mood_note ?? '')
  const [blockers, setBlockers] = useState<string[]>(existingCheckin?.blockers ?? [])
  const [highlight, setHighlight] = useState(existingCheckin?.highlight ?? '')
  const [loading, setLoading] = useState(false)
  const [isRedo, setIsRedo] = useState(false)
  const router = useRouter()

  const [followupQ, setFollowupQ] = useState<string | null>(null)
  const [followupDone, setFollowupDone] = useState(() => followupAlreadyDone || readFollowupDone())
  const followupFetchedRef = useRef(followupAlreadyDone || readFollowupDone())

  useEffect(() => {
    if (step !== 'done' || followupFetchedRef.current || !moodNote.trim()) return
    const words = moodNote.trim().split(/\s+/).filter(Boolean).length
    if (words > 50) return
    followupFetchedRef.current = true
    fetch('/api/followup/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: moodNote, type: 'checkin' }),
    })
      .then(r => r.json())
      .then(({ question }) => { if (question) setFollowupQ(question) })
      .catch(() => {})
  }, [step, moodNote])

  async function handleSubmit() {
    setLoading(true)
    await submitCheckin({
      energy_level: energy,
      mood_note: moodNote || null,
      blockers,
      highlight: highlight.trim() || null,
      localDate: localDateStr(),
    })
    setStep('done')
    setLoading(false)
    router.refresh()
    onCheckinSaved?.()
  }

  const energyLabel =
    energy >= 9 ? 'Exceptional' :
    energy >= 7 ? 'High' :
    energy >= 5 ? 'Moderate' :
    energy >= 3 ? 'Low' : 'Depleted'

  const energyColor =
    energy >= 7 ? 'var(--sage)' :
    energy >= 5 ? 'var(--gold)' : '#c08060'

  return (
    <div style={{ animation: 'fadeUp 0.3s var(--ease) both' }}>
      {/* ── Step progress ── */}
      {step !== 'done' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
          {([1, 2, 3] as const).map(i => (
            <div key={i} style={{
              height: '3px',
              width: i === Number(step) ? '28px' : '12px',
              borderRadius: '2px',
              background: i <= Number(step) ? 'var(--gold)' : 'var(--border-md)',
              opacity: i < Number(step) ? 0.45 : 1,
              transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          ))}
        </div>
      )}

      {step === 1 && (
        <EnergyStep
          energy={energy}
          setEnergy={setEnergy}
          energyLabel={energyLabel}
          energyColor={energyColor}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <MoodStep
          moodNote={moodNote}
          setMoodNote={setMoodNote}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <BlockersStep
          blockers={blockers}
          setBlockers={setBlockers}
          highlight={highlight}
          setHighlight={setHighlight}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
          loading={loading}
          isRedo={isRedo}
        />
      )}
      {step === 'done' && (
        <DoneStep
          energy={energy}
          energyLabel={energyLabel}
          energyColor={energyColor}
          moodNote={moodNote}
          blockers={blockers}
          highlight={highlight}
          isRedo={isRedo}
          onRedo={() => {
            setIsRedo(true)
            setStep(1)
            followupFetchedRef.current = false
            setFollowupQ(null)
            setFollowupDone(false)
            localStorage.removeItem(FOLLOWUP_DONE_KEY)
          }}
          onOpenJournal={onOpenJournal}
          followupQ={followupQ}
          followupDone={followupDone}
          setFollowupDone={(v: boolean) => { setFollowupDone(v); if (v) saveFollowupDone() }}
        />
      )}
    </div>
  )
}

/* ── Step 1: Energy ──────────────────────────────────────────────────────── */

function EnergyStep({
  energy, setEnergy, energyLabel, energyColor, onNext,
}: {
  energy: number
  setEnergy: (fn: (v: number) => number) => void
  energyLabel: string
  energyColor: string
  onNext: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')   setEnergy(v => Math.min(10, v + 1))
      if (e.key === 'ArrowDown') setEnergy(v => Math.max(1,  v - 1))
      if (e.key === 'Enter')     onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setEnergy, onNext])

  return (
    <div style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '26px',
        fontWeight: 300,
        color: 'var(--text-0)',
        marginBottom: '6px',
        lineHeight: 1.3,
      }}>
        What&apos;s your energy level?
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '40px', lineHeight: 1.5 }}>
        Be honest — this calibrates your daily priorities.
      </div>

      {/* Number + arrows */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <ArrowButton
          direction="up"
          disabled={energy === 10}
          onClick={() => setEnergy(v => Math.min(10, v + 1))}
          aria-label="Increase energy"
        />

        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(80px, 14vw, 120px)',
          fontWeight: 300,
          color: 'var(--text-0)',
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          transition: 'color 0.25s',
          userSelect: 'none',
        }}>
          {energy}
        </div>

        <ArrowButton
          direction="down"
          disabled={energy === 1}
          onClick={() => setEnergy(v => Math.max(1, v - 1))}
          aria-label="Decrease energy"
        />
      </div>

      <div style={{
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: energyColor,
        transition: 'color 0.25s',
        marginBottom: '36px',
      }}>
        {energyLabel}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-3)', opacity: 0.6 }}>
          ↑↓ arrow keys · Enter to continue
        </span>
        <button
          onClick={onNext}
          style={{
            padding: '11px 32px',
            background: 'var(--gold)',
            color: '#131110',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

/* ── Step 2: Mood ────────────────────────────────────────────────────────── */

function MoodStep({
  moodNote, setMoodNote, onBack, onNext,
}: {
  moodNote: string
  setMoodNote: (v: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wordCount = moodNote.trim() ? moodNote.trim().split(/\s+/).filter(Boolean).length : 0

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 60)
  }, [])

  return (
    <div style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '26px',
        fontWeight: 300,
        color: 'var(--text-0)',
        marginBottom: '6px',
        lineHeight: 1.3,
      }}>
        What&apos;s on your mind today?
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px', lineHeight: 1.5 }}>
        A sentence is enough. Jaune finds patterns over time.
      </div>

      <textarea
        ref={textareaRef}
        value={moodNote}
        onChange={e => setMoodNote(e.target.value)}
        rows={5}
        placeholder="e.g. Feeling focused but slightly anxious about the demo on Friday..."
        style={{
          width: '100%',
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          fontFamily: 'var(--font-sans)',
          fontSize: '15px',
          color: 'var(--text-0)',
          resize: 'none',
          outline: 'none',
          lineHeight: 1.7,
          marginBottom: '20px',
          boxSizing: 'border-box',
          caretColor: 'var(--gold)',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-3)',
              fontSize: '13.5px', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0,
              transition: 'color 0.15s',
            }}
          >
            ← Back
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-3)', opacity: 0.6 }}>
            {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : 'optional'}
          </span>
        </div>
        <button
          onClick={onNext}
          style={{
            padding: '11px 32px',
            background: 'var(--gold)',
            color: '#131110',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

/* ── Step 3: Blockers + Highlight ────────────────────────────────────────── */

function BlockersStep({
  blockers, setBlockers, highlight, setHighlight, onBack, onSubmit, loading, isRedo,
}: {
  blockers: string[]
  setBlockers: (fn: string[] | ((p: string[]) => string[])) => void
  highlight: string
  setHighlight: (v: string) => void
  onBack: () => void
  onSubmit: () => void
  loading: boolean
  isRedo: boolean
}) {
  return (
    <div style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '26px',
        fontWeight: 300,
        color: 'var(--text-0)',
        marginBottom: '6px',
        lineHeight: 1.3,
      }}>
        Wins &amp; blockers
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '28px', lineHeight: 1.5 }}>
        Share a win to keep things balanced — then flag what&apos;s in your way.
      </div>

      {/* Highlight */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>
          Today&apos;s highlight <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
        </div>
        <input
          type="text"
          value={highlight}
          onChange={e => setHighlight(e.target.value)}
          placeholder="e.g. Shipped a feature, great 1:1 with my manager…"
          style={{
            width: '100%',
            background: 'var(--bg-1)',
            border: '1px solid var(--border-md)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            color: 'var(--text-0)',
            outline: 'none',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Blocker chips */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px' }}>
          Blockers <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— select all that apply</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {BLOCKERS.map(b => {
            const active = blockers.includes(b)
            return (
              <button
                key={b}
                onClick={() => setBlockers(prev =>
                  prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
                )}
                style={{
                  padding: '10px 18px',
                  minHeight: '44px',
                  background: active ? 'var(--gold-dim)' : 'var(--bg-2)',
                  border: `1px solid ${active ? 'rgba(212,168,83,0.3)' : 'var(--border-md)'}`,
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--gold)' : 'var(--text-1)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {b}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-3)',
            fontSize: '13.5px', cursor: 'pointer',
            fontFamily: 'inherit', padding: 0,
          }}
        >
          ← Back
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          style={{
            padding: '11px 32px',
            background: 'var(--gold)',
            color: '#131110',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: loading ? 0.65 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Saving…' : isRedo ? 'Update Check-in' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

/* ── Done state ──────────────────────────────────────────────────────────── */

function DoneStep({
  energy, energyLabel, energyColor, moodNote, blockers, highlight, isRedo,
  onRedo, onOpenJournal, followupQ, followupDone, setFollowupDone,
}: {
  energy: number
  energyLabel: string
  energyColor: string
  moodNote: string
  blockers: string[]
  highlight: string
  isRedo: boolean
  onRedo: () => void
  onOpenJournal?: () => void
  followupQ: string | null
  followupDone: boolean
  setFollowupDone: (v: boolean) => void
}) {
  return (
    <div style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <div className="glass-card-sm" style={{ padding: '28px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(122,158,138,0.2), rgba(122,158,138,0.08))',
            border: '1px solid rgba(122,158,138,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--sage)" strokeWidth="2.2">
              <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'var(--text-0)' }}>
              {isRedo ? 'Check-in updated.' : 'Check-in complete.'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '3px' }}>
              {isRedo ? 'Your brief will regenerate with the new data.' : 'Jaune has updated your daily brief.'}
            </div>
          </div>
        </div>

        <div className="stats-grid-3">
          <SummaryTile label="Energy" value={`${energy}/10`} sub={energyLabel} color={energyColor} />
          <SummaryTile
            label="Mood"
            value={moodNote ? '✓ logged' : '—'}
            sub={moodNote ? moodNote.slice(0, 26) + (moodNote.length > 26 ? '…' : '') : 'skipped'}
          />
          <SummaryTile
            label="Blockers"
            value={`${blockers.filter(b => b !== 'No blockers today').length}`}
            sub={blockers.length === 0 || blockers.includes('No blockers today') ? 'none today' : blockers[0]}
          />
        </div>

        {highlight.trim() && (
          <div style={{
            marginTop: '12px', padding: '10px 14px',
            background: 'rgba(122,158,138,0.08)', border: '1px solid rgba(122,158,138,0.2)',
            borderRadius: '8px', fontSize: '13px', color: 'var(--text-1)',
            display: 'flex', alignItems: 'flex-start', gap: '8px',
          }}>
            <span style={{ color: 'var(--sage)', flexShrink: 0 }}>★</span>
            <span>{highlight.trim()}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onRedo}
          style={{
            flex: 1,
            background: 'none',
            border: '1px solid var(--border-md)',
            color: 'var(--text-2)',
            borderRadius: '9px', padding: '12px',
            fontSize: '13.5px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ↺ Update
        </button>
        {onOpenJournal && (
          <button
            onClick={onOpenJournal}
            style={{
              flex: 2,
              background: 'var(--gold)',
              color: '#131110',
              border: 'none',
              borderRadius: '9px', padding: '12px',
              fontSize: '13.5px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Write in journal →
          </button>
        )}
      </div>

      {followupQ && !followupDone && (
        <FollowupQuestion
          question={followupQ}
          context={moodNote}
          onDone={() => setFollowupDone(true)}
        />
      )}
    </div>
  )
}

/* ── Shared: Summary tile ────────────────────────────────────────────────── */

function SummaryTile({ label, value, sub, color }: {
  label: string; value: string; sub: string; color?: string
}) {
  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: '10px', padding: '12px 14px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 400, color: color ?? 'var(--text-0)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sub}
      </div>
    </div>
  )
}

/* ── Shared: Up/Down arrow button ────────────────────────────────────────── */

function ArrowButton({ direction, disabled, onClick, 'aria-label': ariaLabel }: {
  direction: 'up' | 'down'
  disabled: boolean
  onClick: () => void
  'aria-label': string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: '48px', height: '48px',
        borderRadius: '50%',
        border: `1px solid ${disabled ? 'var(--border)' : 'var(--border-md)'}`,
        background: 'var(--bg-2)',
        color: disabled ? 'var(--text-3)' : 'var(--text-1)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget.style.background = 'var(--bg-3)') }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget.style.background = 'var(--bg-2)') }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'up'
          ? <path d="M5 12.5l5-5 5 5"/>
          : <path d="M5 7.5l5 5 5-5"/>
        }
      </svg>
    </button>
  )
}

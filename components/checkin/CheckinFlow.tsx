'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { submitCheckin } from '@/app/actions/checkin'
import { localDateStr } from '@/lib/utils/date'
import type { CheckIn } from '@/lib/types'
import FollowupQuestion from './FollowupQuestion'

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
}: {
  existingCheckin: CheckIn | null
  onCheckinSaved?: () => void
  onOpenJournal?: () => void
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
  const [followupDone, setFollowupDone] = useState(false)
  const followupFetchedRef = useRef(false)

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

  const isFullscreen = step !== 'done'

  return (
    <>
      {/* ── FULLSCREEN FLOW (steps 1–3) ── */}
      {isFullscreen && (
        <div
          role="main"
          aria-label="Daily check-in"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Frosted backdrop */}
          <div aria-hidden style={{
            position: 'absolute',
            inset: 0,
            background: 'oklch(0.11 0.015 60 / 0.93)',
            backdropFilter: 'blur(56px) saturate(180%)',
            WebkitBackdropFilter: 'blur(56px) saturate(180%)',
          }} />

          {/* Ambient top glow */}
          <div aria-hidden style={{
            position: 'absolute',
            top: '-100px', left: '50%',
            transform: 'translateX(-50%)',
            width: '600px', height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, oklch(0.78 0.09 75 / 0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Step progress bar */}
          <div style={{
            position: 'absolute',
            top: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            zIndex: 1,
            alignItems: 'center',
          }}>
            {([1, 2, 3] as const).map(i => (
              <div key={i} style={{
                height: '3px',
                width: i === Number(step) ? '28px' : '12px',
                borderRadius: '2px',
                background: i <= Number(step)
                  ? 'var(--gold)'
                  : 'rgba(255,255,255,0.15)',
                opacity: i < Number(step) ? 0.45 : 1,
                transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            ))}
          </div>

          {/* Step content */}
          <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {step === 1 && (
              <EnergyStep
                key="energy"
                energy={energy}
                setEnergy={setEnergy}
                energyLabel={energyLabel}
                energyColor={energyColor}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <MoodStep
                key="mood"
                moodNote={moodNote}
                setMoodNote={setMoodNote}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <BlockersStep
                key="blockers"
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
          </div>
        </div>
      )}

      {/* ── DONE STATE (inline, no overlay) ── */}
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
          }}
          onOpenJournal={onOpenJournal}
          followupQ={followupQ}
          followupDone={followupDone}
          setFollowupDone={setFollowupDone}
        />
      )}
    </>
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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      animation: 'fadeUp 0.45s var(--ease) both',
    }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'clamp(20px, 3.5vw, 30px)',
        fontWeight: 300,
        color: 'oklch(0.85 0.01 70 / 0.85)',
        marginBottom: '52px',
        textAlign: 'center',
        letterSpacing: '-0.01em',
      }}>
        What&apos;s your energy level?
      </div>

      {/* Number + arrows */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        {/* Up */}
        <ArrowButton
          direction="up"
          disabled={energy === 10}
          onClick={() => setEnergy(v => Math.min(10, v + 1))}
          aria-label="Increase energy"
        />

        {/* Giant number */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(100px, 18vw, 160px)',
          fontWeight: 300,
          color: 'oklch(0.97 0.008 80)',
          lineHeight: 0.88,
          letterSpacing: '-0.05em',
          transition: 'color 0.25s',
          userSelect: 'none',
        }}>
          {energy}
        </div>

        {/* Down */}
        <ArrowButton
          direction="down"
          disabled={energy === 1}
          onClick={() => setEnergy(v => Math.max(1, v - 1))}
          aria-label="Decrease energy"
        />
      </div>

      {/* Label */}
      <div style={{
        marginTop: '28px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: energyColor,
        transition: 'color 0.25s',
        minHeight: '18px',
      }}>
        {energyLabel}
      </div>

      {/* Continue */}
      <button
        onClick={onNext}
        style={{
          marginTop: '56px',
          padding: '14px 48px',
          background: 'var(--gold)',
          color: '#131110',
          border: 'none',
          borderRadius: '9999px',
          fontSize: '15px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '0.01em',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Continue
      </button>

      <div style={{ marginTop: '14px', fontSize: '11px', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em' }}>
        ↑ ↓ arrow keys &nbsp;·&nbsp; Enter to continue
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeUp 0.45s var(--ease) both',
    }}>
      {/* Question */}
      <div style={{
        padding: 'clamp(72px, 11vh, 110px) clamp(28px, 9vw, 140px) 28px',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(20px, 3.5vw, 30px)',
          fontWeight: 300,
          color: 'oklch(0.85 0.01 70 / 0.85)',
          letterSpacing: '-0.01em',
          marginBottom: '8px',
        }}>
          What&apos;s on your mind today?
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
          A sentence is enough. Locus finds patterns over time.
        </div>
      </div>

      {/* Full-screen textarea */}
      <div style={{ flex: 1, padding: '0 clamp(28px, 9vw, 140px)', minHeight: 0 }}>
        <textarea
          ref={textareaRef}
          value={moodNote}
          onChange={e => setMoodNote(e.target.value)}
          placeholder="e.g. Feeling focused but slightly anxious about the demo on Friday..."
          style={{
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.025)',
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 0,
            outline: 'none',
            resize: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(16px, 2.2vw, 19px)',
            color: 'oklch(0.95 0.008 80)',
            lineHeight: 1.85,
            padding: '24px 0',
            caretColor: 'var(--gold)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '18px clamp(28px, 9vw, 140px)',
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '13.5px', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            ← Back
          </button>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)' }}>
            {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : 'optional'}
          </span>
        </div>
        <button
          onClick={onNext}
          style={{
            padding: '11px 36px',
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
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      animation: 'fadeUp 0.45s var(--ease) both',
    }}>
      <div style={{
        padding: 'clamp(72px, 11vh, 110px) clamp(28px, 9vw, 140px) 0',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Question */}
        <div style={{ flexShrink: 0, marginBottom: '40px' }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(20px, 3.5vw, 30px)',
            fontWeight: 300,
            color: 'oklch(0.85 0.01 70 / 0.85)',
            letterSpacing: '-0.01em',
            marginBottom: '8px',
          }}>
            Wins &amp; blockers
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
            Share a win to keep things balanced — then flag what&apos;s in your way.
          </div>
        </div>

        {/* Today's highlight */}
        <div style={{ flexShrink: 0, marginBottom: '36px' }}>
          <Label text="Today's highlight" optional />
          <input
            type="text"
            value={highlight}
            onChange={e => setHighlight(e.target.value)}
            placeholder="e.g. Shipped the new feature, had a great 1:1…"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '14px 18px',
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              color: 'oklch(0.95 0.008 80)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
        </div>

        {/* Blocker chips */}
        <div style={{ flexShrink: 0 }}>
          <Label text="Blockers" note="select all that apply" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {BLOCKERS.map(b => {
              const active = blockers.includes(b)
              return (
                <button
                  key={b}
                  onClick={() => setBlockers(prev =>
                    prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
                  )}
                  style={{
                    padding: '13px 22px',
                    minHeight: '52px',
                    background: active ? 'rgba(212,168,83,0.16)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? 'rgba(212,168,83,0.5)' : 'rgba(255,255,255,0.11)'}`,
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--gold)' : 'oklch(0.82 0.008 70)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
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

        {/* Bottom bar */}
        <div style={{
          flexShrink: 0,
          marginTop: 'auto',
          padding: '28px 0 32px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '13.5px', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            ← Back
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            style={{
              padding: '14px 48px',
              background: 'var(--gold)',
              color: '#131110',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '15px',
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
    </div>
  )
}

/* ── Done state (inline) ─────────────────────────────────────────────────── */

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
    <div style={{ animation: 'fadeUp 0.4s var(--ease) both' }}>
      {/* Summary card */}
      <div style={{
        background: 'var(--glass-card-bg)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid var(--glass-card-border)',
        boxShadow: 'var(--glass-card-shadow-sm)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px',
        marginBottom: '16px',
      }}>
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
              {isRedo ? 'Your brief will regenerate with the new data.' : 'Locus has updated your daily brief.'}
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

      {/* Actions */}
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
            transition: 'border-color 0.15s',
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
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
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
        width: '56px', height: '56px',
        borderRadius: '50%',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.18)'}`,
        background: disabled ? 'transparent' : 'rgba(255,255,255,0.05)',
        color: disabled ? 'rgba(255,255,255,0.15)' : 'oklch(0.82 0.008 70)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(255,255,255,0.1)') }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(255,255,255,0.05)') }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'up'
          ? <path d="M5 12.5l5-5 5 5"/>
          : <path d="M5 7.5l5 5 5-5"/>
        }
      </svg>
    </button>
  )
}

/* ── Shared: Section label ───────────────────────────────────────────────── */

function Label({ text, optional, note }: { text: string; optional?: boolean; note?: string }) {
  return (
    <div style={{
      fontSize: '10.5px', fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.3)',
      marginBottom: '12px',
      display: 'flex', gap: '6px', alignItems: 'baseline',
    }}>
      {text}
      {optional && (
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.2)' }}>
          — optional
        </span>
      )}
      {note && (
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.2)' }}>
          — {note}
        </span>
      )}
    </div>
  )
}

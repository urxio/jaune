'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { submitCheckin } from '@/app/actions/checkin'
import { saveJournalAction } from '@/app/actions/journal'
import { localDateStr } from '@/lib/utils/date'
import type { CheckIn, JournalEntry } from '@/lib/types'
import type { UserMemory } from '@/lib/ai/memory'
import PostCheckinBrief from '@/components/brief/PostCheckinBrief'
import type { Tab } from '@/components/checkin/CheckinTabs'

const BLOCKERS = [
  'Unclear priorities', 'Low energy', 'Too many meetings',
  'Waiting on others', 'Personal stress', 'Lack of clarity',
  'Distracted environment', 'No blockers today',
]

type FlowStep = 1 | 2 | 3 | 4

function getEnergyLabel(e: number) {
  return e >= 9 ? 'Exceptional' : e >= 7 ? 'High' : e >= 5 ? 'Moderate' : e >= 3 ? 'Low' : 'Depleted'
}

function getEnergyColor(e: number) {
  return e >= 7 ? 'var(--sage)' : e >= 5 ? 'var(--gold)' : '#c08060'
}

export default function FullscreenCheckinFlow({
  existingCheckin,
  todayJournal,
  memory,
  hasBrief = false,
  setTab,
}: {
  existingCheckin: CheckIn | null
  todayJournal: JournalEntry | null
  memory?: UserMemory | null
  hasBrief?: boolean
  setTab?: (t: Tab) => void
}) {
  const [step, setStep]     = useState<FlowStep>(existingCheckin ? 4 : 1)
  const [energy, setEnergy] = useState(existingCheckin?.energy_level ?? 5)
  const [moodNote, setMoodNote]   = useState(existingCheckin?.mood_note ?? '')
  const [blockers, setBlockers]   = useState<string[]>(existingCheckin?.blockers ?? [])
  const [highlight, setHighlight] = useState(existingCheckin?.highlight ?? '')
  const [loading, setLoading]     = useState(false)
  const [isRedo, setIsRedo]       = useState(false)
  const [briefReady, setBriefReady] = useState(hasBrief || !!existingCheckin)
  const [briefKey, setBriefKey]     = useState(0)
  const [journalContent, setJournalContent] = useState(todayJournal?.content ?? '')
  const [journalStatus, setJournalStatus]   = useState<'idle' | 'saving' | 'saved'>('idle')
  const journalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const eLabel = getEnergyLabel(energy)
  const eColor = getEnergyColor(energy)

  async function handleSubmit() {
    setLoading(true)
    try {
      await submitCheckin({
        energy_level: energy,
        mood_note:    moodNote.trim() || null,
        blockers,
        highlight:    highlight.trim() || null,
        localDate:    localDateStr(),
      })
      if (briefReady) setBriefKey(k => k + 1)
      setBriefReady(true)
      setIsRedo(false)
      router.refresh()
      setStep(4)
    } finally {
      setLoading(false)
    }
  }

  function handleRedo() {
    setIsRedo(true)
    setStep(1)
  }

  const handleJournalChange = useCallback((val: string) => {
    setJournalContent(val)
    setJournalStatus('idle')
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current)
    journalTimerRef.current = setTimeout(async () => {
      if (!val.trim()) return
      setJournalStatus('saving')
      try {
        await saveJournalAction(val.trim(), localDateStr())
        setJournalStatus('saved')
        setTimeout(() => setJournalStatus('idle'), 2000)
      } catch {
        setJournalStatus('idle')
      }
    }, 1800)
  }, [])

  const STEP_LABELS = ['Energy', 'Mood', 'Wins', 'Done']

  return (
    <div style={{
      display: 'flex',
      minHeight: 'calc(100vh - 64px)',
      background: 'var(--bg-0)',
    }}>

      {/* ── Left: vertical step indicator ── */}
      <div style={{
        width: '130px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: 'calc(100vh - 64px)',
        paddingLeft: '20px',
      }}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as FlowStep
          const isActive = step === stepNum
          const isDone   = step > stepNum
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                border: `1.5px solid ${isActive ? 'var(--gold)' : isDone ? 'oklch(1 0 0 / 0.25)' : 'oklch(1 0 0 / 0.12)'}`,
                background: isActive ? 'var(--gold)' : 'transparent',
                transition: 'all 0.3s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isDone && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 4-4" stroke="oklch(1 0 0 / 0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase',
                color: isActive ? 'var(--gold)' : isDone ? 'oklch(1 0 0 / 0.25)' : 'oklch(1 0 0 / 0.15)',
                fontWeight: isActive ? 700 : 400,
                marginTop: '5px',
              }}>
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div style={{
                  width: '1px', height: '36px', margin: '8px 0',
                  background: isDone ? 'oklch(1 0 0 / 0.18)' : 'oklch(1 0 0 / 0.07)',
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Right: content area ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: step === 4 ? 'flex-start' : 'center',
        padding: step === 4 ? '72px 64px 96px' : '0 64px',
        overflowY: step === 4 ? 'auto' : 'visible',
        scrollbarWidth: 'none',
        minHeight: 'calc(100vh - 64px)',
        position: 'relative',
      }}>

        {/* ── Step 1: Energy ── */}
        {step === 1 && (
          <div key="step1" style={{ animation: 'fadeUp 0.3s var(--ease) both', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, margin: '0 0 14px', opacity: 0.75 }}>
              Step 1 of 3
            </p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.15, margin: '0 0 10px' }}>
              What&apos;s your energy level right now?
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-3)', margin: '0 0 52px', lineHeight: 1.65 }}>
              Be honest — this calibrates your daily priorities.
            </p>

            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '96px', fontWeight: 300,
                color: eColor, lineHeight: 1, transition: 'color 0.3s',
              }}>
                {energy}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: eColor, marginTop: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'color 0.3s' }}>
                {eLabel}
              </div>
            </div>

            <div style={{ marginBottom: '52px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
                <span>Depleted</span><span>Exceptional</span>
              </div>
              <input
                type="range" min="1" max="10" value={energy}
                onChange={e => setEnergy(Number(e.target.value))}
                style={{ width: '100%', appearance: 'none', height: '2px', borderRadius: '2px', background: `linear-gradient(to right, var(--gold) ${(energy - 1) / 9 * 100}%, oklch(1 0 0 / 0.1) ${(energy - 1) / 9 * 100}%)`, outline: 'none', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(2)} style={pillBtn('primary')}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Mood ── */}
        {step === 2 && (
          <div key="step2" style={{ animation: 'fadeUp 0.3s var(--ease) both', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, margin: '0 0 14px', opacity: 0.75 }}>
              Step 2 of 3
            </p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.15, margin: '0 0 10px' }}>
              What&apos;s on your mind today?
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-3)', margin: '0 0 36px', lineHeight: 1.65 }}>
              A sentence is enough. Locus finds patterns across entries over time.
            </p>

            <textarea
              autoFocus
              value={moodNote}
              onChange={e => setMoodNote(e.target.value)}
              placeholder="e.g. Feeling focused but anxious about the demo on Friday..."
              rows={4}
              style={{
                width: '100%', background: 'oklch(1 0 0 / 0.03)',
                border: '1px solid oklch(1 0 0 / 0.09)', borderRadius: '16px',
                padding: '20px 24px', fontFamily: 'var(--font-sans)', fontSize: '15px',
                color: 'var(--text-0)', resize: 'none', outline: 'none', lineHeight: 1.75,
                boxSizing: 'border-box', caretColor: 'var(--gold)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
              <button onClick={() => setStep(1)} style={pillBtn('ghost')}>← Back</button>
              <button onClick={() => setStep(3)} style={pillBtn('primary')}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Wins + Blockers ── */}
        {step === 3 && (
          <div key="step3" style={{ animation: 'fadeUp 0.3s var(--ease) both', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, margin: '0 0 14px', opacity: 0.75 }}>
              Step 3 of 3
            </p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.15, margin: '0 0 10px' }}>
              Wins &amp; blockers
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-3)', margin: '0 0 36px', lineHeight: 1.65 }}>
              What&apos;s going well — and what&apos;s in your way?
            </p>

            <div style={{ marginBottom: '28px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '12px' }}>
                Today&apos;s highlight <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
              </label>
              <input
                type="text"
                value={highlight}
                onChange={e => setHighlight(e.target.value)}
                placeholder="e.g. Shipped the new feature, great 1:1 with manager…"
                style={{
                  width: '100%', background: 'oklch(1 0 0 / 0.03)',
                  border: '1px solid oklch(1 0 0 / 0.09)', borderRadius: '12px',
                  padding: '15px 20px', fontFamily: 'var(--font-sans)', fontSize: '15px',
                  color: 'var(--text-0)', outline: 'none', lineHeight: 1.5,
                  boxSizing: 'border-box', caretColor: 'var(--gold)',
                }}
              />
            </div>

            <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '12px' }}>
              Blockers <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— select all that apply</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '40px' }}>
              {BLOCKERS.map(b => {
                const active = blockers.includes(b)
                return (
                  <button key={b}
                    onClick={() => setBlockers(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])}
                    style={{
                      padding: '10px 18px',
                      background: active ? 'oklch(0.78 0.12 75 / 0.1)' : 'oklch(1 0 0 / 0.03)',
                      border: `1px solid ${active ? 'oklch(0.78 0.12 75 / 0.28)' : 'oklch(1 0 0 / 0.09)'}`,
                      borderRadius: '9999px', fontSize: '13px',
                      color: active ? 'var(--gold)' : 'var(--text-2)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}>
                    {b}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={pillBtn('ghost')}>← Back</button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ ...pillBtn('primary'), opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
              >
                {loading ? 'Saving…' : isRedo ? 'Update Check-in' : 'Submit Check-in'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Completion ── */}
        {step === 4 && (
          <div key="step4" style={{ animation: 'fadeUp 0.35s var(--ease) both', width: '100%', maxWidth: '640px' }}>

            {/* Heading */}
            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <h1 style={{
                fontFamily: 'var(--font-serif)', fontWeight: 400,
                fontSize: 'clamp(36px, 6vw, 60px)', color: 'var(--text-0)',
                lineHeight: 1.1, margin: '0 0 14px',
              }}>
                {isRedo ? 'Check-in Updated.' : 'Check-in Complete.'}
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-3)', lineHeight: 1.65, margin: 0 }}>
                {briefReady
                  ? 'Your brief is ready. Take a moment to capture your thoughts.'
                  : 'Check-in saved. Take a moment to capture your thoughts.'}
              </p>
            </div>

            {/* Summary card */}
            <div style={{
              background: '#1d1c18',
              borderRadius: '20px',
              padding: '28px 32px',
              marginBottom: '40px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '10px', opacity: 0.8 }}>
                    Today&apos;s Check-in
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'var(--text-0)', marginBottom: '20px', lineHeight: 1.3 }}>
                    {eLabel} Energy Day
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {moodNote?.trim() && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--gold)', opacity: 0.45, flexShrink: 0, marginTop: '3px' }}>◈</span>
                        <span style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: 1.55 }}>{moodNote.trim()}</span>
                      </div>
                    )}
                    {highlight?.trim() && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--sage)', flexShrink: 0, marginTop: '3px' }}>★</span>
                        <span style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: 1.55 }}>{highlight.trim()}</span>
                      </div>
                    )}
                    {blockers.length > 0 && !blockers.includes('No blockers today') && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#c08060', opacity: 0.55, flexShrink: 0, marginTop: '3px' }}>◎</span>
                        <span style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: 1.55 }}>
                          {blockers.filter(b => b !== 'No blockers today').join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Energy badge */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Energy
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', lineHeight: 1 }}>
                    <span style={{ fontSize: '44px', fontWeight: 300, color: eColor }}>{energy}</span>
                    <span style={{ fontSize: '18px', color: 'var(--text-3)' }}>/10</span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: eColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '5px' }}>
                    {eLabel} {energy >= 7 ? '↗' : energy >= 5 ? '→' : '↘'}
                  </div>
                </div>
              </div>
            </div>

            {/* Journal */}
            <div style={{ marginBottom: '36px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px', opacity: 0.65 }}>
                Today&apos;s Journal Entry
              </div>
              <textarea
                value={journalContent}
                onChange={e => handleJournalChange(e.target.value)}
                placeholder="Capture your final thoughts here..."
                rows={5}
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-1)',
                  resize: 'none', lineHeight: 1.85, padding: 0, boxSizing: 'border-box',
                  caretColor: 'var(--gold)',
                }}
              />
              <div style={{
                borderTop: '1px solid oklch(0.78 0.12 75 / 0.2)',
                marginTop: '14px', paddingTop: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'oklch(1 0 0 / 0.1)' }} />
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', opacity: 0.5 }}>
                  {journalStatus === 'saving' ? 'Saving…' : journalStatus === 'saved' ? '✓ Saved' : 'Auto-saves'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <button
                onClick={handleRedo}
                style={{ fontSize: '13px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', letterSpacing: '0.02em' }}
              >
                ↺ Update check-in
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                {setTab && (
                  <button
                    onClick={() => setTab('journal')}
                    style={pillBtn('ghost')}
                  >
                    Journal →
                  </button>
                )}
                {briefReady && (
                  <button
                    onClick={() => {
                      document.getElementById('locus-brief-section')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    style={pillBtn('primary')}
                  >
                    View Brief →
                  </button>
                )}
              </div>
            </div>

            {/* Brief (always rendered when ready, scrolled to) */}
            {briefReady && (
              <div id="locus-brief-section" style={{ marginTop: '72px', borderTop: '1px solid oklch(1 0 0 / 0.07)', paddingTop: '56px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '28px' }}>
                  Daily Brief
                </div>
                <PostCheckinBrief key={briefKey} memory={memory} />
              </div>
            )}
          </div>
        )}

        {/* Skip (steps 1–3) */}
        {step < 4 && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              position: 'absolute', top: '28px', right: '40px',
              fontSize: '13.5px', color: 'var(--text-3)', background: 'none',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Skip →
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Shared button style helper ─────────────────────────────────────────── */
function pillBtn(variant: 'primary' | 'ghost'): React.CSSProperties {
  return {
    padding: '14px 40px',
    borderRadius: '9999px',
    border: variant === 'ghost' ? '1px solid oklch(1 0 0 / 0.12)' : 'none',
    background: variant === 'primary' ? 'var(--gold)' : 'transparent',
    color: variant === 'primary' ? '#131110' : 'var(--text-3)',
    fontSize: '14px',
    fontWeight: variant === 'primary' ? 700 : 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  }
}

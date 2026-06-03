'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitCheckin } from '@/app/actions/checkin'
import type { CheckIn } from '@/lib/types'

const BLOCKERS = [
  'Unclear priorities', 'Low energy', 'Too many meetings',
  'Waiting on others', 'Personal stress', 'Lack of clarity',
  'Distracted environment', 'No blockers today',
]

function getDayLabel(date: Date, today: Date): string {
  const diffMs = new Date(today).setHours(0,0,0,0) - new Date(date).setHours(0,0,0,0)
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function energyColor(e: number) {
  return e >= 7 ? 'var(--sage)' : e >= 5 ? 'var(--gold)' : 'oklch(0.68 0.10 45)'
}

function energyToLabel(e: number) {
  if (e >= 9) return 'Charged, fully present'
  if (e >= 7) return 'Strong, mostly clear'
  if (e >= 6) return 'Steady, mostly clear'
  if (e >= 5) return 'Getting by, some friction'
  if (e >= 3) return 'Low, a bit stretched'
  return 'Running on empty'
}

function EnergyDial({ level }: { level: number }) {
  const filled = Math.round((level / 10) * 5)
  const color = energyColor(level)
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(d => (
        <span key={d} style={{
          height: '5px',
          borderRadius: '3px',
          transition: 'all 0.3s',
          background: d <= filled ? color : 'oklch(1 0 0 / 0.12)',
          width: d <= filled ? '16px' : '6px',
        }} />
      ))}
    </div>
  )
}

type DayEntry = {
  date: Date
  dateStr: string
  label: string
  existing: CheckIn | null
}

type FormState = {
  energy: number
  moodNote: string
  blockers: string[]
  highlight: string
  saving: boolean
  saved: boolean
}

function defaultForm(existing: CheckIn | null): FormState {
  return {
    energy: existing?.energy_level ?? 7,
    moodNote: existing?.mood_note ?? '',
    blockers: existing?.blockers ?? [],
    highlight: existing?.highlight ?? '',
    saving: false,
    saved: !!existing,
  }
}

export default function BackfillCheckin({ recentCheckins }: { recentCheckins: CheckIn[] }) {
  const router = useRouter()
  const today = new Date()

  const days: DayEntry[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (i + 1))
    const dateStr = toLocalDateStr(d)
    return {
      date: new Date(d),
      dateStr,
      label: getDayLabel(new Date(d), new Date(today)),
      existing: recentCheckins.find(c => c.date === dateStr) ?? null,
    }
  })

  const [forms, setForms] = useState<Record<string, FormState>>(
    Object.fromEntries(days.map(d => [d.dateStr, defaultForm(d.existing)]))
  )
  const [expanded, setExpanded] = useState<string | null>(null)

  function updateForm(dateStr: string, patch: Partial<FormState>) {
    setForms(prev => ({ ...prev, [dateStr]: { ...prev[dateStr], ...patch } }))
  }

  async function handleSave(dateStr: string) {
    const f = forms[dateStr]
    updateForm(dateStr, { saving: true })
    await submitCheckin({
      energy_level: f.energy,
      mood_note: f.moodNote || null,
      blockers: f.blockers,
      highlight: f.highlight.trim() || null,
      localDate: dateStr,
    })
    updateForm(dateStr, { saving: false, saved: true })
    setExpanded(null)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '4px', lineHeight: 1.5 }}>
        Fill in check-ins you missed. Each saves independently.
      </div>

      {days.map(day => {
        const f = forms[day.dateStr]
        const isOpen = expanded === day.dateStr

        return (
          <div
            key={day.dateStr}
            className="glass-card"
            style={{
              borderRadius: '14px',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s',
              ...(f.saved ? { borderColor: 'rgba(122,158,138,0.35)' } : {}),
            }}
          >
            {/* Row header */}
            <button
              onClick={() => setExpanded(isOpen ? null : day.dateStr)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Status dot */}
                {f.saved ? (
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(122,158,138,0.15)',
                    border: '1px solid rgba(122,158,138,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--sage)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 8l3.5 3.5 7.5-7"/>
                    </svg>
                  </span>
                ) : (
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    background: 'oklch(1 0 0 / 0.06)',
                    border: '1.5px solid oklch(1 0 0 / 0.18)',
                  }} />
                )}

                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: f.saved ? 'oklch(0.93 0.012 80 / 0.9)' : 'oklch(0.93 0.012 80 / 0.7)',
                    lineHeight: 1.2,
                  }}>
                    {day.label}
                  </div>
                  {f.saved && (
                    <div style={{ fontSize: '12px', color: energyColor(f.energy), marginTop: '2px', fontWeight: 500 }}>
                      {energyToLabel(f.energy)}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {f.saved && <EnergyDial level={f.energy} />}
                <svg
                  width="14" height="14" viewBox="0 0 16 16" fill="none"
                  stroke="oklch(1 0 0 / 0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                >
                  <path d="M3 6l5 5 5-5" />
                </svg>
              </div>
            </button>

            {/* Expanded form */}
            {isOpen && (
              <div style={{
                padding: '20px 20px 20px',
                borderTop: '1px solid oklch(1 0 0 / 0.08)',
                animation: 'fadeUp 0.2s var(--ease) both',
              }}>

                {/* Energy */}
                <div style={{ marginBottom: '22px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 12px' }}>
                    Energy
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-0)', margin: '0 0 4px' }}>
                        {energyToLabel(f.energy)}
                      </p>
                      <p style={{ fontSize: '12px', color: energyColor(f.energy), margin: 0, fontWeight: 500 }}>
                        {f.energy}/10
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => updateForm(day.dateStr, { energy: Math.max(1, f.energy - 1) })}
                        disabled={f.energy === 1}
                        style={stepBtnStyle(f.energy === 1)}
                        aria-label="Decrease energy"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6l5 5 5-5"/></svg>
                      </button>
                      <EnergyDial level={f.energy} />
                      <button
                        onClick={() => updateForm(day.dateStr, { energy: Math.min(10, f.energy + 1) })}
                        disabled={f.energy === 10}
                        style={stepBtnStyle(f.energy === 10)}
                        aria-label="Increase energy"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l5-5 5 5"/></svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mood note */}
                <div style={{ marginBottom: '18px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 8px' }}>
                    Mood <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.6 }}>— optional</span>
                  </p>
                  <textarea
                    value={f.moodNote}
                    onChange={e => updateForm(day.dateStr, { moodNote: e.target.value })}
                    rows={3}
                    placeholder="How were you feeling that day?"
                    style={{
                      width: '100%',
                      background: 'oklch(1 0 0 / 0.05)',
                      border: '1px solid oklch(1 0 0 / 0.10)',
                      borderRadius: '9px',
                      padding: '10px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      color: 'oklch(0.93 0.012 80 / 0.9)',
                      resize: 'none',
                      outline: 'none',
                      lineHeight: 1.6,
                      boxSizing: 'border-box',
                      caretColor: 'var(--gold)',
                    }}
                  />
                </div>

                {/* Highlight */}
                <div style={{ marginBottom: '18px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 8px' }}>
                    Highlight <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.6 }}>— optional</span>
                  </p>
                  <input
                    type="text"
                    value={f.highlight}
                    onChange={e => updateForm(day.dateStr, { highlight: e.target.value })}
                    placeholder="A win or memorable moment"
                    style={{
                      width: '100%',
                      background: 'oklch(1 0 0 / 0.05)',
                      border: '1px solid oklch(1 0 0 / 0.10)',
                      borderRadius: '9px',
                      padding: '10px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      color: 'oklch(0.93 0.012 80 / 0.9)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Blockers */}
                <div style={{ marginBottom: '22px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 10px' }}>
                    Blockers
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {BLOCKERS.map(b => {
                      const active = f.blockers.includes(b)
                      return (
                        <button
                          key={b}
                          onClick={() => updateForm(day.dateStr, {
                            blockers: active ? f.blockers.filter(x => x !== b) : [...f.blockers, b],
                          })}
                          style={{
                            padding: '7px 14px',
                            background: active ? 'var(--gold-dim)' : 'oklch(1 0 0 / 0.07)',
                            border: `1px solid ${active ? 'rgba(212,168,83,0.3)' : 'oklch(1 0 0 / 0.12)'}`,
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: active ? 600 : 400,
                            color: active ? 'var(--gold)' : 'oklch(0.93 0.012 80 / 0.7)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: 'inherit',
                          }}
                        >
                          {b}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleSave(day.dateStr)}
                    disabled={f.saving}
                    style={{
                      padding: '10px 28px',
                      background: 'var(--gold)',
                      color: '#131110',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      cursor: f.saving ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: f.saving ? 0.65 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {f.saving ? 'Saving…' : f.saved ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function stepBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: '28px', height: '28px',
    borderRadius: '50%',
    border: `1px solid ${disabled ? 'oklch(1 0 0 / 0.08)' : 'oklch(1 0 0 / 0.18)'}`,
    background: 'oklch(1 0 0 / 0.06)',
    color: disabled ? 'oklch(1 0 0 / 0.2)' : 'oklch(0.93 0.012 80 / 0.7)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }
}

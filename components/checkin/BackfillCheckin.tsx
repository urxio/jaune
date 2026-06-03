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
  const diffMs = today.setHours(0,0,0,0) - date.setHours(0,0,0,0)
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

  const energyColor = (e: number) =>
    e >= 7 ? 'var(--sage)' : e >= 5 ? 'var(--gold)' : '#c08060'

  const energyLabel = (e: number) =>
    e >= 9 ? 'Exceptional' : e >= 7 ? 'High' : e >= 5 ? 'Moderate' : e >= 3 ? 'Low' : 'Depleted'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px', lineHeight: 1.5 }}>
        Fill in check-ins you missed. Each saves independently.
      </div>

      {days.map(day => {
        const f = forms[day.dateStr]
        const isOpen = expanded === day.dateStr

        return (
          <div
            key={day.dateStr}
            style={{
              background: 'var(--bg-1)',
              border: `1px solid ${f.saved ? 'rgba(122,158,138,0.3)' : 'var(--border-md)'}`,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
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
                padding: '14px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {f.saved ? (
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(122,158,138,0.15)',
                    border: '1px solid rgba(122,158,138,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--sage)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 8l3.5 3.5 7.5-7"/>
                    </svg>
                  </span>
                ) : (
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-md)',
                  }} />
                )}
                <span style={{
                  fontSize: '14px',
                  fontWeight: f.saved ? 500 : 400,
                  color: f.saved ? 'var(--text-1)' : 'var(--text-0)',
                }}>
                  {day.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {f.saved && (
                  <span style={{
                    fontSize: '12px',
                    color: energyColor(f.energy),
                    fontWeight: 600,
                  }}>
                    {f.energy}/10 · {energyLabel(f.energy)}
                  </span>
                )}
                <svg
                  width="14" height="14" viewBox="0 0 16 16" fill="none"
                  stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                >
                  <path d="M3 6l5 5 5-5" />
                </svg>
              </div>
            </button>

            {/* Expanded form */}
            {isOpen && (
              <div style={{ padding: '0 16px 20px', borderTop: '1px solid var(--border)', animation: 'fadeUp 0.2s var(--ease) both' }}>

                {/* Energy */}
                <div style={{ marginTop: '16px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>
                    Energy level
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => updateForm(day.dateStr, { energy: Math.max(1, f.energy - 1) })}
                      disabled={f.energy === 1}
                      style={arrowBtnStyle(f.energy === 1)}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6l5 5 5-5"/></svg>
                    </button>
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 300, color: 'var(--text-0)', lineHeight: 1 }}>
                        {f.energy}
                      </span>
                      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: energyColor(f.energy), marginTop: '4px' }}>
                        {energyLabel(f.energy)}
                      </div>
                    </div>
                    <button
                      onClick={() => updateForm(day.dateStr, { energy: Math.min(10, f.energy + 1) })}
                      disabled={f.energy === 10}
                      style={arrowBtnStyle(f.energy === 10)}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l5-5 5 5"/></svg>
                    </button>
                  </div>
                </div>

                {/* Mood note */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
                    Mood note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
                  </div>
                  <textarea
                    value={f.moodNote}
                    onChange={e => updateForm(day.dateStr, { moodNote: e.target.value })}
                    rows={3}
                    placeholder="How were you feeling that day?"
                    style={{
                      width: '100%',
                      background: 'var(--bg-0)',
                      border: '1px solid var(--border-md)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      color: 'var(--text-0)',
                      resize: 'none',
                      outline: 'none',
                      lineHeight: 1.6,
                      boxSizing: 'border-box',
                      caretColor: 'var(--gold)',
                    }}
                  />
                </div>

                {/* Highlight */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
                    Highlight <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
                  </div>
                  <input
                    type="text"
                    value={f.highlight}
                    onChange={e => updateForm(day.dateStr, { highlight: e.target.value })}
                    placeholder="A win or memorable moment"
                    style={{
                      width: '100%',
                      background: 'var(--bg-0)',
                      border: '1px solid var(--border-md)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      color: 'var(--text-0)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Blockers */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
                    Blockers
                  </div>
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
                            padding: '8px 14px',
                            background: active ? 'var(--gold-dim)' : 'var(--bg-2)',
                            border: `1px solid ${active ? 'rgba(212,168,83,0.3)' : 'var(--border-md)'}`,
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: active ? 600 : 400,
                            color: active ? 'var(--gold)' : 'var(--text-1)',
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

function arrowBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: '36px', height: '36px',
    borderRadius: '50%',
    border: `1px solid ${disabled ? 'var(--border)' : 'var(--border-md)'}`,
    background: 'var(--bg-2)',
    color: disabled ? 'var(--text-3)' : 'var(--text-1)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.35 : 1,
    flexShrink: 0,
  }
}

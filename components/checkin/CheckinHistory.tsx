import type { CheckIn, JournalEntry } from '@/lib/types'
import { localDateStr } from '@/lib/utils/date'

type DayEntry = {
  date: string
  checkin: CheckIn | null
  journal: JournalEntry | null
}

function mergeDays(checkins: CheckIn[], journals: JournalEntry[]): DayEntry[] {
  const map = new Map<string, DayEntry>()

  for (const c of checkins) {
    map.set(c.date, { date: c.date, checkin: c, journal: null })
  }
  for (const j of journals) {
    if (!j.content.trim()) continue
    const existing = map.get(j.date)
    if (existing) {
      existing.journal = j
    } else {
      map.set(j.date, { date: j.date, checkin: null, journal: j })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export default function CheckinHistory({
  checkins,
  journals,
}: {
  checkins: CheckIn[]
  journals: JournalEntry[]
}) {
  const days = mergeDays(checkins, journals)

  if (days.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '80px 0',
        color: 'var(--text-3)',
        fontFamily: 'var(--font-serif)',
        fontSize: '18px',
        fontWeight: 300,
      }}>
        No history yet.<br />
        <span style={{ fontSize: '14px', fontFamily: 'var(--font-sans)', display: 'block', marginTop: '8px', color: 'var(--text-3)' }}>
          Start checking in daily to build your record.
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {days.map(day => <DayCard key={day.date} day={day} />)}
    </div>
  )
}

function DayCard({ day }: { day: DayEntry }) {
  const dateObj  = new Date(day.date + 'T12:00:00')
  const today     = localDateStr()
  const yesterday = localDateStr(new Date(Date.now() - 86400000))
  const isToday   = day.date === today
  const isYday    = day.date === yesterday

  const formatted = dateObj.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const e = day.checkin?.energy_level
  const energyLabel = e
    ? (e >= 9 ? 'Exceptional' : e >= 7 ? 'High' : e >= 5 ? 'Moderate' : e >= 3 ? 'Low' : 'Depleted')
    : null
  const energyColor = e
    ? (e >= 7 ? 'var(--sage)' : e >= 5 ? 'var(--gold)' : '#c08060')
    : 'var(--text-3)'

  const realBlockers = day.checkin?.blockers.filter(b => b !== 'No blockers today') ?? []
  const wordCount    = day.journal?.content.trim()
    ? day.journal.content.trim().split(/\s+/).filter(Boolean).length
    : 0

  return (
    <div
      className="glass-card-sm"
      style={{
        border: `1px solid ${isToday ? 'rgba(212,168,83,0.35)' : 'var(--glass-card-border)'}`,
        overflow: 'hidden',
        animation: 'fadeUp 0.25s var(--ease) both',
      }}
    >

      {/* ── Header ── */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: isToday ? 'rgba(212,168,83,0.04)' : 'transparent',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {(isToday || isYday) && (
            <div style={{
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: isToday ? 'var(--gold)' : 'var(--text-3)',
              fontWeight: 600,
              marginBottom: '2px',
            }}>
              {isToday ? 'Today' : 'Yesterday'}
            </div>
          )}
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--text-0)',
          }}>
            {formatted}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {day.checkin && (
            <span style={{
              fontSize: '11px',
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'var(--bg-3)',
              color: 'var(--text-2)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}>
              ✓ Check-in
            </span>
          )}
          {day.journal && (
            <span style={{
              fontSize: '11px',
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(122,158,138,0.12)',
              color: 'var(--sage)',
              fontWeight: 600,
            }}>
              ✎ Journal
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Check-in data */}
        {day.checkin && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
            {/* Energy */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase',
                letterSpacing: '0.07em', fontWeight: 600, marginBottom: '4px',
              }}>Energy</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span style={{
                  fontFamily: 'var(--font-serif)', fontSize: '26px',
                  fontWeight: 400, color: energyColor, lineHeight: 1,
                }}>
                  {e}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>/10</span>
              </div>
              <div style={{
                fontSize: '10px', color: energyColor, fontWeight: 600,
                marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {energyLabel}
              </div>
            </div>

            {/* Mood note */}
            {day.checkin.mood_note && (
              <div style={{ flex: 1, minWidth: '140px' }}>
                <div style={{
                  fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px',
                }}>Mood note</div>
                <div style={{
                  fontSize: '13px', color: 'var(--text-1)',
                  lineHeight: 1.55, fontStyle: 'italic',
                }}>
                  &ldquo;{day.checkin.mood_note}&rdquo;
                </div>
              </div>
            )}

            {/* Blockers */}
            {realBlockers.length > 0 && (
              <div style={{ width: '100%' }}>
                <div style={{
                  fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', fontWeight: 600, marginBottom: '6px',
                }}>Blockers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {realBlockers.map(b => (
                    <span key={b} style={{
                      fontSize: '11px', padding: '3px 9px', borderRadius: '12px',
                      background: 'rgba(192,128,96,0.1)', color: '#c08060', fontWeight: 500,
                    }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* No blockers note */}
            {realBlockers.length === 0 && day.checkin.blockers.includes('No blockers today') && (
              <div style={{ width: '100%' }}>
                <div style={{
                  fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px',
                }}>Blockers</div>
                <span style={{ fontSize: '12px', color: 'var(--sage)', fontWeight: 500 }}>
                  None today ✓
                </span>
              </div>
            )}

            {/* Highlight / win */}
            {day.checkin.highlight && (
              <div style={{ width: '100%' }}>
                <div style={{
                  fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', fontWeight: 600, marginBottom: '6px',
                }}>Highlight</div>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '9px 13px',
                  background: 'rgba(122,158,138,0.07)',
                  border: '1px solid rgba(122,158,138,0.18)',
                  borderRadius: '9px',
                }}>
                  <span style={{ color: 'var(--sage)', flexShrink: 0, fontSize: '13px' }}>★</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.55 }}>
                    {day.checkin.highlight}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Journal entry */}
        {day.journal && day.journal.content.trim() && (
          <div style={{
            borderTop: day.checkin ? '1px solid var(--border-sm)' : 'none',
            paddingTop: day.checkin ? '14px' : '0',
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px',
            }}>
              <div style={{
                fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase',
                letterSpacing: '0.07em', fontWeight: 600,
              }}>
                Journal
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                {wordCount} word{wordCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{
              fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.75,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {day.journal.content}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

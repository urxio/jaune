'use client'

import { useState, useTransition } from 'react'
import type { Person, PersonGroup } from '@/lib/types'
import { updatePersonAction, deletePersonAction } from '@/app/actions/people'

const GROUP_COLORS: Record<PersonGroup, string> = {
  friends:       'var(--sage)',
  acquaintances: 'var(--text-3)',
  work:          'var(--gold)',
  family:        '#a78bbb',
  partner:       '#e07a8a',
}

const GROUP_BG: Record<PersonGroup, string> = {
  friends:       'rgba(122,158,138,0.12)',
  acquaintances: 'rgba(140,140,140,0.10)',
  work:          'rgba(212,168,83,0.12)',
  family:        'rgba(167,139,187,0.12)',
  partner:       'rgba(224,122,138,0.12)',
}

export default function PersonCard({
  person,
  onEdit,
  onDeleted,
  onCatchupToggled,
}: {
  person: Person
  onEdit: (p: Person) => void
  onDeleted: (id: string) => void
  onCatchupToggled: (id: string, val: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggleCatchup = () => {
    const next = !person.want_catchup
    onCatchupToggled(person.id, next)
    startTransition(async () => {
      await updatePersonAction(person.id, { want_catchup: next })
    })
  }

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      await deletePersonAction(person.id)
      onDeleted(person.id)
    })
  }

  const color = GROUP_COLORS[person.group]
  const bg    = GROUP_BG[person.group]

  return (
    <div style={{
      background: 'var(--glass-card-bg)',
      border: '1px solid var(--glass-card-border)',
      borderRadius: '14px',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      position: 'relative',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {/* Avatar circle */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${bg} 0%, ${color}33 100%)`,
            border: `1.5px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color,
          }}>
            {person.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {person.name}
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color, background: bg,
              padding: '2px 7px', borderRadius: '20px', display: 'inline-block', marginTop: '2px',
            }}>
              {person.group}
            </span>
          </div>
        </div>

        {/* Catch-up toggle */}
        <button
          onClick={toggleCatchup}
          disabled={isPending}
          title={person.want_catchup ? 'Remove from catch-up list' : 'Add to catch-up list'}
          style={{
            background: person.want_catchup ? 'rgba(122,158,138,0.15)' : 'transparent',
            border: `1px solid ${person.want_catchup ? 'var(--sage)' : 'var(--border)'}`,
            borderRadius: '8px',
            color: person.want_catchup ? 'var(--sage)' : 'var(--text-3)',
            cursor: 'pointer',
            padding: '5px 8px',
            fontSize: '13px',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {person.want_catchup ? '✓ Catch up' : 'Catch up'}
        </button>
      </div>

      {/* Locus notes */}
      {person.notes && (
        <p style={{
          fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5, margin: 0,
          fontStyle: 'italic',
          borderLeft: '2px solid var(--border)',
          paddingLeft: '10px',
        }}>
          {person.notes}
        </p>
      )}

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
        <button
          onClick={() => onEdit(person)}
          style={{ fontSize: '12px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
        >
          Edit
        </button>
        <span style={{ color: 'var(--border)', fontSize: '12px' }}>·</span>
        <button
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          disabled={isPending}
          style={{ fontSize: '12px', color: confirmDelete ? '#e05c4a' : 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', transition: 'color 0.15s' }}
        >
          {confirmDelete ? 'Confirm delete' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

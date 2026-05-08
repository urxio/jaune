'use client'

import { useState, useTransition } from 'react'
import type { Person, PersonGroup } from '@/lib/types'
import { createPersonAction, updatePersonAction } from '@/app/actions/people'
import { inputStyle, labelStyle } from '@/components/ui/FormStyles'

const GROUPS: { value: PersonGroup; label: string }[] = [
  { value: 'partner',       label: 'Partner'       },
  { value: 'friends',       label: 'Friends'       },
  { value: 'family',        label: 'Family'        },
  { value: 'work',          label: 'Work'          },
  { value: 'acquaintances', label: 'Acquaintances' },
]

type FormData = { name: string; group: PersonGroup; notes: string }

const EMPTY: FormData = { name: '', group: 'acquaintances', notes: '' }

export default function PersonModal({
  mode,
  person,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit'
  person?: Person
  onClose: () => void
  onSaved: (p: Person, isNew: boolean) => void
}) {
  const [form, setForm] = useState<FormData>(
    person
      ? { name: person.name, group: person.group, notes: person.notes ?? '' }
      : EMPTY
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setError('')
    startTransition(async () => {
      try {
        if (mode === 'add') {
          const created = await createPersonAction({ name: form.name, group: form.group, notes: form.notes || undefined })
          onSaved(created as Person, true)
        } else if (person) {
          await updatePersonAction(person.id, { name: form.name, group: form.group, notes: form.notes || null })
          onSaved({ ...person, name: form.name.trim(), group: form.group, notes: form.notes.trim() || null }, false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      className="modal-overlay"
      style={{ backdropFilter: 'blur(4px)', animation: 'fadeUp 0.15s var(--ease) both' }}
    >
      <div className="modal-box" style={{ padding: '32px', boxShadow: '0 8px 60px rgba(0,0,0,0.5)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'var(--text-0)' }}>
            {mode === 'add' ? 'Add person' : 'Edit person'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Sarah, mom, John…"
              autoFocus
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Group</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {GROUPS.map(g => {
                const active = form.group === g.value
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => set('group', g.value)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '8px',
                      border: `1px solid ${active ? 'var(--sage)' : 'var(--border)'}`,
                      background: active ? 'rgba(122,158,138,0.12)' : 'var(--bg-3)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: active ? 'var(--sage)' : 'var(--text-2)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — Locus may fill this in)</span></label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="A sentence about this person…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: '#e07060', background: 'rgba(200,80,60,0.08)', padding: '10px 14px', borderRadius: '8px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: '9px', padding: '12px', fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              style={{ flex: 2, background: 'var(--sage)', color: '#fff', border: 'none', borderRadius: '9px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1 }}
            >
              {isPending ? 'Saving…' : mode === 'add' ? 'Add person' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

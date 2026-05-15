'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/settings'
import { signOut } from '@/app/actions/auth'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { useToast } from '@/components/ui/ToastContext'
import { createClient } from '@/lib/supabase/client'
import { disconnectCalendar } from '@/app/actions/calendar'

// ── Cover presets ─────────────────────────────────────────────────────────────

const COVER_PRESETS = [
  { id: 'locus-1', url: '/wallpapers/locus-1.jpg',  label: 'Locus I' },
  { id: 'locus-2', url: '/wallpapers/locus-2.jpg',  label: 'Locus II' },
  { id: 'locus-3', url: '/wallpapers/locus-3.avif', label: 'Locus III' },
  { id: 'locus-4', url: '/wallpapers/locus-4.jpg',  label: 'Locus IV' },
  { id: 'locus-5', url: '/wallpapers/locus-5.jpg',  label: 'Locus V' },
]

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px' }}>
        {title}
      </div>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '16px', padding: '14px 18px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '13.5px', color: 'var(--text-1)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = name.charAt(0).toUpperCase() || '?'
  if (url) {
    return <img src={url} alt={name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #4a6e5a 0%, #2a4a3a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 600, color: '#a0d4b8', flexShrink: 0 }}>
      {initial}
    </div>
  )
}

// ── Profile editor ────────────────────────────────────────────────────────────

function ProfileSection({ name: initialName, avatarUrl: initialUrl, coverUrl: initialCover }: { name: string; avatarUrl: string | null; coverUrl: string | null }) {
  const toast = useToast()
  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialUrl ?? '')
  const [coverUrl, setCoverUrl] = useState(initialCover ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, startSave] = useTransition()

  const dirty = name !== initialName || (avatarUrl || null) !== initialUrl || (coverUrl || null) !== initialCover

  function handleSave() {
    startSave(async () => {
      try {
        await updateProfile(name, avatarUrl || null, coverUrl || null)
        toast.success('Profile updated')
        setEditing(false)
      } catch {
        toast.error('Failed to save profile')
      }
    })
  }

  return (
    <Section title="Profile">
      {/* Cover image preview */}
      <div style={{
        height: '100px', background: coverUrl
          ? `url(${coverUrl}) center/cover no-repeat`
          : 'linear-gradient(135deg, var(--bg-3) 0%, var(--bg-2) 100%)',
        position: 'relative', borderRadius: '14px 14px 0 0',
      }}>
        {!coverUrl && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>No cover image</span>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Avatar url={avatarUrl || null} name={name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)' }}>{name || '—'}</div>
          <button
            onClick={() => setEditing(e => !e)}
            style={{ fontSize: '12px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}
          >
            {editing ? 'Cancel' : 'Edit profile'}
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: 'var(--text-0)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cover image</span>
            {/* Preset grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {COVER_PRESETS.map(preset => {
                const selected = coverUrl === preset.url
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setCoverUrl(preset.url)}
                    title={preset.label}
                    style={{
                      aspectRatio: '16/9',
                      borderRadius: '6px',
                      border: selected ? '2px solid var(--gold)' : '2px solid transparent',
                      background: `url(${preset.url}) center/cover no-repeat`,
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                      boxShadow: selected ? '0 0 0 1px var(--gold)' : 'none',
                      transition: 'border-color 0.12s, box-shadow 0.12s',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {selected && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(212,168,83,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 12 12" width="14" height="14" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {/* Custom URL fallback */}
            <input
              value={COVER_PRESETS.some(p => p.url === coverUrl) ? '' : coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              placeholder="Or paste a custom URL…"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: 'var(--text-0)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avatar URL</span>
            <input
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: 'var(--text-0)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
          </label>
          <button
            onClick={handleSave}
            disabled={!dirty || saving || !name.trim()}
            style={{
              padding: '9px 18px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: 600,
              background: dirty && name.trim() ? 'var(--gold)' : 'var(--bg-3)',
              color: dirty && name.trim() ? 'var(--bg-0)' : 'var(--text-3)',
              cursor: dirty && name.trim() ? 'pointer' : 'not-allowed',
              alignSelf: 'flex-start', transition: 'all 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </Section>
  )
}

// ── Change password ───────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const toast = useToast()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8)  { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password updated')
    setPassword(''); setConfirm(''); setOpen(false)
  }

  const iStyle: React.CSSProperties = {
    background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px',
    padding: '9px 12px', fontSize: '14px', color: 'var(--text-0)', outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <Section title="Security">
      <div style={{ padding: '14px 18px', borderBottom: open ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13.5px', color: 'var(--text-1)', fontWeight: 500 }}>Password</span>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ fontSize: '13px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {open ? 'Cancel' : 'Change password'}
        </button>
      </div>
      {open && (
        <form onSubmit={handleSave} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="password" placeholder="New password (min 8 characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus style={iStyle} />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={iStyle} />
          <button
            type="submit"
            disabled={saving || !password || !confirm}
            style={{
              padding: '9px 18px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: 600,
              background: password && confirm ? 'var(--gold)' : 'var(--bg-3)',
              color: password && confirm ? 'var(--bg-0)' : 'var(--text-3)',
              cursor: password && confirm ? 'pointer' : 'not-allowed', alignSelf: 'flex-start',
            }}
          >
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
    </Section>
  )
}

// ── Google Calendar integration ───────────────────────────────────────────────

function CalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2.5" width="14" height="12" rx="2" />
      <path d="M1 6h14M5 1v3M11 1v3" />
    </svg>
  )
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.5l3.5 3.5 5.5-6" />
    </svg>
  )
}

function CalendarIntegrationSection({ connected }: { connected: boolean }) {
  const toast = useToast()
  const [disconnecting, startDisconnect] = useTransition()

  function handleDisconnect() {
    startDisconnect(async () => {
      try {
        await disconnectCalendar()
        toast.success('Google Calendar disconnected')
      } catch {
        toast.error('Failed to disconnect — try again')
      }
    })
  }

  return (
    <Section title="Integrations">
      <Row label="Google Calendar" last>
        {connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#4caf7d', fontWeight: 500 }}>
              <CheckMark />
              Connected
            </span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                padding: '6px 13px', borderRadius: '8px',
                border: '1px solid rgba(224,92,74,0.3)',
                background: 'rgba(224,92,74,0.07)',
                color: disconnecting ? 'var(--text-3)' : '#e05c4a',
                fontSize: '12px', fontWeight: 500,
                cursor: disconnecting ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              Adds your next 7 days to your daily brief
            </span>
            <a
              href="/api/calendar/connect"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '9px',
                background: 'var(--gold)', color: 'var(--bg-0)',
                fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <CalIcon />
              Connect
            </a>
          </div>
        )}
      </Row>
    </Section>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function SettingsView({
  name, avatarUrl, coverUrl, timezone, email, calendarConnected,
}: {
  name: string
  avatarUrl: string | null
  coverUrl: string | null
  timezone: string
  email: string
  calendarConnected: boolean
}) {
  const toast = useToast()
  const router = useRouter()
  const [signingOut, startSignOut] = useTransition()

  // Show a toast based on the ?calendar= param set by the OAuth callback,
  // then strip it from the URL so it doesn't re-fire on refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cal = params.get('calendar')
    if (cal === 'connected') {
      toast.success('Google Calendar connected')
      router.replace('/settings')
    } else if (cal === 'error') {
      toast.error('Failed to connect Google Calendar')
      router.replace('/settings')
    } else if (cal === 'denied') {
      toast.error('Google Calendar access was denied')
      router.replace('/settings')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page-pad" style={{ maxWidth: '560px', animation: 'fadeUp 0.3s var(--ease) both' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', fontWeight: 400, color: 'var(--text-0)', margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0 }}>Manage your profile and preferences.</p>
      </div>

      {/* Profile */}
      <ProfileSection name={name} avatarUrl={avatarUrl} coverUrl={coverUrl} />

      {/* Account info */}
      <Section title="Account">
        <Row label="Email">
          <span style={{ fontSize: '13px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
        </Row>
        <Row label="Timezone" last>
          <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{timezone}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: '5px', padding: '2px 7px' }}>auto</span>
        </Row>
      </Section>

      {/* Security */}
      <ChangePasswordSection />

      {/* Integrations */}
      <CalendarIntegrationSection connected={calendarConnected} />

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Theme" last>
          <ThemeToggle />
        </Row>
      </Section>

      {/* System */}
      <Section title="System">
        <Row label="Onboarding">
          <a
            href="/onboarding?redo=true"
            style={{ fontSize: '13px', color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}
          >
            Redo setup →
          </a>
        </Row>
        <Row label="Sign out" last>
          <button
            onClick={() => startSignOut(() => signOut())}
            disabled={signingOut}
            style={{
              padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(224,92,74,0.3)',
              background: 'rgba(224,92,74,0.07)', color: signingOut ? 'var(--text-3)' : '#e05c4a',
              fontSize: '13px', fontWeight: 500, cursor: signingOut ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </Row>
      </Section>

      <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <span>Locus · AI Life OS</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <a href="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          Privacy Policy
        </a>
      </div>
    </div>
  )
}

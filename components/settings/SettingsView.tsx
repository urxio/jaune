'use client'

import { useState, useRef, useTransition } from 'react'
import { updateProfile } from '@/app/actions/settings'
import { signOut } from '@/app/actions/auth'
import { useToast } from '@/components/ui/ToastContext'
import { createClient } from '@/lib/supabase/client'

// ── Cover presets ─────────────────────────────────────────────────────────────

const COVER_PRESETS = [
  { id: 'locus-1', url: '/wallpapers/locus-1.jpg',  label: 'Silk' },
  { id: 'locus-2', url: '/wallpapers/locus-2.jpg',  label: 'Chrome' },
  { id: 'locus-3', url: '/wallpapers/locus-3.avif', label: 'Ember' },
  { id: 'locus-4', url: '/wallpapers/locus-4.jpg',  label: 'Frost' },
  { id: 'locus-5', url: '/wallpapers/locus-5.jpg',  label: 'Dusk' },
]

// ── Shared card style ─────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'var(--glass-card-bg)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid var(--glass-card-border)',
  boxShadow: 'var(--glass-card-shadow-sm)',
  borderRadius: '14px',
  overflow: 'hidden',
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px' }}>
        {title}
      </div>
      <div style={CARD}>
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
      borderBottom: last ? 'none' : '1px solid var(--glass-card-border-subtle)',
    }}>
      <span style={{ fontSize: '13.5px', color: 'var(--text-1)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}

// ── Avatar with upload ────────────────────────────────────────────────────────

function AvatarUpload({
  url, name, onUpload,
}: {
  url: string | null
  name: string
  onUpload: (newUrl: string) => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const initial = name.charAt(0).toUpperCase() || '?'

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // bust cache so img re-fetches
      onUpload(`${publicUrl}?t=${Date.now()}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        style={{ display: 'none' }}
        aria-label="Upload avatar"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Upload photo"
        style={{
          position: 'relative', width: '44px', height: '44px',
          borderRadius: '50%', border: 'none', padding: 0,
          cursor: uploading ? 'default' : 'pointer', flexShrink: 0,
          background: 'none',
        }}
      >
        {/* Avatar image or initial */}
        {url ? (
          <img
            src={url} alt={name}
            style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #4a6e5a 0%, #2a4a3a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 600, color: '#a0d4b8' }}>
            {uploading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : initial}
          </div>
        )}

        {/* Upload overlay on hover */}
        {!uploading && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
        )}

        {uploading && url && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        )}
      </button>
    </>
  )
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ name: initialName, avatarUrl: initialUrl, coverUrl }: { name: string; avatarUrl: string | null; coverUrl: string | null }) {
  const toast = useToast()
  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialUrl ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, startSave] = useTransition()

  const dirty = name !== initialName || (avatarUrl || null) !== initialUrl

  function handleSave() {
    startSave(async () => {
      try {
        await updateProfile(name, avatarUrl || null, coverUrl)
        toast.success('Profile updated')
        setEditing(false)
      } catch {
        toast.error('Failed to save profile')
      }
    })
  }

  async function handleAvatarUpload(newUrl: string) {
    setAvatarUrl(newUrl)
    try {
      await updateProfile(name, newUrl, coverUrl)
      toast.success('Photo updated')
    } catch {
      toast.error('Failed to save photo')
    }
  }

  return (
    <Section title="Profile">
      <div style={{ padding: '14px 18px', borderBottom: editing ? '1px solid var(--glass-card-border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <AvatarUpload url={avatarUrl || null} name={name} onUpload={handleAvatarUpload} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)' }}>{name || '—'}</div>
          <button
            onClick={() => setEditing(e => !e)}
            style={{ fontSize: '12px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}
          >
            {editing ? 'Cancel' : 'Edit name'}
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ background: 'var(--bg-2)', border: '1px solid var(--glass-card-border)', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: 'var(--text-0)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </Section>
  )
}

// ── Appearance section ────────────────────────────────────────────────────────

function AppearanceSection({ name, avatarUrl, initialCoverUrl }: { name: string; avatarUrl: string | null; initialCoverUrl: string | null }) {
  const toast = useToast()
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl ?? '')
  const [saving, startSave] = useTransition()

  function selectPreset(url: string) {
    if (url === coverUrl) return
    setCoverUrl(url)
    startSave(async () => {
      try {
        await updateProfile(name, avatarUrl, url)
      } catch {
        toast.error('Failed to save wallpaper')
        setCoverUrl(initialCoverUrl ?? '')
      }
    })
  }

  return (
    <Section title="Appearance">
      <div style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: '13.5px', color: 'var(--text-1)', fontWeight: 500, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Wallpaper</span>
          {saving && <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Saving…</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {COVER_PRESETS.map(preset => {
            const selected = coverUrl === preset.url
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.url)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div style={{
                  width: '100%', aspectRatio: '3/4',
                  borderRadius: '9px',
                  border: selected ? '2px solid var(--gold)' : '2px solid transparent',
                  background: `url(${preset.url}) center/cover no-repeat`,
                  boxShadow: selected ? '0 0 0 1px var(--gold)' : '0 0 0 1px var(--glass-card-border)',
                  transition: 'border-color 0.12s, box-shadow 0.12s',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {selected && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(212,168,83,0.15)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '5px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 12 12" width="8" height="8" fill="none" stroke="var(--bg-0)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: selected ? 600 : 400,
                  color: selected ? 'var(--gold)' : 'var(--text-3)',
                  letterSpacing: '0.04em', transition: 'color 0.12s',
                }}>
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
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
    background: 'var(--bg-2)', border: '1px solid var(--glass-card-border)', borderRadius: '8px',
    padding: '9px 12px', fontSize: '14px', color: 'var(--text-0)', outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <Section title="Security">
      <div style={{ padding: '14px 18px', borderBottom: open ? '1px solid var(--glass-card-border-subtle)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

// ── Main view ─────────────────────────────────────────────────────────────────

export default function SettingsView({
  name, avatarUrl, coverUrl, timezone, email,
}: {
  name: string
  avatarUrl: string | null
  coverUrl: string | null
  timezone: string
  email: string
}) {
  const [signingOut, startSignOut] = useTransition()

  return (
    <div className="page-pad" style={{ maxWidth: '560px', margin: '0 auto', animation: 'fadeUp 0.3s var(--ease) both' }}>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', fontWeight: 400, color: 'var(--text-0)', margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0 }}>Manage your profile and preferences.</p>
      </div>

      <ProfileSection name={name} avatarUrl={avatarUrl} coverUrl={coverUrl} />

      <Section title="Account">
        <Row label="Email">
          <span style={{ fontSize: '13px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
        </Row>
        <Row label="Timezone" last>
          <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{timezone}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: '5px', padding: '2px 7px' }}>auto</span>
        </Row>
      </Section>

      <AppearanceSection name={name} avatarUrl={avatarUrl} initialCoverUrl={coverUrl} />

      <ChangePasswordSection />

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

'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const PHOTO = '/wallpapers/locus-5.jpg'

const C = {
  white:      '#ffffff',
  offwhite:   'rgba(255,255,255,0.90)',
  muted:      'rgba(255,255,255,0.45)',
  inputBg:    'rgba(255,255,255,0.07)',
  inputBdr:   'rgba(255,255,255,0.12)',
  inputFocus: 'rgba(255,255,255,0.38)',
  error:      '#ff6b6b',
  errorBg:    'rgba(255,107,107,0.10)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  background: C.inputBg,
  border: `1px solid ${C.inputBdr}`,
  borderRadius: '10px',
  color: C.white,
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 0.18s',
}

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  background: C.white,
  color: '#111',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '-0.01em',
  transition: 'opacity 0.15s',
}

function DarkInput({ type, placeholder, value, onChange, autoFocus, minLength }: {
  type: string; placeholder: string; value: string
  onChange: (v: string) => void; autoFocus?: boolean; minLength?: number
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type} placeholder={placeholder} value={value} minLength={minLength}
      onChange={e => onChange(e.target.value)} autoFocus={autoFocus} required
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...inputStyle, borderColor: focused ? C.inputFocus : C.inputBdr }}
    />
  )
}

export default function SignupPage() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [done,     setDone]     = useState(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.session) { window.location.href = '/onboarding'; return }
    setDone(true); setLoading(false)
  }

  return (
    <>
      {/* Full-bleed background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO} alt="" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', zIndex: 1 }} />

      {/* Page shell */}
      <div style={{
        position: 'relative', zIndex: 2,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        fontFamily: "'DM Sans', -apple-system, sans-serif",
      }}>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: '400px',
          background: 'rgba(14,12,10,0.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '36px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.50)',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Locus" width={34} height={34} style={{ borderRadius: '9px', display: 'block' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: C.white, letterSpacing: '-0.01em', lineHeight: 1 }}>Locus</div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.16em', color: C.muted, marginTop: '2px' }}>Life OS</div>
            </div>
          </div>

          {done ? (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.white, margin: '0 0 8px', letterSpacing: '-0.025em' }}>Check your inbox</h1>
              <p style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, margin: 0 }}>
                We sent a confirmation to <strong style={{ color: C.offwhite }}>{email}</strong>. Click the link to activate your account.
              </p>
            </div>
          ) : (
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: C.white, margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Create account
              </h1>
              <p style={{ fontSize: '13.5px', color: C.muted, lineHeight: 1.6, margin: '0 0 28px' }}>
                Your AI-native life operating system.
              </p>

              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <DarkInput type="text"     placeholder="Your name" value={name}     onChange={setName}     autoFocus />
                <DarkInput type="email"    placeholder="Email"     value={email}    onChange={setEmail} />
                <DarkInput type="password" placeholder="Password (min 8 characters)" value={password} onChange={setPassword} minLength={8} />
                {error && (
                  <div style={{ fontSize: '13px', color: C.error, padding: '10px 14px', background: C.errorBg, borderRadius: '8px', border: '1px solid rgba(255,107,107,0.20)', lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}
                <button
                  type="submit" disabled={loading}
                  style={{ ...btnPrimary, marginTop: '6px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p style={{ marginTop: '24px', fontSize: '13px', color: C.muted, textAlign: 'center', margin: '24px 0 0' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: '#e07a3a', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25); }
        * { box-sizing: border-box; }
      `}</style>
    </>
  )
}

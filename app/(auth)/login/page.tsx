'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type View = 'login' | 'forgot' | 'forgot-code' | 'forgot-reset' | 'magic-sent'

const PHOTO = '/wallpapers/locus-5.jpg'

const C = {
  white:      '#ffffff',
  offwhite:   'rgba(255,255,255,0.90)',
  muted:      'rgba(255,255,255,0.45)',
  inputBg:    'rgba(255,255,255,0.07)',
  inputBdr:   'rgba(255,255,255,0.12)',
  inputFocus: 'rgba(255,255,255,0.38)',
  divider:    'rgba(255,255,255,0.10)',
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

const btnSocial: React.CSSProperties = {
  width: '100%',
  padding: '11px 16px',
  background: C.inputBg,
  border: `1px solid ${C.inputBdr}`,
  borderRadius: '10px',
  color: C.offwhite,
  fontSize: '13.5px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: 'inherit',
  transition: 'background 0.15s',
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}


function DarkInput({ type, placeholder, value, onChange, autoFocus }: {
  type: string; placeholder: string; value: string
  onChange: (v: string) => void; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...inputStyle, borderColor: focused ? C.inputFocus : C.inputBdr }}
    />
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const urlError = errorParam === 'link_expired'
    ? 'Your confirmation link has expired. Please sign up again or request a new one.'
    : errorParam === 'link_invalid'
    ? 'This confirmation link is invalid. Please sign up again.'
    : null

  const [view,     setView]     = useState<View>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [code,     setCode]     = useState('')
  const [newPass,  setNewPass]  = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(urlError)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  function resetError() { setError(null) }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); resetError()
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Check if the email is registered at all (signInWithOtp fails for unknown emails)
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email, options: { shouldCreateUser: false },
        })
        const notFound = otpError && (
          otpError.message.toLowerCase().includes('user not found') ||
          otpError.message.toLowerCase().includes('no user') ||
          otpError.message.toLowerCase().includes('email not found') ||
          otpError.status === 422
        )
        setError(notFound
          ? 'No account found with that email. Please create one.'
          : 'Incorrect email or password.')
      } else if (!data?.session) {
        setError('Sign-in failed. Please try again.')
      } else {
        window.location.href = '/checkin'
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.')
    } finally { setLoading(false) }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); resetError()
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { shouldCreateUser: false },
      })
      if (error) {
        const msg = error.message.toLowerCase()
        setError(msg.includes('user not found') || msg.includes('no user')
          ? 'No account found with that email.'
          : error.message || 'Failed to send code.')
      } else { setCode(''); setView('forgot-code') }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); resetError()
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
      if (error) setError('Invalid or expired code. Please request a new one.')
      else { setNewPass(''); setConfirm(''); setView('forgot-reset') }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirm) { setError('Passwords do not match.'); return }
    if (newPass.length < 8)  { setError('Password must be at least 8 characters.'); return }
    setLoading(true); resetError()
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) setError(error.message || 'Failed to update password.')
      else window.location.href = '/checkin'
    } catch {
      setError('Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <>
      {/* Full-bleed background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO} alt="" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      {/* Subtle dark overlay */}
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
          background: 'var(--glass-card-bg)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRadius: '20px',
          border: '1px solid var(--glass-card-border)',
          padding: '36px 32px',
          boxShadow: 'var(--glass-card-shadow)',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Jaune" width={34} height={34} style={{ borderRadius: '9px', display: 'block' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: C.white, letterSpacing: '-0.01em', lineHeight: 1 }}>Jaune</div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.16em', color: C.muted, marginTop: '2px' }}>Life OS</div>
            </div>
          </div>

          {/* ── Magic link sent ── */}
          {view === 'magic-sent' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.white, margin: '0 0 8px', letterSpacing: '-0.025em' }}>Check your inbox</h1>
              <p style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, margin: '0 0 24px' }}>
                We sent a magic link to <strong style={{ color: C.offwhite }}>{email}</strong>.
              </p>
              <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                ← Back to sign in
              </button>
            </div>
          )}

          {/* ── Forgot: enter email ── */}
          {view === 'forgot' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.white, margin: '0 0 8px', letterSpacing: '-0.025em' }}>Reset password</h1>
              <p style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, margin: '0 0 24px' }}>We&apos;ll send a 6-digit code to your email.</p>
              <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <DarkInput type="email" placeholder="Your email" value={email} onChange={setEmail} autoFocus />
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading} style={btnPrimary}>{loading ? 'Sending…' : 'Send code'}</button>
              </form>
              <button onClick={() => { setView('login'); resetError() }} style={{ marginTop: '16px', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0 }}>
                ← Back to sign in
              </button>
            </div>
          )}

          {/* ── Forgot: enter code ── */}
          {view === 'forgot-code' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.white, margin: '0 0 8px', letterSpacing: '-0.025em' }}>Enter your code</h1>
              <p style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, margin: '0 0 24px' }}>
                Sent to <strong style={{ color: C.offwhite }}>{email}</strong>
              </p>
              <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text" inputMode="numeric" placeholder="000000"
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  required autoFocus
                  style={{ ...inputStyle, fontSize: '24px', letterSpacing: '0.35em', textAlign: 'center' }}
                />
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading || code.length < 6} style={{ ...btnPrimary, opacity: code.length < 6 ? 0.4 : 1 }}>
                  {loading ? 'Verifying…' : 'Continue'}
                </button>
              </form>
              <button onClick={() => { setView('forgot'); resetError(); setCode('') }} style={{ marginTop: '16px', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0 }}>
                ← Resend code
              </button>
            </div>
          )}

          {/* ── Forgot: set new password ── */}
          {view === 'forgot-reset' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.white, margin: '0 0 8px', letterSpacing: '-0.025em' }}>New password</h1>
              <p style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, margin: '0 0 24px' }}>Choose a strong password for your account.</p>
              <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <DarkInput type="password" placeholder="New password (min 8 chars)" value={newPass} onChange={setNewPass} autoFocus />
                <DarkInput type="password" placeholder="Confirm password" value={confirm} onChange={setConfirm} />
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading} style={{ ...btnPrimary, marginTop: '4px' }}>{loading ? 'Saving…' : 'Update password'}</button>
              </form>
            </div>
          )}

          {/* ── Main login ── */}
          {view === 'login' && (
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: C.white, margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Welcome back
              </h1>
              <p style={{ fontSize: '13.5px', color: C.muted, lineHeight: 1.6, margin: '0 0 28px' }}>
                Sign in to your Jaune account.
              </p>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <DarkInput type="email" placeholder="Email" value={email} onChange={setEmail} />
                <DarkInput type="password" placeholder="Password" value={password} onChange={setPassword} />
                {error && <ErrorBox msg={error} />}
                <button
                  type="submit" disabled={loading}
                  style={{ ...btnPrimary, marginTop: '6px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: C.divider }} />
                <span style={{ fontSize: '12px', color: C.muted, letterSpacing: '0.04em' }}>or continue with</span>
                <div style={{ flex: 1, height: '1px', background: C.divider }} />
              </div>

              <button onClick={handleGoogle} style={btnSocial}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.11)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.inputBg }}
              >
                <GoogleIcon /> Continue with Google
              </button>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', color: C.muted, margin: 0 }}>
                  No account?{' '}
                  <Link href="/signup" style={{ color: '#e07a3a', fontWeight: 600, textDecoration: 'none' }}>
                    Create one
                  </Link>
                </p>
                <button onClick={() => { setView('forgot'); resetError() }} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  Forgot password?
                </button>
              </div>
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

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      fontSize: '13px', color: C.error,
      padding: '10px 14px', background: C.errorBg,
      borderRadius: '8px', border: '1px solid rgba(255,107,107,0.20)',
      lineHeight: 1.5,
    }}>
      {msg}
    </div>
  )
}

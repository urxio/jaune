'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MAIN_NAV = [
  { href: '/',        label: 'Home',     icon: <HomeIcon /> },
  { href: '/checkin', label: 'Check-in', icon: <CheckinIcon /> },
  { href: '/habits',  label: 'Habits',   icon: <HabitsIcon /> },
  { href: '/capture', label: 'Capture',  icon: <CaptureIcon /> },
  { href: '/goals',   label: 'Goals',    icon: <GoalsIcon /> },
]

export default function Sidebar({ userName, avatarUrl, overdueStepCount = 0 }: {
  userName: string
  avatarUrl: string | null
  overdueStepCount?: number
}) {
  const pathname = usePathname()
  const initial = userName.charAt(0).toUpperCase()

  return (
    <aside className="app-sidebar">
      {/* Floating nav pill — centered */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2px',
        background: 'var(--glass-card-bg)',
        border: '1px solid var(--glass-card-border)',
        borderRadius: 'var(--radius-card)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        boxShadow: 'var(--glass-card-shadow)',
        padding: '6px 8px',
        height: '52px',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        {/* Brand mark */}
        <div style={{
          width: '32px', height: '32px',
          borderRadius: '10px',
          background: 'var(--glass-card-bg-tint)',
          border: '1px solid var(--glass-card-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: '4px',
        }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--sea-soft, #c8ddd7) 0%, var(--sage) 100%)',
          }} />
        </div>

        {/* Main nav — horizontal */}
        <nav style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: '2px',
        }}>
          {MAIN_NAV.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname === item.href
            const showBadge = item.href === '/goals' && overdueStepCount > 0
            return (
              <DockItem key={item.href} href={item.href} label={item.label} active={active} badge={showBadge}>
                {item.icon}
              </DockItem>
            )
          })}
        </nav>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right: settings + avatar — floating, no pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <DockItem href="/settings" label="Settings" active={pathname === '/settings'}>
          <SettingsIcon />
        </DockItem>
        <div style={{
          width: '32px', height: '32px',
          borderRadius: '10px',
          background: avatarUrl
            ? `url(${avatarUrl}) center/cover no-repeat`
            : 'linear-gradient(135deg, var(--sea-soft, #c8ddd7), var(--sage))',
          border: '1.5px solid var(--glass-card-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
          color: 'var(--text-0)',
          flexShrink: 0,
        }}>
          {!avatarUrl && initial}
        </div>
      </div>
    </aside>
  )
}

function DockItem({ href, label, active, badge = false, children }: {
  href: string
  label: string
  active: boolean
  badge?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        borderRadius: '14px',
        background: active ? 'var(--nav-active-bg)' : 'transparent',
        border: active ? '1px solid var(--nav-active-border)' : '1px solid transparent',
        color: active ? 'var(--text-0)' : 'var(--text-3)',
        textDecoration: 'none',
        position: 'relative',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--nav-hover-bg)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-1)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-3)'
        }
      }}
    >
      {children}
      {/* Active indicator bar */}
      {active && (
        <span style={{
          position: 'absolute', bottom: '-1px',
          left: '50%', transform: 'translateX(-50%)',
          width: '18px', height: '3px',
          borderRadius: '3px 3px 0 0',
          background: 'var(--sage)',
        }} />
      )}
      {/* Overdue badge */}
      {badge && (
        <span style={{
          position: 'absolute', top: '8px', right: '8px',
          width: '7px', height: '7px',
          borderRadius: '50%',
          background: '#e05c4a',
          border: '1.5px solid var(--glass-card-bg)',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
      )}
    </Link>
  )
}

/* ── SVG Icons ── */

function HomeIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><path d="M3 9.5L10 3l7 6.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 8v8a1 1 0 0 0 1 1h3v-4h2v4h3a1 1 0 0 0 1-1V8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function CheckinIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><path d="M10 3v2M10 15v2M3 10h2M15 10h2" strokeLinecap="round" /><circle cx="10" cy="10" r="4" /></svg>
}

function HabitsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><circle cx="10" cy="10" r="7" /><path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function CaptureIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>
}

function GoalsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><path d="M4 15l4-4 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function SettingsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><circle cx="10" cy="10" r="2.5" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" strokeLinecap="round" /></svg>
}

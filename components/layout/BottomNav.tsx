'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',        label: 'Home',     icon: <HomeIcon /> },
  { href: '/checkin', label: 'Check-in', icon: <CheckinIcon /> },
  { href: '/habits',  label: 'Habits',   icon: <HabitsIcon /> },
  { href: '/capture', label: 'Capture',  icon: <CaptureIcon /> },
  { href: '/goals',   label: 'Goals',    icon: <GoalsIcon /> },
]

export default function BottomNav({ overdueStepCount = 0 }: { overdueStepCount?: number }) {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => {
        const active = item.href === '/' ? pathname === '/' : pathname === item.href
        const showBadge = item.href === '/goals' && overdueStepCount > 0
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item${active ? ' active' : ''}`}
          >
            <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {item.icon}
              {showBadge && (
                <span style={{
                  position: 'absolute',
                  top: '-1px',
                  right: '-2px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#e05c4a',
                  border: '1.5px solid var(--bg-0)',
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
              )}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      <path d="M3 9.5L10 3l7 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8v8a1 1 0 0 0 1 1h3v-4h2v4h3a1 1 0 0 0 1-1V8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="4" />
    </svg>
  )
}

function HabitsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CaptureIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  )
}

function GoalsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      <path d="M4 15l4-4 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


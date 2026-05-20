'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/home',    label: 'Home',     icon: <HomeIcon /> },
  { href: '/checkin', label: 'Check-in', icon: <CheckinIcon /> },
  { href: '/habits',  label: 'Habits',   icon: <HabitsIcon /> },
  { href: '/goals',   label: 'Goals',    icon: <GoalsIcon /> },
  { href: '/review',  label: 'Review',   icon: <ReviewIcon /> },
]

export default function BottomNav({ overdueStepCount = 0 }: { overdueStepCount?: number }) {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => {
        const active = item.href === '/home' ? pathname === '/home' : pathname === item.href
        const showBadge = item.href === '/goals' && overdueStepCount > 0
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={`bottom-nav-item${active ? ' active' : ''}`}
          >
            <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {item.icon}
              {showBadge && (
                <span style={{
                  position: 'absolute', top: '-2px', right: '-3px',
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#e05c4a', border: '1.5px solid var(--bg-0)',
                }} />
              )}
            </span>
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
      <circle cx="10" cy="10" r="7" />
      <path d="M10 7v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
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

function GoalsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      <path d="M4 15l4-4 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" />
    </svg>
  )
}

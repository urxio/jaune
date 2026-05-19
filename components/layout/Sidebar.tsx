'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

function LocusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {/* Small gold petals (diagonal) — scaled around (50,50) */}
      <g fill="var(--gold)" transform="translate(15 15) scale(0.7)">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(45,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(135,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(225,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(315,50,50)" />
      </g>
      {/* Big white petals (cardinal) */}
      <g fill="#FFFFFF">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(90,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(180,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(270,50,50)" />
      </g>
    </svg>
  )
}

const MAIN_NAV = [
  { href: '/home',    label: 'Home',     icon: <HomeIcon /> },
  { href: '/checkin', label: 'Check-in', icon: <CheckinIcon /> },
  { href: '/habits',  label: 'Habits',   icon: <HabitsIcon /> },
  { href: '/goals',   label: 'Goals',    icon: <GoalsIcon /> },
  { href: '/review',  label: 'Review',   icon: <ReviewIcon /> },
]

export default function Sidebar({ userName, avatarUrl, overdueStepCount = 0, dueTodayStepCount = 0, checkinDoneToday = true, habitsRemainingToday = 0 }: {
  userName: string
  avatarUrl: string | null
  overdueStepCount?: number
  dueTodayStepCount?: number
  checkinDoneToday?: boolean
  habitsRemainingToday?: number
}) {
  const pathname = usePathname()
  const initial = userName.charAt(0).toUpperCase()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const goalStepsDone = overdueStepCount === 0 && dueTodayStepCount === 0
  const goalStepsDetail = overdueStepCount > 0
    ? `${overdueStepCount} overdue`
    : dueTodayStepCount > 0
      ? `${dueTodayStepCount} due today`
      : 'On track'
  const hasAttention = !checkinDoneToday || habitsRemainingToday > 0 || !goalStepsDone

  useEffect(() => { setMounted(true) }, [])

  useLayoutEffect(() => {
    if (!popoverOpen || !triggerRef.current) return
    const updatePos = () => {
      const r = triggerRef.current!.getBoundingClientRect()
      setPopoverPos({ left: r.left, bottom: window.innerHeight - r.top + 10 })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [popoverOpen])

  useEffect(() => {
    if (!popoverOpen) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  return (
    <aside className="app-sidebar">
      {/* Status popover — portaled to body to escape stacking-context traps */}
      {mounted && popoverOpen && popoverPos && createPortal(
        <div ref={popoverRef} style={{
          position: 'fixed',
          left: popoverPos.left,
          bottom: popoverPos.bottom,
          zIndex: 1100,
          background: 'rgba(18, 22, 26, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          borderRadius: '14px',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.7), 0 8px 20px -6px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4)',
          padding: '14px 16px',
          minWidth: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
            Today&rsquo;s status
          </p>
          <StatusRow
            done={checkinDoneToday}
            label="Check-in"
            detail={checkinDoneToday ? 'Done' : 'Pending'}
            href="/checkin"
            onClose={() => setPopoverOpen(false)}
          />
          <StatusRow
            done={habitsRemainingToday === 0}
            label="Habits"
            detail={habitsRemainingToday === 0 ? 'All done' : `${habitsRemainingToday} remaining`}
            href="/habits"
            onClose={() => setPopoverOpen(false)}
          />
          <StatusRow
            done={goalStepsDone}
            label="Goal steps"
            detail={goalStepsDetail}
            href="/goals"
            onClose={() => setPopoverOpen(false)}
          />
        </div>,
        document.body
      )}

      {/* Floating nav pill — centered */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {/* Glass pill */}
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
        }}>
          {/* Brand mark — pulse trigger */}
          <button
            ref={triggerRef}
            onClick={() => setPopoverOpen(o => !o)}
            title="Today's status"
            style={{
              width: '32px', height: '32px',
              borderRadius: '10px',
              background: 'var(--glass-card-bg-tint)',
              border: '1px solid var(--glass-card-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginRight: '4px',
              cursor: 'pointer',
              padding: 0,
              position: 'relative',
            }}
          >
            <LocusIcon size={18} />
            {hasAttention && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '10px',
                animation: 'statusRing 2.4s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            )}
          </button>

          {/* Main nav — horizontal */}
          <nav style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2px' }}>
            {MAIN_NAV.map(item => {
              const active = item.href === '/home' ? pathname === '/home' : pathname === item.href
              const showBadge = item.href === '/goals' && overdueStepCount > 0
              return (
                <DockItem key={item.href} href={item.href} label={item.label} active={active} badge={showBadge}>
                  {item.icon}
                </DockItem>
              )
            })}
          </nav>
        </div>
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
        gap: '7px',
        padding: '0 14px',
        height: '40px',
        borderRadius: '12px',
        background: active ? 'var(--nav-active-bg)' : 'transparent',
        border: active ? '1px solid var(--nav-active-border)' : '1px solid transparent',
        color: active ? 'var(--gold, #c9a96e)' : 'var(--text-3)',
        textDecoration: 'none',
        position: 'relative',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        flexShrink: 0,
        whiteSpace: 'nowrap',
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
      <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {children}
      </span>
      <span style={{
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
        letterSpacing: '0.01em',
        lineHeight: 1,
      }}>
        {label}
      </span>
      {/* Overdue badge */}
      {badge && (
        <span style={{
          position: 'absolute', top: '8px', right: '6px',
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

function StatusRow({ done, label, detail, href, onClose }: {
  done: boolean
  label: string
  detail: string
  href: string
  onClose: () => void
}) {
  return (
    <Link href={href} onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
        background: done ? 'var(--sage, #8aab9a)' : '#c9a96e',
        boxShadow: done ? 'none' : '0 0 6px #c9a96e88',
      }} />
      <span style={{ fontSize: '13px', color: 'var(--text-1)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: '12px', color: done ? 'var(--text-3)' : 'var(--gold, #c9a96e)' }}>{detail}</span>
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

function GoalsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><path d="M4 15l4-4 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function ReviewIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><rect x="4" y="3" width="12" height="14" rx="2" /><path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" /></svg>
}

function JournalIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><rect x="5" y="2" width="10" height="16" rx="2" /><path d="M8 6h4M8 9h4M8 12h2" strokeLinecap="round" /></svg>
}

function SettingsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="7" r="3" /><path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" /></svg>
}

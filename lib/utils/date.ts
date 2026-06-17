/**
 * Date utilities — timezone-safe helpers.
 *
 * Problem: `new Date().toISOString()` is always UTC. Vercel servers run UTC.
 * A user at UTC+2 at 11pm Thursday will get Friday from toISOString().
 *
 * Solution:
 * - Server-side: use `dateInTz(timezone)` with the user's stored timezone
 * - Client-side: use `localDateStr()` which reads from the browser's local clock
 */

/**
 * Server-safe. Returns 'YYYY-MM-DD' in the given IANA timezone.
 * Falls back to UTC if timezone is invalid.
 *
 * @example dateInTz('America/New_York') // '2026-04-09'
 */
export function dateInTz(timezone = 'UTC'): string {
  try {
    // en-CA locale formats as YYYY-MM-DD — exactly what we want
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    // Invalid timezone — fall back to UTC
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date())
  }
}

/** Server-safe. Returns the current hour (0–23) in the given IANA timezone. */
export function hourInTz(timezone = 'UTC'): number {
  try {
    const h = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(new Date())
    return parseInt(h, 10)
  } catch {
    return new Date().getUTCHours()
  }
}

/**
 * Client-side only. Returns 'YYYY-MM-DD' in the user's browser local time.
 * Do NOT call this in server components / server actions.
 */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Returns a date `n` days before `fromDate` (YYYY-MM-DD string), in the given timezone.
 */
/**
 * ISO 8601 week number for the given date.
 */
export function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Returns the date of Monday of the week containing `date`, as a 'YYYY-MM-DD' string.
 */
export function getMondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

/** Returns the number of days between two 'YYYY-MM-DD' dates (later − earlier). */
export function daysBetween(earlier: string, later: string): number {
  const d1 = new Date(earlier + 'T00:00:00Z').getTime()
  const d2 = new Date(later + 'T00:00:00Z').getTime()
  return Math.round((d2 - d1) / 86400000)
}

export function daysAgoInTz(days: number, timezone = 'UTC'): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(d)
  }
}

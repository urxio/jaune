#!/usr/bin/env node
/**
 * Deploy smoke test — exercises the *deployed* app's unauthenticated surface.
 *
 *   node scripts/smoke-test-deploy.mjs                    # defaults to https://jaune.space
 *   node scripts/smoke-test-deploy.mjs http://localhost:3000
 *
 * Complements scripts/smoke-test-prompt.mjs, which tests prompt quality against
 * the Anthropic API directly and never touches the deployment.
 *
 * Everything here is read-only: GETs on public pages plus unauthenticated hits
 * on API routes that are expected to reject. Nothing writes to the database and
 * nothing costs Anthropic tokens. Safe to run against production any time.
 *
 * Exits 1 if any FAIL. WARNs don't fail the run — they're worth a look, not a block.
 */

const BASE = (process.argv[2] ?? 'https://jaune.space').replace(/\/$/, '')
const TIMEOUT_MS = 20_000

let pass = 0, fail = 0, warn = 0
const failures = []

const c = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
}

function ok(msg, detail)   { pass++; console.log(`  ${c.green('PASS')}  ${msg}${detail ? c.dim(`  ${detail}`) : ''}`) }
function bad(msg, detail)  { fail++; failures.push(msg); console.log(`  ${c.red('FAIL')}  ${msg}${detail ? c.dim(`  ${detail}`) : ''}`) }
function meh(msg, detail)  { warn++; console.log(`  ${c.yellow('WARN')}  ${msg}${detail ? c.dim(`  ${detail}`) : ''}`) }

async function get(path, init = {}) {
  const url = path.startsWith('http') ? path : BASE + path
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual', ...init })
    const body = res.headers.get('content-type')?.includes('application/json') || res.status >= 400
      ? await res.text().catch(() => '')
      : await res.text().catch(() => '')
    return { res, body, url }
  } catch (err) {
    return { err, url }
  } finally {
    clearTimeout(t)
  }
}

/** Follows redirects — for pages where we care about the final render. */
async function getFollow(path) {
  return get(path, { redirect: 'follow' })
}

// ── 1. Public pages render ───────────────────────────────────────────────────
async function publicPages() {
  console.log(c.bold('\n1. Public pages'))

  const pages = [
    { path: '/',        name: 'landing (/)',    expect: ['Jaune'] },
    { path: '/login',   name: '/login',         expect: [] },
    { path: '/signup',  name: '/signup',        expect: [] },
    { path: '/privacy', name: '/privacy',       expect: ['Last updated'] },
    { path: '/landing', name: '/landing',       expect: ['Jaune'] },
  ]

  for (const p of pages) {
    const { res, body, err } = await getFollow(p.path)
    if (err) { bad(`${p.name} unreachable`, err.message); continue }
    if (res.status !== 200) { bad(`${p.name} returned ${res.status}`, 'expected 200'); continue }

    const missing = p.expect.filter(s => !body.includes(s))
    if (missing.length) meh(`${p.name} 200 but missing copy`, `no match for: ${missing.join(', ')}`)
    else ok(`${p.name} 200`, `${(body.length / 1024).toFixed(0)}kb`)
  }
}

// ── 2. API routes reject unauthenticated callers ─────────────────────────────
// A 401 proves the route booted, reached Supabase, and rejected us properly.
// A 500 usually means a missing/incorrect env var on the deployment.
async function apiAuthGuards() {
  console.log(c.bold('\n2. API auth guards (401 expected — a 500 means bad env vars)'))

  const routes = [
    { path: '/api/status',          method: 'GET'  },
    { path: '/api/brief/generate',  method: 'POST' },
    { path: '/api/pulse',           method: 'POST' },
    { path: '/api/user/export',     method: 'GET'  },
    { path: '/api/habits/week',     method: 'GET'  },
  ]

  for (const r of routes) {
    const { res, body, err } = await get(r.path, {
      method: r.method,
      headers: r.method === 'POST' ? { 'content-type': 'application/json' } : {},
      body: r.method === 'POST' ? '{}' : undefined,
    })
    if (err) { bad(`${r.method} ${r.path} unreachable`, err.message); continue }

    if (res.status === 401) ok(`${r.method} ${r.path} → 401`)
    else if (res.status >= 500) bad(`${r.method} ${r.path} → ${res.status}`, body.slice(0, 160))
    else if (res.status === 200) bad(`${r.method} ${r.path} → 200 unauthenticated`, 'route is not gated')
    else meh(`${r.method} ${r.path} → ${res.status}`, 'expected 401')
  }
}

// ── 3. Bearer-token path (the API the iOS app will use) ──────────────────────
async function bearerPath() {
  console.log(c.bold('\n3. Bearer-token rejection (mobile API path)'))
  const { res, body, err } = await get('/api/status', {
    headers: { authorization: 'Bearer not-a-real-jwt' },
  })
  if (err) return bad('bearer /api/status unreachable', err.message)
  if (res.status === 401) ok('garbage bearer token → 401')
  else if (res.status >= 500) bad(`garbage bearer token → ${res.status}`, body.slice(0, 160))
  else meh(`garbage bearer token → ${res.status}`, 'expected 401')
}

// ── 4. Domain, TLS, redirects ────────────────────────────────────────────────
async function domain() {
  console.log(c.bold('\n4. Domain + TLS'))

  if (!BASE.startsWith('https://')) { meh('base URL is not https', 'skipping TLS checks'); return }

  const host = new URL(BASE).host
  const apex = host.replace(/^www\./, '')

  // http → https
  const { res: httpRes, err: httpErr } = await get(`http://${apex}/`)
  if (httpErr) meh('http:// unreachable', httpErr.message)
  else if ([301, 302, 307, 308].includes(httpRes.status) && httpRes.headers.get('location')?.startsWith('https://')) {
    ok('http:// redirects to https', httpRes.headers.get('location'))
  } else if (httpRes.status === 200) bad('http:// serves 200 without redirecting', 'insecure')
  else meh(`http:// returned ${httpRes.status}`)

  // www variant resolves (redirect or 200 both fine)
  const { res: wwwRes, err: wwwErr } = await get(`https://www.${apex}/`)
  if (wwwErr) bad('www. variant unreachable', wwwErr.message)
  else if (wwwRes.status < 400) ok(`https://www.${apex} → ${wwwRes.status}`)
  else bad(`https://www.${apex} → ${wwwRes.status}`)
}

// ── 5. Regressions we've fixed before, and don't want back ───────────────────
async function regressions() {
  console.log(c.bold('\n5. Known regressions'))

  const { body: home, err } = await getFollow('/')
  const { body: privacy } = await getFollow('/privacy')
  if (err) return bad('could not fetch / for regression checks', err.message)

  // Pre-rebrand domain should appear nowhere in shipped markup.
  const stale = [home, privacy].filter(b => b && /locusai\.space/i.test(b)).length
  if (stale) bad('"locusai.space" still present in shipped HTML', 'pre-rebrand domain leaked')
  else ok('no locusai.space references in shipped HTML')

  // Calendar feature was removed 2026-07-23 — privacy policy shouldn't mention it.
  if (privacy && /google calendar/i.test(privacy)) {
    bad('privacy policy still mentions Google Calendar', 'feature was removed — deploy may be stale')
  } else ok('privacy policy has no Google Calendar references')

  // Server env leakage: a service-role key or Anthropic key in client HTML is critical.
  const leak = [home, privacy].some(b => b && (/sk-ant-/.test(b) || /service_role/.test(b)))
  if (leak) bad('possible secret leaked into client HTML', 'CHECK IMMEDIATELY')
  else ok('no obvious secret material in client HTML')
}

// ── 6. Informational: headers + caching ──────────────────────────────────────
async function headers() {
  console.log(c.bold('\n6. Headers (informational)'))
  const { res, err } = await getFollow('/')
  if (err) return meh('could not read headers', err.message)

  const hsts = res.headers.get('strict-transport-security')
  hsts ? ok('HSTS set', hsts) : meh('no strict-transport-security header', 'Vercel sets this once the domain is fully provisioned')

  const xfo = res.headers.get('x-frame-options') || res.headers.get('content-security-policy')
  xfo ? ok('clickjacking protection present') : meh('no x-frame-options / CSP', 'low priority pre-beta; revisit before public launch')

  const cache = res.headers.get('x-vercel-cache')
  if (cache) ok('served by Vercel', `x-vercel-cache: ${cache}`)
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log(c.bold(`\nJaune deploy smoke test → ${BASE}`))
console.log(c.dim(`${new Date().toISOString()}`))

await publicPages()
await apiAuthGuards()
await bearerPath()
await domain()
await regressions()
await headers()

console.log(c.bold('\n── Summary ──'))
console.log(`  ${c.green(`${pass} passed`)}   ${fail ? c.red(`${fail} failed`) : '0 failed'}   ${warn ? c.yellow(`${warn} warnings`) : '0 warnings'}`)
if (fail) {
  console.log(c.red('\nFailures:'))
  failures.forEach(f => console.log(`  · ${f}`))
}
console.log(c.dim('\nThis only covers the unauthenticated surface. The signed-in flow'))
console.log(c.dim('(onboarding → goal → habit → check-in → brief) still needs a manual pass —'))
console.log(c.dim('see DEPLOY_CHECKLIST.md §5.\n'))

process.exit(fail ? 1 : 0)

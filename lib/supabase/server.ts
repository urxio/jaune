import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

function createBearerClient(authHeader: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}

export async function createClient() {
  // Mobile clients authenticate with `Authorization: Bearer <jwt>` instead of
  // cookies. Detecting it here makes every caller (API routes and the lib/db
  // layer alike) forward the user's JWT so RLS applies as that user. NOTE:
  // bearer clients have no session — `auth.getUser()` only works when passed
  // the JWT explicitly, which `createClientFromRequest` below handles.
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return createBearerClient(authHeader)
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}

// Request-aware auth for API routes that serve both the web app and the
// mobile app. Mobile clients authenticate with `Authorization: Bearer <jwt>`
// (no cookies); web clients keep using the cookie session. The bearer client
// forwards the user's JWT on every request so RLS applies as that user.
// Returns the resolved user alongside the client — bearer clients have no
// session, so callers must not rely on `supabase.auth.getUser()` themselves.
export async function createClientFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const supabase = createBearerClient(authHeader)
    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
    return { supabase, user }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// Service-role client — bypasses RLS. Only use in server-to-server contexts
// (e.g. OAuth callbacks) where no user cookie session is available.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  )
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const publicPaths = ['/login', '/signup', '/auth/callback', '/landing', '/privacy', '/email-confirmed']
  const isPublic = pathname === '/' || publicPaths.some(p => pathname.startsWith(p))
  // Onboarding is authenticated-only but not a "public" auth page
  const isOnboarding = pathname.startsWith('/onboarding')

  // API routes authenticate themselves (cookie session or Bearer token for the
  // mobile app) and return proper 401s — a login redirect would break
  // non-browser clients, so let them through.
  const isApi = pathname.startsWith('/api')

  // Redirect unauthenticated users to login
  if (!user && !isPublic && !isApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isLanding = pathname === '/' || pathname.startsWith('/landing')

  // Redirect authenticated users away from auth pages (but not onboarding or landing)
  if (user && isPublic && !isOnboarding && !isLanding) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

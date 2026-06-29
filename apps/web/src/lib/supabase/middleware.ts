import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    },
  )

  // Resolve the user, but never let an auth error tank the entire request.
  // Reasons getUser() can throw or return null even with a cookie present:
  //   - Stale refresh token from a previous Supabase project
  //   - Network blip between Edge runtime and Supabase
  //   - Refresh token was rotated server-side
  // In any of those cases, we treat the visitor as logged out and continue.
  // Auth-required pages will redirect them to /login below.
  let user: { id: string } | null = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user ?? null
  } catch (err) {
    console.warn('[middleware] auth.getUser failed, treating as unauthenticated:', err)
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')
  const isAppRoute = request.nextUrl.pathname.startsWith('/library') ||
    request.nextUrl.pathname.startsWith('/tbr') ||
    request.nextUrl.pathname.startsWith('/analytics') ||
    request.nextUrl.pathname.startsWith('/series') ||
    request.nextUrl.pathname.startsWith('/clubs') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/import') ||
    request.nextUrl.pathname.startsWith('/feed')

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/library'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

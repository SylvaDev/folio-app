'use client'

import { useEffect, useState } from 'react'
import { PostHogProvider as Provider } from 'posthog-js/react'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'

/**
 * PostHog provider for client-side analytics + feature flags.
 *
 * Initializes once on first mount. Identifies the user with Supabase user.id
 * so feature flag rollouts can target individual users deterministically.
 *
 * Safe to render at the root: no-op if env vars are missing (dev/local builds).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!key || !host) {
      // No PostHog configured — skip silently. Useful for local dev.
      setReady(true)
      return
    }

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',  // don't create profiles for anon visitors
      capture_pageview: false,             // we handle this ourselves below
      capture_pageleave: true,
      // Block in dev to keep our analytics clean
      loaded: ph => {
        if (process.env.NODE_ENV === 'development') ph.opt_out_capturing()
      },
    })

    setReady(true)
  }, [])

  // Identify the user when they sign in
  useEffect(() => {
    if (!ready) return
    const supabase = createClient()

    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      posthog.identify(user.id, {
        email: user.email ?? undefined,
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        posthog.identify(session.user.id, { email: session.user.email ?? undefined })
      }
      if (event === 'SIGNED_OUT') {
        posthog.reset()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [ready])

  return <Provider client={posthog}>{children}</Provider>
}

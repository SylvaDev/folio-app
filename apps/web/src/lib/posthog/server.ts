import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog client. Used to evaluate feature flags in Server
 * Components and API routes so the client doesn't need a round trip.
 *
 * Lazy-initialized. Returns null if PostHog isn't configured (dev builds).
 * Server-only — never import from a client component.
 */

let _client: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  if (_client) return _client

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!key || !host) return null

  _client = new PostHog(key, {
    host,
    // Server-side calls are short-lived; flush before the lambda exits
    flushAt: 1,
    flushInterval: 0,
  })
  return _client
}

/**
 * Evaluates a feature flag for a specific user, server-side.
 * Returns false on any error or if PostHog isn't configured (safe default).
 */
export async function isFeatureEnabled(flag: string, userId: string): Promise<boolean> {
  const ph = getPostHogServer()
  if (!ph) return false
  try {
    const value = await ph.isFeatureEnabled(flag, userId)
    return value === true
  } catch (err) {
    console.error('[posthog.isFeatureEnabled]', err)
    return false
  }
}

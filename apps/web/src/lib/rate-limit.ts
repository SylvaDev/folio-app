import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Rate limit configurations. Tune these as we learn real usage patterns.
 *
 * Convention: per-user limits. When we need IP-based throttling for
 * unauthenticated endpoints, add a separate set of configs.
 */
export const RATE_LIMITS = {
  // Engagement actions — generous, but spam-proof
  'comment.create':  { max: 30,  windowSeconds: 60 },  // 30 comments/min
  'like.toggle':     { max: 120, windowSeconds: 60 },  // doubles + uncovers OK
  'follow.toggle':   { max: 60,  windowSeconds: 60 },

  // Write-heavy: scanner runs through whole library
  'series.scan':     { max: 4,   windowSeconds: 60 },

  // AI is the most expensive call we make
  'ai.queue':        { max: 10,  windowSeconds: 60 },

  // Reading sessions — only realistic case is "log a few in quick succession"
  'session.log':     { max: 30,  windowSeconds: 60 },

  // Username writes / profile updates
  'profile.write':   { max: 20,  windowSeconds: 60 },
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS

/**
 * Checks if the given user can perform `action`. Call before mutating.
 *
 * Returns a Response if rate-limited (caller should `return` it immediately),
 * or null if allowed.
 *
 * Bucketing: each (user_id, action) gets its own window.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: RateLimitAction,
): Promise<NextResponse | null> {
  const config = RATE_LIMITS[action]
  const bucket = `user:${userId}:${action}`

  // `check_rate_limit` lives in the `internal` schema (not `public`) so it
  // isn't auto-exposed via PostgREST as /rest/v1/rpc/check_rate_limit.
  const { data, error } = await supabase
    .schema('internal' as 'public')
    .rpc('check_rate_limit', {
      p_bucket: bucket,
      p_max_count: config.max,
      p_window_seconds: config.windowSeconds,
    })

  if (error) {
    // Fail OPEN on rate-limit infrastructure errors. We'd rather take the
    // hit than block legitimate users when the limiter itself misbehaves.
    console.error('[rate-limit] check failed, allowing through:', error)
    return null
  }

  if (data === false) {
    return NextResponse.json(
      {
        error: 'Too many requests, slow down',
        retryAfterSeconds: config.windowSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(config.windowSeconds),
        },
      },
    )
  }

  return null
}

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Tiered quota system for premium-leaning features.
 *
 * Distinct from `lib/rate-limit.ts`:
 *   - rate-limit = short-term abuse prevention (e.g. 30 comments/min)
 *   - quota      = feature-value gating (e.g. 3 AI calls/week on free)
 *
 * Both apply: a Pro user gets unlimited quota but is still rate-limited
 * for abuse protection. The two systems share the `rate_limits` table
 * but use different buckets so they don't interfere.
 */

export type SubscriptionTier = 'free' | 'pro' | 'book_club'
export type QuotaAction = 'ai.recommendation'

interface QuotaLimit {
  count: number
  windowSeconds: number
  windowLabel: string  // human-readable, used in UI copy
}

const DAY = 86_400
const WEEK = 7 * DAY

/**
 * Per-tier limits. Tune these as we learn real engagement patterns.
 *
 * Pro is deliberately not "unlimited" — it's a high cap that's
 * effectively unlimited for any normal use but blocks abuse / runaway
 * scripts that would burn the Anthropic API key.
 */
export const QUOTAS: Record<QuotaAction, Record<SubscriptionTier, QuotaLimit>> = {
  'ai.recommendation': {
    free:      { count: 3,  windowSeconds: WEEK, windowLabel: 'week' },
    pro:       { count: 30, windowSeconds: DAY,  windowLabel: 'day' },
    book_club: { count: 30, windowSeconds: DAY,  windowLabel: 'day' },
  },
}

export interface QuotaStatus {
  allowed: boolean
  used: number
  remaining: number
  limit: number
  resetsAt: string  // ISO timestamp
  windowLabel: string
  tier: SubscriptionTier
}

function bucketFor(userId: string, action: QuotaAction, tier: SubscriptionTier): string {
  // Include the tier in the bucket so changing tiers doesn't carry quota
  // across (e.g. upgrade clears the free counter, downgrade clears Pro counter)
  return `user:${userId}:${action}:${tier}`
}

/**
 * Atomically check + consume one unit of quota. Returns whether the call
 * was allowed and the current usage state.
 */
export async function consumeQuota(
  supabase: SupabaseClient,
  userId: string,
  action: QuotaAction,
  tier: SubscriptionTier,
): Promise<QuotaStatus | { error: string }> {
  const limit = QUOTAS[action][tier]
  const { data, error } = await supabase
    .schema('internal' as 'public')
    .rpc('consume_quota', {
      p_bucket: bucketFor(userId, action, tier),
      p_limit: limit.count,
      p_window_seconds: limit.windowSeconds,
    })

  if (error) {
    console.error('[quota.consume]', error)
    return { error: 'Quota service unavailable' }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { error: 'Quota service returned empty response' }

  return {
    allowed: row.allowed,
    used: row.used,
    remaining: row.remaining,
    limit: row.limit,
    resetsAt: row.resets_at,
    windowLabel: limit.windowLabel,
    tier,
  }
}

/**
 * Non-consuming read of current quota state. Used by the UI to show
 * "X recommendations left this week" before the user clicks.
 */
export async function peekQuota(
  supabase: SupabaseClient,
  userId: string,
  action: QuotaAction,
  tier: SubscriptionTier,
): Promise<Omit<QuotaStatus, 'allowed'> | { error: string }> {
  const limit = QUOTAS[action][tier]
  const { data, error } = await supabase
    .schema('internal' as 'public')
    .rpc('peek_quota', {
      p_bucket: bucketFor(userId, action, tier),
      p_limit: limit.count,
      p_window_seconds: limit.windowSeconds,
    })

  if (error) {
    console.error('[quota.peek]', error)
    return { error: 'Quota service unavailable' }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { error: 'Quota service returned empty response' }

  return {
    used: row.used,
    remaining: row.remaining,
    limit: row.limit,
    resetsAt: row.resets_at,
    windowLabel: limit.windowLabel,
    tier,
  }
}

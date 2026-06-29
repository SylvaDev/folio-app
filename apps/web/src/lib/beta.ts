/**
 * Beta cohort evaluation.
 *
 * A user is in the beta cohort if EITHER:
 *   1. They've explicitly opted in (profiles.beta_access = true), OR
 *   2. Their user_id deterministically buckets into the auto-rollout range
 *
 * The auto-bucket is a fast hash of the user_id mod 100. A given user
 * always lands in the same bucket, so as we move the percentage threshold
 * up over time, more users get rolled in deterministically.
 */

// Tunable: percentage of users in the auto-beta cohort (0-100).
// Bump this as confidence grows. Start at 5%.
export const BETA_ROLLOUT_PERCENT = 5

/**
 * Returns a bucket in [0, 99] for the given user_id. Deterministic and
 * stable across sessions. Uses FNV-1a 32-bit which is fast and good
 * enough for non-cryptographic distribution.
 */
export function userBucket(userId: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash % 100
}

/**
 * Should this user see beta features?
 *
 * @param userId       The user's auth.uid()
 * @param explicitOptIn  Value of profiles.beta_access
 * @param rolloutPercent  Optional override (defaults to BETA_ROLLOUT_PERCENT)
 */
export function hasBetaAccess(
  userId: string,
  explicitOptIn: boolean,
  rolloutPercent: number = BETA_ROLLOUT_PERCENT,
): boolean {
  if (explicitOptIn) return true
  return userBucket(userId) < rolloutPercent
}

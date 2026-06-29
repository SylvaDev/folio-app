import Stripe from 'stripe'

/**
 * Lazy-initialized Stripe client. Server-only.
 *
 * Why lazy: keeps STRIPE_SECRET_KEY out of module-load-time reads, same
 * pattern as lib/anthropic.ts. Throws clearly if the key isn't configured
 * so misconfigurations fail fast at the request that needed it.
 */

let _client: Stripe | null = null

export function getStripeClient(): Stripe {
  if (_client) return _client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  _client = new Stripe(key, {
    // Pin the API version so future Stripe defaults don't change behavior
    // without us noticing. Bump deliberately, alongside testing.
    apiVersion: '2025-02-24.acacia',
    // Identify our integration to Stripe — appears in dashboard + support
    appInfo: { name: 'Folio', version: '0.1.0', url: 'https://foliotbr.app' },
    // Built-in retries for transient network blips
    maxNetworkRetries: 2,
  })
  return _client
}

/**
 * Maps our internal plan keys to Stripe Price IDs from env vars.
 * Price IDs are public (they're meant to be exposed in checkout URLs)
 * so they live in NEXT_PUBLIC_* env vars and can be read here too.
 */
export type PaidPlan = 'pro' | 'book_club'

export function priceIdFor(plan: PaidPlan): string | null {
  if (plan === 'pro') return process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? null
  if (plan === 'book_club') return process.env.NEXT_PUBLIC_STRIPE_PRICE_BOOK_CLUB ?? null
  return null
}

/**
 * Reverse mapping: given a Stripe Price ID from a webhook, figure out
 * which internal plan it represents. Used by the webhook handler to
 * set the right `profiles.subscription` value.
 */
export function planFromPriceId(priceId: string | null | undefined): 'free' | PaidPlan {
  if (!priceId) return 'free'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BOOK_CLUB) return 'book_club'
  return 'free'
}

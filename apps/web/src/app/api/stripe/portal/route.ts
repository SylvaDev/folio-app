import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'
import { getStripeClient } from '@/lib/stripe'

/**
 * POST /api/stripe/portal
 *
 * Returns a URL to the Stripe Customer Portal so the user can update
 * their card, see invoices, switch plans, or cancel. Stripe hosts the
 * page; we just provision the one-time session token.
 *
 * Only callable by users who already have a Stripe customer record.
 * Free users have no customer to manage — they go through /checkout instead.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'profile.write')
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = profile?.stripe_customer_id
  if (!customerId) {
    return badRequest('You don’t have an active subscription to manage')
  }

  try {
    const stripe = getStripeClient()
    const origin = req.headers.get('origin')
      ?? process.env.NEXT_PUBLIC_SITE_URL
      ?? 'https://foliotbr.app'

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings?tab=billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return serverError('api.stripe.portal', err)
  }
}

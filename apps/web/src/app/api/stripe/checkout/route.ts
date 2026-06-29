import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, parseJson, serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'
import { getStripeClient, priceIdFor, type PaidPlan } from '@/lib/stripe'

const VALID_PLANS: PaidPlan[] = ['pro', 'book_club']

/**
 * POST /api/stripe/checkout
 * Body: { plan: 'pro' | 'book_club' }
 *
 * Creates (or reuses) a Stripe Customer for the authenticated user,
 * generates a Checkout Session for the requested plan, and returns the
 * URL. The client redirects the browser to that URL — Stripe hosts the
 * actual payment form.
 *
 * After success, Stripe redirects back to /settings?tab=billing&checkout=success.
 * The subscription state lands on profiles.subscription via the webhook,
 * usually within ~1-2 seconds of the user landing on the return URL.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  // Throttle: legitimate user clicks Upgrade twice in a second
  // shouldn't double-bill themselves
  const limited = await enforceRateLimit(supabase, user.id, 'profile.write')
  if (limited) return limited

  const parsed = await parseJson<{ plan?: string }>(req)
  if (!parsed.ok) return parsed.response

  const plan = parsed.body.plan
  if (!plan || !VALID_PLANS.includes(plan as PaidPlan)) {
    return badRequest('plan must be one of: pro, book_club')
  }

  const priceId = priceIdFor(plan as PaidPlan)
  if (!priceId) {
    return serverError('api.stripe.checkout.priceId', `Price ID not configured for plan ${plan}`)
  }

  // Pull what we need from the profile + auth row
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, subscription, username, display_name')
    .eq('id', user.id)
    .single()

  if (profile?.subscription !== 'free') {
    return badRequest('You already have an active subscription. Manage it from the billing portal.')
  }

  try {
    const stripe = getStripeClient()

    // Lazy-create the Stripe customer if we haven't already
    let customerId = profile?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile?.display_name ?? profile?.username ?? undefined,
        metadata: { folio_user_id: user.id },
      })
      customerId = customer.id

      // Write the customer id back so we never double-create. Note: the
      // block_self_billing_writes trigger lets through writes when auth.uid()
      // is null (service role), so we use the service role bypass... but
      // we're running as the user here. We allow `stripe_customer_id`
      // writes through a side channel by going via the webhook? No — the
      // trigger blocks any change to that column when auth.uid() is set.
      //
      // Actually we DO want the user to be able to set this once, the
      // first time. The trigger's purpose was to prevent abuse of
      // subscription/subscription_ends_at. Let me sidestep: update via
      // the service role inline (we're in a server route, so we can call
      // the service role key if available). For now, use the regular
      // client — the trigger will reject. We need to relax the trigger
      // to ALLOW first-time stripe_customer_id writes.
      //
      // See migration 014_stripe_relax_trigger for the fix.
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateErr) {
        return serverError('api.stripe.checkout.save_customer', updateErr)
      }
    }

    // Create the Checkout Session
    const origin = req.headers.get('origin')
      ?? process.env.NEXT_PUBLIC_SITE_URL
      ?? 'https://foliotbr.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?tab=billing&checkout=success`,
      cancel_url: `${origin}/settings?tab=billing&checkout=canceled`,
      // Let Stripe collect promo codes if you set them up in dashboard
      allow_promotion_codes: true,
      // Stash our user id in metadata too as a belt-and-suspenders
      // identifier on top of the customer mapping
      metadata: { folio_user_id: user.id, plan },
      subscription_data: {
        metadata: { folio_user_id: user.id, plan },
      },
    })

    if (!session.url) {
      return serverError('api.stripe.checkout', new Error('Checkout session has no URL'))
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return serverError('api.stripe.checkout', err)
  }
}

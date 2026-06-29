import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient, planFromPriceId } from '@/lib/stripe'
import { getAdminClient } from '@/lib/supabase/admin'

// Stripe needs the raw body for signature verification. Disable Next's
// body parsing for this route.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe events. Source of truth for profiles.subscription and
 * profiles.subscription_ends_at — these columns are immutable from the
 * client side (enforced by the block_self_billing_writes trigger).
 *
 * Idempotent: each Stripe event id is recorded in stripe_events on first
 * successful handle. Subsequent deliveries of the same event are no-ops.
 */
export async function POST(req: Request) {
  const stripe = getStripeClient()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    console.error('[stripe.webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Idempotency check: have we already processed this event?
  const { data: existing } = await admin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()

  if (existing) {
    // Already handled — return 200 so Stripe stops retrying
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    await dispatch(event, admin)

    // Record the event for idempotency
    await admin.from('stripe_events').insert({
      id: event.id,
      event_type: event.type,
      payload: event.data?.object as object,
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`[stripe.webhook] handler failed for ${event.type} (${event.id}):`, err)
    // Returning 500 makes Stripe retry. That's what we want for transient
    // failures, but be careful: bugs in our handler will retry forever.
    // Stripe gives up after ~3 days.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Event dispatch
// ─────────────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof getAdminClient>

async function dispatch(event: Stripe.Event, admin: AdminClient): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, admin)

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionUpsert(event.data.object as Stripe.Subscription, admin)

    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription, admin)

    case 'invoice.payment_failed':
      return handlePaymentFailed(event.data.object as Stripe.Invoice, admin)

    default:
      // Other events (invoice.paid, customer.created, etc.) are logged
      // via the stripe_events table but don't require action.
      return
  }
}

// ─── Checkout completed → look up subscription + sync ───────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, admin: AdminClient) {
  if (session.mode !== 'subscription' || !session.subscription) return
  const stripe = getStripeClient()
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await handleSubscriptionUpsert(subscription, admin)
}

// ─── Subscription created/updated → set tier + period end ────────────────
async function handleSubscriptionUpsert(subscription: Stripe.Subscription, admin: AdminClient) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  // Find the user this customer belongs to. Try metadata first (set at
  // checkout time), fall back to customer id lookup.
  const folioUserId = (subscription.metadata?.folio_user_id as string | undefined) ?? null
  const userId = folioUserId ?? await findUserIdByCustomer(customerId, admin)
  if (!userId) {
    console.warn('[stripe.webhook] subscription has no matching Folio user:', subscription.id, customerId)
    return
  }

  // Pull the price → resolve to our internal plan name
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null
  const plan = planFromPriceId(priceId)

  // If the subscription is "canceled" or "incomplete_expired", treat as free
  const effectiveTier = ['canceled', 'incomplete_expired', 'unpaid'].includes(subscription.status)
    ? 'free'
    : plan

  // current_period_end is a unix timestamp seconds. ISO it for storage.
  // Use a runtime any-cast: Stripe's TS types are inconsistent across versions.
  const periodEndUnix = (subscription as unknown as { current_period_end?: number }).current_period_end
  const periodEnd = typeof periodEndUnix === 'number'
    ? new Date(periodEndUnix * 1000).toISOString()
    : null

  const { error } = await admin
    .from('profiles')
    .update({
      subscription: effectiveTier,
      subscription_ends_at: periodEnd,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to update profile for ${userId}: ${error.message}`)
  }
}

// ─── Subscription truly deleted → downgrade to free ──────────────────────
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, admin: AdminClient) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
  const folioUserId = (subscription.metadata?.folio_user_id as string | undefined) ?? null
  const userId = folioUserId ?? await findUserIdByCustomer(customerId, admin)
  if (!userId) return

  const { error } = await admin
    .from('profiles')
    .update({
      subscription: 'free',
      subscription_ends_at: null,
      stripe_subscription_id: null,
    })
    .eq('id', userId)

  if (error) throw new Error(`Failed to downgrade ${userId}: ${error.message}`)
}

// ─── Payment failed → log only for now ───────────────────────────────────
// Stripe's automatic retry policy + dunning emails will handle the user.
// If we wanted in-app messaging ("Your payment failed, update card"), we'd
// flip a profile flag here and surface it in the AppShell. Not in MVP scope.
async function handlePaymentFailed(invoice: Stripe.Invoice, _admin: AdminClient) {
  console.warn('[stripe.webhook] invoice.payment_failed:', invoice.id, invoice.customer)
}

// ─── Helper: look up Folio user id from Stripe customer id ───────────────
async function findUserIdByCustomer(customerId: string, admin: AdminClient): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

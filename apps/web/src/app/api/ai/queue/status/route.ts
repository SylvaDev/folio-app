import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serverError, unauthorized } from '@/lib/api-errors'
import { peekQuota, type SubscriptionTier } from '@/lib/quota'

const VALID_TIERS: SubscriptionTier[] = ['free', 'pro', 'book_club']

function asTier(value: unknown): SubscriptionTier {
  return VALID_TIERS.includes(value as SubscriptionTier)
    ? (value as SubscriptionTier)
    : 'free'
}

/**
 * GET /api/ai/queue/status
 * Returns the user's current AI recommendation quota state without
 * consuming anything. Used by the TBR page to show "X left this week".
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription')
    .eq('id', user.id)
    .single()
  const tier = asTier(profile?.subscription)

  const status = await peekQuota(supabase, user.id, 'ai.recommendation', tier)
  if ('error' in status) {
    return serverError('api.ai.queue.status', status.error)
  }

  return NextResponse.json({ quota: status })
}

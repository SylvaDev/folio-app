import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic'
import { badRequest, parseJson, serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'
import { consumeQuota, type SubscriptionTier } from '@/lib/quota'

const VALID_TIERS: SubscriptionTier[] = ['free', 'pro', 'book_club']

function asTier(value: unknown): SubscriptionTier {
  return VALID_TIERS.includes(value as SubscriptionTier)
    ? (value as SubscriptionTier)
    : 'free'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  // Short-window abuse protection (every tier, prevents script-driven hammering)
  const limited = await enforceRateLimit(supabase, user.id, 'ai.queue')
  if (limited) return limited

  // Look up the user's tier so we can apply the correct quota
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription')
    .eq('id', user.id)
    .single()
  const tier = asTier(profile?.subscription)

  // Tier-aware quota check: 3/week for free, 30/day for paid.
  // Consumed atomically — if denied, the user is told when their quota resets.
  const quota = await consumeQuota(supabase, user.id, 'ai.recommendation', tier)
  if ('error' in quota) {
    return serverError('api.ai.queue.quota', quota.error)
  }
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message:
          tier === 'free'
            ? `You've used all ${quota.limit} recommendations this ${quota.windowLabel}. Upgrade to Pro for unlimited.`
            : `Limit reached: ${quota.limit} per ${quota.windowLabel}. Resets soon.`,
        quota,
      },
      { status: 429 },
    )
  }

  const parsed = await parseJson<{ books?: unknown; mood?: string }>(request)
  if (!parsed.ok) return parsed.response

  const { books, mood } = parsed.body
  if (!Array.isArray(books) || books.length === 0) {
    return badRequest('books array required')
  }
  // Hard cap on payload size to bound token spend
  const cappedBooks = books.slice(0, 20)
  const moodLine = mood && typeof mood === 'string' ? `The reader is currently in a "${mood}" mood.` : ''

  try {
    const anthropic = getAnthropicClient()
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: `You are Folio's AI reading assistant. You help readers decide what to read next from their TBR list.
Be conversational, specific, and enthusiastic but concise — 2-3 sentences max.
Reference the actual book title and author in your recommendation.
If mood is provided, prioritize books that match it.`,
      messages: [{
        role: 'user',
        content: `Here are my top TBR books:\n${JSON.stringify(cappedBooks, null, 2)}\n\n${moodLine}\n\nWhat should I read next and why?`,
      }],
    })

    const recommendation = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ recommendation, quota })
  } catch (err) {
    return serverError('api.ai.queue', err)
  }
}

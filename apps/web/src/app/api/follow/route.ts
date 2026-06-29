import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, notFound, parseJson, serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/follow  { username: string }
 * Creates a follow row pointing the authenticated user → the target.
 *
 * Idempotent: re-following someone you already follow is a no-op (the
 * composite PK quietly absorbs the duplicate insert when we use upsert).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'follow.toggle')
  if (limited) return limited

  const parsed = await parseJson<{ username?: string }>(req)
  if (!parsed.ok) return parsed.response

  const username = (parsed.body.username ?? '').toLowerCase().trim()
  if (!username) return badRequest('username required')

  const { data: target, error: lookupErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (lookupErr) return serverError('api.follow.POST.lookup', lookupErr)
  if (!target) return notFound('User not found')
  if (target.id === user.id) return badRequest("You can't follow yourself")

  const { error: insertErr } = await supabase
    .from('follows')
    .upsert(
      { follower_id: user.id, followed_id: target.id },
      { onConflict: 'follower_id,followed_id', ignoreDuplicates: true },
    )

  if (insertErr) return serverError('api.follow.POST', insertErr)
  return NextResponse.json({ ok: true, following: true })
}

/**
 * DELETE /api/follow  { username: string }
 * Removes the follow.
 */
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'follow.toggle')
  if (limited) return limited

  const parsed = await parseJson<{ username?: string }>(req)
  if (!parsed.ok) return parsed.response

  const username = (parsed.body.username ?? '').toLowerCase().trim()
  if (!username) return badRequest('username required')

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (!target) return notFound('User not found')

  const { error: deleteErr } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followed_id', target.id)

  if (deleteErr) return serverError('api.follow.DELETE', deleteErr)
  return NextResponse.json({ ok: true, following: false })
}

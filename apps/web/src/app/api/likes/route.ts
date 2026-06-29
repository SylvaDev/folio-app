import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, parseJson, serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'

const VALID_TARGETS = ['activity', 'review'] as const
type LikeTarget = (typeof VALID_TARGETS)[number]

const UUID_RE = /^[0-9a-f-]{36}$/i

function parseTarget(body: unknown):
  | { ok: false; error: string }
  | { ok: true; target_type: LikeTarget; target_id: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid body' }
  }
  const b = body as Record<string, unknown>
  const target_type = b.target_type
  const target_id = b.target_id
  if (typeof target_type !== 'string' || !VALID_TARGETS.includes(target_type as LikeTarget)) {
    return { ok: false, error: 'target_type must be activity or review' }
  }
  if (typeof target_id !== 'string' || !UUID_RE.test(target_id)) {
    return { ok: false, error: 'target_id must be a UUID' }
  }
  return { ok: true, target_type: target_type as LikeTarget, target_id }
}

/**
 * POST /api/likes  { target_type: 'activity' | 'review', target_id: uuid }
 * Idempotent: re-liking returns 200 without error.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'like.toggle')
  if (limited) return limited

  const json = await parseJson(req)
  if (!json.ok) return json.response
  const parsed = parseTarget(json.body)
  if (!parsed.ok) return badRequest(parsed.error)

  const { error } = await supabase
    .from('likes')
    .upsert(
      { user_id: user.id, target_type: parsed.target_type, target_id: parsed.target_id },
      { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true },
    )

  if (error) return serverError('api.likes.POST', error)
  return NextResponse.json({ ok: true, liked: true })
}

/**
 * DELETE /api/likes  { target_type, target_id }
 */
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'like.toggle')
  if (limited) return limited

  const json = await parseJson(req)
  if (!json.ok) return json.response
  const parsed = parseTarget(json.body)
  if (!parsed.ok) return badRequest(parsed.error)

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('target_type', parsed.target_type)
    .eq('target_id', parsed.target_id)

  if (error) return serverError('api.likes.DELETE', error)
  return NextResponse.json({ ok: true, liked: false })
}

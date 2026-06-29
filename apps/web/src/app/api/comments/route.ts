import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, parseJson, serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'

const VALID_TARGETS = ['activity', 'review'] as const
type CommentTarget = (typeof VALID_TARGETS)[number]

const UUID_RE = /^[0-9a-f-]{36}$/i
const MAX_LEN = 2000

/**
 * GET /api/comments?target_type=activity&target_id=UUID
 * Returns all comments on a target, oldest first, with author info.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const url = new URL(req.url)
  const target_type = url.searchParams.get('target_type')
  const target_id = url.searchParams.get('target_id')

  if (!target_type || !VALID_TARGETS.includes(target_type as CommentTarget)) {
    return badRequest('target_type must be activity or review')
  }
  if (!target_id || !UUID_RE.test(target_id)) {
    return badRequest('target_id must be a UUID')
  }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      id, content, parent_id, edited, created_at, updated_at,
      author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .order('created_at', { ascending: true })

  if (error) return serverError('api.comments.GET', error)
  return NextResponse.json({ comments: data ?? [] })
}

/**
 * POST /api/comments  { target_type, target_id, content, parent_id? }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'comment.create')
  if (limited) return limited

  const parsed = await parseJson<{
    target_type?: string
    target_id?: string
    content?: string
    parent_id?: string | null
  }>(req)
  if (!parsed.ok) return parsed.response

  const body = parsed.body
  const target_type = body.target_type
  const target_id = body.target_id
  const content = (body.content ?? '').trim()
  const parent_id = body.parent_id ?? null

  if (!target_type || !VALID_TARGETS.includes(target_type as CommentTarget)) {
    return badRequest('target_type must be activity or review')
  }
  if (!target_id || !UUID_RE.test(target_id)) {
    return badRequest('target_id must be a UUID')
  }
  if (!content) return badRequest('Comment is empty')
  if (content.length > MAX_LEN) return badRequest(`Comment too long (max ${MAX_LEN} chars)`)
  if (parent_id !== null && !UUID_RE.test(parent_id)) return badRequest('Invalid parent_id')

  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: user.id,
      target_type,
      target_id,
      content,
      parent_id,
    })
    .select(`
      id, content, parent_id, edited, created_at, updated_at,
      author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .single()

  if (error) return serverError('api.comments.POST', error)
  return NextResponse.json({ comment: data })
}

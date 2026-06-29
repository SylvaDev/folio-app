import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, notFound, parseJson, serverError, unauthorized } from '@/lib/api-errors'

const UUID_RE = /^[0-9a-f-]{36}$/i
const MAX_LEN = 2000

interface Ctx {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/comments/[id]  { content: string }
 * Edits the user's own comment. RLS enforces ownership.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  if (!UUID_RE.test(id)) return badRequest('Invalid id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const parsed = await parseJson<{ content?: string }>(req)
  if (!parsed.ok) return parsed.response
  const content = (parsed.body.content ?? '').trim()

  if (!content) return badRequest('Content cannot be empty')
  if (content.length > MAX_LEN) return badRequest(`Comment too long (max ${MAX_LEN} chars)`)

  const { data, error } = await supabase
    .from('comments')
    .update({ content })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(`
      id, content, parent_id, edited, created_at, updated_at,
      author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .maybeSingle()

  if (error) return serverError('api.comments.PATCH', error)
  if (!data) return notFound('Comment not found or not yours')
  return NextResponse.json({ comment: data })
}

/**
 * DELETE /api/comments/[id]
 * Removes the user's own comment (and any replies via cascade).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  if (!UUID_RE.test(id)) return badRequest('Invalid id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return serverError('api.comments.DELETE', error)
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, parseJson, serverError, unauthorized } from '@/lib/api-errors'

/**
 * POST /api/notifications/read
 * Body: { id?: string, all?: boolean }
 *
 * Marks notifications as read.
 *   - { id }   → mark a single notification as read
 *   - { all }  → mark all of the user's notifications as read
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const parsed = await parseJson<{ id?: string; all?: boolean }>(req)
  if (!parsed.ok) return parsed.response

  const id = parsed.body.id
  const all = parsed.body.all === true
  const now = new Date().toISOString()

  if (all) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null)
    if (error) return serverError('api.notifications.read.all', error)
    return NextResponse.json({ ok: true })
  }

  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return badRequest('Invalid id')
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return serverError('api.notifications.read.one', error)
    return NextResponse.json({ ok: true })
  }

  return badRequest('Provide id or all')
}

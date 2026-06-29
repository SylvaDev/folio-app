import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serverError, unauthorized } from '@/lib/api-errors'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

/**
 * GET /api/notifications?limit=20&cursor=<iso>&only_unread=1
 * Returns the user's notifications with actor info hydrated.
 * Always includes `unread_count` for the badge.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)
  const cursor = url.searchParams.get('cursor')
  const onlyUnread = url.searchParams.get('only_unread') === '1'

  // Build list query
  let query = supabase
    .from('notifications')
    .select(`
      id, type, target_type, target_id, metadata, read_at, created_at,
      actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) query = query.lt('created_at', cursor)
  if (onlyUnread) query = query.is('read_at', null)

  const [{ data: rows, error: listErr }, { count: unreadCount }] = await Promise.all([
    query,
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  if (listErr) return serverError('api.notifications.GET', listErr)

  const hasMore = (rows?.length ?? 0) > limit
  const notifications = (rows ?? []).slice(0, limit)
  const nextCursor = hasMore ? notifications[notifications.length - 1].created_at : null

  return NextResponse.json({
    notifications,
    nextCursor,
    unread_count: unreadCount ?? 0,
  })
}

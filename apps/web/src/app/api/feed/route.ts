import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, serverError, unauthorized } from '@/lib/api-errors'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

/**
 * GET /api/feed?cursor=<iso-timestamp>&limit=20&scope=follows|self|all
 *
 * Returns activities sorted by created_at desc, cursor-paginated by timestamp.
 *
 * Scopes:
 *   - follows (default): your own activities + the people you follow
 *   - self: only your own activities
 *   - all: every public activity (discovery; later when we have users)
 *
 * Each activity is enriched with actor info + the underlying book + the
 * current viewer's like state. One round trip from the client.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const scope = url.searchParams.get('scope') ?? 'follows'
  const limit = Math.min(
    Number(url.searchParams.get('limit')) || DEFAULT_LIMIT,
    MAX_LIMIT,
  )

  // Resolve which user_ids count for this scope
  let allowedUserIds: string[] | null = null  // null = no filter (all)

  if (scope === 'self') {
    allowedUserIds = [user.id]
  } else if (scope === 'follows') {
    const { data: follows } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', user.id)
    allowedUserIds = [user.id, ...(follows ?? []).map(f => f.followed_id)]
  } else if (scope !== 'all') {
    return badRequest('scope must be follows, self, or all')
  }

  // Build query against the activity_feed view (joined with profiles)
  let query = supabase
    .from('activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1)  // fetch one extra to detect "has more"

  if (cursor) {
    query = query.lt('created_at', cursor)
  }
  if (allowedUserIds) {
    if (allowedUserIds.length === 0) {
      // Nothing followed yet + scope=follows means empty feed
      return NextResponse.json({ activities: [], nextCursor: null })
    }
    query = query.in('user_id', allowedUserIds)
  }

  const { data: rows, error } = await query
  if (error) return serverError('api.feed.GET', error)

  const hasMore = (rows?.length ?? 0) > limit
  const activities = (rows ?? []).slice(0, limit)
  const nextCursor = hasMore ? activities[activities.length - 1].created_at : null

  if (activities.length === 0) {
    return NextResponse.json({ activities: [], nextCursor: null })
  }

  // Hydrate the user_book + book data for each activity
  const userBookIds = activities
    .filter(a => a.target_type === 'user_book')
    .map(a => a.target_id)

  const { data: userBooks } = userBookIds.length > 0
    ? await supabase
        .from('user_books')
        .select(`
          id, status, rating, review, review_is_public, date_finished, pages_read,
          book:books(id, title, authors, cover_url, page_count)
        `)
        .in('id', userBookIds)
    : { data: [] }

  const userBookMap = new Map((userBooks ?? []).map(ub => [ub.id, ub]))

  // Like state + counts for the activities themselves
  const activityIds = activities.map(a => a.id)
  const [{ data: viewerLikes }, { data: allLikes }, { data: commentCounts }] = await Promise.all([
    supabase
      .from('likes')
      .select('target_id')
      .eq('user_id', user.id)
      .eq('target_type', 'activity')
      .in('target_id', activityIds),
    supabase
      .from('likes')
      .select('target_id')
      .eq('target_type', 'activity')
      .in('target_id', activityIds),
    supabase
      .from('comments')
      .select('target_id')
      .eq('target_type', 'activity')
      .in('target_id', activityIds),
  ])

  const likedByMe = new Set((viewerLikes ?? []).map(l => l.target_id))
  const likeCounts = new Map<string, number>()
  for (const l of allLikes ?? []) {
    likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1)
  }
  const commentTotals = new Map<string, number>()
  for (const c of commentCounts ?? []) {
    commentTotals.set(c.target_id, (commentTotals.get(c.target_id) ?? 0) + 1)
  }

  const hydrated = activities.map(a => ({
    ...a,
    user_book: a.target_type === 'user_book' ? userBookMap.get(a.target_id) ?? null : null,
    liked_by_viewer: likedByMe.has(a.id),
    like_count: likeCounts.get(a.id) ?? 0,
    comment_count: commentTotals.get(a.id) ?? 0,
  }))

  return NextResponse.json({ activities: hydrated, nextCursor })
}

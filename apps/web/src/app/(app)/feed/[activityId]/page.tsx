import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ActivityCard, activityVerb, type ActivityHydrated } from '@/components/social/ActivityCard'

interface PageProps {
  params: Promise<{ activityId: string }>
}

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { activityId } = await params
  if (!UUID_RE.test(activityId)) return { title: 'Activity' }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('activity_feed')
    .select('actor_username, type')
    .eq('id', activityId)
    .maybeSingle()

  if (!row) return { title: 'Activity' }
  const verb = activityVerb(row.type)
  return {
    title: `@${row.actor_username} ${verb.verb}`,
    description: `${row.actor_username}'s reading activity on Folio`,
  }
}

export default async function ActivityPermalinkPage({ params }: PageProps) {
  const { activityId } = await params
  if (!UUID_RE.test(activityId)) notFound()

  const supabase = await createClient()
  const { data: { user: viewer } } = await supabase.auth.getUser()

  // Fetch the activity through the view (RLS enforces privacy + public-profile check)
  const { data: activity } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('id', activityId)
    .maybeSingle()

  if (!activity) notFound()

  // Hydrate the user_book if this activity references one
  let userBook = null
  if (activity.target_type === 'user_book') {
    const { data } = await supabase
      .from('user_books')
      .select(`
        id, status, rating, review, review_is_public, date_finished, pages_read,
        book:books(id, title, authors, cover_url, page_count)
      `)
      .eq('id', activity.target_id)
      .maybeSingle()
    userBook = data
  }

  // Engagement counts + viewer like state
  const [{ data: allLikes }, { data: allComments }, { data: viewerLikes }] = await Promise.all([
    supabase.from('likes').select('user_id').eq('target_type', 'activity').eq('target_id', activity.id),
    supabase.from('comments').select('id').eq('target_type', 'activity').eq('target_id', activity.id),
    viewer
      ? supabase
          .from('likes')
          .select('user_id')
          .eq('user_id', viewer.id)
          .eq('target_type', 'activity')
          .eq('target_id', activity.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const hydrated: ActivityHydrated = {
    ...activity,
    user_book: userBook,
    like_count: allLikes?.length ?? 0,
    comment_count: allComments?.length ?? 0,
    liked_by_viewer: !!viewerLikes,
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-forest transition-colors mb-5 outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 rounded-md"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Back to feed
      </Link>

      <ActivityCard activity={hydrated} viewerId={viewer?.id ?? null} commentsOpen />
    </div>
  )
}

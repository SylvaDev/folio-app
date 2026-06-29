import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ProfileView } from './ProfileView'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  return {
    title: `@${username}`,
    description: `${username}'s reading life on Folio`,
    openGraph: {
      title: `@${username} on Folio`,
      description: `${username}'s reading life on Folio`,
      type: 'profile',
    },
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params
  const cleanUsername = username.toLowerCase().replace(/^@/, '')

  const supabase = await createClient()
  const { data: { user: viewer } } = await supabase.auth.getUser()

  // Fetch the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, reading_goal, created_at, is_public, subscription')
    .eq('username', cleanUsername)
    .maybeSingle()

  if (!profile) notFound()

  const isOwn = viewer?.id === profile.id

  // If private and not the owner, render a "private profile" stub
  if (!profile.is_public && !isOwn) {
    return (
      <ProfileView
        profile={profile}
        viewerId={viewer?.id ?? null}
        isOwn={false}
        isPrivate={true}
        stats={null}
        currentlyReading={[]}
        recentlyFinished={[]}
        favorites={[]}
      />
    )
  }

  // Aggregate stats from the view
  const { data: stats } = await supabase
    .from('user_reading_stats')
    .select('total_read, read_this_year, currently_reading, avg_rating, total_pages_read')
    .eq('user_id', profile.id)
    .maybeSingle()

  // Parallelize: book lists + follow counts + viewer's follow state + public reviews
  const [
    { data: currentlyReading },
    { data: recentlyFinished },
    { data: favorites },
    { count: followerCount },
    { count: followingCount },
    { data: viewerFollow },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from('user_books')
      .select('id, status, pages_read, book:books(id, title, authors, cover_url, page_count)')
      .eq('user_id', profile.id)
      .eq('status', 'reading')
      .limit(6),
    supabase
      .from('user_books')
      .select('id, status, rating, date_finished, book:books(id, title, authors, cover_url)')
      .eq('user_id', profile.id)
      .eq('status', 'read')
      .order('date_finished', { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from('user_books')
      .select('id, status, rating, book:books(id, title, authors, cover_url)')
      .eq('user_id', profile.id)
      .eq('is_favorite', true)
      .limit(8),
    supabase
      .from('follows')
      .select('followed_id', { count: 'exact', head: true })
      .eq('followed_id', profile.id),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
    viewer && !isOwn
      ? supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewer.id)
          .eq('followed_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('user_books')
      .select('id, rating, review, date_finished, book:books(id, title, authors, cover_url)')
      .eq('user_id', profile.id)
      .eq('review_is_public', true)
      .not('review', 'is', null)
      .order('date_finished', { ascending: false, nullsFirst: false })
      .limit(10),
  ])

  // Hydrate review engagement (likes + comment counts + viewer-liked state)
  const reviewIds = (reviews ?? []).map(r => r.id)
  let likeCounts = new Map<string, number>()
  let commentCounts = new Map<string, number>()
  let viewerLikedSet = new Set<string>()

  if (reviewIds.length > 0) {
    const [{ data: allLikes }, { data: allComments }, { data: viewerLikes }] = await Promise.all([
      supabase
        .from('likes')
        .select('target_id')
        .eq('target_type', 'review')
        .in('target_id', reviewIds),
      supabase
        .from('comments')
        .select('target_id')
        .eq('target_type', 'review')
        .in('target_id', reviewIds),
      viewer
        ? supabase
            .from('likes')
            .select('target_id')
            .eq('user_id', viewer.id)
            .eq('target_type', 'review')
            .in('target_id', reviewIds)
        : Promise.resolve({ data: [] as { target_id: string }[] }),
    ])

    for (const l of allLikes ?? []) likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1)
    for (const c of allComments ?? []) commentCounts.set(c.target_id, (commentCounts.get(c.target_id) ?? 0) + 1)
    viewerLikedSet = new Set((viewerLikes ?? []).map(l => l.target_id))
  }

  const hydratedReviews = (reviews ?? []).map(r => ({
    ...r,
    like_count: likeCounts.get(r.id) ?? 0,
    comment_count: commentCounts.get(r.id) ?? 0,
    liked_by_viewer: viewerLikedSet.has(r.id),
  }))

  return (
    <ProfileView
      profile={profile}
      viewerId={viewer?.id ?? null}
      isOwn={isOwn}
      isPrivate={false}
      stats={stats}
      currentlyReading={currentlyReading ?? []}
      recentlyFinished={recentlyFinished ?? []}
      favorites={favorites ?? []}
      reviews={hydratedReviews}
      followerCount={followerCount ?? 0}
      followingCount={followingCount ?? 0}
      viewerFollows={!!viewerFollow}
    />
  )
}

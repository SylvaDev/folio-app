'use client'

import Link from 'next/link'
import { BookOpen, Check, Star, MessageCircle } from 'lucide-react'
import { BookCover } from '@/components/books/BookCover'
import { LikeButton } from './LikeButton'
import { CommentThread } from './CommentThread'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────
export type ActivityType =
  | 'started_book'
  | 'finished_book'
  | 'rated_book'
  | 'reviewed_book'
  | 'added_to_tbr'

interface BookLite {
  id: string
  title: string
  authors: string[]
  cover_url: string | null
  page_count: number | null
}

export interface UserBookLite {
  id: string
  status: string
  rating: number | null
  review: string | null
  review_is_public: boolean
  date_finished: string | null
  pages_read: number | null
  book: BookLite | BookLite[] | null
}

export interface ActivityHydrated {
  id: string
  user_id: string
  type: ActivityType
  target_type: 'user_book' | 'review' | 'book'
  target_id: string
  metadata: Record<string, unknown>
  created_at: string
  actor_username: string
  actor_display_name: string | null
  actor_avatar_url: string | null
  actor_is_public: boolean
  user_book: UserBookLite | null
  liked_by_viewer: boolean
  like_count: number
  comment_count: number
}

function asBook(b: BookLite | BookLite[] | null | undefined): BookLite | null {
  if (!b) return null
  return Array.isArray(b) ? (b[0] ?? null) : b
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function activityVerb(type: ActivityType): { verb: string; icon: typeof BookOpen; tint: string } {
  switch (type) {
    case 'started_book':
      return { verb: 'started reading', icon: BookOpen, tint: 'text-mint' }
    case 'finished_book':
      return { verb: 'finished', icon: Check, tint: 'text-forest' }
    case 'rated_book':
      return { verb: 'rated', icon: Star, tint: 'text-gold' }
    case 'reviewed_book':
      return { verb: 'reviewed', icon: MessageCircle, tint: 'text-terra' }
    case 'added_to_tbr':
      return { verb: 'added to TBR', icon: BookOpen, tint: 'text-gray-400' }
  }
}

interface Props {
  activity: ActivityHydrated
  viewerId: string | null
  /** When true, the comment thread is expanded on mount (used by permalink view). */
  commentsOpen?: boolean
  /** Optional class extension for the outer article element. */
  className?: string
}

export function ActivityCard({ activity, viewerId, commentsOpen = false, className }: Props) {
  const book = asBook(activity.user_book?.book ?? null)
  const { verb, icon: Icon, tint } = activityVerb(activity.type)
  const displayName = activity.actor_display_name ?? activity.actor_username
  const initials =
    displayName.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
  const rating =
    (activity.metadata?.rating as number | undefined) ?? activity.user_book?.rating ?? null

  return (
    <article className={cn('card p-5 fade-up', className)}>
      <div className="flex items-start gap-3 mb-3">
        <Link
          href={`/u/${activity.actor_username}`}
          className="w-10 h-10 rounded-full bg-cream flex items-center justify-center flex-shrink-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2"
        >
          {activity.actor_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activity.actor_avatar_url} alt={activity.actor_username} className="w-full h-full object-cover" />
          ) : (
            <span className="font-serif text-sm font-bold text-forest">{initials}</span>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 leading-snug">
            <Link
              href={`/u/${activity.actor_username}`}
              className="font-semibold text-forest hover:text-forest-light transition-colors"
            >
              {displayName}
            </Link>
            <span className="text-gray-400"> {verb} </span>
            {book && <span className="font-medium text-forest">{book.title}</span>}
            {book?.authors?.[0] && <span className="text-gray-400"> by {book.authors[0]}</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
            <Icon className={cn('w-3 h-3', tint)} aria-hidden />
            <Link
              href={`/feed/${activity.id}`}
              className="hover:text-forest transition-colors"
              title="Permalink"
            >
              {timeAgo(activity.created_at)}
            </Link>
            {activity.type === 'finished_book' && rating && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gold tracking-tight">
                  {'★'.repeat(rating)}<span className="text-gray-200">{'★'.repeat(5 - rating)}</span>
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {book && (
        <div className="flex gap-4 mt-3 mb-4">
          <BookCover
            title={book.title}
            authors={book.authors}
            coverUrl={book.cover_url}
            className="w-14 h-20 flex-shrink-0"
          />
          <div className="flex-1 min-w-0 self-center">
            {activity.type === 'reviewed_book' && activity.user_book?.review && (
              <blockquote className="text-sm text-forest/80 italic leading-relaxed line-clamp-3 border-l-2 border-mint/40 pl-3">
                {activity.user_book.review}
              </blockquote>
            )}
            {activity.type === 'started_book' && activity.user_book?.pages_read != null && book.page_count && (
              <div className="text-xs text-gray-500">
                {Math.round((activity.user_book.pages_read / book.page_count) * 100)}% through
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 -mb-1">
        <LikeButton
          targetType="activity"
          targetId={activity.id}
          initialLiked={activity.liked_by_viewer}
          initialCount={activity.like_count}
          viewerId={viewerId}
        />
        <CommentThread
          targetType="activity"
          targetId={activity.id}
          initialCount={activity.comment_count}
          viewerId={viewerId}
          defaultOpen={commentsOpen}
        />
      </div>
    </article>
  )
}

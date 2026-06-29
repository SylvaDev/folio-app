'use client'

import { BookCover } from '@/components/books/BookCover'
import { LikeButton } from './LikeButton'
import { CommentThread } from './CommentThread'

interface BookLite {
  id: string
  title: string
  authors: string[]
  cover_url: string | null
}

export interface ReviewWithBook {
  id: string  // user_book id, used as the polymorphic target_id for likes/comments
  rating: number | null
  review: string | null
  date_finished: string | null
  book: BookLite | BookLite[] | null
  like_count: number
  comment_count: number
  liked_by_viewer: boolean
}

interface Props {
  review: ReviewWithBook
  viewerId: string | null
}

function asBook(b: BookLite | BookLite[] | null | undefined): BookLite | null {
  if (!b) return null
  return Array.isArray(b) ? (b[0] ?? null) : b
}

function formatFinished(date: string | null): string | null {
  if (!date) return null
  try {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return null
  }
}

export function ReviewCard({ review, viewerId }: Props) {
  const book = asBook(review.book)
  if (!book) return null

  const finishedLabel = formatFinished(review.date_finished)

  return (
    <article className="card p-5 fade-up">
      <div className="flex gap-4 mb-3">
        <BookCover
          title={book.title}
          authors={book.authors}
          coverUrl={book.cover_url}
          className="w-14 h-20 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-bold text-forest leading-tight line-clamp-2">
            {book.title}
          </h3>
          {book.authors?.[0] && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {book.authors.slice(0, 2).join(', ')}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs">
            {review.rating && (
              <span className="text-gold tracking-tight">
                {'★'.repeat(review.rating)}
                <span className="text-gray-200">{'★'.repeat(5 - review.rating)}</span>
              </span>
            )}
            {finishedLabel && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">Finished {finishedLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {review.review && (
        <blockquote className="text-sm text-forest/80 leading-relaxed border-l-2 border-mint/40 pl-3 mt-3 whitespace-pre-wrap">
          {review.review}
        </blockquote>
      )}

      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 -mb-1">
        <LikeButton
          targetType="review"
          targetId={review.id}
          initialLiked={review.liked_by_viewer}
          initialCount={review.like_count}
          viewerId={viewerId}
        />
        <CommentThread
          targetType="review"
          targetId={review.id}
          initialCount={review.comment_count}
          viewerId={viewerId}
        />
      </div>
    </article>
  )
}

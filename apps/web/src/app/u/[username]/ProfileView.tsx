'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen, Lock, BookMarked, Target, Star, Calendar, ArrowLeft, Settings,
  Share2, Check, Sparkles, UserPlus, UserCheck, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { BookCover } from '@/components/books/BookCover'
import { ReviewCard, type ReviewWithBook } from '@/components/social/ReviewCard'
import { cn } from '@/lib/utils'

interface ProfileLite {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  reading_goal: number | null
  created_at: string
  is_public: boolean
  subscription: string
}

interface BookLite {
  id: string
  title: string
  authors: string[]
  cover_url: string | null
  page_count?: number | null
}

interface UserBookLite {
  id: string
  status: string
  rating?: number | null
  pages_read?: number | null
  date_finished?: string | null
  book: BookLite | BookLite[] | null
}

interface Props {
  profile: ProfileLite
  viewerId: string | null
  isOwn: boolean
  isPrivate: boolean
  stats: {
    total_read: number
    read_this_year: number
    currently_reading: number
    avg_rating: number | null
    total_pages_read: number | null
  } | null
  currentlyReading: UserBookLite[]
  recentlyFinished: UserBookLite[]
  favorites: UserBookLite[]
  reviews?: ReviewWithBook[]
  followerCount?: number
  followingCount?: number
  viewerFollows?: boolean
}

// Normalize join result — Supabase sometimes returns book as object, sometimes as array
function asBook(b: BookLite | BookLite[] | null | undefined): BookLite | null {
  if (!b) return null
  return Array.isArray(b) ? (b[0] ?? null) : b
}

// ─── Share button with inline "Copied" confirmation ────────────────────────
function ShareButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/u/${username}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Profile link copied')
      // Reset after 2 seconds with a smooth transition
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <button
      onClick={copyLink}
      title="Copy profile link"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
        'transition-all duration-200 ease-out active:scale-[0.97]',
        'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
        copied
          ? 'bg-mint/15 text-forest'
          : 'text-gray-500 hover:bg-cream hover:text-forest',
      )}
    >
      <span className="relative w-3.5 h-3.5 flex items-center justify-center">
        <Share2
          className={cn(
            'absolute w-3.5 h-3.5 transition-all duration-200 ease-out',
            copied ? 'opacity-0 scale-50' : 'opacity-100 scale-100',
          )}
        />
        <Check
          className={cn(
            'absolute w-3.5 h-3.5 text-mint transition-all duration-200 ease-out',
            copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
          )}
        />
      </span>
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

// ─── Follow button ─────────────────────────────────────────────────────────
function FollowButton({ username, initialFollowing, viewerId }: {
  username: string
  initialFollowing: boolean
  viewerId: string | null
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)
  const [hovering, setHovering] = useState(false)

  async function toggle() {
    if (!viewerId) {
      // Push to signup with a redirect back
      router.push(`/signup?redirectTo=${encodeURIComponent(`/u/${username}`)}`)
      return
    }
    if (pending) return
    const willFollow = !following
    setPending(true)
    setFollowing(willFollow)  // optimistic
    try {
      const res = await fetch('/api/follow', {
        method: willFollow ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) {
        setFollowing(!willFollow)
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Could not update follow')
      } else {
        // Refresh server data so counts update everywhere
        router.refresh()
      }
    } catch {
      setFollowing(!willFollow)
      toast.error('Network error')
    } finally {
      setPending(false)
    }
  }

  // Visual states:
  //  - not following → solid forest button "Follow"
  //  - following + not hovered → outlined "Following" with check
  //  - following + hovered → outlined "Unfollow" in terra
  const isUnfollowState = following && hovering
  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      disabled={pending}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold',
        'transition-[background-color,color,border-color,transform] duration-150 ease-out',
        'active:scale-[0.97]',
        'outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        following
          ? isUnfollowState
            ? 'bg-terra/10 text-terra border border-terra/30 focus-visible:ring-terra'
            : 'bg-white text-forest border border-mint/40 focus-visible:ring-mint'
          : 'bg-forest text-white border border-forest hover:bg-forest-light focus-visible:ring-forest',
      )}
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : following ? (
        isUnfollowState ? (
          <UserPlus className="w-3.5 h-3.5 rotate-180" aria-hidden />
        ) : (
          <UserCheck className="w-3.5 h-3.5" aria-hidden />
        )
      ) : (
        <UserPlus className="w-3.5 h-3.5" aria-hidden />
      )}
      {pending ? 'Working…' : following ? (isUnfollowState ? 'Unfollow' : 'Following') : 'Follow'}
    </button>
  )
}

// ─── Profile header ────────────────────────────────────────────────────────
function ProfileHeader({
  profile, isOwn, viewerId, followerCount, followingCount, viewerFollows,
}: {
  profile: ProfileLite
  isOwn: boolean
  viewerId: string | null
  followerCount: number
  followingCount: number
  viewerFollows: boolean
}) {
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const initials = (profile.display_name ?? profile.username)
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('') || '?'

  return (
    <div className="relative fade-up">
      {/* Forest banner with subtle radial accent */}
      <div className="h-36 bg-gradient-to-br from-forest to-forest-light relative overflow-hidden">
        <div
          className="absolute -top-12 -right-16 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #52B788 0%, transparent 70%)' }}
        />
      </div>

      <div className="px-6 pb-6 max-w-4xl mx-auto">
        {/* Avatar row — sits half-overlapping the banner */}
        <div className="flex items-end justify-between gap-3 -mt-14 mb-4 flex-wrap">
          <div
            className="w-24 h-24 rounded-full bg-cream border-4 border-white shadow-xl flex items-center justify-center flex-shrink-0 overflow-hidden fade-up"
            style={{ ['--enter-delay' as string]: '60ms' }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <span className="font-serif text-3xl font-bold text-forest">{initials}</span>
            )}
          </div>

          {/* Actions sit at the same baseline as the avatar — clear of the banner */}
          <div className="flex items-center gap-2">
            {!isOwn && (
              <FollowButton
                username={profile.username}
                initialFollowing={viewerFollows}
                viewerId={viewerId}
              />
            )}
            <ShareButton username={profile.username} />
            {isOwn && (
              <Link
                href="/settings"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  'text-gray-500 hover:bg-cream hover:text-forest',
                  'transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.97]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
                )}
              >
                <Settings className="w-3.5 h-3.5" />
                Edit profile
              </Link>
            )}
          </div>
        </div>

        {/* Name + handle sit cleanly below the banner */}
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-forest leading-tight">
              {profile.display_name ?? profile.username}
            </h1>
            {profile.subscription === 'pro' && (
              <span className="badge bg-gold/20 text-amber-700 text-xs">PRO</span>
            )}
            {profile.subscription === 'book_club' && (
              <span className="badge bg-terra/15 text-terra text-xs">BOOK CLUB</span>
            )}
          </div>
          <p className="text-terra text-sm font-mono">@{profile.username}</p>
        </div>

        {/* Bio + meta */}
        {profile.bio && (
          <p className="text-forest/70 text-sm leading-relaxed mb-3 max-w-2xl whitespace-pre-wrap">
            {profile.bio}
          </p>
        )}

        {/* Follow stats + meta */}
        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <strong className="text-forest font-semibold tabular-nums">{followerCount.toLocaleString()}</strong>
            <span>follower{followerCount === 1 ? '' : 's'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <strong className="text-forest font-semibold tabular-nums">{followingCount.toLocaleString()}</strong>
            <span>following</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1 text-gray-400">
            <Calendar className="w-3 h-3" />
            Joined {memberSince}
          </span>
          {profile.reading_goal && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1 text-gray-400">
                <Target className="w-3 h-3" />
                Goal: {profile.reading_goal}/year
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Stat strip ────────────────────────────────────────────────────────────
function StatStrip({ stats }: { stats: Props['stats'] }) {
  const KPIS = [
    { icon: BookOpen, label: 'Books read', value: stats?.total_read ?? 0 },
    { icon: BookMarked, label: 'This year', value: stats?.read_this_year ?? 0 },
    { icon: Star, label: 'Avg rating', value: stats?.avg_rating ? `${stats.avg_rating}★` : '—' },
    { icon: Target, label: 'Total pages', value: stats?.total_pages_read?.toLocaleString() ?? 0 },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {KPIS.map(({ icon: Icon, label, value }, idx) => (
        <div
          key={label}
          className={cn(
            'bg-white rounded-2xl p-4 border border-gray-100',
            'transition-all duration-200 ease-out',
            'hover:border-mint/40 hover:-translate-y-0.5 hover:shadow-sm',
            'fade-up',
          )}
          style={{ ['--enter-delay' as string]: `${120 + idx * 50}ms` }}
        >
          <Icon className="w-4 h-4 text-forest mb-2" />
          <p className="font-serif text-2xl font-bold text-forest leading-none">{value}</p>
          <p className="text-xs text-gray-500 mt-1.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Book grid row ─────────────────────────────────────────────────────────
function BookGridRow({
  title,
  books,
  emptyHint,
  emptyAction,
  showProgress,
  showRating,
  delayBase = 0,
}: {
  title: string
  books: UserBookLite[]
  emptyHint: string
  emptyAction?: { label: string; href: string }
  showProgress?: boolean
  showRating?: boolean
  delayBase?: number
}) {
  return (
    <section className="fade-up" style={{ ['--enter-delay' as string]: `${delayBase}ms` }}>
      <h2 className="font-serif text-xl font-bold text-forest mb-4">{title}</h2>
      {books.length === 0 ? (
        <div className="text-gray-400 text-sm py-10 text-center bg-cream/40 rounded-2xl px-6">
          <p>{emptyHint}</p>
          {emptyAction && (
            <Link
              href={emptyAction.href}
              className={cn(
                'inline-flex items-center gap-1 mt-3 text-xs font-medium text-forest',
                'hover:text-forest-light transition-colors',
              )}
            >
              {emptyAction.label}
              <Sparkles className="w-3 h-3" />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {books.map((ub, idx) => {
            const book = asBook(ub.book)
            if (!book) return null
            const pct = showProgress && book.page_count && ub.pages_read
              ? Math.min(100, (ub.pages_read / book.page_count) * 100)
              : null

            // Stagger cap at 8 items so the cascade always finishes <500ms
            const staggerDelay = Math.min(idx, 7) * 45

            return (
              <div
                key={ub.id}
                className="group flex flex-col items-center gap-1.5 stagger-rise"
                style={{ ['--enter-delay' as string]: `${staggerDelay}ms` }}
              >
                <div className="relative w-full">
                  <BookCover
                    title={book.title}
                    authors={book.authors}
                    coverUrl={book.cover_url}
                    className={cn(
                      'w-full aspect-[2/3] transition-all duration-200 ease-out',
                      'group-hover:-translate-y-1 group-hover:shadow-md',
                    )}
                  />
                  {pct !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-forest/40 rounded-b-lg overflow-hidden">
                      <div
                        className="h-full bg-mint transition-[width] duration-500 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-600 text-center leading-tight line-clamp-2 px-1">
                  {book.title}
                </p>
                {showRating && ub.rating && (
                  <p className="text-xs text-gold tracking-tight">
                    {'★'.repeat(ub.rating)}<span className="text-gray-200">{'★'.repeat(5 - ub.rating)}</span>
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Main ProfileView ──────────────────────────────────────────────────────
export function ProfileView(props: Props) {
  const { profile, isOwn, isPrivate, stats, currentlyReading, recentlyFinished, favorites } = props

  if (isPrivate) {
    return (
      <div className="min-h-screen bg-cream/30">
        <ProfileHeader
          profile={profile}
          isOwn={isOwn}
          viewerId={props.viewerId}
          followerCount={props.followerCount ?? 0}
          followingCount={props.followingCount ?? 0}
          viewerFollows={props.viewerFollows ?? false}
        />
        <div className="max-w-md mx-auto text-center py-16 px-6 fade-up" style={{ ['--enter-delay' as string]: '120ms' }}>
          <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-forest" />
          </div>
          <h2 className="font-serif text-xl font-bold text-forest mb-2">This profile is private</h2>
          <p className="text-gray-500 text-sm">
            @{profile.username} has chosen to keep their reading life private.
          </p>
          <Link
            href="/"
            className={cn(
              'inline-flex items-center gap-1.5 mt-6 px-4 py-2 rounded-full text-sm font-medium',
              'text-gray-500 hover:bg-cream hover:text-forest',
              'transition-all duration-200 ease-out active:scale-[0.97]',
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream/30">
      <ProfileHeader
        profile={profile}
        isOwn={isOwn}
        viewerId={props.viewerId}
        followerCount={props.followerCount ?? 0}
        followingCount={props.followingCount ?? 0}
        viewerFollows={props.viewerFollows ?? false}
      />

      <div className="max-w-4xl mx-auto px-6 pb-12 space-y-10">
        <StatStrip stats={stats} />

        <BookGridRow
          title="Currently reading"
          books={currentlyReading}
          emptyHint={
            isOwn
              ? "You're not reading anything right now."
              : `@${profile.username} isn't reading anything right now.`
          }
          emptyAction={isOwn ? { label: 'Pick something from your TBR', href: '/tbr' } : undefined}
          showProgress
          delayBase={300}
        />

        <BookGridRow
          title="Recently finished"
          books={recentlyFinished}
          emptyHint={
            isOwn
              ? "No books finished yet. Your next finish will appear here."
              : `@${profile.username} hasn't finished any books yet.`
          }
          showRating
          delayBase={350}
        />

        <BookGridRow
          title="Favorites"
          books={favorites}
          emptyHint={
            isOwn
              ? "No favorites yet. Mark a book as a favorite to feature it here."
              : `@${profile.username} hasn't picked any favorites yet.`
          }
          emptyAction={isOwn ? { label: 'Go to your library', href: '/library' } : undefined}
          showRating
          delayBase={400}
        />

        {/* Public reviews — only render if there are any */}
        {props.reviews && props.reviews.length > 0 && (
          <section className="fade-up" style={{ ['--enter-delay' as string]: '450ms' }}>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-serif text-xl font-bold text-forest">
                {isOwn ? 'Your reviews' : 'Reviews'}
              </h2>
              <p className="text-xs text-gray-400">
                {props.reviews.length} public
              </p>
            </div>
            <div className="space-y-4">
              {props.reviews.map(r => (
                <ReviewCard key={r.id} review={r} viewerId={props.viewerId} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Conversion CTA — only for unauthenticated viewers */}
      {!props.viewerId && (
        <div className="border-t border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto px-6 py-10 text-center">
            <p className="font-serif text-2xl font-bold text-forest mb-1">
              Track your reading like @{profile.username}
            </p>
            <p className="text-gray-500 text-sm mb-5">
              Free forever. No ads. Your reading life, organized.
            </p>
            <Link
              href="/signup"
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-full bg-terra text-white font-semibold text-sm',
                'transition-all duration-200 ease-out',
                'hover:bg-terra-dark hover:-translate-y-0.5 hover:shadow-terra',
                'active:scale-[0.97]',
                'outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2',
              )}
            >
              Start your Folio
              <Sparkles className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

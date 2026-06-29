import { cn } from '@/lib/utils'

/**
 * Loading placeholder for an ActivityCard.
 * Renders matching shape to the real card so layout doesn't shift on load.
 */
export function ActivityCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="card p-5 fade-up"
      style={{ ['--enter-delay' as string]: `${index * 60}ms` }}
      aria-hidden
    >
      {/* Header: avatar + name + meta */}
      <div className="flex items-start gap-3 mb-3">
        <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2 pt-1">
          <div className="skeleton h-3 w-3/4 max-w-xs" />
          <div className="skeleton h-2 w-1/3" />
        </div>
      </div>

      {/* Book + preview */}
      <div className="flex gap-4 mt-3 mb-4">
        <div className="skeleton w-14 h-20 flex-shrink-0" style={{ borderRadius: '0.5rem' }} />
        <div className="flex-1 min-w-0 self-center space-y-2">
          <div className="skeleton h-3 w-full max-w-md" />
          <div className="skeleton h-3 w-2/3 max-w-sm" />
        </div>
      </div>

      {/* Engagement bar */}
      <div className="flex items-center gap-2 -mb-1 pt-2">
        <div className="skeleton h-6 w-12 rounded-full" />
        <div className="skeleton h-6 w-12 rounded-full" />
      </div>
    </div>
  )
}

/** Renders N skeleton cards. */
export function ActivityFeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('space-y-4')} aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => (
        <ActivityCardSkeleton key={i} index={i} />
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  targetType: 'activity' | 'review'
  targetId: string
  initialLiked: boolean
  initialCount: number
  viewerId: string | null
  /** Optional: override the visual size of the icon */
  size?: 'sm' | 'md'
}

/**
 * Reusable heart-style like button. Renders the heart filled when liked,
 * outlined when not. Optimistic update, rollback on error.
 * Click while signed-out routes to /login.
 */
export function LikeButton({
  targetType, targetId, initialLiked, initialCount, viewerId, size = 'sm',
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)

  async function toggle() {
    if (!viewerId) {
      window.location.href = '/login'
      return
    }
    if (pending) return
    setPending(true)
    const willLike = !liked
    // Optimistic
    setLiked(willLike)
    setCount(c => Math.max(0, c + (willLike ? 1 : -1)))

    try {
      const res = await fetch('/api/likes', {
        method: willLike ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      })
      if (!res.ok) {
        setLiked(!willLike)
        setCount(c => Math.max(0, c + (willLike ? -1 : 1)))
        toast.error('Could not update like')
      }
    } catch {
      setLiked(!willLike)
      setCount(c => Math.max(0, c + (willLike ? -1 : 1)))
      toast.error('Network error, try again')
    } finally {
      setPending(false)
    }
  }

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium',
        'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.95]',
        'outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2',
        liked
          ? 'text-terra hover:bg-terra/10'
          : 'text-gray-400 hover:text-terra hover:bg-terra/5',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconSize}
        aria-hidden
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      </svg>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  )
}

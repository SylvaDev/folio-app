'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as Popover from '@radix-ui/react-popover'
import {
  Bell, Heart, MessageCircle, Reply, UserPlus, Loader2, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Actor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface Notification {
  id: string
  type: 'like' | 'comment' | 'reply' | 'follow'
  target_type: 'activity' | 'comment' | null
  target_id: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
  actor: Actor | Actor[] | null
}

function asActor(a: Actor | Actor[] | null): Actor | null {
  if (!a) return null
  return Array.isArray(a) ? (a[0] ?? null) : a
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

function notificationText(n: Notification): { verb: string; icon: typeof Heart; tint: string } {
  switch (n.type) {
    case 'like':    return { verb: 'liked your post',        icon: Heart,       tint: 'text-terra' }
    case 'comment': return { verb: 'commented on your post', icon: MessageCircle, tint: 'text-forest' }
    case 'reply':   return { verb: 'replied to your comment', icon: Reply,      tint: 'text-mint' }
    case 'follow':  return { verb: 'followed you',           icon: UserPlus,    tint: 'text-mint' }
  }
}

// Where does clicking a notification go?
function notificationHref(n: Notification): string {
  if (n.type === 'follow') {
    const actor = asActor(n.actor)
    return actor ? `/u/${actor.username}` : '/feed'
  }
  // For likes/comments on activities: deep-link to the activity permalink
  if ((n.type === 'like' || n.type === 'comment') && n.target_type === 'activity' && n.target_id) {
    return `/feed/${n.target_id}`
  }
  // For replies: the metadata carries activity_id so we can route to the original post
  if (n.type === 'reply') {
    const activityId = (n.metadata?.activity_id ?? null) as string | null
    if (activityId) return `/feed/${activityId}`
  }
  return '/feed'
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=1', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && typeof data.unread_count === 'number') {
        setUnread(data.unread_count)
      }
    } catch {
      // silent — the bell just won't update count this round
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setNotifications(data.notifications ?? [])
        setUnread(data.unread_count ?? 0)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll unread count every 60s while the user is on the app
  useEffect(() => {
    refreshUnread()
    const id = window.setInterval(refreshUnread, 60_000)
    return () => window.clearInterval(id)
  }, [refreshUnread])

  // Fetch full list when the panel opens
  useEffect(() => {
    if (open) loadList()
  }, [open, loadList])

  async function markAllRead() {
    if (unread === 0) return
    setUnread(0)
    setNotifications(prev => prev?.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null)
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      // silent — server will reconcile on next poll
    }
  }

  async function handleClick(n: Notification) {
    setOpen(false)
    // Mark single notification read (optimistic)
    if (!n.read_at) {
      setUnread(u => Math.max(0, u - 1))
      setNotifications(prev => prev?.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x) ?? null)
      fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {})
    }
    router.push(notificationHref(n))
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          className={cn(
            'relative w-8 h-8 rounded-full flex items-center justify-center',
            'text-white/60 hover:text-white hover:bg-white/8',
            'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.95]',
            'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest',
            open && 'bg-white/8 text-white',
          )}
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-terra text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'z-50 w-[360px] max-h-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-forest text-sm">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-forest transition-colors"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && notifications === null ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-4 h-4 text-mint animate-spin" />
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="text-center py-10 px-6">
                <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-4 h-4 text-forest" />
                </div>
                <p className="text-sm font-semibold text-forest">All caught up</p>
                <p className="text-xs text-gray-400 mt-1">
                  When someone likes, comments, or follows you, it&apos;ll show up here.
                </p>
              </div>
            ) : (
              <ul>
                {notifications.map(n => {
                  const actor = asActor(n.actor)
                  if (!actor) return null
                  const { verb, icon: Icon, tint } = notificationText(n)
                  const displayName = actor.display_name ?? actor.username
                  const initials = displayName.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
                  const unreadDot = !n.read_at

                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-3 text-left',
                          'transition-[background-color] duration-150',
                          'hover:bg-cream/40',
                          'outline-none focus-visible:bg-cream',
                          unreadDot && 'bg-mint/5',
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full bg-cream flex items-center justify-center overflow-hidden">
                            {actor.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={actor.avatar_url} alt={actor.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-serif text-xs font-bold text-forest">{initials}</span>
                            )}
                          </div>
                          <div className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center',
                          )}>
                            <Icon className={cn('w-2.5 h-2.5', tint)} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 leading-snug">
                            <span className="font-semibold text-forest">{displayName}</span>
                            <span className="text-gray-500"> {verb}</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                        </div>

                        {unreadDot && (
                          <span className="w-2 h-2 rounded-full bg-mint flex-shrink-0 mt-2" aria-label="Unread" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications && notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2">
              <Link
                href="/feed"
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-medium text-forest hover:text-forest-light"
              >
                View feed
              </Link>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

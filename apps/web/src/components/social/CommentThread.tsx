'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  MessageCircle, Loader2, Send, Reply, MoreHorizontal, Pencil, Trash2, X, Check,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────
interface CommentAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface CommentRow {
  id: string
  content: string
  parent_id: string | null
  edited: boolean
  created_at: string
  updated_at: string
  author: CommentAuthor | CommentAuthor[] | null
}

type CommentTarget = 'activity' | 'review'

function asAuthor(a: CommentAuthor | CommentAuthor[] | null | undefined): CommentAuthor | null {
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

// ─── Single comment row ────────────────────────────────────────────────────
function CommentItem({
  comment, viewerId, isReply, onReply, onUpdate, onDelete,
}: {
  comment: CommentRow
  viewerId: string | null
  isReply?: boolean
  onReply: (id: string) => void
  onUpdate: (updated: CommentRow) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [busy, setBusy] = useState(false)

  const author = asAuthor(comment.author)
  if (!author) return null

  const isMine = viewerId === author.id
  const displayName = author.display_name ?? author.username
  const initials = displayName.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'

  async function saveEdit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === comment.content) {
      setEditing(false)
      setDraft(comment.content)
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save')
        return
      }
      onUpdate(data.comment)
      setEditing(false)
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this comment? Any replies to it will also be removed.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Could not delete')
        return
      }
      onDelete(comment.id)
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex gap-3', isReply && 'ml-9 pl-3 border-l-2 border-cream')}>
      <Link
        href={`/u/${author.username}`}
        className="w-7 h-7 rounded-full bg-cream flex items-center justify-center flex-shrink-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2"
      >
        {author.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.avatar_url} alt={author.username} className="w-full h-full object-cover" />
        ) : (
          <span className="font-serif text-[10px] font-bold text-forest">{initials}</span>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
          <Link
            href={`/u/${author.username}`}
            className="text-xs font-semibold text-forest hover:text-forest-light transition-colors"
          >
            {displayName}
          </Link>
          <span className="text-[10px] text-gray-400">
            {timeAgo(comment.created_at)}
            {comment.edited && <span className="ml-1 italic">· edited</span>}
          </span>
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="input min-h-[60px] resize-none text-sm py-2 px-3"
              autoFocus
              maxLength={2000}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditing(false); setDraft(comment.content) }}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={busy || draft.trim() === '' || draft.trim() === comment.content}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-forest text-white hover:bg-forest-light disabled:opacity-50 transition-[background-color,transform] duration-150 active:scale-[0.97]"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-forest/85 leading-snug whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        {!editing && (
          <div className="flex items-center gap-1 mt-1 -ml-2">
            {!isReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-gray-400 hover:text-forest hover:bg-cream transition-[background-color,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
            )}

            {isMine && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-400 hover:text-forest hover:bg-cream transition-[background-color,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    collisionPadding={8}
                    className="z-50 min-w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1"
                  >
                    <DropdownMenu.Item
                      onSelect={() => setEditing(true)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 cursor-pointer outline-none data-[highlighted]:bg-cream data-[highlighted]:text-forest"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={handleDelete}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 cursor-pointer outline-none data-[highlighted]:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Comment form (used for top-level + replies) ───────────────────────────
function CommentForm({
  placeholder, onSubmit, autoFocus, onCancel,
}: {
  placeholder: string
  onSubmit: (content: string) => Promise<boolean>
  autoFocus?: boolean
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  async function send() {
    const content = draft.trim()
    if (!content || submitting) return
    setSubmitting(true)
    const ok = await onSubmit(content)
    setSubmitting(false)
    if (ok) setDraft('')
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            send()
          }
        }}
        placeholder={placeholder}
        maxLength={2000}
        rows={1}
        className="flex-1 min-h-[40px] max-h-32 resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-forest-light focus:ring-2 focus:ring-forest/10"
      />
      <div className="flex gap-1 items-center">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-forest hover:bg-cream transition-[background-color,color] duration-150 flex items-center justify-center"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={send}
          disabled={submitting || draft.trim() === ''}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center',
            'transition-[background-color,transform] duration-150 ease-out active:scale-[0.95]',
            'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'bg-forest text-white hover:bg-forest-light',
          )}
          aria-label="Post comment"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── Main thread component ────────────────────────────────────────────────
interface Props {
  targetType: CommentTarget
  targetId: string
  initialCount: number
  viewerId: string | null
  /** Called when a comment is added or removed, so the parent can update its badge */
  onCountChange?: (delta: number) => void
  /** When false, renders just the trigger button; when true, expanded inline */
  defaultOpen?: boolean
}

export function CommentThread({
  targetType, targetId, initialCount, viewerId, onCountChange, defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [count, setCount] = useState(initialCount)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ target_type: targetType, target_id: targetId })
      const res = await fetch(`/api/comments?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not load comments')
        return
      }
      setComments(data.comments ?? [])
      setCount(data.comments?.length ?? 0)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [targetType, targetId])

  useEffect(() => {
    if (open && comments === null) load()
  }, [open, comments, load])

  async function submitComment(content: string, parent_id: string | null = null): Promise<boolean> {
    if (!viewerId) {
      toast.error('Sign in to comment')
      return false
    }
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          content,
          parent_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not post comment')
        return false
      }
      setComments(prev => [...(prev ?? []), data.comment])
      setCount(c => c + 1)
      onCountChange?.(1)
      setReplyingTo(null)
      return true
    } catch {
      toast.error('Network error')
      return false
    }
  }

  function handleUpdate(updated: CommentRow) {
    setComments(prev => prev?.map(c => c.id === updated.id ? updated : c) ?? null)
  }

  function handleDelete(id: string) {
    setComments(prev => {
      if (!prev) return prev
      // Also remove orphaned replies
      const removed = new Set<string>([id])
      let changed = true
      while (changed) {
        changed = false
        for (const c of prev) {
          if (c.parent_id && removed.has(c.parent_id) && !removed.has(c.id)) {
            removed.add(c.id)
            changed = true
          }
        }
      }
      const next = prev.filter(c => !removed.has(c.id))
      setCount(next.length)
      onCountChange?.(-(removed.size))
      return next
    })
  }

  // Group comments: top-level + each one's replies
  const topLevel = (comments ?? []).filter(c => !c.parent_id)
  const repliesByParent = new Map<string, CommentRow[]>()
  for (const c of comments ?? []) {
    if (c.parent_id) {
      if (!repliesByParent.has(c.parent_id)) repliesByParent.set(c.parent_id, [])
      repliesByParent.get(c.parent_id)!.push(c)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium',
          'text-gray-400 hover:text-forest hover:bg-cream',
          'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.95]',
          'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
          open && 'text-forest bg-cream',
        )}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {count > 0 ? count : ''}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
          {viewerId ? (
            <CommentForm
              placeholder="Add a comment…"
              onSubmit={content => submitComment(content, null)}
            />
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">
              <Link href="/login" className="text-forest font-medium hover:underline">Sign in</Link> to join the conversation.
            </p>
          )}

          {loading && comments === null ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 text-mint animate-spin" />
            </div>
          ) : topLevel.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">
              No comments yet. Start the conversation.
            </p>
          ) : (
            <div className="space-y-4">
              {topLevel.map(c => (
                <div key={c.id} className="space-y-3">
                  <CommentItem
                    comment={c}
                    viewerId={viewerId}
                    onReply={setReplyingTo}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                  {(repliesByParent.get(c.id) ?? []).map(reply => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      viewerId={viewerId}
                      isReply
                      onReply={() => setReplyingTo(c.id)}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                  {replyingTo === c.id && viewerId && (
                    <div className="ml-9 pl-3">
                      <CommentForm
                        placeholder={`Reply to ${asAuthor(c.author)?.display_name ?? asAuthor(c.author)?.username ?? 'this comment'}…`}
                        autoFocus
                        onCancel={() => setReplyingTo(null)}
                        onSubmit={content => submitComment(content, c.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

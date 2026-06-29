'use client'

import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal, BookOpen, Check, X, Bookmark, Pause, Trash2, Clock, PlusCircle } from 'lucide-react'
import { cn, statusLabel } from '@/lib/utils'
import type { UserBook } from '@folio/shared'
import { BookCover } from './BookCover'
import { StarRating } from './StarRating'
import { LogSessionDialog } from './LogSessionDialog'

interface Props {
  userBook: UserBook
  onStatusChange?: (id: string, status: UserBook['status']) => void
  onRemove?: (id: string) => void
  view?: 'grid' | 'list'
}

const STATUS_ICONS = {
  tbr: <Bookmark className="w-3.5 h-3.5" />,
  reading: <BookOpen className="w-3.5 h-3.5" />,
  read: <Check className="w-3.5 h-3.5" />,
  dnf: <X className="w-3.5 h-3.5" />,
  paused: <Pause className="w-3.5 h-3.5" />,
}

export function BookCard({ userBook, onStatusChange, onRemove, view = 'grid' }: Props) {
  const [logOpen, setLogOpen] = useState(false)
  const { book } = userBook

  if (!book) return null

  const canLogSession = userBook.status === 'reading' || userBook.status === 'tbr' || userBook.status === 'paused'

  if (view === 'list') {
    return (
      <>
        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-mint/30 hover:shadow-card transition-[border-color,box-shadow] duration-200 group">
          <BookCover
            title={book.title}
            authors={book.authors}
            coverUrl={book.cover_url}
            className="w-12 h-16 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-forest text-sm leading-tight line-clamp-1">{book.title}</h3>
            <p className="text-gray-500 text-xs mt-0.5">{book.authors.slice(0, 2).join(', ')}</p>
            {userBook.rating && <StarRating value={userBook.rating} readonly size="sm" />}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {userBook.status === 'reading' && (
              <button
                onClick={() => setLogOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mint/10 text-forest hover:bg-mint/20 text-xs font-medium transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Log progress
              </button>
            )}
            <span className={cn('badge text-xs', `badge-${userBook.status}`)}>
              {STATUS_ICONS[userBook.status]}
              <span className="ml-1">{statusLabel(userBook.status)}</span>
            </span>
            <StatusMenu
              userBook={userBook}
              onStatusChange={onStatusChange}
              onRemove={onRemove}
              onLogSession={canLogSession ? () => setLogOpen(true) : undefined}
            />
          </div>
        </div>
        {canLogSession && (
          <LogSessionDialog userBook={userBook} open={logOpen} onOpenChange={setLogOpen} />
        )}
      </>
    )
  }

  return (
    <>
      <div className="group relative flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-mint/30 hover:shadow-card-hover transition-[border-color,box-shadow] duration-200 overflow-hidden">
        {/* Cover */}
        <div className="relative">
          <BookCover
            title={book.title}
            authors={book.authors}
            coverUrl={book.cover_url}
            className="w-full aspect-[2/3]"
          />
          <div className="absolute top-2 right-2">
            <span className={cn('badge shadow-sm', `badge-${userBook.status}`)}>
              {STATUS_ICONS[userBook.status]}
            </span>
          </div>
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-forest/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
            {userBook.status === 'reading' && (
              <button
                onClick={() => setLogOpen(true)}
                aria-label="Log reading session"
                className="w-9 h-9 rounded-full bg-mint text-forest hover:bg-mint/90 flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                title="Log progress"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            )}
            <StatusMenu
              userBook={userBook}
              onStatusChange={onStatusChange}
              onRemove={onRemove}
              onLogSession={canLogSession ? () => setLogOpen(true) : undefined}
              overlay
            />
          </div>
        </div>

        {/* Info */}
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="font-semibold text-forest text-sm leading-tight line-clamp-2 mb-1">
            {book.title}
          </h3>
          <p className="text-gray-400 text-xs line-clamp-1">{book.authors.slice(0, 2).join(', ')}</p>
          {userBook.rating && (
            <div className="mt-1.5">
              <StarRating value={userBook.rating} readonly size="sm" />
            </div>
          )}
          {userBook.status === 'reading' && userBook.pages_read !== null && book.page_count && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>p. {userBook.pages_read}</span>
                <span>{Math.round((userBook.pages_read / book.page_count) * 100)}%</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-mint rounded-full transition-all"
                  style={{ width: `${(userBook.pages_read / book.page_count) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {canLogSession && (
        <LogSessionDialog userBook={userBook} open={logOpen} onOpenChange={setLogOpen} />
      )}
    </>
  )
}

function StatusMenu({ userBook, onStatusChange, onRemove, onLogSession, overlay }: {
  userBook: UserBook
  onStatusChange?: (id: string, status: UserBook['status']) => void
  onRemove?: (id: string) => void
  onLogSession?: () => void
  overlay?: boolean
}) {
  const statuses: UserBook['status'][] = ['tbr', 'reading', 'read', 'dnf', 'paused']

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          aria-label="Book actions"
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center transition-colors outline-none',
            'focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1',
            overlay
              ? 'bg-white/20 text-white hover:bg-white/30 data-[state=open]:bg-white/40'
              : 'text-gray-400 hover:bg-gray-100 hover:text-forest data-[state=open]:bg-gray-100 data-[state=open]:text-forest',
          )}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          onClick={e => e.stopPropagation()}
          className="z-50 min-w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1"
        >
          {onLogSession && (
            <>
              <DropdownMenu.Item
                onSelect={onLogSession}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-forest cursor-pointer outline-none data-[highlighted]:bg-mint/15 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-mint" />
                Log reading session
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
            </>
          )}

          <DropdownMenu.Label className="px-3 py-1 text-xs text-gray-400 font-semibold uppercase tracking-wide">
            Move to
          </DropdownMenu.Label>

          {statuses.filter(s => s !== userBook.status).map(s => (
            <DropdownMenu.Item
              key={s}
              onSelect={() => onStatusChange?.(userBook.id, s)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 cursor-pointer outline-none data-[highlighted]:bg-cream data-[highlighted]:text-forest transition-colors"
            >
              {STATUS_ICONS[s]}
              {statusLabel(s)}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />

          <DropdownMenu.Item
            onSelect={() => onRemove?.(userBook.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 cursor-pointer outline-none data-[highlighted]:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove from library
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

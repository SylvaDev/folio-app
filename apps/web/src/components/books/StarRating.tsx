'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number | null
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}

export function StarRating({ value, onChange, readonly, size = 'md' }: Props) {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange?.(star)}
          className={cn(
            'transition-transform duration-100',
            !readonly && 'hover:scale-110 cursor-pointer',
            readonly && 'cursor-default',
          )}
          disabled={readonly}
        >
          <Star
            className={cn(sz, (value ?? 0) >= star ? 'fill-gold text-gold' : 'text-gray-200 fill-gray-200')}
          />
        </button>
      ))}
    </div>
  )
}

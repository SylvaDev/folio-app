import Image from 'next/image'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  authors: string[]
  coverUrl: string | null
  className?: string
  priority?: boolean
}

export function BookCover({ title, authors, coverUrl, className, priority }: Props) {
  if (coverUrl) {
    return (
      <div className={cn('relative overflow-hidden rounded-lg bg-cream-dark', className)}>
        <Image
          src={coverUrl}
          alt={`${title} cover`}
          fill
          className="object-cover"
          priority={priority}
          sizes="(max-width: 768px) 80px, 120px"
        />
      </div>
    )
  }

  return (
    <div className={cn(
      'cover-placeholder rounded-lg flex flex-col items-center justify-center',
      className,
    )}>
      <span className="text-cream/80 font-serif font-bold text-center leading-tight line-clamp-3 px-2">
        {title}
      </span>
      {authors[0] && (
        <span className="text-cream/40 text-center mt-1 line-clamp-1 px-2" style={{ fontSize: '0.6rem' }}>
          {authors[0]}
        </span>
      )}
    </div>
  )
}

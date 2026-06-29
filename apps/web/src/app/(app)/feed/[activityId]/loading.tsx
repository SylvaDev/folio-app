import { ArrowLeft } from 'lucide-react'
import { ActivityCardSkeleton } from '@/components/social/ActivityCardSkeleton'

export default function Loading() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-1.5 text-sm text-gray-400 mb-5">
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Back to feed
      </div>
      <ActivityCardSkeleton />
    </div>
  )
}

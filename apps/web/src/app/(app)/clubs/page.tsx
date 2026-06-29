import { Users, BookOpen, MessageCircle, Globe, Lock, Plus } from 'lucide-react'

export const metadata = { title: 'Book Clubs' }

const COMING_FEATURES = [
  {
    icon: Globe,
    title: 'Public clubs',
    description: 'Join open reading groups around any genre, theme, or author.',
  },
  {
    icon: Lock,
    title: 'Private clubs',
    description: 'Create a private space for your friend group, book circle, or class.',
  },
  {
    icon: BookOpen,
    title: 'Shared reading',
    description: 'Vote on the next pick, track progress together, and set reading milestones.',
  },
  {
    icon: MessageCircle,
    title: 'Chapter discussions',
    description: 'Spoiler-safe discussion threads organized by chapter or section.',
  },
]

export default function ClubsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title mb-2">Book Clubs</h1>
        <p className="text-gray-500 text-sm">Read together, discuss together.</p>
      </div>

      {/* Coming soon hero */}
      <div className="bg-forest rounded-3xl p-8 md:p-12 text-center mb-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 w-20 h-20 rounded-full bg-mint" />
          <div className="absolute bottom-4 right-12 w-32 h-32 rounded-full bg-terra" />
          <div className="absolute top-12 right-24 w-12 h-12 rounded-full bg-gold" />
        </div>
        <div className="relative z-10">
          <div className="w-16 h-16 bg-mint/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-mint" />
          </div>
          <h2 className="font-serif text-3xl font-bold text-white mb-3">
            Coming in the next release
          </h2>
          <p className="text-cream/70 max-w-md mx-auto leading-relaxed">
            Book Clubs are actively being built. You&apos;ll be able to read with friends,
            run spoiler-safe discussions, and vote on the next pick, all without leaving Folio.
          </p>
          <div className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-white/10 rounded-full text-cream text-sm font-medium">
            <span className="w-2 h-2 bg-mint rounded-full animate-pulse" />
            In development
          </div>
        </div>
      </div>

      {/* Feature preview grid */}
      <div className="mb-8">
        <h3 className="font-semibold text-forest mb-4 text-sm tracking-wide uppercase">What&apos;s coming</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMING_FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card p-5 flex gap-4">
              <div className="w-10 h-10 bg-cream rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-forest" />
              </div>
              <div>
                <h4 className="font-semibold text-forest text-sm mb-1">{title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notify CTA */}
      <div className="card p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-forest mb-1">Get notified when it launches</h3>
          <p className="text-gray-500 text-sm">We&apos;ll send you one email the moment Book Clubs go live.</p>
        </div>
        <button
          disabled
          className="btn-primary opacity-60 cursor-not-allowed whitespace-nowrap"
          title="Coming soon"
        >
          <Plus className="w-4 h-4" />
          Notify me
        </button>
      </div>
    </div>
  )
}

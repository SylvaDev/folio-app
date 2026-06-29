'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { User, CreditCard, Check, Loader2, Globe, Lock, ExternalLink, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { hasBetaAccess, userBucket, BETA_ROLLOUT_PERCENT } from '@/lib/beta'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'privacy', label: 'Privacy', icon: Globe },
  { key: 'beta', label: 'Beta', icon: Sparkles },
  { key: 'billing', label: 'Billing', icon: CreditCard },
]

const PLANS = [
  {
    key: 'free' as const,
    name: 'Free',
    price: '$0',
    features: ['Up to 500 books', '3 AI recommendations per week', 'Basic reading stats', 'Series tracking'],
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: '$4.99/mo',
    popular: true,
    features: ['Unlimited books & shelves', 'Unlimited AI recommendations', 'Full analytics', 'Goodreads import', 'Reading goal tracking', 'Priority support'],
  },
  {
    key: 'book_club' as const,
    name: 'Book Club',
    price: '$9.99/mo',
    features: ['Everything in Pro', 'Create/join book clubs', 'Shared reading progress', 'Group discussions', 'Up to 20 club members'],
  },
]

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  reading_goal: number | null
  is_public: boolean
  subscription: string
  subscription_ends_at: string | null
  stripe_customer_id: string | null
  beta_access: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'profile')
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [stripeAction, setStripeAction] = useState<'pro' | 'book_club' | 'portal' | null>(null)

  // Show success/cancel feedback after returning from Stripe Checkout
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      toast.success('Welcome to Pro! Your subscription is active.')
    } else if (checkout === 'canceled') {
      toast.info('Checkout canceled. You can upgrade any time.')
    }
  }, [searchParams])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        setProfile(data)
      })
    })
  }, [])

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Username is now intentionally not editable — claimed once at onboarding.
    const { error } = await supabase.from('profiles').update({
      display_name: fd.get('display_name') as string,
      bio: fd.get('bio') as string,
      reading_goal: parseInt(fd.get('reading_goal') as string) || null,
    }).eq('id', user.id)

    setSaving(false)
    if (error) toast.error('Could not save')
    else toast.success('Profile saved')
  }

  async function togglePrivacy(makePublic: boolean) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return
    const { error } = await supabase.from('profiles').update({ is_public: makePublic }).eq('id', user.id)
    if (error) {
      toast.error('Could not update privacy')
      return
    }
    setProfile({ ...profile, is_public: makePublic })
    toast.success(makePublic ? 'Profile is now public' : 'Profile is now private')
  }

  async function toggleBeta(optIn: boolean) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return
    const { error } = await supabase.from('profiles').update({ beta_access: optIn }).eq('id', user.id)
    if (error) {
      toast.error('Could not update beta access')
      return
    }
    // Audit log (best-effort; failure here doesn't block the toggle)
    await supabase.from('beta_access_log').insert({
      user_id: user.id,
      enabled: optIn,
      reason: 'self-opt-in',
    })
    setProfile({ ...profile, beta_access: optIn })
    toast.success(optIn ? 'Beta features enabled' : 'Beta features turned off')
  }

  async function startCheckout(plan: 'pro' | 'book_club') {
    if (!profile || stripeAction) return
    setStripeAction(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data?.error ?? 'Could not start checkout')
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Network error, try again')
    } finally {
      setStripeAction(null)
    }
  }

  async function openPortal() {
    if (!profile || stripeAction) return
    setStripeAction('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data?.error ?? 'Could not open billing portal')
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Network error, try again')
    } finally {
      setStripeAction(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="page-title mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-cream rounded-xl p-1 w-fit mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key ? 'bg-white text-forest shadow-sm' : 'text-gray-500 hover:text-forest',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && profile && (
        <div className="space-y-4">
          {/* Public profile link */}
          {profile.username && (
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Your public profile</p>
                <p className="font-mono text-sm text-forest">foliotbr.app/u/{profile.username}</p>
              </div>
              <Link href={`/u/${profile.username}`} className="btn-ghost gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                View
              </Link>
            </div>
          )}

          {/* Avatar uploader — lives outside the form because uploads are immediate */}
          <div className="card p-6">
            <p className="label mb-3">Profile picture</p>
            <AvatarUploader
              userId={profile.id}
              username={profile.username}
              displayName={profile.display_name}
              currentAvatarUrl={profile.avatar_url}
              onChange={newUrl => {
                setProfile({ ...profile, avatar_url: newUrl })
                // Force the app shell to re-fetch the profile so the sidebar avatar updates
                router.refresh()
              }}
            />
          </div>

          <form onSubmit={saveProfile} className="card p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Display name</label>
                <input name="display_name" defaultValue={profile.display_name ?? ''} className="input" />
              </div>
              <div>
                <label className="label">Username</label>
                <input
                  defaultValue={profile.username ?? ''}
                  className="input bg-gray-50 text-gray-500 cursor-not-allowed"
                  readOnly
                  title="Username can't be changed (yet)"
                />
                <p className="text-xs text-gray-400 mt-1">Usernames are permanent for now.</p>
              </div>
            </div>
            <div>
              <label className="label">Bio</label>
              <textarea name="bio" defaultValue={profile.bio ?? ''} className="input min-h-[80px] resize-none" placeholder="Tell us about your reading life…" />
            </div>
            <div>
              <label className="label">Annual reading goal (books)</label>
              <input name="reading_goal" type="number" defaultValue={profile.reading_goal ?? ''} className="input w-32" placeholder="24" min={1} max={1000} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>
      )}

      {/* Privacy tab */}
      {tab === 'privacy' && profile && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-forest mb-1">Profile visibility</h2>
            <p className="text-sm text-gray-500 mb-4">
              Controls who can see your profile, library, and reviews.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => togglePrivacy(true)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                  profile.is_public
                    ? 'border-mint bg-mint/5'
                    : 'border-gray-100 hover:border-gray-200',
                )}
              >
                <Globe className={cn('w-5 h-5 mt-0.5 flex-shrink-0', profile.is_public ? 'text-mint' : 'text-gray-400')} />
                <div className="flex-1">
                  <p className="font-semibold text-forest">Public</p>
                  <p className="text-sm text-gray-500">Anyone with your profile link can see your books, ratings, and public reviews.</p>
                </div>
                {profile.is_public && <Check className="w-5 h-5 text-mint flex-shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => togglePrivacy(false)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                  !profile.is_public
                    ? 'border-forest bg-forest/5'
                    : 'border-gray-100 hover:border-gray-200',
                )}
              >
                <Lock className={cn('w-5 h-5 mt-0.5 flex-shrink-0', !profile.is_public ? 'text-forest' : 'text-gray-400')} />
                <div className="flex-1">
                  <p className="font-semibold text-forest">Private</p>
                  <p className="text-sm text-gray-500">Your profile shows a private placeholder. Only you can see your library.</p>
                </div>
                {!profile.is_public && <Check className="w-5 h-5 text-forest flex-shrink-0" />}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5 text-xs text-gray-400">
            <p>Individual reviews can also be marked private when you write them, regardless of overall profile setting.</p>
          </div>
        </div>
      )}

      {/* Beta tab */}
      {tab === 'beta' && profile && (
        <div className="card p-6 space-y-6">
          {(() => {
            const autoBucket = userBucket(profile.id)
            const autoEligible = autoBucket < BETA_ROLLOUT_PERCENT
            const active = hasBetaAccess(profile.id, profile.beta_access)
            return (
              <>
                <div>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-10 h-10 bg-mint/15 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-mint" aria-hidden />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-semibold text-forest mb-0.5">Beta features</h2>
                      <p className="text-sm text-gray-500">
                        Try new things before they ship. Beta users get features 1-2 weeks early
                        and have a direct line to share feedback.
                      </p>
                    </div>
                    {active && (
                      <span className="badge bg-mint/20 text-forest text-xs flex-shrink-0">ACTIVE</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleBeta(!profile.beta_access)}
                  className={cn(
                    'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left',
                    'transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99]',
                    'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
                    profile.beta_access
                      ? 'border-mint bg-mint/5'
                      : 'border-gray-100 hover:border-gray-200',
                  )}
                >
                  <Sparkles className={cn('w-5 h-5 mt-0.5 flex-shrink-0', profile.beta_access ? 'text-mint' : 'text-gray-400')} aria-hidden />
                  <div className="flex-1">
                    <p className="font-semibold text-forest">
                      {profile.beta_access ? 'Beta access is on' : 'Enable beta access'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {profile.beta_access
                        ? "You'll see new features as they roll out. Click to opt out."
                        : "You'll see new features earlier than most users."}
                    </p>
                  </div>
                  {profile.beta_access && <Check className="w-5 h-5 text-mint flex-shrink-0" aria-hidden />}
                </button>

                {/* Auto-cohort status (transparent about how we pick) */}
                <div className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold text-forest tracking-wide uppercase mb-2">
                    Your auto-cohort status
                  </p>
                  {autoEligible ? (
                    <p className="text-sm text-gray-500">
                      You&apos;re also in the <strong className="text-forest">automatic {BETA_ROLLOUT_PERCENT}% rollout</strong>.
                      This means you&apos;d see beta features even without the toggle above.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      You&apos;re not in the current automatic {BETA_ROLLOUT_PERCENT}% rollout.
                      Toggle the option above to access beta features now, or wait as we expand the rollout.
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2 font-mono">
                    Bucket {autoBucket} of 100 · Auto threshold: &lt; {BETA_ROLLOUT_PERCENT}
                  </p>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Billing tab */}
      {tab === 'billing' && profile && (
        <div>
          {/* Current plan banner */}
          {profile.subscription !== 'free' && (
            <div className="card p-5 mb-5 bg-gradient-to-br from-mint/5 to-forest/5 border-2 border-mint/30">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-mint tracking-wider uppercase">
                      Current plan
                    </p>
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-forest capitalize">
                    {profile.subscription === 'pro' ? 'Pro' : 'Book Club'}
                  </h2>
                  {profile.subscription_ends_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Renews on {new Date(profile.subscription_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={openPortal}
                  disabled={stripeAction !== null}
                  className="btn-ghost text-xs gap-1.5 self-start"
                >
                  {stripeAction === 'portal' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                  )}
                  Manage subscription
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const isCurrent = profile.subscription === plan.key
              const isPaidPlan = plan.key !== 'free'
              const userIsPaid = profile.subscription !== 'free'

              return (
                <div
                  key={plan.key}
                  className={cn(
                    'card p-5 relative',
                    plan.popular && !isCurrent && 'border-2 border-mint ring-1 ring-mint/20',
                    isCurrent && 'border-2 border-forest ring-1 ring-forest/20',
                  )}
                >
                  {plan.popular && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-mint text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most popular
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest text-white text-xs font-bold px-3 py-1 rounded-full">
                      Your plan
                    </div>
                  )}
                  <h3 className="font-serif text-lg font-bold text-forest">{plan.name}</h3>
                  <p className="text-2xl font-bold text-terra my-2">{plan.price}</p>
                  <ul className="space-y-2 mb-4">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-3.5 h-3.5 text-mint mt-0.5 flex-shrink-0" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <span className="text-xs text-forest font-medium">You&apos;re on this plan</span>
                  ) : !isPaidPlan ? (
                    userIsPaid ? (
                      <button
                        onClick={openPortal}
                        disabled={stripeAction !== null}
                        className="btn-ghost text-xs w-full justify-center"
                      >
                        Downgrade
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Your current plan</span>
                    )
                  ) : userIsPaid ? (
                    <button
                      onClick={openPortal}
                      disabled={stripeAction !== null}
                      className={cn(
                        'btn-primary w-full justify-center text-sm',
                        !plan.popular && 'bg-forest hover:bg-forest-light',
                      )}
                    >
                      {stripeAction === 'portal' ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      ) : null}
                      Switch to {plan.name}
                    </button>
                  ) : (
                    <button
                      onClick={() => startCheckout(plan.key)}
                      disabled={stripeAction !== null}
                      className={cn(
                        'btn-primary w-full justify-center text-sm',
                        !plan.popular && 'bg-forest hover:bg-forest-light',
                      )}
                    >
                      {stripeAction === plan.key ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      ) : null}
                      Upgrade to {plan.name}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Payments handled securely by Stripe. Cancel anytime from the billing portal.
          </p>
        </div>
      )}
    </div>
  )
}

# Folio Deployment Guide

## Overview

| Layer | Service | Notes |
|---|---|---|
| Web app | Vercel | Auto-deploys from `main` on push. Per-PR preview URLs. |
| Database | Supabase | Single project (no separate staging). Migrations applied manually via SQL Editor. |
| Mobile | Expo / EAS | Not in this doc — see mobile/README when it ships. |
| Domain | `foliotbr.app` | Configured in Vercel domain settings. |

---

## First-time Vercel setup

1. **Connect the GitHub repo** to Vercel
   - Vercel dashboard → Add New → Project → import the `folio-app` GitHub repo
   - Set **Root Directory** to `apps/web` (it's a monorepo)
   - Framework preset: **Next.js** (Vercel detects automatically)
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter @folio/web build` (matches what `vercel.json` says)
   - Output directory: `.next`
   - Install command: `pnpm install --frozen-lockfile`

2. **Add environment variables** (Vercel project → Settings → Environment Variables)

   Add each to **all three environments** (Production, Preview, Development):

   | Variable | Required | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | From Supabase dashboard → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Same page. Safe to be public. |
   | `ANTHROPIC_API_KEY` | ✅ (for AI queue) | Server-only. From console.anthropic.com. Use a separate prod key. |
   | `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` | Optional | Raises 1k→100k req/day quota |
   | `NEXT_PUBLIC_POSTHOG_KEY` | ✅ (once analytics is on) | PostHog project key, public-safe |
   | `NEXT_PUBLIC_POSTHOG_HOST` | ✅ (once analytics is on) | `https://us.i.posthog.com` or `https://eu.i.posthog.com` |

3. **Add domain** (Vercel project → Settings → Domains)
   - Add `foliotbr.app` (and `www.foliotbr.app` redirecting to apex)
   - Vercel guides you through DNS records

4. **Connect Supabase OAuth callback** to the production domain
   - Supabase dashboard → Authentication → URL Configuration
   - **Site URL**: `https://foliotbr.app`
   - **Redirect URLs**: add `https://foliotbr.app/auth/callback`, `https://www.foliotbr.app/auth/callback`, and `https://*.vercel.app/auth/callback` (the last enables PR preview auth)
   - In Google Cloud Console → OAuth Client → Authorized redirect URIs: add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` (already done from earlier setup, but verify)

---

## Deployment workflow

### Production
1. PR opened against `main` → Vercel builds a preview URL automatically
2. CI runs in parallel (`.github/workflows/ci.yml`): type-check, lint, build, secret scan
3. PR merged to `main` → Vercel deploys to production automatically
4. Postgres migrations are **NOT** auto-applied. See "Migrations" below.

### Preview (per PR)
Every PR gets its own URL like `folio-app-git-<branch>.vercel.app`. These share the production database (we chose single-project earlier). Be mindful that mutating actions in a preview hit prod data.

### Rollback
- Vercel dashboard → Deployments → find a known-good deployment → "Promote to Production"
- Takes ~30 seconds; no rebuild needed (Vercel just swaps the routing alias)

---

## Migrations

Migrations live in `supabase/migrations/` and are versioned in Git, but **not auto-applied**. For our single-project setup, the workflow is:

1. Write the migration file locally (`supabase/migrations/NNN_description.sql`)
2. Test it on a fresh local Postgres if structural (skip for additive-only changes)
3. Open a PR. CI must pass.
4. After merge, run the migration via Supabase SQL Editor manually
5. Update production code only after migration is applied (PR can be merged before but the deploy will fail until the migration runs)

> **Sequencing rule:** for additive migrations (new columns, new tables, new indexes), run the migration BEFORE merging the code that depends on it. For removals or breaking changes (rare), run AFTER the code that no longer references the removed thing.

---

## Branch protection (one-time GitHub setup)

In GitHub → repo settings → Branches → add rule for `main`:

- ✅ Require pull request before merging
- ✅ Require status checks to pass: `build`, `secret-scan`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above (even for admins, recommended)

This guarantees nothing lands on production without CI green.

---

## Verifying a deploy

After production deploys:

1. Open `https://foliotbr.app/login` in an incognito window — should load with brand
2. Sign in with a known account — should redirect to `/feed` (or `/onboarding/username` for new user)
3. Open the bell — should fetch notifications without error
4. Check Vercel → project → Logs for any 500s in the last 5 minutes
5. Check Supabase → Logs → API for any RLS denials that look unexpected

If anything is off, **roll back via Vercel** before debugging. Fix in a new PR.

---

## Cost expectations at small scale

| Item | Free tier headroom | Paid tier |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth/mo, unlimited deployments | $20/mo Pro when needed |
| Supabase | 500 MB DB, 50K MAU, 2 GB bandwidth | $25/mo Pro at scale |
| Anthropic | Pay-as-you-go from $0 | ~$0.008 per AI queue call |
| Google Books | 1k req/day free | 100k req/day with key |
| PostHog | 1M events/mo free | $0.00031/event after |
| **Total at 0-50 users** | **$0/mo** | |
| **Total at 1k users** | ~$50/mo | |

---

## Stripe setup

Subscription billing runs through Stripe Checkout + the Customer Portal. We don't host any payment form ourselves — Stripe handles PCI compliance, 3DS, Apple Pay, Google Pay, and dunning emails automatically.

### One-time dashboard setup

Do this in **test mode first** (dashboard.stripe.com → toggle "Test mode" on top right), then repeat with the same values in live mode when you're ready to take real money.

1. **Create the Products**
   - Products → "+ Add product"
   - **Pro** — recurring, `$4.99 / month`, currency USD
   - **Book Club** — recurring, `$9.99 / month`, currency USD
   - Copy each product's **Price API ID** (starts with `price_`). You'll need these in env vars.

2. **Configure the Customer Portal**
   - Settings → Billing → Customer portal
   - Enable: customers can update payment method, cancel, switch plan, see invoices
   - Save

3. **Create the webhook endpoint** (do this for both test and live modes)
   - Developers → Webhooks → "+ Add endpoint"
   - URL: `https://foliotbr.app/api/stripe/webhook` (production) or your preview URL during dev
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Click into the new endpoint → "Reveal signing secret" → copy. This is `STRIPE_WEBHOOK_SECRET`.

4. **Local development against the webhook**

   Stripe webhooks need to reach your local machine. Use the Stripe CLI:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3001/api/stripe/webhook
   ```
   The CLI prints a webhook signing secret each session — use that as `STRIPE_WEBHOOK_SECRET` in `.env.local` for local testing.

5. **Vercel env vars** (add these in Project Settings → Environment Variables)

   | Variable | Source | Notes |
   |---|---|---|
   | `STRIPE_SECRET_KEY` | Dashboard → Developers → API keys → Secret key | `sk_test_*` for staging, `sk_live_*` for prod |
   | `STRIPE_WEBHOOK_SECRET` | The webhook endpoint signing secret | Different in test vs live |
   | `NEXT_PUBLIC_STRIPE_PRICE_PRO` | Pro product → Price API ID | Different price IDs in test vs live |
   | `NEXT_PUBLIC_STRIPE_PRICE_BOOK_CLUB` | Book Club product → Price API ID | Same |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → `service_role` | **Server-only**. Webhook uses this to update billing columns. |
   | `NEXT_PUBLIC_SITE_URL` | `https://foliotbr.app` | Fallback for redirect URLs |

### Test card numbers

In test mode, use:

| Scenario | Number |
|---|---|
| Successful charge | `4242 4242 4242 4242` |
| Card declined | `4000 0000 0000 0002` |
| Requires 3DS | `4000 0025 0000 3155` |
| Insufficient funds | `4000 0000 0000 9995` |

Any future expiry, any CVC.

### Going live

1. Confirm both Pro and Book Club work end-to-end in test mode (subscribe → portal → cancel → resubscribe)
2. Switch the Stripe dashboard to live mode
3. **Re-create the same products + prices in live mode** (Stripe test ↔ live are completely separate)
4. **Re-create the webhook endpoint** in live mode
5. Swap Vercel env vars from `sk_test_*` to `sk_live_*` + the new live Price IDs + new live webhook secret
6. Deploy

### Why the webhook is the source of truth

`profiles.subscription` and `profiles.subscription_ends_at` are immutable from the client — enforced by the `block_self_billing_writes` trigger. Only the webhook handler (running with the Supabase service role) can update them. This prevents anyone from setting `subscription = 'pro'` directly via the Supabase JS client, even if they discovered the column name.

---

## Folio AI quota model

The "what to read next" AI is available on every tier — free included — to make the product feel valuable from minute one. Limits are enforced server-side and refresh on a sliding window.

| Tier | Quota | Window |
|---|---|---|
| Free | 3 recommendations | 7 days (rolling) |
| Pro | 30 recommendations | 24 hours (rolling) |
| Book Club | 30 recommendations | 24 hours (rolling) |

Tunable via `QUOTAS` in `apps/web/src/lib/quota.ts`. No DB migration needed to adjust — just deploy.

When a free user exhausts their quota, the TBR page replaces the "Ask Folio AI" button with an "Upgrade for unlimited" CTA pointing at `/settings?tab=billing`. The quota also includes a `resetsAt` timestamp so users know when they can come back.

---

## Production checklist before announcing publicly

- [ ] All migrations 001-014 applied (run them in order from the SQL Editor or via the Supabase MCP)
- [ ] `.env.local` does NOT exist on any production machine — only Vercel env vars
- [ ] Supabase Site URL = `https://foliotbr.app` + redirect URLs include `https://foliotbr.app/auth/callback` and `https://www.foliotbr.app/auth/callback`
- [ ] Google OAuth Authorized JavaScript origins includes `https://foliotbr.app`
- [ ] Vercel project env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, and optionally `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` + PostHog keys
- [ ] Branch protection on `main` enabled — CI must pass before merge
- [ ] Anthropic API key has a billing alert set at $50/mo (one rec ≈ $0.008, so $50 covers ~6000 calls)
- [ ] Stripe live mode: products + prices created, webhook endpoint added, env vars swapped from `sk_test_*` to `sk_live_*`
- [ ] Stripe webhook endpoint URL verified responds 200 to Stripe's test ping (Dashboard → Webhooks → endpoint → Send test webhook)
- [ ] Supabase **Auth → Settings → Password Strength** → enable "Leaked password protection" (HaveIBeenPwned check)
- [ ] Supabase free-tier project is NOT paused (or upgrade to Pro to prevent auto-pause)
- [ ] Vercel team has at least two members (you + backup) so the project isn't single-pointed
- [ ] Sentry or another error tracker connected (optional but recommended once users are active)
- [ ] Run [securityheaders.com](https://securityheaders.com) against `foliotbr.app` — aim for grade A

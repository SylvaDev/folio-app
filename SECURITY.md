# Security Policy

Folio takes the security of our users' reading data seriously. If you find a vulnerability, we appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not file a public GitHub issue for security vulnerabilities.**

Email **support@exovaralabs.com** with:

1. A description of the issue and its impact
2. Steps to reproduce, including any required setup
3. Your name and how you'd like to be credited (or whether you'd prefer to remain anonymous)

You can expect:

- An acknowledgement within **48 hours**
- A timeline for the fix within **5 business days**
- A coordinated disclosure once the fix is deployed (we'll credit you publicly unless you'd prefer otherwise)

## Scope

In scope:

- `foliotbr.app` and any preview deployments (`*.vercel.app` subdomains owned by Folio)
- The Supabase backend and PostgreSQL Row Level Security policies
- The mobile app once it ships
- Any API endpoint under `/api/`

Out of scope:

- Findings that require physical access to a user's device or account
- Social engineering of Folio employees or users
- DDoS or volumetric attacks
- Open Library or Google Books endpoints (they're third-party catalogs we read from)
- Best-practice violations without a concrete vulnerability (e.g. "header X is missing" alone)

## Hardening summary

These are the controls already in place:

- **Row Level Security** on every table. Users can only read/write rows where `auth.uid() = user_id`, except for explicitly public surfaces (e.g. profiles where `is_public = true`).
- **Server-authoritative writes.** Every mutation flows through an authenticated API route or a Supabase client constrained by RLS. The frontend never trusts a user-supplied `user_id`.
- **Rate limiting** on all write endpoints via a Postgres `check_rate_limit` function (`supabase/migrations/006_rate_limiting.sql`).
- **Generic error responses.** 500-class errors return `{ error: 'Something went wrong' }`; the underlying DB error is logged server-side only. Prevents schema leaks.
- **Polymorphic engagement uses composite keys.** Double-likes are blocked at the DB level via `PRIMARY KEY (user_id, target_type, target_id)`.
- **Activity feed respects profile visibility at read time.** RLS joins to `profiles.is_public` for each read; if a user toggles to private, their entire feed presence disappears instantly.
- **Trigger-only notification writes.** The `notifications` table has no INSERT policy. Notifications can only be created by database triggers (`security definer`). Even a bug in our app code can't spam someone's inbox.
- **Secret scoping.** `ANTHROPIC_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix). `NEXT_PUBLIC_*` env vars are reviewed before release to confirm they're safe to be public.
- **Secret scan in CI.** A GitHub Actions step blocks `.env*` files from being committed (in addition to `.gitignore`).
- **Lazy SDK init.** The Anthropic SDK is lazy-initialized so the API key never reads from `process.env` at module load time.

## Supported versions

This is a single-version product. Only the current production deployment is supported. Older versions are not patched separately.

## Public disclosure

After a vulnerability is fixed:

1. We push the fix to production
2. We notify the reporter that the patch is live
3. We may write a post-mortem (with the reporter's permission to credit them) explaining what happened and what we've changed structurally

---

*Last updated: 2026-06-20*

-- ═══ STRIPE INTEGRATION ═══════════════════════════════════════════════════
-- Schema needed to map Folio users to Stripe customers + subscriptions,
-- plus an idempotency table for webhook handling.
--
-- We rely on the webhook as the source of truth for `profiles.subscription`
-- and `profiles.subscription_ends_at`. Client code never updates these
-- directly — only the webhook handler (running with service role) does.
-- ═════════════════════════════════════════════════════════════════════════

-- ─── profiles: link to Stripe ────────────────────────────────────────────
alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- ─── stripe_events: idempotency for webhook deliveries ───────────────────
-- Stripe retries webhooks aggressively. Without idempotency, a retried
-- event could double-apply a state change (e.g. extend a subscription
-- by another month). We record the event id on first successful handle
-- and skip if it's already there.
create table if not exists public.stripe_events (
  id            text primary key,                   -- Stripe event id (evt_*)
  event_type    text not null,
  processed_at  timestamptz not null default now(),
  payload       jsonb                                -- audit trail; can drop later
);

create index if not exists stripe_events_type_idx
  on public.stripe_events (event_type, processed_at desc);

-- No client access — only the webhook handler (server-side, service role)
-- writes here. RLS enabled with no policies = locked down.
alter table public.stripe_events enable row level security;

-- ─── Profile billing fields readability ──────────────────────────────────
-- The existing "Users can update own profile" policy lets users update
-- ANY column. We need to ensure they can't write `subscription`,
-- `subscription_ends_at`, `stripe_customer_id`, or `stripe_subscription_id`
-- directly — only the webhook can. Postgres doesn't support per-column
-- RLS, so the right pattern is a trigger that blocks the change.
create or replace function public.block_self_billing_writes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Allow if no actual change to billing columns
  if new.subscription is not distinct from old.subscription
     and new.subscription_ends_at is not distinct from old.subscription_ends_at
     and new.stripe_customer_id is not distinct from old.stripe_customer_id
     and new.stripe_subscription_id is not distinct from old.stripe_subscription_id
  then
    return new;
  end if;
  -- Allow if no JWT (i.e. service role / webhook handler)
  if auth.uid() is null then
    return new;
  end if;
  -- Otherwise, this is a logged-in user trying to change a billing column. Reject.
  raise exception 'Billing columns can only be updated by the webhook handler';
end;
$$;

drop trigger if exists profiles_block_self_billing on public.profiles;
create trigger profiles_block_self_billing
  before update on public.profiles
  for each row execute procedure public.block_self_billing_writes();

revoke execute on function public.block_self_billing_writes() from public, anon, authenticated;

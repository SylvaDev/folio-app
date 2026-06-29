-- ═══ RELAX THE BILLING-WRITE TRIGGER ══════════════════════════════════════
-- 013's trigger was too strict — it also blocked the legitimate first-time
-- `stripe_customer_id` write that happens when a user clicks Upgrade for
-- the first time (lazy customer creation). The checkout API route runs
-- with the user's JWT, so auth.uid() is non-null and the original trigger
-- rejected.
--
-- Relaxed rules:
--   - Allow stripe_customer_id NULL -> value transitions (lazy customer create)
--   - Block any change to: subscription, subscription_ends_at, stripe_subscription_id
--   - Block clearing stripe_customer_id (would orphan the Stripe customer)
-- ═════════════════════════════════════════════════════════════════════════

create or replace function public.block_self_billing_writes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Service role / no JWT: webhooks and admin scripts — let everything through
  if auth.uid() is null then
    return new;
  end if;

  -- Always block: subscription tier, end date, subscription id.
  -- These are set by the webhook handler exclusively.
  if new.subscription is distinct from old.subscription then
    raise exception 'profiles.subscription can only be updated by the webhook handler';
  end if;
  if new.subscription_ends_at is distinct from old.subscription_ends_at then
    raise exception 'profiles.subscription_ends_at can only be updated by the webhook handler';
  end if;
  if new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'profiles.stripe_subscription_id can only be updated by the webhook handler';
  end if;

  -- Block clearing the customer id (orphaning), but allow setting it
  -- for the first time during lazy customer creation.
  if old.stripe_customer_id is not null
     and new.stripe_customer_id is distinct from old.stripe_customer_id
  then
    raise exception 'profiles.stripe_customer_id is immutable once set';
  end if;

  return new;
end;
$$;

revoke execute on function public.block_self_billing_writes() from public, anon, authenticated;

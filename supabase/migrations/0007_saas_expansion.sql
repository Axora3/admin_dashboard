-- AXORA SaaS expansion. Additive only: no tables are dropped and no store
-- business data (products, orders, customers, inventory) is created or moved.
-- Store business data stays in each store's own Google Spreadsheet.

-- 1. Future roles. Modelled only; the application denies sign-in for roles
--    that are not active yet (see src/lib/platform/permissions.ts).
alter type public.user_role add value if not exists 'store_manager';

begin;

-- 2. Billing metadata for future payment providers (QPay, bank integrations).
--    No card data is ever stored. Rows are written only by a verified provider
--    adapter through the service role; nothing in this phase inserts rows.
create table if not exists public.platform_billing_events (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  plan_id text references public.platform_plans(id),
  provider text not null,
  external_reference text not null,
  status text not null check (status in ('pending','paid','failed','refunded','cancelled')),
  amount numeric check (amount >= 0),
  currency text not null default 'MNT',
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (provider, external_reference),
  check (period_end is null or period_start is null or period_end > period_start)
);
create index if not exists platform_billing_events_store on public.platform_billing_events(store_id, created_at desc);
alter table public.platform_billing_events enable row level security;
revoke all on public.platform_billing_events from anon, authenticated;
grant all on public.platform_billing_events to service_role;
grant select on public.platform_billing_events to authenticated;
drop policy if exists platform_owner_read on public.platform_billing_events;
create policy platform_owner_read on public.platform_billing_events for select to authenticated using (public.axora_super_admin());

-- 3. Monitoring query support.
create index if not exists platform_health_component_time on public.platform_health(component, checked_at desc);
create index if not exists platform_notifications_audience on public.platform_notifications(audience, store_id, created_at desc);

-- 4. Supabase Realtime for notification badges. Realtime respects the RLS
--    policies from 0006, so a Store Admin only receives events for their own
--    store-audience notifications.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'platform_notifications') then
    execute 'alter publication supabase_realtime add table public.platform_notifications';
  end if;
end $$;

commit;

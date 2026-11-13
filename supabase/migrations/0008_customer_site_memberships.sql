-- Additive authorization metadata only. Customer business records stay in Sheets.
begin;
create table if not exists public.site_memberships (
  site_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id,user_id)
);
create index if not exists site_memberships_user on public.site_memberships(user_id,status);
insert into public.site_memberships(site_id,user_id,role,status)
select store_id,user_id,'owner','active' from public.admin_assignments
on conflict (site_id,user_id) do nothing;
alter table public.site_memberships enable row level security;
revoke all on public.site_memberships from anon,authenticated;
grant select on public.site_memberships to authenticated;
grant all on public.site_memberships to service_role;
create policy own_site_membership_read on public.site_memberships for select to authenticated
using (public.axora_super_admin() or (user_id=auth.uid() and status='active' and exists (
 select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='store_admin'
)));

create or replace function public.axora_owns_store(s text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='store_admin')
 and (exists(select 1 from public.site_memberships m where m.user_id=auth.uid() and m.site_id=s and m.status='active')
   or (exists(select 1 from public.admin_assignments a where a.user_id=auth.uid() and a.store_id=s)
       and not exists(select 1 from public.site_memberships m where m.user_id=auth.uid() and m.site_id=s)))
 and exists(select 1 from public.platform_registry r, jsonb_array_elements(r.payload->'stores') v where v->>'id'=s and v->>'status'='active');
$$;
create policy own_billing_event_read on public.platform_billing_events for select to authenticated
using (public.axora_owns_store(store_id));
-- All membership writes remain privileged server operations. No browser write grants.
commit;

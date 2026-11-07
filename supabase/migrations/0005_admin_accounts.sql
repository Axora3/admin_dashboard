-- Identity/authorization only. Business data remains in Google Sheets.
alter type public.user_role add value if not exists 'store_admin';
alter table public.profiles add column if not exists is_active boolean not null default true;
-- Registry IDs are text; the Sheets registry is not public.stores.
create table public.admin_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.admin_assignments enable row level security;
-- Only the server service client manages assignments.
revoke all on public.admin_assignments from anon, authenticated;
drop policy if exists profiles_update_own on public.profiles;
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid()
    and is_active and is_super_admin and role = 'super_admin');
$$;
create unique index profiles_single_super_admin on public.profiles ((is_super_admin)) where is_super_admin;
-- Store Admin authorization is exclusively handled by the scoped Sheets service.
-- Legacy membership grants must not bypass disabled accounts.
create or replace function public.has_store_access(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;
create or replace function public.can_manage_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;

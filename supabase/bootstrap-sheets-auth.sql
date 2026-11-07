-- Fresh Google Sheets deployment: identity metadata only, no business tables.
begin;
create type public.user_role as enum ('super_admin', 'store_admin', 'store_owner', 'store_staff');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role public.user_role not null default 'store_owner',
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consistent_admin_role check (is_super_admin = (role = 'super_admin'))
);
create unique index profiles_single_super_admin on public.profiles ((is_super_admin)) where is_super_admin;
create table public.admin_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.admin_assignments enable row level security;
revoke all on public.profiles from anon, authenticated;
revoke all on public.admin_assignments from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles, public.admin_assignments to service_role;
create policy profiles_read_own on public.profiles for select to authenticated using (id = auth.uid());
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
commit;

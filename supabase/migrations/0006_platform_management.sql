-- Additive extension to either the identity-only bootstrap or migrations 0001–0005.
-- No products, orders, customers or inventory tables are created or migrated.
begin;
create table if not exists public.platform_registry (
 id boolean primary key default true check(id), payload jsonb not null default '{"version":1,"stores":[]}', revision bigint not null default 0
);
insert into public.platform_registry(id) values(true) on conflict do nothing;
create table if not exists public.platform_audit (
 id uuid primary key default gen_random_uuid(), actor_id text, actor_name text not null,
 store_id text, action text not null, resource_type text not null, resource_id text,
 metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists platform_audit_store_time on public.platform_audit(store_id,created_at desc);
create index if not exists platform_audit_actor_time on public.platform_audit(actor_id,created_at desc);
create table if not exists public.platform_plans (
 id text primary key, name text not null, description text not null default '',
 monthly_price numeric check(monthly_price>=0), yearly_price numeric check(yearly_price>=0),
 currency text not null default 'MNT', max_products integer check(max_products>=0), max_orders integer check(max_orders>=0),
 max_admins integer check(max_admins>=1), storage_bytes bigint check(storage_bytes>=0),
 features text[] not null default '{}', support_level text not null default 'standard',
 duration_days integer not null default 30 check(duration_days between 1 and 3660), updated_at timestamptz not null default now()
);
insert into public.platform_plans(id,name,description) values
 ('basic','Basic','Configure limits before assigning'),('pro','Pro','Configure limits before assigning'),('business','Business','Configure limits before assigning') on conflict do nothing;
create table if not exists public.platform_subscriptions (
 store_id text primary key, plan_id text not null references public.platform_plans(id),
 status text not null check(status in ('trial','active','suspended','cancelled')),
 starts_at timestamptz not null default now(), expires_at timestamptz not null,
 provider text, external_reference text, payment_status text not null default 'not_integrated',
 updated_at timestamptz not null default now(), check(expires_at>starts_at)
);
create table if not exists public.platform_subscription_history (
 id uuid primary key default gen_random_uuid(), store_id text not null, actor_id text not null,
 before_value jsonb, after_value jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.platform_notifications (
 id uuid primary key default gen_random_uuid(), event_key text not null unique,
 store_id text, category text not null, title text not null, audience text not null default 'store' check(audience in ('store','platform')),
 created_at timestamptz not null default now()
);
create index if not exists platform_notifications_scope on public.platform_notifications(store_id,created_at desc);
create table if not exists public.platform_notification_reads (
 user_id uuid not null references auth.users(id) on delete cascade, notification_id uuid not null references public.platform_notifications(id) on delete cascade,
 read_at timestamptz not null default now(), primary key(user_id,notification_id)
);
create table if not exists public.platform_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade, muted_categories text[] not null default '{}'
);
create table if not exists public.platform_health (
 id uuid primary key default gen_random_uuid(), store_id text, component text not null,
 status text not null check(status in ('healthy','warning','error','disconnected','unknown')),
 code text not null, checked_at timestamptz not null default now(), latency_ms integer
);
create index if not exists platform_health_scope on public.platform_health(store_id,checked_at desc);
create table if not exists public.platform_backups (
 id uuid primary key default gen_random_uuid(), store_id text not null, kind text not null check(kind in ('manual','scheduled','pre_restore')),
 status text not null check(status in ('running','success','failed')), object_path text unique,
 checksum text, size_bytes bigint, row_count integer, tab_count integer, failure_code text,
 created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists platform_backups_scope on public.platform_backups(store_id,created_at desc);
create table if not exists public.platform_restores (
 id uuid primary key default gen_random_uuid(), store_id text not null, backup_id uuid not null references public.platform_backups(id),
 pre_backup_id uuid references public.platform_backups(id), status text not null check(status in ('running','success','failed','partial_failure')),
 failure_code text, created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.platform_backup_schedules (
 store_id text primary key, enabled boolean not null default true,
 interval_hours integer not null default 24 check(interval_hours between 1 and 8760), next_run_at timestamptz not null default now()
);
create table if not exists public.platform_poll_cursors (
 store_id text primary key, order_ids text[] not null default '{}', last_checked_at timestamptz not null default now(), initialized boolean not null default false
);
create table if not exists public.platform_jobs (
 id uuid primary key default gen_random_uuid(), status text not null check(status in ('running','success','failed')),
 started_at timestamptz not null default now(), completed_at timestamptz, failures integer not null default 0
);
create table if not exists public.platform_locks (
 key text primary key, owner uuid not null, expires_at timestamptz not null
);

create or replace function public.axora_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_active and is_super_admin and role='super_admin');
$$;
create or replace function public.axora_owns_store(s text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.admin_assignments a on a.user_id=p.id
 where p.id=auth.uid() and p.is_active and p.role='store_admin' and a.store_id=s)
 and exists(select 1 from public.platform_registry r, jsonb_array_elements(r.payload->'stores') v where v->>'id'=s and v->>'status'='active');
$$;
create or replace function public.axora_notification_visible(n uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_notifications where id=n and
 (public.axora_super_admin() or (audience='store' and public.axora_owns_store(store_id))));
$$;
do $$ declare t text; begin
 foreach t in array array['platform_registry','platform_audit','platform_plans','platform_subscriptions','platform_subscription_history','platform_notifications','platform_notification_reads','platform_notification_preferences','platform_health','platform_backups','platform_restores','platform_backup_schedules','platform_poll_cursors','platform_jobs','platform_locks'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy platform_owner_read on public.%I for select to authenticated using(public.axora_super_admin())',t);
 end loop;
end $$;
create policy own_subscription_read on public.platform_subscriptions for select to authenticated using(public.axora_owns_store(store_id));
create policy own_notification_read on public.platform_notifications for select to authenticated using(audience='store' and public.axora_owns_store(store_id));
create policy own_notification_state on public.platform_notification_reads for select to authenticated using(user_id=auth.uid() and public.axora_notification_visible(notification_id));
create policy own_notification_preferences on public.platform_notification_preferences for select to authenticated using(user_id=auth.uid());
-- All writes go through server authorization. No browser mutation grants exist.
create function public.axora_save_registry(expected_revision bigint,next_payload jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare r bigint; begin
 update public.platform_registry set payload=next_payload,revision=revision+1 where id=true and revision=expected_revision returning revision into r;
 if r is null then raise exception 'Registry changed; reload and retry'; end if; return r;
end; $$;
create function public.axora_lock(lock_key text,lock_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 insert into public.platform_locks(key,owner,expires_at) values(lock_key,lock_owner,now()+interval '10 minutes')
 on conflict(key) do update set owner=excluded.owner,expires_at=excluded.expires_at
 where public.platform_locks.expires_at<now() or public.platform_locks.owner=lock_owner;
 return found;
end; $$;
create function public.axora_subscription_change(s text,p text,state text,expiry timestamptz,actor text) returns void
language plpgsql security definer set search_path='' as $$
declare old jsonb; fresh jsonb; begin
 perform pg_advisory_xact_lock(hashtextextended(s,0));
 select to_jsonb(x) into old from public.platform_subscriptions x where store_id=s;
 insert into public.platform_subscriptions(store_id,plan_id,status,expires_at) values(s,p,state,expiry)
 on conflict(store_id) do update set plan_id=p,status=state,expires_at=expiry,updated_at=now();
 select to_jsonb(x) into fresh from public.platform_subscriptions x where store_id=s;
 insert into public.platform_subscription_history(store_id,actor_id,before_value,after_value) values(s,actor,old,fresh);
end; $$;
revoke all on function public.axora_save_registry(bigint,jsonb), public.axora_lock(text,uuid), public.axora_subscription_change(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.axora_save_registry(bigint,jsonb), public.axora_lock(text,uuid), public.axora_subscription_change(text,text,text,timestamptz,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('axora-backups','axora-backups',false,52428800) on conflict(id) do nothing;
-- Existing bucket visibility is deliberately not changed silently.
commit;

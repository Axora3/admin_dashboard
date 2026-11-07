-- ---------------------------------------------------------------------------
-- AXORA — Row Level Security
-- Public storefront reads are limited to active stores and active products.
-- Every admin mutation is still authorized server-side in the app; RLS is the
-- second line of defence and protects against direct API access.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.store_domains enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles -------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and public.profile_fields_unchanged(id, is_super_admin, role)
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

-- Stores ---------------------------------------------------------------------
drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores
  for select using (
    public.is_super_admin()
    or public.has_store_access(id)
    or status = 'active'
  );

drop policy if exists stores_insert on public.stores;
create policy stores_insert on public.stores
  for insert with check (public.is_super_admin());

drop policy if exists stores_update on public.stores;
create policy stores_update on public.stores
  for update using (public.is_super_admin() or public.can_manage_store(id))
  with check (public.is_super_admin() or public.can_manage_store(id));

drop policy if exists stores_delete on public.stores;
create policy stores_delete on public.stores
  for delete using (public.is_super_admin());

-- Store members --------------------------------------------------------------
drop policy if exists store_members_select on public.store_members;
create policy store_members_select on public.store_members
  for select using (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists store_members_insert on public.store_members;
create policy store_members_insert on public.store_members
  for insert with check (public.is_super_admin() or public.can_manage_store(store_id));

drop policy if exists store_members_update on public.store_members;
create policy store_members_update on public.store_members
  for update using (public.is_super_admin() or public.can_manage_store(store_id))
  with check (public.is_super_admin() or public.can_manage_store(store_id));

drop policy if exists store_members_delete on public.store_members;
create policy store_members_delete on public.store_members
  for delete using (public.is_super_admin() or public.can_manage_store(store_id));

-- Store settings -------------------------------------------------------------
drop policy if exists store_settings_select on public.store_settings;
create policy store_settings_select on public.store_settings
  for select using (
    public.store_is_public(store_id) or public.has_store_access(store_id)
  );

drop policy if exists store_settings_insert on public.store_settings;
create policy store_settings_insert on public.store_settings
  for insert with check (public.has_store_access(store_id));

drop policy if exists store_settings_update on public.store_settings;
create policy store_settings_update on public.store_settings
  for update using (public.has_store_access(store_id))
  with check (public.has_store_access(store_id));

drop policy if exists store_settings_delete on public.store_settings;
create policy store_settings_delete on public.store_settings
  for delete using (public.is_super_admin());

-- Domains --------------------------------------------------------------------
drop policy if exists store_domains_select on public.store_domains;
create policy store_domains_select on public.store_domains
  for select using (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists store_domains_insert on public.store_domains;
create policy store_domains_insert on public.store_domains
  for insert with check (public.is_super_admin() or public.can_manage_store(store_id));

drop policy if exists store_domains_update on public.store_domains;
create policy store_domains_update on public.store_domains
  for update using (public.is_super_admin() or public.can_manage_store(store_id))
  with check (public.is_super_admin() or public.can_manage_store(store_id));

drop policy if exists store_domains_delete on public.store_domains;
create policy store_domains_delete on public.store_domains
  for delete using (public.is_super_admin() or public.can_manage_store(store_id));

-- Categories -----------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (
    public.store_is_public(store_id) or public.has_store_access(store_id)
  );

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert with check (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update using (public.is_super_admin() or public.has_store_access(store_id))
  with check (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete using (public.is_super_admin() or public.has_store_access(store_id));

-- Products -------------------------------------------------------------------
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (
    (is_active and public.store_is_public(store_id))
    or public.has_store_access(store_id)
  );

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert with check (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update using (public.is_super_admin() or public.has_store_access(store_id))
  with check (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete using (public.is_super_admin() or public.has_store_access(store_id));

-- Orders ---------------------------------------------------------------------
-- Inserts only happen through create_store_order(), never directly.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_super_admin() or public.has_store_access(store_id))
  with check (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete using (public.is_super_admin());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists order_items_delete on public.order_items;
create policy order_items_delete on public.order_items
  for delete using (public.is_super_admin());

-- Inventory ------------------------------------------------------------------
drop policy if exists inventory_logs_select on public.inventory_logs;
create policy inventory_logs_select on public.inventory_logs
  for select using (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists inventory_logs_insert on public.inventory_logs;
create policy inventory_logs_insert on public.inventory_logs
  for insert with check (public.is_super_admin() or public.has_store_access(store_id));

drop policy if exists inventory_logs_delete on public.inventory_logs;
create policy inventory_logs_delete on public.inventory_logs
  for delete using (public.is_super_admin());

-- Audit logs -----------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (public.is_super_admin());

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (
    auth.uid() is not null
    and actor_user_id = auth.uid()
    and (store_id is null or public.has_store_access(store_id))
  );

drop policy if exists audit_logs_delete on public.audit_logs;
create policy audit_logs_delete on public.audit_logs
  for delete using (public.is_super_admin());

-- Privileges -----------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on public.profiles from anon, authenticated;
revoke all on public.stores from anon, authenticated;
revoke all on public.store_members from anon, authenticated;
revoke all on public.store_settings from anon, authenticated;
revoke all on public.store_domains from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.inventory_logs from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

-- Anonymous storefront reads
grant select on public.stores to anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;

-- Authenticated admin operations (RLS still filters every row)
grant select, insert, update, delete on public.stores to authenticated;
grant select, insert, update, delete on public.store_members to authenticated;
grant select, insert, update, delete on public.store_settings to authenticated;
grant select, insert, update, delete on public.store_domains to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, insert on public.inventory_logs to authenticated;
grant select, insert on public.audit_logs to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

grant usage, select on sequence public.order_number_seq to anon, authenticated;

-- Helper functions used inside policies must be executable by the caller.
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.has_store_access(uuid) to anon, authenticated;
grant execute on function public.can_manage_store(uuid) to anon, authenticated;
grant execute on function public.store_is_public(uuid) to anon, authenticated;
grant execute on function public.profile_fields_unchanged(uuid, boolean, public.user_role) to authenticated;

-- Public checkout + authenticated admin RPCs
grant execute on function public.create_store_order(text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.adjust_product_stock(uuid, integer, text, text, text) to authenticated;

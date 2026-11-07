-- ---------------------------------------------------------------------------
-- AXORA multi-tenant e-commerce platform — core schema
-- Run with the Supabase CLI or paste into the SQL editor in order:
--   0001_schema.sql → 0002_functions.sql → 0003_rls.sql → 0004_storage.sql
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- Enums ---------------------------------------------------------------------
create type public.store_status as enum ('active', 'suspended', 'archived');
create type public.user_role as enum ('super_admin', 'store_owner', 'store_staff');
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.member_status as enum ('invited', 'active', 'disabled');
create type public.order_status as enum (
  'new',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'refunded');
create type public.verification_status as enum ('unconnected', 'pending', 'verified', 'failed');
create type public.ssl_status as enum ('none', 'provisioning', 'active', 'error');
create type public.domain_status as enum (
  'unconnected',
  'pending',
  'verified',
  'ssl_pending',
  'active',
  'error'
);
create type public.theme_style as enum ('minimal', 'editorial', 'bold');

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role public.user_role not null default 'store_owner',
  is_super_admin boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stores --------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text not null default '',
  description text not null default '',
  logo_url text,
  status public.store_status not null default 'active',
  currency text not null default 'MNT',
  language text not null default 'mn',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  owner_name text not null default '',
  owner_email text not null default '',
  owner_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_slug_lowercase check (slug = lower(slug)),
  constraint stores_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$')
);

create index stores_status_idx on public.stores (status);
create index stores_created_at_idx on public.stores (created_at desc);

-- Store members / permissions ------------------------------------------------
create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  full_name text not null default '',
  role public.member_role not null default 'staff',
  permissions jsonb not null default '[]'::jsonb,
  status public.member_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (store_id, email)
);

create index store_members_store_idx on public.store_members (store_id);
create index store_members_user_idx on public.store_members (user_id);

-- Store settings (theme, shipping, payments, visibility) ---------------------
create table public.store_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint store_settings_object check (jsonb_typeof(settings) = 'object')
);

-- Custom domains -------------------------------------------------------------
create table public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  verification_status public.verification_status not null default 'pending',
  ssl_status public.ssl_status not null default 'none',
  status public.domain_status not null default 'pending',
  verification_token text not null default '',
  expected_target text not null default 'cname.axora.mn',
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint store_domains_lowercase check (domain = lower(domain))
);

create index store_domains_store_idx on public.store_domains (store_id);
create unique index store_domains_one_primary_idx
  on public.store_domains (store_id)
  where is_primary;

-- Categories -----------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, slug)
);

create index categories_store_idx on public.categories (store_id);

-- Products -------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  price numeric(14, 2) not null default 0 check (price >= 0),
  sale_price numeric(14, 2) check (sale_price is null or sale_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  sku text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  images jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug),
  constraint products_images_array check (jsonb_typeof(images) = 'array'),
  constraint products_variants_array check (jsonb_typeof(variants) = 'array')
);

create index products_store_idx on public.products (store_id);
create index products_category_idx on public.products (category_id);
create index products_store_active_idx on public.products (store_id, is_active);

-- Orders ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  order_number text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null default '',
  customer_address text not null default '',
  note text not null default '',
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  shipping_amount numeric(14, 2) not null default 0 check (shipping_amount >= 0),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  payment_status public.payment_status not null default 'unpaid',
  order_status public.order_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, order_number)
);

create index orders_store_idx on public.orders (store_id);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (order_status);
create index orders_payment_idx on public.orders (payment_status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_store_idx on public.order_items (store_id);
create index order_items_product_idx on public.order_items (product_id);

-- Inventory movements --------------------------------------------------------
create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null default '',
  change_amount integer not null,
  balance_after integer not null,
  reason text not null,
  note text not null default '',
  actor_name text not null default '',
  created_at timestamptz not null default now()
);

create index inventory_logs_store_idx on public.inventory_logs (store_id);
create index inventory_logs_product_idx on public.inventory_logs (product_id);
create index inventory_logs_created_idx on public.inventory_logs (created_at desc);

-- Audit trail ----------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  store_id uuid references public.stores (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_logs_store_idx on public.audit_logs (store_id);
create index audit_logs_action_idx on public.audit_logs (action);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

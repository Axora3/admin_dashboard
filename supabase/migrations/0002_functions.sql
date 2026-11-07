-- ---------------------------------------------------------------------------
-- AXORA — helper functions, triggers and transactional RPCs
-- ---------------------------------------------------------------------------

-- updated_at -----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- Profile bootstrap for every Supabase Auth user ------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_super_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''),
    'store_owner',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Authorization helpers ------------------------------------------------------
-- SECURITY DEFINER keeps these helpers from recursing through RLS when they
-- are used inside policies on the same tables.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.is_super_admin or p.role = 'super_admin')
  );
$$;

create or replace function public.has_store_access(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.can_manage_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  );
$$;

create or replace function public.store_is_public(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.status = 'active'
  );
$$;

-- Prevents a user from promoting themselves through a normal profile update.
create or replace function public.profile_fields_unchanged(
  p_id uuid,
  p_is_super_admin boolean,
  p_role public.user_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_id
      and p.is_super_admin = p_is_super_admin
      and p.role = p_role
  );
$$;

-- Public storefront order creation -------------------------------------------
-- Called by anonymous visitors through the anon key. SECURITY DEFINER is safe
-- because the function only touches the requested store and validates stock,
-- price and visibility itself.
create or replace function public.create_store_order(
  p_store_slug text,
  p_customer jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_settings jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_product public.products%rowtype;
  v_product_id text;
  v_quantity integer;
  v_quantities jsonb := '{}'::jsonb;
  v_price numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_shipping numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_prefix text;
  v_published boolean := true;
  v_shipping_enabled boolean := false;
  v_flat_rate numeric(14, 2) := 0;
  v_free_over numeric(14, 2) := 0;
  v_name text;
  v_phone text;
begin
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Харилцагчийн мэдээлэл буруу байна.' using errcode = '22023';
  end if;

  v_name := nullif(trim(coalesce(p_customer ->> 'name', '')), '');
  v_phone := nullif(trim(coalesce(p_customer ->> 'phone', '')), '');
  if v_name is null or v_phone is null then
    raise exception 'Нэр болон утасны дугаар шаардлагатай.' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Сагс хоосон байна.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Нэг захиалгад хэт олон төрлийн бараа байна.' using errcode = '22023';
  end if;

  select *
  into v_store
  from public.stores
  where slug = lower(trim(p_store_slug))
  for update;

  if not found then
    raise exception 'Дэлгүүр олдсонгүй.' using errcode = 'P0002';
  end if;
  if v_store.status <> 'active' then
    raise exception 'Дэлгүүр түр хаалттай байна.' using errcode = '22023';
  end if;

  select coalesce(settings, '{}'::jsonb)
  into v_settings
  from public.store_settings
  where store_id = v_store.id;

  v_settings := coalesce(v_settings, '{}'::jsonb);
  v_published := coalesce((v_settings -> 'visibility' ->> 'published')::boolean, true);
  if not v_published then
    raise exception 'Дэлгүүрийн website нийтэд нээлттэй биш байна.' using errcode = '22023';
  end if;

  -- Basic abuse guard. Application-level rate limiting also applies.
  if (
    select count(*)
    from public.orders o
    where o.store_id = v_store.id
      and o.customer_phone = v_phone
      and o.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Энэ утасны дугаараар хэт олон захиалга илгээгдлээ. Түр хүлээнэ үү.'
      using errcode = '22023';
  end if;

  -- Validate every line and lock the product rows before writing anything.
  for v_elem in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_elem) <> 'object' then
      raise exception 'Захиалгын мөр буруу байна.' using errcode = '22023';
    end if;

    v_product_id := nullif(trim(coalesce(v_elem ->> 'productId', '')), '');
    v_quantity := nullif(v_elem ->> 'quantity', '')::integer;

    if v_product_id is null
      or v_product_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Бүтээгдэхүүн олдсонгүй.' using errcode = 'P0002';
    end if;
    if v_quantity is null or v_quantity <= 0 or v_quantity > 99 then
      raise exception 'Тоо ширхэг буруу байна.' using errcode = '22023';
    end if;

    select *
    into v_product
    from public.products
    where id = v_product_id::uuid
      and store_id = v_store.id
    for update;

    if not found then
      raise exception 'Бүтээгдэхүүн олдсонгүй.' using errcode = 'P0002';
    end if;
    if not v_product.is_active then
      raise exception '% зарагдахгүй байна.', v_product.name using errcode = '22023';
    end if;

    -- Accumulate quantities per product so duplicate lines cannot oversell.
    v_quantities := jsonb_set(
      v_quantities,
      array[v_product_id],
      to_jsonb(coalesce((v_quantities ->> v_product_id)::integer, 0) + v_quantity)
    );

    v_price := coalesce(v_product.sale_price, v_product.price);
    v_subtotal := v_subtotal + (v_price * v_quantity);
  end loop;

  -- Check stock against the aggregated quantity per product.
  for v_product_id, v_quantity in
    select key, value::integer
    from jsonb_each_text(v_quantities)
  loop
    select *
    into v_product
    from public.products
    where id = v_product_id::uuid
      and store_id = v_store.id
    for update;

    if not found then
      raise exception 'Бүтээгдэхүүн олдсонгүй.' using errcode = 'P0002';
    end if;
    if v_product.stock < v_quantity then
      raise exception '% хангалттай үлдэгдэлгүй байна.', v_product.name using errcode = '22023';
    end if;
  end loop;

  v_shipping_enabled := coalesce((v_settings -> 'shipping' ->> 'enabled')::boolean, false);
  v_flat_rate := coalesce((v_settings -> 'shipping' ->> 'flatRate')::numeric, 0);
  v_free_over := coalesce((v_settings -> 'shipping' ->> 'freeOver')::numeric, 0);

  if v_shipping_enabled and (v_free_over <= 0 or v_subtotal < v_free_over) then
    v_shipping := v_flat_rate;
  end if;
  v_total := v_subtotal + v_shipping;

  v_prefix := upper(left(regexp_replace(v_store.slug, '[^a-z0-9]', '', 'g'), 2));
  if v_prefix is null or v_prefix = '' then
    v_prefix := 'AX';
  end if;
  v_order_number := v_prefix || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  insert into public.orders (
    id,
    store_id,
    order_number,
    customer_name,
    customer_phone,
    customer_email,
    customer_address,
    note,
    subtotal,
    shipping_amount,
    total_amount,
    payment_status,
    order_status
  ) values (
    v_order_id,
    v_store.id,
    v_order_number,
    v_name,
    v_phone,
    coalesce(trim(coalesce(p_customer ->> 'email', '')), ''),
    coalesce(trim(coalesce(p_customer ->> 'address', '')), ''),
    coalesce(trim(coalesce(p_customer ->> 'note', '')), ''),
    v_subtotal,
    v_shipping,
    v_total,
    'unpaid',
    'new'
  );

  for v_elem in select value from jsonb_array_elements(p_items) loop
    v_product_id := trim(v_elem ->> 'productId');
    v_quantity := (v_elem ->> 'quantity')::integer;

    select *
    into v_product
    from public.products
    where id = v_product_id::uuid
      and store_id = v_store.id;

    v_price := coalesce(v_product.sale_price, v_product.price);

    insert into public.order_items (
      order_id,
      store_id,
      product_id,
      product_name,
      quantity,
      unit_price
    ) values (
      v_order_id,
      v_store.id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_price
    );

    update public.products
    set stock = stock - v_quantity,
        updated_at = now()
    where id = v_product.id;

    insert into public.inventory_logs (
      store_id,
      product_id,
      product_name,
      change_amount,
      balance_after,
      reason,
      note,
      actor_name
    ) values (
      v_store.id,
      v_product.id,
      v_product.name,
      -v_quantity,
      v_product.stock - v_quantity,
      'Захиалга',
      v_order_number,
      'Public website'
    );
  end loop;

  return v_order_id;
end;
$$;

-- Admin order status changes (with stock restoration on cancellation) --------
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_previous public.order_status;
  v_actor text;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Захиалга олдсонгүй.' using errcode = 'P0002';
  end if;

  if not public.has_store_access(v_order.store_id) then
    raise exception 'Эрх хүрэлцэхгүй.' using errcode = '42501';
  end if;

  v_previous := v_order.order_status;
  v_actor := coalesce(nullif(auth.jwt() ->> 'email', ''), 'Admin');

  update public.orders
  set order_status = p_status,
      updated_at = now()
  where id = p_order_id;

  if p_status = 'cancelled' and v_previous <> 'cancelled' then
    for v_item in
      select product_id, product_name, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      if v_item.product_id is not null then
        update public.products
        set stock = stock + v_item.quantity,
            updated_at = now()
        where id = v_item.product_id;

        insert into public.inventory_logs (
          store_id,
          product_id,
          product_name,
          change_amount,
          balance_after,
          reason,
          note,
          actor_name
        )
        select
          v_order.store_id,
          v_item.product_id,
          v_item.product_name,
          v_item.quantity,
          p.stock,
          'Буцаалт',
          'Захиалга ' || v_order.order_number || ' цуцлагдсан',
          v_actor
        from public.products p
        where p.id = v_item.product_id;
      end if;
    end loop;
  end if;
end;
$$;

-- Manual inventory adjustment -------------------------------------------------
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_change integer,
  p_reason text,
  p_note text,
  p_actor text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_actor text;
begin
  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Бараа олдсонгүй.' using errcode = 'P0002';
  end if;
  if not public.has_store_access(v_product.store_id) then
    raise exception 'Эрх хүрэлцэхгүй.' using errcode = '42501';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'Өөрчлөлтийн утга 0-ээс ялгаатай бүхэл тоо байх ёстой.' using errcode = '22023';
  end if;
  if v_product.stock + p_change < 0 then
    raise exception 'Үлдэгдэл 0-ээс доош болохгүй.' using errcode = '22023';
  end if;

  v_actor := coalesce(nullif(trim(coalesce(p_actor, '')), ''), nullif(auth.jwt() ->> 'email', ''), 'Admin');

  update public.products
  set stock = stock + p_change,
      updated_at = now()
  where id = p_product_id;

  insert into public.inventory_logs (
    store_id,
    product_id,
    product_name,
    change_amount,
    balance_after,
    reason,
    note,
    actor_name
  ) values (
    v_product.store_id,
    v_product.id,
    v_product.name,
    p_change,
    v_product.stock + p_change,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Гар аргаар засвар'),
    coalesce(p_note, ''),
    v_actor
  );
end;
$$;

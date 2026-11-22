-- SOL shared product publishing
-- Run this in Supabase SQL Editor. Then create an auth user for the store owner
-- and add that user's UUID to sol_admins using the SQL snippet in README-SUPABASE.md.

create table if not exists public.sol_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.sol_products (
  id text primary key,
  name text not null,
  category text not null,
  price numeric(10,2) not null check (price >= 0),
  data jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.sol_admins enable row level security;
alter table public.sol_products enable row level security;

-- A signed-in admin can see their own admin membership. Membership is inserted
-- manually by the project owner through the SQL editor, never by a browser client.
create policy "admins can read own membership"
on public.sol_admins for select to authenticated
using (user_id = auth.uid());

create policy "public can read published products"
on public.sol_products for select to anon, authenticated
using (is_published = true);

create policy "admins can read all products"
on public.sol_products for select to authenticated
using (exists (select 1 from public.sol_admins a where a.user_id = auth.uid()));

create policy "admins can insert products"
on public.sol_products for insert to authenticated
with check (exists (select 1 from public.sol_admins a where a.user_id = auth.uid()));

create policy "admins can update products"
on public.sol_products for update to authenticated
using (exists (select 1 from public.sol_admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.sol_admins a where a.user_id = auth.uid()));

create policy "admins can delete products"
on public.sol_products for delete to authenticated
using (exists (select 1 from public.sol_admins a where a.user_id = auth.uid()));

-- Explicit API grants are required in addition to RLS policies.
-- RLS controls which rows can be accessed; GRANT controls table-level access.
grant usage on schema public to anon, authenticated;
grant select on table public.sol_products to anon, authenticated;
grant insert, update, delete on table public.sol_products to authenticated;
grant select on table public.sol_admins to authenticated;

-- Public product images. Upload/delete is restricted to signed-in SOL admins.
insert into storage.buckets (id, name, public)
values ('sol-products', 'sol-products', true)
on conflict (id) do update set public = true;

create policy "public can view SOL product images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'sol-products');

create policy "admins can upload SOL product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sol-products'
  and exists (select 1 from public.sol_admins a where a.user_id = auth.uid())
);

create policy "admins can update SOL product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'sol-products'
  and exists (select 1 from public.sol_admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'sol-products'
  and exists (select 1 from public.sol_admins a where a.user_id = auth.uid())
);

create policy "admins can delete SOL product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'sol-products'
  and exists (select 1 from public.sol_admins a where a.user_id = auth.uid())
);

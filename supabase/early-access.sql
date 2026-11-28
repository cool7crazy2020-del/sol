-- SOL one-time early-access codes
-- Run once in Supabase Dashboard → SQL Editor.
create table if not exists public.sol_early_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by uuid not null references auth.users(id),
  redeemed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  revoked_at timestamptz
);
create index if not exists sol_early_access_codes_redeemed_by_idx
  on public.sol_early_access_codes (redeemed_by) where redeemed_by is not null;
alter table public.sol_early_access_codes enable row level security;
revoke all on table public.sol_early_access_codes from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on table public.sol_early_access_codes to service_role;

-- SOL customer messaging setup
-- Run this once in Supabase Dashboard → SQL Editor.
create table if not exists public.sol_customer_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_email text,
  message text not null check (char_length(message) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists sol_customer_messages_created_at_idx
  on public.sol_customer_messages (created_at desc);
alter table public.sol_customer_messages enable row level security;
revoke all on table public.sol_customer_messages from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert on table public.sol_customer_messages to service_role;

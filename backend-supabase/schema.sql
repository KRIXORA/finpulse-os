-- ==========================================================================
-- FinPulse-OS — Supabase schema
-- Run this once in Supabase: Project > SQL Editor > New Query > Run
-- ==========================================================================

-- ---------- Transactions ----------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  category text not null,
  amount numeric not null check (amount > 0),
  date date not null,
  created_at timestamptz not null default now()
);

-- ---------- Budgets ----------
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  limit_amount numeric not null check (limit_amount > 0),
  unique (user_id, category)
);

-- ---------- Goals ----------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target numeric not null check (target > 0),
  saved numeric not null default 0,
  deadline date
);

-- ---------- Row Level Security ----------
-- This is what makes it safe: every user can ONLY see and modify their own rows.
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;

create policy "Users manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own budgets"
  on budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own goals"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Indexes ----------
create index if not exists idx_tx_user on transactions(user_id);
create index if not exists idx_budget_user on budgets(user_id);
create index if not exists idx_goal_user on goals(user_id);

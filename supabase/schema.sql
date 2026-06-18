-- AURA — Supabase schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It creates a single table holding each user's active plan, their progress
-- (which sets are ticked off), and the inputs they built the plan with.
-- Row-Level Security ensures every user can only ever see/edit their own row.

create table if not exists public.user_plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan       jsonb,
  progress   jsonb not null default '{}'::jsonb,
  profile    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_plans enable row level security;

drop policy if exists "read own plan"   on public.user_plans;
drop policy if exists "insert own plan" on public.user_plans;
drop policy if exists "update own plan" on public.user_plans;

create policy "read own plan"
  on public.user_plans for select
  using (auth.uid() = user_id);

create policy "insert own plan"
  on public.user_plans for insert
  with check (auth.uid() = user_id);

create policy "update own plan"
  on public.user_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

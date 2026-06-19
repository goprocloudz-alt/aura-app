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
  settings   jsonb not null default '{}'::jsonb,   -- display name, prefs
  history    jsonb not null default '[]'::jsonb,   -- logged workout sessions
  updated_at timestamptz not null default now()
);

-- Invite-only signup. Codes are validated/consumed ONLY by the service role
-- (via the `signup-with-invite` edge function). RLS is on with no policies, so
-- anon/authenticated clients can never read or write this table directly.
create table if not exists public.invite_codes (
  code       text primary key,
  note       text,
  created_at timestamptz not null default now(),
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz
);
alter table public.invite_codes enable row level security;  -- no policies on purpose

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

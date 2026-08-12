-- ============================================================
-- Raid Team Planner - database setup
-- Paste this whole file into Supabase -> SQL Editor -> Run.
-- ============================================================

create table if not exists public.raids (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  raid_name   text not null,
  time        text,
  players     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- Fast lookup of "my raids, newest first".
create index if not exists raids_user_created_idx
  on public.raids (user_id, created_at desc);

-- ------------------------------------------------------------
-- Row Level Security: every user only ever sees their own rows.
-- Without this, anyone could read everyone's raids.
-- ------------------------------------------------------------
alter table public.raids enable row level security;

drop policy if exists "read own raids"   on public.raids;
drop policy if exists "insert own raids" on public.raids;
drop policy if exists "update own raids" on public.raids;
drop policy if exists "delete own raids" on public.raids;

create policy "read own raids"
  on public.raids for select
  using (auth.uid() = user_id);

create policy "insert own raids"
  on public.raids for insert
  with check (auth.uid() = user_id);

create policy "update own raids"
  on public.raids for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own raids"
  on public.raids for delete
  using (auth.uid() = user_id);

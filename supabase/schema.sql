-- JIMRAMI Supabase schema
-- Run this in Supabase -> SQL Editor for a fresh project.
--
-- JIMRAMI remains local-first. Supabase is optional and is used only
-- when VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are configured.
--
-- Security model:
--   - every row belongs to one authenticated Supabase user via owner_id
--   - Row Level Security allows that user to access only their own rows
--   - anon receives no table privileges

begin;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  name text not null,
  nicknames text[] not null default '{}',
  last_used_display_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  started_at timestamptz not null,
  ended_at timestamptz,

  status text not null
    check (status in ('active', 'ended')),

  round_number integer not null default 0,

  -- Goalpost / Deuce and future session-level data.
  metadata jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now()
);

create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  session_id uuid not null
    references public.sessions(id) on delete cascade,

  player_id uuid not null
    references public.players(id) on delete restrict,

  display_name text,
  rotation_order integer not null,

  points integer not null default 0,
  wins integer not null default 0,
  jim_wins integer not null default 0,
  jim_attempts integer not null default 0,

  unique (session_id, player_id)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  session_id uuid not null
    references public.sessions(id) on delete cascade,

  round_number integer not null,

  type text not null
    check (type in ('standard', 'jim')),

  created_at timestamptz not null default now(),
  edited_at timestamptz,

  unique (session_id, round_number)
);

create table if not exists public.round_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  round_id uuid not null
    references public.rounds(id) on delete cascade,

  session_id uuid not null
    references public.sessions(id) on delete cascade,

  player_id uuid not null
    references public.players(id) on delete restrict,

  card_score integer,
  position integer not null,
  points_awarded integer not null,

  unique (round_id, player_id)
);

create table if not exists public.jim_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  round_id uuid not null unique
    references public.rounds(id) on delete cascade,

  session_id uuid not null
    references public.sessions(id) on delete cascade,

  jim_player_id uuid not null
    references public.players(id) on delete restrict,

  caught_by_player_id uuid
    references public.players(id) on delete restrict,

  out_player_id uuid
    references public.players(id) on delete restrict,

  won boolean not null,

  steps_survived integer not null
    check (steps_survived between 0 and 6),

  hide_stage integer
    check (hide_stage between 2 and 5),

  jim_points_awarded integer not null,
  catcher_points_awarded integer not null
);

create table if not exists public.penalty_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  session_id uuid not null
    references public.sessions(id) on delete cascade,

  player_id uuid not null
    references public.players(id) on delete restrict,

  round_number integer not null
    check (round_number >= 0),

  points_awarded integer not null,

  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_players_owner
  on public.players(owner_id);

create index if not exists idx_sessions_owner
  on public.sessions(owner_id);

create index if not exists idx_session_players_owner
  on public.session_players(owner_id);

create index if not exists idx_session_players_session
  on public.session_players(session_id);

create index if not exists idx_rounds_owner
  on public.rounds(owner_id);

create index if not exists idx_rounds_session
  on public.rounds(session_id);

create index if not exists idx_round_results_owner
  on public.round_results(owner_id);

create index if not exists idx_round_results_session
  on public.round_results(session_id);

create index if not exists idx_round_results_round
  on public.round_results(round_id);

create index if not exists idx_jim_results_owner
  on public.jim_results(owner_id);

create index if not exists idx_jim_results_session
  on public.jim_results(session_id);

create index if not exists idx_penalty_results_owner
  on public.penalty_results(owner_id);

create index if not exists idx_penalty_results_session
  on public.penalty_results(session_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.rounds enable row level security;
alter table public.round_results enable row level security;
alter table public.jim_results enable row level security;
alter table public.penalty_results enable row level security;

-- Browser clients should never use the anonymous role for these tables.
revoke all on public.players from anon;
revoke all on public.sessions from anon;
revoke all on public.session_players from anon;
revoke all on public.rounds from anon;
revoke all on public.round_results from anon;
revoke all on public.jim_results from anon;
revoke all on public.penalty_results from anon;

grant select, insert, update, delete on public.players to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.session_players to authenticated;
grant select, insert, update, delete on public.rounds to authenticated;
grant select, insert, update, delete on public.round_results to authenticated;
grant select, insert, update, delete on public.jim_results to authenticated;
grant select, insert, update, delete on public.penalty_results to authenticated;

-- Re-running this script should not fail because old policy names are removed first.

drop policy if exists "players_select_own" on public.players;
drop policy if exists "players_insert_own" on public.players;
drop policy if exists "players_update_own" on public.players;
drop policy if exists "players_delete_own" on public.players;

create policy "players_select_own"
  on public.players for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "players_insert_own"
  on public.players for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "players_update_own"
  on public.players for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "players_delete_own"
  on public.players for delete
  to authenticated
  using ((select auth.uid()) = owner_id);


drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "sessions_update_own" on public.sessions;
drop policy if exists "sessions_delete_own" on public.sessions;

create policy "sessions_select_own"
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "sessions_insert_own"
  on public.sessions for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "sessions_update_own"
  on public.sessions for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "sessions_delete_own"
  on public.sessions for delete
  to authenticated
  using ((select auth.uid()) = owner_id);


drop policy if exists "session_players_select_own" on public.session_players;
drop policy if exists "session_players_insert_own" on public.session_players;
drop policy if exists "session_players_update_own" on public.session_players;
drop policy if exists "session_players_delete_own" on public.session_players;

create policy "session_players_select_own"
  on public.session_players for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "session_players_insert_own"
  on public.session_players for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "session_players_update_own"
  on public.session_players for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "session_players_delete_own"
  on public.session_players for delete
  to authenticated
  using ((select auth.uid()) = owner_id);


drop policy if exists "rounds_select_own" on public.rounds;
drop policy if exists "rounds_insert_own" on public.rounds;
drop policy if exists "rounds_update_own" on public.rounds;
drop policy if exists "rounds_delete_own" on public.rounds;

create policy "rounds_select_own"
  on public.rounds for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "rounds_insert_own"
  on public.rounds for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "rounds_update_own"
  on public.rounds for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "rounds_delete_own"
  on public.rounds for delete
  to authenticated
  using ((select auth.uid()) = owner_id);


drop policy if exists "round_results_select_own" on public.round_results;
drop policy if exists "round_results_insert_own" on public.round_results;
drop policy if exists "round_results_update_own" on public.round_results;
drop policy if exists "round_results_delete_own" on public.round_results;

create policy "round_results_select_own"
  on public.round_results for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "round_results_insert_own"
  on public.round_results for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "round_results_update_own"
  on public.round_results for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "round_results_delete_own"
  on public.round_results for delete
  to authenticated
  using ((select auth.uid()) = owner_id);


drop policy if exists "jim_results_select_own" on public.jim_results;
drop policy if exists "jim_results_insert_own" on public.jim_results;
drop policy if exists "jim_results_update_own" on public.jim_results;
drop policy if exists "jim_results_delete_own" on public.jim_results;

create policy "jim_results_select_own"
  on public.jim_results for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "jim_results_insert_own"
  on public.jim_results for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "jim_results_update_own"
  on public.jim_results for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "jim_results_delete_own"
  on public.jim_results for delete
  to authenticated
  using ((select auth.uid()) = owner_id);


drop policy if exists "penalty_results_select_own" on public.penalty_results;
drop policy if exists "penalty_results_insert_own" on public.penalty_results;
drop policy if exists "penalty_results_update_own" on public.penalty_results;
drop policy if exists "penalty_results_delete_own" on public.penalty_results;

create policy "penalty_results_select_own"
  on public.penalty_results for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "penalty_results_insert_own"
  on public.penalty_results for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "penalty_results_update_own"
  on public.penalty_results for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "penalty_results_delete_own"
  on public.penalty_results for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

commit;

-- JIMRAMI Supabase schema
-- Fresh project setup.
-- Run this in Supabase -> SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

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

  round_number integer not null
    check (round_number >= 1),

  -- Goalpost settings/events are stored together because the app
  -- treats them as session metadata.
  metadata jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now()
);

create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  session_id uuid not null
    references public.sessions(id),

  player_id uuid not null
    references public.players(id),

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
    references public.sessions(id),

  round_number integer not null
    check (round_number >= 1),

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
    references public.rounds(id),

  session_id uuid not null
    references public.sessions(id),

  player_id uuid not null
    references public.players(id),

  card_score integer,
  position integer not null,
  points_awarded integer not null,

  unique (round_id, player_id)
);

create table if not exists public.jim_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  round_id uuid not null
    references public.rounds(id),

  session_id uuid not null
    references public.sessions(id),

  jim_player_id uuid not null
    references public.players(id),

  caught_by_player_id uuid
    references public.players(id),

  out_player_id uuid
    references public.players(id),

  won boolean not null,
  steps_survived integer not null,
  hide_stage integer,
  jim_points_awarded integer not null,
  catcher_points_awarded integer not null,

  unique (round_id)
);

create table if not exists public.penalty_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  session_id uuid not null
    references public.sessions(id),

  player_id uuid not null
    references public.players(id),

  round_number integer not null,
  points_awarded integer not null,
  created_at timestamptz not null default now()
);

-- One revision row per Supabase user.
-- JIMRAMI uses this to prevent stale devices from overwriting newer cloud data.
create table if not exists public.sync_state (
  owner_id uuid primary key default auth.uid()
    references auth.users(id) on delete cascade,

  revision bigint not null default 0
    check (revision >= 0),

  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Useful indexes
-- ---------------------------------------------------------------------------

create index if not exists players_owner_id_idx
  on public.players(owner_id);

create index if not exists sessions_owner_id_idx
  on public.sessions(owner_id);

create index if not exists session_players_owner_id_idx
  on public.session_players(owner_id);

create index if not exists session_players_session_id_idx
  on public.session_players(session_id);

create index if not exists session_players_player_id_idx
  on public.session_players(player_id);

create index if not exists rounds_owner_id_idx
  on public.rounds(owner_id);

create index if not exists rounds_session_id_idx
  on public.rounds(session_id);

create index if not exists round_results_owner_id_idx
  on public.round_results(owner_id);

create index if not exists round_results_round_id_idx
  on public.round_results(round_id);

create index if not exists round_results_session_id_idx
  on public.round_results(session_id);

create index if not exists round_results_player_id_idx
  on public.round_results(player_id);

create index if not exists jim_results_owner_id_idx
  on public.jim_results(owner_id);

create index if not exists jim_results_round_id_idx
  on public.jim_results(round_id);

create index if not exists jim_results_session_id_idx
  on public.jim_results(session_id);

create index if not exists penalty_results_owner_id_idx
  on public.penalty_results(owner_id);

create index if not exists penalty_results_session_id_idx
  on public.penalty_results(session_id);

create index if not exists penalty_results_player_id_idx
  on public.penalty_results(player_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.rounds enable row level security;
alter table public.round_results enable row level security;
alter table public.jim_results enable row level security;
alter table public.penalty_results enable row level security;
alter table public.sync_state enable row level security;

revoke all on table
  public.players,
  public.sessions,
  public.session_players,
  public.rounds,
  public.round_results,
  public.jim_results,
  public.penalty_results,
  public.sync_state
from anon;

grant select, insert, update, delete on table
  public.players,
  public.sessions,
  public.session_players,
  public.rounds,
  public.round_results,
  public.jim_results,
  public.penalty_results,
  public.sync_state
to authenticated;

-- Drop/recreate policies so the file can safely be rerun.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'players',
    'sessions',
    'session_players',
    'rounds',
    'round_results',
    'jim_results',
    'penalty_results',
    'sync_state'
  ]
  loop
    execute format(
      'drop policy if exists "jimrami_select_own" on public.%I',
      table_name
    );

    execute format(
      'drop policy if exists "jimrami_insert_own" on public.%I',
      table_name
    );

    execute format(
      'drop policy if exists "jimrami_update_own" on public.%I',
      table_name
    );

    execute format(
      'drop policy if exists "jimrami_delete_own" on public.%I',
      table_name
    );

    execute format(
      'create policy "jimrami_select_own" on public.%I
       for select to authenticated
       using ((select auth.uid()) = owner_id)',
      table_name
    );

    execute format(
      'create policy "jimrami_insert_own" on public.%I
       for insert to authenticated
       with check ((select auth.uid()) = owner_id)',
      table_name
    );

    execute format(
      'create policy "jimrami_update_own" on public.%I
       for update to authenticated
       using ((select auth.uid()) = owner_id)
       with check ((select auth.uid()) = owner_id)',
      table_name
    );

    execute format(
      'create policy "jimrami_delete_own" on public.%I
       for delete to authenticated
       using ((select auth.uid()) = owner_id)',
      table_name
    );
  end loop;
end
$$;

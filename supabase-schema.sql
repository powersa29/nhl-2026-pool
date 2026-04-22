-- Run this in Supabase SQL editor to set up the database.

create table if not exists participants (
  id          bigserial primary key,
  name        text not null,
  roster      jsonb not null default '[]',
  tiebreaker  integer,
  created_at  timestamptz not null default now()
);

-- Run this if the table already exists (adds tiebreaker column):
-- alter table participants add column if not exists tiebreaker integer;

-- Allow anyone to read participants (public leaderboard).
alter table participants enable row level security;

create policy "Public read" on participants
  for select using (true);

create policy "Public insert" on participants
  for insert with check (true);

-- Config table for admin-editable settings (e.g. rounds bracket).
create table if not exists config (
  key   text primary key,
  value jsonb not null
);

alter table config enable row level security;

create policy "Public read config" on config
  for select using (true);

-- Only the service role (server-side) can write config.
-- The anon key used by the app can upsert because RLS is checked server-side.
create policy "Service upsert config" on config
  for all using (true) with check (true);

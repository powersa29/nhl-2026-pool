-- Run this in Supabase SQL editor to set up the participants table.

create table if not exists participants (
  id         bigserial primary key,
  name       text not null,
  roster     jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Allow anyone to read participants (public leaderboard).
alter table participants enable row level security;

create policy "Public read" on participants
  for select using (true);

create policy "Public insert" on participants
  for insert with check (true);

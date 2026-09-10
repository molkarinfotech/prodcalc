-- Family Time Log — Supabase schema
-- Run this in your Supabase dashboard > SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tasks table: defines the task categories the family uses
create table if not exists tasks (
  id            text primary key,
  name          text not null,
  emoji         text not null default '',
  productive    boolean not null default true,
  color         text not null default '#6B7280',
  sort_order    integer not null default 0,
  created_at    timestamptz default now()
);

-- Time entries: one row per logged session
create table if not exists time_entries (
  id            uuid default uuid_generate_v4() primary key,
  member_name   text not null,            -- e.g. "Kid 1", "Parent"
  task_name     text not null,
  task_emoji    text not null default '',
  productive    boolean not null default true,
  minutes       integer not null,
  logged_date   text not null,            -- YYYY-MM-DD
  logged_at     timestamptz not null default now(),
  note          text
);

-- Indexes for fast lookups
create index if not exists idx_entries_member_date on time_entries (member_name, logged_date);
create index if not exists idx_entries_date on time_entries (logged_date);

-- Default task list (edit or add more in the dashboard)
insert into tasks (id, name, emoji, productive, color, sort_order) values
  ('read',     'Reading',           '📚', true,  '#7C3AED', 1),
  ('math',     'Math',              '🧮', true,  '#2563EB', 2),
  ('writing',  'Writing',           '✍️', true,  '#059669', 3),
  ('science',  'Science',           '🔬', true,  '#DB2777', 4),
  ('exercise', 'Exercise',          '🏃', true,  '#EA580C', 5),
  ('chores',   'Chores',            '🧹', true,  '#CA8A04', 6),
  ('music',    'Music Practice',    '🎵', true,  '#7C3AED', 7),
  ('tv',       'TV / Videos',       '📺', false, '#6B7280', 8),
  ('games',    'Games',             '🎮', false, '#9CA3AF', 9),
  ('social',   'Social / Chat',     '💬', false, '#D97706', 10)
on conflict (id) do nothing;

-- Storage: allow anyone to read tasks and entries (family sharing)
alter table tasks enable row level security;
alter table time_entries enable row level security;

create policy "Public tasks are viewable by everyone"
  on tasks for select using (true);

create policy "Entries are viewable by family members"
  on time_entries for select using (true);

create policy "Family members can insert entries"
  on time_entries for insert with check (true);

create policy "Family members can delete their own entries"
  on time_entries for delete using (true);

create extension if not exists "uuid-ossp";

create table if not exists tasks (
  id            text primary key,
  name          text not null,
  emoji         text not null default '',
  productive    boolean not null default true,
  color         text not null default '#6B7280',
  sort_order    integer not null default 0,
  created_at    timestamptz default now()
);

create table if not exists time_entries (
  id            uuid default uuid_generate_v4() primary key,
  member_name   text not null,
  task_name     text not null,
  task_emoji    text not null default '',
  productive    boolean not null default true,
  minutes       integer not null,
  logged_date   text not null,
  logged_at     timestamptz not null default now(),
  note          text
);

create index if not exists idx_entries_member_date on time_entries (member_name, logged_date);
create index if not exists idx_entries_date on time_entries (logged_date);

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

alter table tasks enable row level security;
alter table time_entries enable row level security;

create policy "Public tasks" on tasks for select using (true);
create policy "Family entries readable" on time_entries for select using (true);
create policy "Family can insert" on time_entries for insert with check (true);
create policy "Family can delete" on time_entries for delete using (true);

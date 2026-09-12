create extension if not exists "uuid-ossp";

-- =============================================
-- FAMILIES
-- =============================================
create table if not exists families (
  id            uuid default uuid_generate_v4() primary key,
  name          text not null,
  invite_code   text not null unique,
  created_by    uuid not null,
  created_at    timestamptz default now()
);

create or replace function generate_invite_code()
returns trigger as $$
begin
  new.invite_code = upper(substring(md5(random()::text) from 1 for 6));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_families_invite_code on families;
create trigger trg_families_invite_code
  before insert on families
  for each row
  when (new.invite_code is null)
  execute function generate_invite_code();

-- =============================================
-- FAMILY MEMBERS
-- =============================================
create table if not exists family_members (
  id            uuid default uuid_generate_v4() primary key,
  family_id     uuid not null references families(id) on delete cascade,
  user_id       uuid not null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  display_name  text not null,
  emoji         text not null default '🧑',
  color         text not null default '#6B7280',
  sort_order    integer not null default 0,
  created_at    timestamptz default now(),
  unique(family_id, user_id)
);

-- =============================================
-- TASKS (family-specific, with global defaults)
-- =============================================
create table if not exists tasks (
  id            uuid default uuid_generate_v4() primary key,
  family_id     uuid references families(id) on delete cascade,
  name          text not null,
  emoji         text not null default '',
  productive    boolean not null default true,
  color         text not null default '#6B7280',
  sort_order    integer not null default 0,
  created_at    timestamptz default now()
);

-- =============================================
-- TIME ENTRIES (linked to family + member)
-- =============================================
create table if not exists time_entries (
  id            uuid default uuid_generate_v4() primary key,
  family_id     uuid not null references families(id) on delete cascade,
  member_id     uuid not null references family_members(id) on delete cascade,
  task_id       uuid references tasks(id) on delete set null,
  task_name     text not null,
  task_emoji    text not null default '',
  productive    boolean not null default true,
  minutes       integer not null,
  logged_date   text not null,
  logged_at     timestamptz not null default now(),
  note          text
);

-- =============================================
-- INDEXES
-- =============================================
create index if not exists idx_family_members_family on family_members(family_id);
create index if not exists idx_family_members_user on family_members(user_id);
create index if not exists idx_tasks_family on tasks(family_id);
create index if not exists idx_entries_family_member_date on time_entries(family_id, member_id, logged_date);
create index if not exists idx_entries_family_date on time_entries(family_id, logged_date);
create index if not exists idx_families_invite_code on families(invite_code);

-- =============================================
-- DEFAULT TASKS (global, family_id = null)
-- =============================================
insert into tasks (family_id, name, emoji, productive, color, sort_order) values
  (null, 'Reading',           '📚', true,  '#7C3AED', 1),
  (null, 'Math',              '🧮', true,  '#2563EB', 2),
  (null, 'Writing',           '✍️', true,  '#059669', 3),
  (null, 'Science',           '🔬', true,  '#DB2777', 4),
  (null, 'Exercise',          '🏃', true,  '#EA580C', 5),
  (null, 'Chores',            '🧹', true,  '#CA8A04', 6),
  (null, 'Music Practice',    '🎵', true,  '#7C3AED', 7),
  (null, 'TV / Videos',       '📺', false, '#6B7280', 8),
  (null, 'Games',             '🎮', false, '#9CA3AF', 9),
  (null, 'Social / Chat',     '💬', false, '#D97706', 10)
on conflict do nothing;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table families enable row level security;
alter table family_members enable row level security;
alter table tasks enable row level security;
alter table time_entries enable row level security;

-- Families: members of a family can see it
create policy "Family members can view their families"
  on families for select using (
    id in (select family_id from family_members where user_id = auth.uid())
  );

-- Families: authenticated users can create
create policy "Authenticated users can create families"
  on families for insert with check (auth.uid() is not null and created_by = auth.uid());

-- Family members: visible to family members
create policy "Family members can view members"
  on family_members for select using (
    family_id in (select family_id from family_members where user_id = auth.uid())
  );

-- Family members: users can add themselves via invite code
create policy "Users can join family via invite"
  on family_members for insert with check (
    user_id = auth.uid() and
    family_id in (select id from families where invite_code = family_id::text)
  );

-- Family members: admins can manage
create policy "Admins can manage members"
  on family_members for update using (
    family_id in (
      select family_id from family_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Tasks: visible to family members (global + family-specific)
create policy "Family members can view tasks"
  on tasks for select using (
    family_id is null or
    family_id in (select family_id from family_members where user_id = auth.uid())
  );

-- Tasks: family admins can manage
create policy "Admins can manage family tasks"
  on tasks for insert with check (
    family_id in (
      select family_id from family_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Time entries: visible to family members
create policy "Family members can view entries"
  on time_entries for select using (
    family_id in (select family_id from family_members where user_id = auth.uid())
  );

-- Time entries: members can insert their own
create policy "Members can insert own entries"
  on time_entries for insert with check (
    member_id in (
      select id from family_members
      where user_id = auth.uid() and family_id = time_entries.family_id
    )
  );

-- Time entries: members can delete their own
create policy "Members can delete own entries"
  on time_entries for delete using (
    member_id in (
      select id from family_members
      where user_id = auth.uid() and family_id = time_entries.family_id
    )
  );

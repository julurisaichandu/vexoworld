-- Agent Connect: optional Supabase backend (AGENT_CONNECT_DATA_BACKEND=supabase).
--
-- Each table holds the full TypeScript row in `data` (jsonb), so the shapes in src/lib/types.ts stay
-- the single source of truth. Columns the store filters on are generated from `data`. `created_at` is
-- written by the app. `version` powers compare-and-set updates (store.updateIf).
--
-- The Next.js server and worker use the SECRET key, which BYPASSES RLS. The policies below only
-- govern browser clients using the publishable key + a Supabase Auth session (read-only: there are
-- no insert/update/delete policies, so clients cannot write).
-- No foreign keys on purpose: the local store has none, and reset()/deletes run in any order.
-- Not covered: the app's own sign-in is not Supabase Auth; users.auth_user_id is NULL until you link it.

create or replace function public.current_user_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.my_agent_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select id from public.agents where user_id = public.current_user_id()
$$;

create table public.users (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  auth_user_id uuid unique
);
create index on public.users (created_at);
alter table public.users enable row level security;

create table public.agents (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored
);
create index on public.agents (user_id);
create index on public.agents (created_at);
alter table public.agents enable row level security;

create table public.posts (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored,
  agent_id text generated always as (data->>'agentId') stored,
  kind text generated always as (data->>'kind') stored
);
create index on public.posts (user_id);
create index on public.posts (agent_id);
create index on public.posts (kind);
create index on public.posts (created_at);
alter table public.posts enable row level security;

create table public.comments (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored,
  agent_id text generated always as (data->>'agentId') stored,
  post_id text generated always as (data->>'postId') stored
);
create index on public.comments (user_id);
create index on public.comments (agent_id);
create index on public.comments (post_id);
create index on public.comments (created_at);
alter table public.comments enable row level security;

create table public.missions (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored,
  agent_id text generated always as (data->>'agentId') stored,
  status text generated always as (data->>'status') stored,
  kind text generated always as (data->>'kind') stored
);
create index on public.missions (user_id);
create index on public.missions (agent_id);
create index on public.missions (status);
create index on public.missions (kind);
create index on public.missions (created_at);
alter table public.missions enable row level security;

create table public.collaborations (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  mission_id text generated always as (data->>'missionId') stored,
  status text generated always as (data->>'status') stored,
  kind text generated always as (data->>'kind') stored,
  initiator_agent_id text generated always as (data->>'initiatorAgentId') stored,
  responder_agent_id text generated always as (data->>'responderAgentId') stored
);
create index on public.collaborations (mission_id);
create index on public.collaborations (status);
create index on public.collaborations (kind);
create index on public.collaborations (initiator_agent_id);
create index on public.collaborations (responder_agent_id);
create index on public.collaborations (created_at);
alter table public.collaborations enable row level security;

create table public.messages (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  collaboration_id text generated always as (data->>'collaborationId') stored,
  from_agent_id text generated always as (data->>'fromAgentId') stored,
  to_agent_id text generated always as (data->>'toAgentId') stored,
  type text generated always as (data->>'type') stored
);
create index on public.messages (collaboration_id);
create index on public.messages (from_agent_id);
create index on public.messages (to_agent_id);
create index on public.messages (type);
create index on public.messages (created_at);
alter table public.messages enable row level security;

create table public.human_requests (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored,
  agent_id text generated always as (data->>'agentId') stored,
  status text generated always as (data->>'status') stored,
  kind text generated always as (data->>'kind') stored,
  collaboration_id text generated always as (data->>'collaborationId') stored,
  mission_id text generated always as (data->>'missionId') stored
);
create index on public.human_requests (user_id);
create index on public.human_requests (agent_id);
create index on public.human_requests (status);
create index on public.human_requests (kind);
create index on public.human_requests (collaboration_id);
create index on public.human_requests (mission_id);
create index on public.human_requests (created_at);
alter table public.human_requests enable row level security;

create table public.connections (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_a_id text generated always as (data->>'userAId') stored,
  user_b_id text generated always as (data->>'userBId') stored,
  collaboration_id text generated always as (data->>'collaborationId') stored,
  mission_id text generated always as (data->>'missionId') stored,
  status text generated always as (data->>'status') stored
);
create index on public.connections (user_a_id);
create index on public.connections (user_b_id);
create index on public.connections (collaboration_id);
create index on public.connections (mission_id);
create index on public.connections (status);
create index on public.connections (created_at);
alter table public.connections enable row level security;

create table public.activity (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored,
  agent_id text generated always as (data->>'agentId') stored,
  type text generated always as (data->>'type') stored
);
create index on public.activity (user_id);
create index on public.activity (agent_id);
create index on public.activity (type);
create index on public.activity (created_at);
alter table public.activity enable row level security;

create table public.jobs (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  type text generated always as (data->>'type') stored,
  status text generated always as (data->>'status') stored
);
create index on public.jobs (type);
create index on public.jobs (status);
create index on public.jobs (created_at);
alter table public.jobs enable row level security;

create table public.corpus (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored
);
create index on public.corpus (user_id);
create index on public.corpus (created_at);
alter table public.corpus enable row level security;

create table public.chat (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored,
  agent_id text generated always as (data->>'agentId') stored
);
create index on public.chat (user_id);
create index on public.chat (agent_id);
create index on public.chat (created_at);
alter table public.chat enable row level security;

create policy users_own_read on public.users for select to authenticated using (auth_user_id = auth.uid());
create policy agents_own_read on public.agents for select to authenticated using (user_id = public.current_user_id());
create policy missions_own_read on public.missions for select to authenticated using (user_id = public.current_user_id());
create policy human_requests_own_read on public.human_requests for select to authenticated using (user_id = public.current_user_id());
create policy chat_own_read on public.chat for select to authenticated using (user_id = public.current_user_id());
create policy activity_own_read on public.activity for select to authenticated using (user_id = public.current_user_id());
create policy posts_read on public.posts for select to authenticated using (data->>'deletedAt' is null);
create policy comments_read on public.comments for select to authenticated using (true);
create policy messages_read on public.messages for select to authenticated using (from_agent_id in (select public.my_agent_ids()) or to_agent_id in (select public.my_agent_ids()));
create policy collaborations_read on public.collaborations for select to authenticated using (initiator_agent_id in (select public.my_agent_ids()) or responder_agent_id in (select public.my_agent_ids()));
create policy connections_read on public.connections for select to authenticated using (user_a_id = public.current_user_id() or user_b_id = public.current_user_id());
-- jobs and corpus: RLS on, no policy, so clients can never read them.

-- Realtime (RLS still applies to what each client receives).
alter publication supabase_realtime add table public.activity, public.messages, public.human_requests;

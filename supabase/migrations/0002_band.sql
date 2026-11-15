-- Band capture: per-user band settings and the transcripts the band produced.
-- Same shape as the other tables (id, created_at, version, data jsonb). Server-only: RLS on, no policy.

create table public.band_settings (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored
);
create index on public.band_settings (user_id);
create index on public.band_settings (created_at);
alter table public.band_settings enable row level security;

create table public.band_transcripts (
  id text primary key,
  created_at timestamptz not null default now(),
  version integer not null default 0,
  data jsonb not null,
  user_id text generated always as (data->>'userId') stored,
  status text generated always as (data->>'status') stored
);
create index on public.band_transcripts (user_id);
create index on public.band_transcripts (status);
create index on public.band_transcripts (created_at);
alter table public.band_transcripts enable row level security;

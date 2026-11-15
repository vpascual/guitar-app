-- Sync store for the guitar app. One table of JSON documents, partitioned by a secret sync key.
-- There is no login: each request carries the key in the x-sync-key header, and row-level security only
-- exposes rows whose owner equals the SHA-256 of that header. Without the key, no row can be read or changed.

create table if not exists public.sync_docs (
  owner text not null,
  kind text not null check (kind in ('attempt', 'session', 'kv')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, kind, id)
);

create index if not exists sync_docs_owner_updated on public.sync_docs (owner, updated_at);

-- Hash of the sync key sent with the current request; null when the header is missing or too short to be a real key.
create or replace function public.sync_owner() returns text
language sql stable
set search_path = ''
as $$
  select case
    when length(coalesce(current_setting('request.headers', true)::json ->> 'x-sync-key', '')) >= 20
    then encode(sha256(convert_to(current_setting('request.headers', true)::json ->> 'x-sync-key', 'utf8')), 'hex')
  end
$$;

-- The server, not the client, stamps every write; the pull cursor relies on it.
create or replace function public.sync_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists sync_docs_touch on public.sync_docs;
create trigger sync_docs_touch before insert or update on public.sync_docs
  for each row execute function public.sync_touch();

alter table public.sync_docs enable row level security;

drop policy if exists sync_docs_by_key on public.sync_docs;
create policy sync_docs_by_key on public.sync_docs
  for all to anon, authenticated
  using (owner = public.sync_owner())
  with check (owner = public.sync_owner());

revoke all on public.sync_docs from anon, authenticated;
grant select, insert, update on public.sync_docs to anon, authenticated;

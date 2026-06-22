-- Suivi de présence réel (durée de connexion des collaborateurs).
-- Neon Auth ne met pas à jour l'activité des sessions ; on mesure nous-mêmes.

create table if not exists public.presence_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id   text not null,
  email     text,
  started_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  user_agent text,
  ip         text
);
create index if not exists presence_user_idx on public.presence_sessions(user_id, started_at desc);

alter table public.presence_sessions enable row level security;
grant select, insert, update, delete on public.presence_sessions to authenticated;

drop policy if exists presence_insert_self on public.presence_sessions;
drop policy if exists presence_update_self on public.presence_sessions;
drop policy if exists presence_select       on public.presence_sessions;
drop policy if exists presence_delete_admin on public.presence_sessions;

create policy presence_insert_self on public.presence_sessions
  for insert to authenticated with check (user_id = auth.user_id());
create policy presence_update_self on public.presence_sessions
  for update to authenticated using (user_id = auth.user_id()) with check (user_id = auth.user_id());
create policy presence_select on public.presence_sessions
  for select to authenticated using (public.is_admin() or user_id = auth.user_id());
create policy presence_delete_admin on public.presence_sessions
  for delete to authenticated using (public.is_admin());

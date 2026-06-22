-- Fix: règles RLS d'écriture manquantes sur acces_autorises (liste blanche CRM).
-- Sans ces policies, tout INSERT/UPDATE/DELETE était refusé ("new row violates row-level security policy").
-- L'écriture est réservée aux administrateurs.

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.user_id() and p.is_admin) $$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists acces_admin_insert on public.acces_autorises;
drop policy if exists acces_admin_update on public.acces_autorises;
drop policy if exists acces_admin_delete on public.acces_autorises;

create policy acces_admin_insert on public.acces_autorises
  for insert to authenticated with check (public.is_admin());

create policy acces_admin_update on public.acces_autorises
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy acces_admin_delete on public.acces_autorises
  for delete to authenticated using (public.is_admin());

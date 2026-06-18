-- Liste blanche des utilisateurs autorisés à accéder au CRM TBEECOM.
-- Un utilisateur est autorisé si son email figure dans cette table
-- OU s'il est admin (profiles.is_admin = true).
create table if not exists public.acces_autorises (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nom text,
  created_at timestamptz not null default now()
);

create index if not exists acces_autorises_email_lower_idx
  on public.acces_autorises (lower(email));

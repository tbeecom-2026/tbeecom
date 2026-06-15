-- ──────────────────────────────────────────────────────────────────────────
-- TBEECOM — Schéma Neon (Data API PostgREST + Neon Auth / Better Auth)
-- À exécuter dans le SQL Editor Neon (NeonDB).
--
-- Différences clés avec le schéma Supabase d'origine :
--   • auth.uid()                       → auth.user_id()
--   • user_id uuid REFERENCES auth.users(id) → user_id text DEFAULT auth.user_id()
--     (la FK est supprimée car la table auth.users n'existe pas côté Neon —
--      les utilisateurs vivent dans le schéma neon_auth géré par Better Auth)
--   • trigger on_auth_user_created    → SUPPRIMÉ (profile peuplé à la 1re
--     connexion côté app, voir AuthContext.tsx)
--   • rôles anon/authenticated        → anonymous/authenticated (Neon)
--   • GRANT explicites pour authenticated sur chaque table
--   • Les uploads fichiers sont reportés et à rebrancher ultérieurement
-- ──────────────────────────────────────────────────────────────────────────

-- ── profiles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          TEXT PRIMARY KEY DEFAULT auth.user_id(),
  email       TEXT,
  full_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated USING (auth.user_id() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.user_id() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.user_id() = id);

-- ── contacts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          TEXT NOT NULL,
  prenom       TEXT,
  societe      TEXT,
  email        TEXT,
  telephone    TEXT,
  adresse      TEXT,
  code_postal  TEXT,
  commune      TEXT,
  roles        TEXT[] DEFAULT '{}',
  notes        TEXT,
  -- Enrichissement société (Sirene)
  siret                   varchar(14),
  siren                   varchar(9),
  tva_intracommunautaire  varchar(20),
  forme_juridique         varchar(100),
  libelle_forme_juridique varchar(150),
  capital_social          numeric,
  code_naf                varchar(10),
  libelle_naf             varchar(200),
  date_creation_societe   date,
  nom_dirigeant           varchar(200),
  telephone_fixe          varchar(20),
  site_web                varchar(255),
  user_id      TEXT NOT NULL DEFAULT auth.user_id(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.contacts;
CREATE POLICY "Equipe TBEECOM" ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_contacts_siret ON public.contacts (siret);
CREATE INDEX IF NOT EXISTS idx_contacts_siren ON public.contacts (siren);

-- ── mandats ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mandats (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             TEXT UNIQUE NOT NULL,
  type_mandat           TEXT DEFAULT 'simple',
  statut                TEXT DEFAULT 'sur_le_marche',
  confidentiel          BOOLEAN DEFAULT false,
  type_commerce         TEXT,
  sous_type             TEXT,
  titre                 TEXT,
  description           TEXT,
  adresse               TEXT,
  code_postal           TEXT,
  commune               TEXT,
  secteur               TEXT,
  prix_demande          NUMERIC,
  prix_net_vendeur      NUMERIC,
  honoraires_pct        NUMERIC,
  honoraires_montant    NUMERIC,
  ca_annuel             NUMERIC,
  ebe                   NUMERIC,
  resultat_net          NUMERIC,
  effectif              INTEGER,
  date_bilan            DATE,
  loyer_mensuel         NUMERIC,
  charges_mensuelles    NUMERIC,
  date_debut_bail       DATE,
  date_fin_bail         DATE,
  duree_bail            INTEGER,
  date_renouvellement   DATE,
  clause_destination    TEXT,
  droit_au_bail         BOOLEAN DEFAULT false,
  montant_droit_bail    NUMERIC,
  surface_commerciale   NUMERIC,
  surface_reserves      NUMERIC,
  surface_cuisine       NUMERIC,
  surface_totale        NUMERIC,
  nb_couverts_salle     INTEGER DEFAULT 0,
  nb_couverts_terrasse  INTEGER DEFAULT 0,
  lineaire_vitrine      NUMERIC,
  conforme_erp          BOOLEAN DEFAULT false,
  conforme_pmr          BOOLEAN DEFAULT false,
  extraction            BOOLEAN DEFAULT false,
  murs_a_vendre         BOOLEAN DEFAULT false,
  date_sur_le_marche    DATE,
  date_sous_compromis   DATE,
  date_vendu            DATE,
  date_retire           DATE,
  cles                  BOOLEAN DEFAULT false,
  notes_internes        TEXT,
  suivi_par             TEXT,
  numero_registre       INTEGER,
  enseigne              TEXT,
  nature_activite       TEXT,
  raison_vente          TEXT,
  honoraires_charge     TEXT DEFAULT 'Acquéreur',
  photo_principale      TEXT,
  photos                TEXT[] DEFAULT '{}',
  documents             JSONB DEFAULT '[]'::jsonb,
  document_url          TEXT,
  user_id               TEXT NOT NULL DEFAULT auth.user_id(),
  created_at            TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mandats TO authenticated;

ALTER TABLE public.mandats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.mandats;
CREATE POLICY "Equipe TBEECOM" ON public.mandats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mandats_numero_registre ON public.mandats(numero_registre);
CREATE INDEX IF NOT EXISTS idx_mandats_statut          ON public.mandats(statut);
CREATE INDEX IF NOT EXISTS idx_mandats_type_commerce   ON public.mandats(type_commerce);

-- ── recherches (acquéreurs) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recherches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  budget_min            NUMERIC,
  budget_max            NUMERIC,
  apport                NUMERIC,
  droit_bail_max        NUMERIC,
  financement_bancaire  BOOLEAN DEFAULT false,
  types_commerce        TEXT[] DEFAULT '{}',
  activites_libres      TEXT,
  villes                TEXT[] DEFAULT '{}',
  departements          TEXT[] DEFAULT '{}',
  rayon_km              INTEGER,
  surface_min           NUMERIC,
  surface_max           NUMERIC,
  conforme_erp          BOOLEAN,
  conforme_pmr          BOOLEAN,
  extraction            BOOLEAN,
  murs_souhaites        BOOLEAN,
  statut                TEXT DEFAULT 'actif',
  user_id               TEXT NOT NULL DEFAULT auth.user_id(),
  created_at            TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recherches TO authenticated;

ALTER TABLE public.recherches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.recherches;
CREATE POLICY "Equipe TBEECOM" ON public.recherches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── mandat_vendeurs (liaison) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mandat_vendeurs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandat_id   UUID REFERENCES public.mandats(id)  ON DELETE CASCADE NOT NULL,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(mandat_id, contact_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mandat_vendeurs TO authenticated;

ALTER TABLE public.mandat_vendeurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.mandat_vendeurs;
CREATE POLICY "Equipe TBEECOM" ON public.mandat_vendeurs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── rapprochements ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rapprochements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recherche_id  UUID REFERENCES public.recherches(id) ON DELETE CASCADE NOT NULL,
  mandat_id     UUID REFERENCES public.mandats(id)    ON DELETE CASCADE NOT NULL,
  statut        TEXT DEFAULT 'propose',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapprochements TO authenticated;

ALTER TABLE public.rapprochements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.rapprochements;
CREATE POLICY "Equipe TBEECOM" ON public.rapprochements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── activites ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL,
  description  TEXT NOT NULL,
  mandat_id    UUID REFERENCES public.mandats(id)  ON DELETE SET NULL,
  contact_id   UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id      TEXT NOT NULL DEFAULT auth.user_id(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activites TO authenticated;

ALTER TABLE public.activites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.activites;
CREATE POLICY "Equipe TBEECOM" ON public.activites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── bareme_honoraires ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bareme_honoraires (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordre        INT  NOT NULL,
  type_trans   TEXT NOT NULL DEFAULT 'fdc',   -- fdc | dab | murs
  prix_min     NUMERIC,                       -- null = pas de minimum
  prix_max     NUMERIC,                       -- null = au-delà (illimité)
  type_calcul  TEXT NOT NULL,                 -- 'forfait' | 'pourcentage'
  valeur       NUMERIC NOT NULL,              -- € si forfait, % si pourcentage
  libelle      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bareme_honoraires TO authenticated;

ALTER TABLE public.bareme_honoraires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.bareme_honoraires;
CREATE POLICY "Equipe TBEECOM" ON public.bareme_honoraires
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Données initiales : barème FDC TBEECOM (10/10/2020)
INSERT INTO public.bareme_honoraires (ordre, type_trans, prix_min, prix_max, type_calcul, valeur, libelle)
VALUES
  (1, 'fdc', NULL,    30000,  'forfait',     5000, '≤ 30 000 € → forfait 5 000 € HT'),
  (2, 'fdc', 30001,   85000,  'forfait',     7500, '30 001 € à 85 000 € → forfait 7 500 € HT'),
  (3, 'fdc', 85001,   200000, 'pourcentage', 9,    '85 001 € à 200 000 € → 9 % HT'),
  (4, 'fdc', 200001,  400000, 'pourcentage', 8,    '200 001 € à 400 000 € → 8 % HT'),
  (5, 'fdc', 400001,  800000, 'pourcentage', 7,    '400 001 € à 800 000 € → 7 % HT'),
  (6, 'fdc', 800001,  NULL,   'pourcentage', 6,    '> 800 000 € → 6 % HT')
ON CONFLICT DO NOTHING;

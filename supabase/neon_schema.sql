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

-- ──────────────────────────────────────────────────────────────────────────
-- ESPACE PUBLIC TBEECOM (landingpage) — accès anonyme
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Lecture anonyme des biens "sur le marché" (champs publics uniquement).
--    On expose la table mandats via GRANT + RLS. Les colonnes sensibles
--    (prix_net_vendeur, honoraires, notes_internes, proprietaire_*, etc.)
--    ne sont JAMAIS sélectionnées par le front public — la sélection est
--    cadrée côté app dans src/lib/publicBiens.ts (PUBLIC_FIELDS).
GRANT SELECT ON public.mandats TO anonymous;

DROP POLICY IF EXISTS "Public peut lire biens sur le marche" ON public.mandats;
CREATE POLICY "Public peut lire biens sur le marche"
  ON public.mandats FOR SELECT TO anonymous
  USING (statut = 'sur_le_marche');

-- 2) Table leads (formulaires publics : contact / vendre / acheter / annonce)
CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,                      -- contact | vendre | acheter | annonce
  nom             TEXT,
  prenom          TEXT,
  email           TEXT NOT NULL,
  telephone       TEXT,
  message         TEXT,
  reference_bien  TEXT,                               -- ref mandat si "annonce"
  payload         JSONB DEFAULT '{}'::jsonb,          -- critères wizard
  rgpd_consent    BOOLEAN NOT NULL DEFAULT false,
  source          TEXT,                               -- pathname
  statut          TEXT DEFAULT 'nouveau',
  created_at      TIMESTAMPTZ DEFAULT now()
);

GRANT INSERT ON public.leads TO anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anonyme peut creer un lead" ON public.leads;
CREATE POLICY "Anonyme peut creer un lead"
  ON public.leads FOR INSERT TO anonymous
  WITH CHECK (rgpd_consent = true);

DROP POLICY IF EXISTS "Equipe TBEECOM lit les leads" ON public.leads;
CREATE POLICY "Equipe TBEECOM lit les leads"
  ON public.leads FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_leads_type ON public.leads(type);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- 🔒 DURCISSEMENT SÉCURITÉ — à exécuter dans Neon (SQL Editor)
-- Cette section :
--   1. RÉVOQUE tout accès anonyme direct à la table `mandats`
--      (les policies USING(true) restent valables uniquement pour
--      `authenticated` = équipe TBEECOM connectée au CRM).
--   2. Ajoute une colonne `publie` (BOOLEAN, défaut TRUE) pour piloter
--      la visibilité fine d'un bien sur le site public.
--   3. Crée une VUE `public.biens_publics` (security_invoker=on) qui
--      n'expose QUE les colonnes safe, filtrée sur
--      statut='sur_le_marche' AND publie=true.
--   4. Verrouille la table `contacts` : aucun accès anonyme.
--   5. Re-confirme les grants/policies de `leads` (insert anonyme RGPD).
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Couper l'accès direct à mandats pour les visiteurs non connectés
REVOKE ALL ON public.mandats FROM anonymous;
DROP POLICY IF EXISTS "Public peut lire biens sur le marche" ON public.mandats;

-- 2) Drapeau de publication (par défaut TRUE pour ne rien casser sur les biens
--    déjà importés ; passer à FALSE pour retirer un bien du site sans changer
--    son statut interne).
ALTER TABLE public.mandats
  ADD COLUMN IF NOT EXISTS publie BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_mandats_publie ON public.mandats(publie);

-- 3) Vue publique — SEULES colonnes safe, jamais :
--    adresse, prix_net_vendeur, honoraires_*, notes_internes,
--    suivi_par, user_id, documents, document_url, raison_vente, ...
DROP VIEW IF EXISTS public.biens_publics;
CREATE VIEW public.biens_publics
WITH (security_invoker = on) AS
SELECT
  id, reference,
  type_mandat, statut, confidentiel,
  type_commerce, sous_type, nature_activite, enseigne,
  titre, description,
  commune, code_postal, secteur,
  surface_commerciale, surface_totale, surface_reserves, surface_cuisine,
  nb_couverts_salle, nb_couverts_terrasse, lineaire_vitrine,
  conforme_erp, conforme_pmr, extraction, murs_a_vendre,
  prix_demande,
  photo_principale, photos,
  -- exposé seulement pour l'UI publique (catégorie = libellé métier)
  type_commerce AS categorie,
  created_at
FROM public.mandats
WHERE statut = 'sur_le_marche'
  AND publie = true;

GRANT SELECT ON public.biens_publics TO anonymous;
GRANT SELECT ON public.biens_publics TO authenticated;

-- 4) Contacts : aucun accès anonyme, jamais. (Sécurité explicite.)
REVOKE ALL ON public.contacts FROM anonymous;  -- no-op si pas grant, safe

-- 5) Leads — confirmation idempotente
GRANT INSERT ON public.leads TO anonymous;

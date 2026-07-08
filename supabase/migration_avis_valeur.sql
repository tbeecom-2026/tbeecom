-- ── Table avis_valeur : sauvegarde + historique des avis de valeur (estimations) ──
-- Motif RLS/GRANT identique aux tables d'équipe (mandats, bareme_honoraires) :
-- accès complet aux utilisateurs authentifiés, visible via le Neon Data API (PostgREST).
CREATE TABLE IF NOT EXISTS public.avis_valeur (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandat_id          uuid REFERENCES public.mandats(id) ON DELETE SET NULL,  -- nullable : avis hors mandat
  contact_id         uuid,
  -- Identification dénormalisée (l'historique reste lisible même si le bien évolue)
  enseigne           text,
  adresse            text,
  activite           text,
  siren              text,
  -- Reproductibilité : toutes les entrées + tout le calcul figé
  entree             jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultats          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Champs de tête pour la liste d'historique (évite de parser le jsonb)
  valeur_centrale    numeric,
  valeur_basse       numeric,
  valeur_haute       numeric,
  valeur_centrale_s2 numeric,          -- scénario 2 (déplafonnement) si applicable
  double_scenario    boolean DEFAULT false,
  fiabilite          text,             -- A | B | C | D
  curseur_retenu     numeric,          -- 0..100, le levier négociateur
  statut             text NOT NULL DEFAULT 'brouillon',   -- brouillon | finalise
  created_by         text DEFAULT auth.user_id(),         -- négociateur auteur
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE public.avis_valeur ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avis_valeur_auth_all ON public.avis_valeur;
CREATE POLICY avis_valeur_auth_all ON public.avis_valeur
  FOR ALL TO authenticated
  USING (auth.user_id() IS NOT NULL)
  WITH CHECK (auth.user_id() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avis_valeur TO authenticated;

CREATE INDEX IF NOT EXISTS idx_avis_valeur_created_by ON public.avis_valeur(created_by);
CREATE INDEX IF NOT EXISTS idx_avis_valeur_mandat     ON public.avis_valeur(mandat_id);
CREATE INDEX IF NOT EXISTS idx_avis_valeur_created_at ON public.avis_valeur(created_at DESC);

-- Recharge le cache de schéma PostgREST (Neon Data API)
NOTIFY pgrst, 'reload schema';

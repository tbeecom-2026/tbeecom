-- Migration V2 : Ajout des colonnes manquantes pour l'import Netty
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter les colonnes manquantes à la table mandats
ALTER TABLE public.mandats
  ADD COLUMN IF NOT EXISTS numero_registre INTEGER,
  ADD COLUMN IF NOT EXISTS enseigne TEXT,
  ADD COLUMN IF NOT EXISTS nature_activite TEXT,
  ADD COLUMN IF NOT EXISTS raison_vente TEXT,
  ADD COLUMN IF NOT EXISTS honoraires_charge TEXT DEFAULT 'Acquéreur',
  ADD COLUMN IF NOT EXISTS surface_totale NUMERIC,
  ADD COLUMN IF NOT EXISTS nb_couverts_salle INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_couverts_terrasse INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lineaire_vitrine NUMERIC,
  ADD COLUMN IF NOT EXISTS photo_principale TEXT,
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

-- 2. Mettre à jour les politiques RLS vers "Equipe TBEECOM" (accès total à tous les membres)
-- Mandats
DROP POLICY IF EXISTS "Users can manage own mandats" ON public.mandats;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.mandats;
CREATE POLICY "Equipe TBEECOM" ON public.mandats FOR ALL USING (true) WITH CHECK (true);

-- Contacts
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.contacts;
CREATE POLICY "Equipe TBEECOM" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

-- Recherches
DROP POLICY IF EXISTS "Users can manage own recherches" ON public.recherches;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.recherches;
CREATE POLICY "Equipe TBEECOM" ON public.recherches FOR ALL USING (true) WITH CHECK (true);

-- Mandat_vendeurs
DROP POLICY IF EXISTS "Users can manage mandat_vendeurs" ON public.mandat_vendeurs;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.mandat_vendeurs;
CREATE POLICY "Equipe TBEECOM" ON public.mandat_vendeurs FOR ALL USING (true) WITH CHECK (true);

-- Rapprochements
DROP POLICY IF EXISTS "Users can manage rapprochements" ON public.rapprochements;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.rapprochements;
CREATE POLICY "Equipe TBEECOM" ON public.rapprochements FOR ALL USING (true) WITH CHECK (true);

-- Activités
DROP POLICY IF EXISTS "Users can manage own activites" ON public.activites;
DROP POLICY IF EXISTS "Equipe TBEECOM" ON public.activites;
CREATE POLICY "Equipe TBEECOM" ON public.activites FOR ALL USING (true) WITH CHECK (true);

-- 3. Index sur numero_registre pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_mandats_numero_registre ON public.mandats(numero_registre);
CREATE INDEX IF NOT EXISTS idx_mandats_statut ON public.mandats(statut);
CREATE INDEX IF NOT EXISTS idx_mandats_type_commerce ON public.mandats(type_commerce);

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mandats'
ORDER BY ordinal_position;

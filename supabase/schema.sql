-- FDC Manager Database Schema
-- Execute this in Supabase SQL Editor

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT,
  societe TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  code_postal TEXT,
  commune TEXT,
  roles TEXT[] DEFAULT '{}',
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe TBEECOM" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

-- Mandats table
CREATE TABLE IF NOT EXISTS public.mandats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  type_mandat TEXT DEFAULT 'simple',
  statut TEXT DEFAULT 'sur_le_marche',
  confidentiel BOOLEAN DEFAULT false,
  type_commerce TEXT,
  sous_type TEXT,
  titre TEXT,
  description TEXT,
  adresse TEXT,
  code_postal TEXT,
  commune TEXT,
  secteur TEXT,
  prix_demande NUMERIC,
  prix_net_vendeur NUMERIC,
  honoraires_pct NUMERIC,
  honoraires_montant NUMERIC,
  ca_annuel NUMERIC,
  ebe NUMERIC,
  resultat_net NUMERIC,
  effectif INTEGER,
  date_bilan DATE,
  loyer_mensuel NUMERIC,
  charges_mensuelles NUMERIC,
  date_debut_bail DATE,
  date_fin_bail DATE,
  duree_bail INTEGER,
  date_renouvellement DATE,
  clause_destination TEXT,
  droit_au_bail BOOLEAN DEFAULT false,
  montant_droit_bail NUMERIC,
  surface_commerciale NUMERIC,
  surface_reserves NUMERIC,
  surface_cuisine NUMERIC,
  surface_totale NUMERIC,
  nb_couverts_salle INTEGER DEFAULT 0,
  nb_couverts_terrasse INTEGER DEFAULT 0,
  lineaire_vitrine NUMERIC,
  conforme_erp BOOLEAN DEFAULT false,
  conforme_pmr BOOLEAN DEFAULT false,
  extraction BOOLEAN DEFAULT false,
  murs_a_vendre BOOLEAN DEFAULT false,
  date_sur_le_marche DATE,
  date_sous_compromis DATE,
  date_vendu DATE,
  date_retire DATE,
  cles BOOLEAN DEFAULT false,
  notes_internes TEXT,
  suivi_par TEXT,
  -- Champs spécifiques fonds de commerce
  numero_registre INTEGER,
  enseigne TEXT,
  nature_activite TEXT,
  raison_vente TEXT,
  honoraires_charge TEXT DEFAULT 'Acquéreur',
  photo_principale TEXT,
  photos TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mandats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe TBEECOM" ON public.mandats FOR ALL USING (true) WITH CHECK (true);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_mandats_numero_registre ON public.mandats(numero_registre);
CREATE INDEX IF NOT EXISTS idx_mandats_statut ON public.mandats(statut);
CREATE INDEX IF NOT EXISTS idx_mandats_type_commerce ON public.mandats(type_commerce);

-- Recherches (acquéreurs)
CREATE TABLE IF NOT EXISTS public.recherches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  budget_min NUMERIC,
  budget_max NUMERIC,
  apport NUMERIC,
  droit_bail_max NUMERIC,
  financement_bancaire BOOLEAN DEFAULT false,
  types_commerce TEXT[] DEFAULT '{}',
  activites_libres TEXT,
  villes TEXT[] DEFAULT '{}',
  departements TEXT[] DEFAULT '{}',
  rayon_km INTEGER,
  surface_min NUMERIC,
  surface_max NUMERIC,
  conforme_erp BOOLEAN,
  conforme_pmr BOOLEAN,
  extraction BOOLEAN,
  murs_souhaites BOOLEAN,
  statut TEXT DEFAULT 'actif',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recherches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe TBEECOM" ON public.recherches FOR ALL USING (true) WITH CHECK (true);

-- Mandat-Vendeurs liaison
CREATE TABLE IF NOT EXISTS public.mandat_vendeurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandat_id UUID REFERENCES public.mandats(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(mandat_id, contact_id)
);

ALTER TABLE public.mandat_vendeurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe TBEECOM" ON public.mandat_vendeurs FOR ALL USING (true) WITH CHECK (true);

-- Rapprochements
CREATE TABLE IF NOT EXISTS public.rapprochements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recherche_id UUID REFERENCES public.recherches(id) ON DELETE CASCADE NOT NULL,
  mandat_id UUID REFERENCES public.mandats(id) ON DELETE CASCADE NOT NULL,
  statut TEXT DEFAULT 'propose',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rapprochements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe TBEECOM" ON public.rapprochements FOR ALL USING (true) WITH CHECK (true);

-- Activités
CREATE TABLE IF NOT EXISTS public.activites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  mandat_id UUID REFERENCES public.mandats(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe TBEECOM" ON public.activites FOR ALL USING (true) WITH CHECK (true);

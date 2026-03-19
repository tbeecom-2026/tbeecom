export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  nom: string;
  prenom: string | null;
  societe: string | null;
  email: string | null;
  telephone: string | null;
  telephone_fixe: string | null;
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
  roles: string[];
  notes: string | null;
  // ── Infos juridiques (renseignées via SIRET / API Sirene) ──
  siret: string | null;
  siren: string | null;
  tva_intracommunautaire: string | null;
  forme_juridique: string | null;
  libelle_forme_juridique: string | null;
  capital_social: number | null;
  code_naf: string | null;
  libelle_naf: string | null;
  date_creation_societe: string | null;
  nom_dirigeant: string | null;
  site_web: string | null;
  created_at: string;
  user_id: string;
}

export interface Mandat {
  id: string;
  reference: string;
  type_mandat: string;
  statut: string;
  confidentiel: boolean;
  type_commerce: string;
  sous_type: string | null;
  titre: string;
  description: string | null;
  adresse: string | null;
  code_postal: string | null;
  commune: string;
  secteur: string | null;
  prix_demande: number | null;
  prix_net_vendeur: number | null;
  honoraires_pct: number | null;
  honoraires_montant: number | null;
  ca_annuel: number | null;
  ebe: number | null;
  resultat_net: number | null;
  effectif: number | null;
  date_bilan: string | null;
  loyer_mensuel: number | null;
  charges_mensuelles: number | null;
  date_debut_bail: string | null;
  date_fin_bail: string | null;
  duree_bail: number | null;
  date_renouvellement: string | null;
  clause_destination: string | null;
  droit_au_bail: boolean;
  montant_droit_bail: number | null;
  surface_commerciale: number | null;
  surface_reserves: number | null;
  surface_cuisine: number | null;
  conforme_erp: boolean;
  conforme_pmr: boolean;
  extraction: boolean;
  murs_a_vendre: boolean;
  date_sur_le_marche: string | null;
  date_sous_compromis: string | null;
  date_vendu: string | null;
  date_retire: string | null;
  cles: boolean;
  notes_internes: string | null;
  suivi_par: string | null;
  created_at: string;
  user_id: string;
}

export interface Recherche {
  id: string;
  contact_id: string;
  budget_min: number | null;
  budget_max: number | null;
  apport: number | null;
  droit_bail_max: number | null;
  financement_bancaire: boolean;
  types_commerce: string[];
  activites_libres: string | null;
  villes: string[];
  departements: string[];
  rayon_km: number | null;
  surface_min: number | null;
  surface_max: number | null;
  conforme_erp: boolean | null;
  conforme_pmr: boolean | null;
  extraction: boolean | null;
  murs_souhaites: boolean | null;
  statut: string;
  created_at: string;
  user_id: string;
  contact?: Contact;
}

export interface MandatVendeur {
  id: string;
  mandat_id: string;
  contact_id: string;
  contact?: Contact;
}

export interface Rapprochement {
  id: string;
  recherche_id: string;
  mandat_id: string;
  statut: string;
  notes: string | null;
  created_at: string;
  mandat?: Mandat;
}

export interface Activite {
  id: string;
  type: string;
  description: string;
  mandat_id: string | null;
  contact_id: string | null;
  user_id: string;
  created_at: string;
  mandat?: Mandat;
  contact?: Contact;
  profile?: Profile;
}

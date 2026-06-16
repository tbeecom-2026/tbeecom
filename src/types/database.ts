// ============================================================
// Types alignés sur la base Neon réelle (généré le 16/06/2026)
// Source de vérité : neon_schema.sql + v2 + registre_mandats.sql
// 'donnees_brutes'/'attributs' = JSONB ; champs *_compat = optionnels (legacy app)
// ============================================================

export interface Contact {
  id: string;
  nom: string | null;
  prenom: string | null;
  societe: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
  roles: string[] | null;
  notes: string | null;
  user_id: string | null;
  created_at: string | null;
  civilite: string | null;
  forme_juridique: string | null;
  siret: string | null;
  rcs: string | null;
  num_tva: string | null;
  fonction: string | null;
  email_secondaire: string | null;
  tel_fixe: string | null;
  tel_portable: string | null;
  tel_pro: string | null;
  fax: string | null;
  langue: string | null;
  complement_adresse: string | null;
  date_naissance: string | null;
  commune_naissance: string | null;
  situation_familiale: string | null;
  regime_matrimonial: string | null;
  origine: string | null;
  origine_detail: string | null;
  observations: string | null;
  prive: string | null;
  stop_telephone: string | null;
  stop_mail: string | null;
  suivi_par: string | null;
  agence: string | null;
  archive: string | null;
  type_contact: string | null;
  donnees_brutes: Record<string, unknown> | null;
  // legacy / optionnels utilisés ailleurs dans l'app :
  telephone_fixe?: string | null;
  siren?: string | null;
  tva_intracommunautaire?: string | null;
  libelle_forme_juridique?: string | null;
  capital_social?: number | null;
  code_naf?: string | null;
  libelle_naf?: string | null;
  date_creation_societe?: string | null;
  nom_dirigeant?: string | null;
  site_web?: string | null;
}

export interface Mandat {
  id: string;
  reference: string | null;
  type_mandat: string | null;
  statut: string | null;
  confidentiel: boolean | null;
  type_commerce: string | null;
  sous_type: string | null;
  titre: string | null;
  description: string | null;
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
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
  droit_au_bail: boolean | null;
  montant_droit_bail: number | null;
  surface_commerciale: number | null;
  surface_reserves: number | null;
  surface_cuisine: number | null;
  surface_totale: number | null;
  nb_couverts_salle: number | null;
  nb_couverts_terrasse: number | null;
  lineaire_vitrine: number | null;
  conforme_erp: boolean | null;
  conforme_pmr: boolean | null;
  extraction: boolean | null;
  murs_a_vendre: boolean | null;
  date_sur_le_marche: string | null;
  date_sous_compromis: string | null;
  date_vendu: string | null;
  date_retire: string | null;
  cles: boolean | null;
  notes_internes: string | null;
  suivi_par: string | null;
  numero_registre: number | null;
  enseigne: string | null;
  nature_activite: string | null;
  raison_vente: string | null;
  honoraires_charge: string | null;
  photo_principale: string | null;
  photos: string[] | null;
  user_id: string | null;
  created_at: string | null;
  categorie: string | null;
  prix_murs: number | null;
  licence: string | null;
  proprietaire_nom: string | null;
  proprietaire_societe: string | null;
  proprietaire_email: string | null;
  proprietaire_tel: string | null;
  classe_dpe: string | null;
  classe_ges: string | null;
  agence: string | null;
  publie: string | null;
  repartition_surface: string | null;
  horaires_ouverture: string | null;
  vitrines: string | null;
  attributs: Record<string, unknown> | null;
  donnees_brutes: Record<string, unknown> | null;
  mandat_numero: string | null;
  mandat_date_debut: string | null;
  mandat_date_fin: string | null;
  mandant_nom: string | null;
  numero_repertoire: string | null;
  mandat_objet: string | null;
  mandat_negociateur: string | null;
  // legacy / optionnels :
  documents?: unknown[] | null;
  document_url?: string | null;
}

export interface Recherche {
  id: string;
  contact_id: string | null;
  budget_min: number | null;
  budget_max: number | null;
  apport: number | null;
  droit_bail_max: number | null;
  financement_bancaire: boolean | null;
  types_commerce: string[] | null;
  activites_libres: string | null;
  villes: string[] | null;
  departements: string[] | null;
  rayon_km: number | null;
  surface_min: number | null;
  surface_max: number | null;
  conforme_erp: boolean | null;
  conforme_pmr: boolean | null;
  extraction: boolean | null;
  murs_souhaites: boolean | null;
  statut: string | null;
  user_id: string | null;
  created_at: string | null;
  contact_nom: string | null;
  contact_prenom: string | null;
  contact_email: string | null;
  contact_telephone: string | null;
  entreprise: string | null;
  secteur: string | null;
  type_commerce: string | null;
  type_recherche: string | null;
  priorite: string | null;
  negociateur: string | null;
  observations: string | null;
  donnees_brutes: Record<string, unknown> | null;
  contact?: Contact;
}

export interface RegistreMandat {
  id: string;
  numero: string | null;
  dates_mandat: string | null;
  date_debut: string | null;
  date_fin: string | null;
  mandant_nom: string | null;
  mandant_adresse: string | null;
  objet: string | null;
  type_mandat: string | null;
  reference_bien: string | null;
  nature_situation: string | null;
  numero_repertoire: string | null;
  observations: string | null;
  negociateur: string | null;
  created_at: string | null;
  mandat?: Mandat;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
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
  recherche?: Recherche;
}
export interface Activite {
  id: string;
  type: string;
  description: string;
  mandat_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  created_at: string;
  mandat?: Mandat;
  contact?: Contact;
  profile?: Profile;
}
export interface BaremeHonoraire {
  id: string;
  ordre: number | null;
  type_trans: string | null;
  prix_min: number | null;
  prix_max: number | null;
  type_calcul: string | null;
  valeur: number | null;
  libelle: string | null;
  created_at: string;
}

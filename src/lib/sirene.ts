/**
 * sirene.ts
 * Recherche d'entreprise via l'API Recherche Entreprises (recherche-entreprises.api.gouv.fr)
 * Entièrement gratuit, sans clé API, données officielles INSEE/SIRENE/RNE
 */

import type { Contact } from "@/types/database";

const API_BASE = "https://recherche-entreprises.api.gouv.fr";

export interface SireneResult {
  societe: string;
  siret: string;
  siren: string;
  tva_intracommunautaire: string | null;
  forme_juridique: string | null;
  libelle_forme_juridique: string | null;
  capital_social: number | null;
  code_naf: string | null;
  libelle_naf: string | null;
  date_creation_societe: string | null;
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
  nom_dirigeant: string | null;
  prenom_dirigeant: string | null;
}

/**
 * Nettoie les doublons de nom type "ANGLARET (ANGLARET)" → "ANGLARET"
 */
function cleanNom(nom: string | null): string | null {
  if (!nom) return null;
  return nom.replace(/\s*\(.*?\)\s*/g, "").trim() || nom.trim();
}

/**
 * Recherche principale — accepte SIREN (9 chiffres) ou SIRET (14 chiffres)
 */
async function searchEntreprise(query: string): Promise<SireneResult> {
  const clean = query.replace(/\s/g, "");
  const res = await fetch(
    `${API_BASE}/search?q=${encodeURIComponent(clean)}&page=1&per_page=1`,
    { headers: { Accept: "application/json" } }
  );

  if (!res.ok) {
    throw new Error(`Erreur API (${res.status}) — réessayez dans quelques secondes.`);
  }

  const data = await res.json();
  const r = data?.results?.[0];

  if (!r) throw new Error(`Entreprise introuvable pour "${clean}".`);

  const siege = r.siege ?? {};

  // Adresse
  const adresseLigne = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
    .filter(Boolean).join(" ") || siege.geo_adresse || siege.adresse || null;
  const codePostal = siege.code_postal ?? null;
  const commune = siege.libelle_commune ?? null;

  // Dirigeant (premier de la liste)
  const dirigeants: any[] = r.dirigeants ?? [];
  const dirigeant = dirigeants[0] ?? null;
  const prenomDir = dirigeant?.prenoms ?? null;
  const nomDir = cleanNom(dirigeant?.nom ?? null);

  // Forme juridique
  const formeJur = r.nature_juridique ?? null;
  const libelleFormeJur = resolveFormeJuridique(formeJur);

  // NAF
  const codeNaf = r.activite_principale ?? siege.activite_principale ?? null;
  const libelleNaf = resolveNaf(codeNaf);

  // TVA calculée depuis le SIREN (formule officielle)
  const siren = r.siren ?? clean.substring(0, 9);
  const tva = siren ? computeTva(siren) : null;

  // Capital social — tentative via l'API entreprise détaillée
  let capital: number | null = null;
  try {
    const capRes = await fetch(
      `https://api.annuaire-entreprises.data.gouv.fr/entreprise/${siren}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) }
    );
    if (capRes.ok) {
      const capData = await capRes.json();
      if (capData?.capital_social != null) capital = Number(capData.capital_social);
    }
  } catch {
    // API non accessible depuis cet environnement — capital à saisir manuellement
  }

  return {
    societe: r.nom_raison_sociale ?? r.nom_complet ?? clean,
    siret: siege.siret ?? clean,
    siren,
    tva_intracommunautaire: tva,
    forme_juridique: formeJur,
    libelle_forme_juridique: libelleFormeJur,
    capital_social: capital,
    code_naf: codeNaf,
    libelle_naf: libelleNaf,
    date_creation_societe: r.date_creation ?? siege.date_creation ?? null,
    adresse: adresseLigne,
    code_postal: codePostal,
    commune,
    nom_dirigeant: nomDir ? `${prenomDir ?? ""} ${nomDir}`.trim() : null,
    prenom_dirigeant: prenomDir,
  };
}

/**
 * Calcule le numéro TVA intracommunautaire depuis le SIREN
 * Formule officielle : FR + clé (2 chiffres) + SIREN
 */
function computeTva(siren: string): string | null {
  if (!/^\d{9}$/.test(siren)) return null;
  const cle = (12 + 3 * (parseInt(siren) % 97)) % 97;
  return `FR${String(cle).padStart(2, "0")}${siren}`;
}

/**
 * Recherche par SIREN (9 chiffres)
 */
export async function lookupSiren(siren: string): Promise<SireneResult> {
  const clean = siren.replace(/\s/g, "");
  if (clean.length !== 9 || !/^\d+$/.test(clean)) {
    throw new Error("Le SIREN doit contenir exactement 9 chiffres.");
  }
  return searchEntreprise(clean);
}

/**
 * Recherche par SIRET (14 chiffres)
 */
export async function lookupSiret(siret: string): Promise<SireneResult> {
  const clean = siret.replace(/\s/g, "");
  if (clean.length !== 14 || !/^\d+$/.test(clean)) {
    throw new Error("Le SIRET doit contenir exactement 14 chiffres.");
  }
  return searchEntreprise(clean);
}

/**
 * Formes juridiques courantes (code INSEE → libellé)
 */
function resolveFormeJuridique(code: string | null): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    "1000": "Entrepreneur individuel",
    "1100": "Artisan-commerçant",
    "5410": "SARL à associé unique (EURL)",
    "5498": "EURL",
    "5499": "SARL",
    "5505": "SA à directoire",
    "5510": "SA à conseil d'administration",
    "5710": "SAS",
    "5720": "SASU",
    "5800": "Groupement d'intérêt économique",
    "6540": "SA",
    "9220": "Association loi 1901",
  };
  return map[code] ?? `Code ${code}`;
}

/**
 * Codes NAF courants → libellé activité
 */
function resolveNaf(code: string | null): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    "47.76Z": "Commerce de détail de fleurs, plantes, graines, engrais",
    "56.10A": "Restauration traditionnelle",
    "56.10B": "Cafétérias et libres-services",
    "56.30Z": "Débits de boissons",
    "47.11B": "Commerce d'alimentation générale",
    "47.11C": "Supérettes",
    "47.11D": "Supermarchés",
    "47.11F": "Hypermarchés",
    "47.19B": "Grandes surfaces spécialisées",
    "47.25Z": "Commerce de détail de boissons",
    "47.26Z": "Commerce de détail de produits à base de tabac",
    "45.11Z": "Commerce de voitures et véhicules légers",
    "45.20A": "Entretien et réparation de véhicules",
    "55.10Z": "Hôtels et hébergement similaire",
    "47.41Z": "Commerce informatique et équipements",
    "47.71Z": "Commerce de détail d'habillement",
    "47.72A": "Commerce de détail de chaussures",
    "47.78A": "Commerce d'articles de bijouterie",
    "82.30Z": "Organisation de salons professionnels",
    "86.21Z": "Médecine générale",
  };
  return map[code] ?? null;
}

/**
 * Merge les données Sirene dans un objet Contact partiel
 */
export function sireneToContact(result: SireneResult): Partial<Contact> {
  return {
    societe: result.societe,
    siret: result.siret,
    siren: result.siren,
    tva_intracommunautaire: result.tva_intracommunautaire,
    forme_juridique: result.forme_juridique,
    libelle_forme_juridique: result.libelle_forme_juridique,
    capital_social: result.capital_social,
    code_naf: result.code_naf,
    libelle_naf: result.libelle_naf,
    date_creation_societe: result.date_creation_societe,
    adresse: result.adresse,
    code_postal: result.code_postal,
    commune: result.commune,
    nom_dirigeant: result.nom_dirigeant,
  };
}

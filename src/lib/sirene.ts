/**
 * sirene.ts
 * Recherche d'entreprise via l'API Annuaire des Entreprises (data.gouv.fr)
 * Entièrement gratuit, sans clé API, données officielles INSEE/SIRENE
 */

import type { Contact } from "@/types/database";

const API_BASE = "https://api.annuaire-entreprises.data.gouv.fr";

export interface SireneResult {
  // Champs mappés vers Contact
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
 * Recherche par SIREN (9 chiffres) — retourne les infos du siège social
 */
export async function lookupSiren(siren: string): Promise<SireneResult> {
  const clean = siren.replace(/\s/g, "");
  if (clean.length !== 9 || !/^\d+$/.test(clean)) {
    throw new Error("Le SIREN doit contenir exactement 9 chiffres.");
  }

  const res = await fetch(`${API_BASE}/entreprise/${clean}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(`SIREN ${clean} introuvable dans la base SIRENE.`);
    throw new Error(`Erreur API (${res.status}) — réessayez dans quelques secondes.`);
  }

  const d = await res.json();

  // Le siège social est dans d.siege
  const siege = d.siege ?? {};
  const siretSiege = siege.siret ?? (clean + "00001");

  const adresseLigne =
    [siege.numero_voie, siege.type_voie, siege.libelle_voie]
      .filter(Boolean).join(" ") ||
    siege.adresse || null;
  const codePostal = siege.code_postal ?? null;
  const commune = siege.libelle_commune ?? siege.commune ?? null;

  const dirigeants: any[] = d.dirigeants ?? [];
  const dirigeant = dirigeants[0] ?? null;
  const prenomDir = dirigeant?.prenom_usuel ?? dirigeant?.prenoms ?? dirigeant?.prenom ?? null;
  const nomDir = dirigeant?.nom ?? null;

  const formeJur = d.nature_juridique ?? null;
  const libelleFormeJur = d.libelle_nature_juridique ?? resolveFormeJuridique(formeJur);
  const codeNaf = d.activite_principale ?? siege.activite_principale ?? null;
  const libelleNaf = d.libelle_activite_principale ?? siege.libelle_activite_principale ?? null;
  const capital = d.capital_social != null ? Number(d.capital_social) : null;
  const tva = d.numero_tva_intracommunautaire ?? null;
  const dateCrea = d.date_creation ?? null;

  return {
    societe: d.nom_complet ?? d.nom_raison_sociale ?? d.denomination ?? clean,
    siret: siretSiege,
    siren: clean,
    tva_intracommunautaire: tva,
    forme_juridique: formeJur,
    libelle_forme_juridique: libelleFormeJur,
    capital_social: capital,
    code_naf: codeNaf,
    libelle_naf: libelleNaf,
    date_creation_societe: dateCrea,
    adresse: adresseLigne,
    code_postal: codePostal,
    commune,
    nom_dirigeant: nomDir ? `${prenomDir ?? ""} ${nomDir}`.trim() : null,
    prenom_dirigeant: prenomDir,
  };
}

/**
 * Recherche un établissement par SIRET (14 chiffres)
 * Retourne les champs prêts à merger dans un Contact
 */
export async function lookupSiret(siret: string): Promise<SireneResult> {
  const clean = siret.replace(/\s/g, "");
  if (clean.length !== 14 || !/^\d+$/.test(clean)) {
    throw new Error("Le SIRET doit contenir exactement 14 chiffres.");
  }

  const res = await fetch(`${API_BASE}/etablissement/${clean}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(`SIRET ${clean} introuvable dans la base SIRENE.`);
    throw new Error(`Erreur API (${res.status}) — réessayez dans quelques secondes.`);
  }

  const d = await res.json();

  // ── Adresse ────────────────────────────────────────────────────────────
  const siege = d.siege ?? d.adresse_etablissement ?? {};
  const adresseLigne =
    [siege.numero_voie, siege.type_voie, siege.libelle_voie]
      .filter(Boolean).join(" ") ||
    siege.adresse ||
    d.adresse ||
    null;
  const codePostal = siege.code_postal ?? siege.code_postal_cedex ?? null;
  const commune =
    siege.libelle_commune ??
    siege.commune ??
    d.commune ??
    null;

  // ── Dirigeant ──────────────────────────────────────────────────────────
  const dirigeants: any[] = d.dirigeants ?? d.representants ?? [];
  const dirigeant = dirigeants[0] ?? null;
  const prenomDir =
    dirigeant?.prenom_usuel ??
    dirigeant?.prenoms ??
    dirigeant?.prenom ??
    null;
  const nomDir = dirigeant?.nom ?? null;

  // ── Forme juridique ────────────────────────────────────────────────────
  const formeJur = d.nature_juridique ?? d.forme_juridique ?? null;
  const libelleFormeJur =
    d.libelle_nature_juridique ??
    d.libelle_forme_juridique ??
    resolveFormeJuridique(formeJur);

  // ── NAF ────────────────────────────────────────────────────────────────
  const codeNaf =
    d.activite_principale ??
    siege.activite_principale ??
    null;
  const libelleNaf =
    d.libelle_activite_principale ??
    siege.libelle_activite_principale ??
    null;

  // ── Capital ────────────────────────────────────────────────────────────
  const capital =
    d.capital_social != null ? Number(d.capital_social) : null;

  // ── TVA ────────────────────────────────────────────────────────────────
  const tva = d.numero_tva_intracommunautaire ?? d.numero_tva ?? null;

  // ── Date création ──────────────────────────────────────────────────────
  const dateCrea = d.date_creation ?? siege.date_debut_activite ?? null;

  return {
    societe: d.nom_complet ?? d.nom_raison_sociale ?? d.denomination ?? clean,
    siret: clean,
    siren: d.siren ?? clean.substring(0, 9),
    tva_intracommunautaire: tva,
    forme_juridique: formeJur,
    libelle_forme_juridique: libelleFormeJur,
    capital_social: capital,
    code_naf: codeNaf,
    libelle_naf: libelleNaf,
    date_creation_societe: dateCrea,
    adresse: adresseLigne,
    code_postal: codePostal,
    commune,
    nom_dirigeant: nomDir ? `${prenomDir ?? ""} ${nomDir}`.trim() : null,
    prenom_dirigeant: prenomDir,
  };
}

/**
 * Formes juridiques courantes (code INSEE → libellé)
 */
function resolveFormeJuridique(code: string | null): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    "1000": "Entrepreneur individuel",
    "5499": "SARL",
    "5710": "SAS",
    "5720": "SASU",
    "5498": "EURL",
    "6540": "SA",
    "9220": "Association loi 1901",
  };
  return map[code] ?? null;
}

/**
 * Merge les données Sirene dans un objet Contact partiel
 */
export function sireneToContact(
  result: SireneResult
): Partial<Contact> {
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
    // Dirigeant → prérempli dans nom/prenom si le contact est vide
    nom_dirigeant: result.nom_dirigeant,
  };
}

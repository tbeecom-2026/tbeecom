// src/lib/prospection.ts
// Moteur de prospection TBEECOM — leads qualifiés depuis les API publiques gratuites.
//   • Commerces réels d'une zone : Annuaire des Entreprises (recherche-entreprises)
//   • Difficultés (procédures collectives vivantes) : BODACC
//   • Croisement par SIREN, calcul de l'âge du dirigeant, score 0–100.
// Zone = code postal OU code commune (INSEE) OU département entier.
// Appelable directement depuis le front (les 2 API sont gratuites, sans clé, CORS ouvert).
// Voir PROSPECTION_SPEC.md. Réutilise familleMetier() de metier.ts.

import { familleMetier, METIER_LABEL, type FamilleMetier } from "@/lib/metier";

const API_ENTREPRISES = "https://recherche-entreprises.api.gouv.fr/search";
const API_BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

// Plafond de pages Annuaire (25/page) : un département d'une activité courante peut être énorme.
const MAX_PAGES = 12; // -> 300 commerces max ; au-delà on tronque (affiner la zone/activité).

// Familles métier -> codes NAF représentatifs (pour le filtre activite_principale).
export const NAF_PAR_FAMILLE: Record<FamilleMetier, string[]> = {
  restauration_assise: ["56.10A"],
  restauration_rapide: ["56.10C"],
  bar_cafe_tabac: ["56.30Z"],
  boulangerie_patisserie: ["10.71C", "10.71D", "47.24Z"],
  fleuriste: ["47.76Z"],
  coiffure_esthetique: ["96.02A", "96.02B"],
  garage_carrosserie: ["45.20A", "45.20B", "45.11Z"],
  autre: [],
  non_precise: [],
};

export type EtatDifficulte = "sain" | "redressement" | "liquidation" | "avis_en_cours";

// Zone géographique : renseigne UN des trois (priorité CP > commune > département).
export interface Zone {
  codePostal?: string; // ex. "75002"
  codeCommune?: string; // INSEE, ex. "92073" (Suresnes)
  departement?: string; // ex. "92"
}

export interface Prospect {
  siren: string | null;
  denomination: string | null;
  naf: string | null;
  famille_metier: FamilleMetier;
  famille_label: string;
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
  dirigeant_nom: string | null;
  dirigeant_annee_naissance: number | null;
  dirigeant_age: number | null;
  dirigeant_qualite: string | null;
  etat: EtatDifficulte;
  bodacc_id: string | null;
  bodacc_date: string | null;
  mandataire: string | null;
  date_creation: string | null;
  anciennete_annees: number | null;
  nombre_etablissements: number | null;
  categorie_entreprise: string | null;
  domiciliation_probable: boolean;
  score: number;
  score_detail: { age: number; difficulte: number; anciennete: number };
}

export interface ResultatProspection {
  prospects: Prospect[];
  total_commerces: number; // nb de commerces analysés dans la zone
  tronque: boolean; // true si on a atteint le plafond (zone trop large)
}

const ANNEE = new Date().getFullYear();
const digits = (s: any) => String(s ?? "").replace(/\D/g, "");

// ---------- Géo : paramètre Annuaire + clause BODACC ----------
function paramEntreprises(z: Zone): [string, string] | null {
  if (z.codePostal) return ["code_postal", digits(z.codePostal).slice(0, 5)];
  if (z.codeCommune) return ["code_commune", digits(z.codeCommune).slice(0, 5)];
  if (z.departement) return ["departement", digits(z.departement).slice(0, 3)];
  return null;
}
function whereBodacc(z: Zone): string {
  if (z.codePostal) return `cp="${digits(z.codePostal).slice(0, 5)}"`;
  // commune ou département -> on scope au département (le match par SIREN affine ensuite)
  const dep = z.departement ? digits(z.departement).slice(0, 3) : digits(z.codeCommune).slice(0, 2);
  return `numerodepartement="${dep}"`;
}
// Établissement réellement situé dans la zone (≠ siège, qui peut être ailleurs).
function etabZone(e: any, z: Zone): any {
  const ms: any[] = e?.matching_etablissements ?? [];
  const ok = (m: any) => {
    if (z.codePostal) return m?.code_postal === digits(z.codePostal).slice(0, 5);
    if (z.codeCommune) return m?.commune === digits(z.codeCommune).slice(0, 5);
    if (z.departement) return String(m?.code_postal ?? "").slice(0, 2) === digits(z.departement).slice(0, 2);
    return true;
  };
  return ms.find((m) => ok(m) && m?.etat_administratif === "A") ?? ms.find(ok) ?? ms[0] ?? e?.siege ?? null;
}

// ---------- Dirigeant exploitant (personne physique, gérant/président) ----------
function extraireDirigeant(dirigeants: any[]): { nom: string; annee: number | null; qualite: string } | null {
  if (!Array.isArray(dirigeants)) return null;
  const pp = dirigeants.filter(
    (d) =>
      d?.type_dirigeant === "personne physique" &&
      !/commissaire/i.test(d?.qualite ?? "") &&
      /g[ée]rant|pr[ée]sident|exploitant|associ[ée]|directeur g/i.test(d?.qualite ?? ""),
  );
  const pool = pp.length
    ? pp
    : dirigeants.filter((d) => d?.type_dirigeant === "personne physique" && !/commissaire/i.test(d?.qualite ?? ""));
  if (!pool.length) return null;
  pool.sort((a, b) => Number(a?.annee_de_naissance ?? 9999) - Number(b?.annee_de_naissance ?? 9999));
  const d = pool[0];
  const annee = d?.annee_de_naissance ? Number(d.annee_de_naissance) : null;
  const nom = [d?.prenoms, d?.nom].filter(Boolean).join(" ").trim() || null;
  return { nom: nom ?? "", annee, qualite: d?.qualite ?? "" };
}

// ---------- Score 0–100 ----------
// Garde-fou : un âge > 92 ans est jugé NON fiable (fiche périmée) -> pas de points d'âge.
export function scoreProspect(p: Partial<Prospect>): { score: number; detail: Prospect["score_detail"] } {
  let age = 0;
  const a = p.dirigeant_age ?? 0;
  if (a > 92) age = 0;
  else if (a >= 70) age = 45;
  else if (a >= 65) age = 35;
  else if (a >= 60) age = 25;

  let difficulte = 0;
  if (p.etat === "redressement") difficulte = 40;
  else if (p.etat === "liquidation") difficulte = 30;
  else if (p.etat === "avis_en_cours") difficulte = 20;

  let anciennete = 0;
  const anc = p.anciennete_annees ?? 0;
  if (anc >= 25) anciennete = 25;
  else if (anc >= 15) anciennete = 15;

  return { score: Math.min(100, age + difficulte + anciennete), detail: { age, difficulte, anciennete } };
}

// ---------- Étape 1 : commerces réels d'une zone (Annuaire) ----------
async function chercherCommerces(nafCodes: string[], z: Zone): Promise<{ liste: any[]; tronque: boolean }> {
  const naf = nafCodes.join(",");
  const geo = paramEntreprises(z);
  const out: any[] = [];
  let tronque = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ etat_administratif: "A", per_page: "25", page: String(page) });
    if (geo) params.set(geo[0], geo[1]);
    if (naf) params.set("activite_principale", naf);
    const r = await fetch(`${API_ENTREPRISES}?${params}`);
    if (!r.ok) break;
    const data = await r.json();
    const res = data?.results ?? [];
    out.push(...res);
    if (res.length < 25 || page >= (data?.total_pages ?? 1)) break;
    if (page === MAX_PAGES && (data?.total_pages ?? 1) > MAX_PAGES) tronque = true;
  }
  return { liste: out, tronque };
}

// ---------- Étape 2 : difficultés vivantes d'une zone (BODACC) ----------
async function chercherDifficultes(z: Zone): Promise<Map<string, any>> {
  const where = `familleavis="collective" and ${whereBodacc(z)}`;
  const url = `${API_BODACC}?where=${encodeURIComponent(where)}&order_by=${encodeURIComponent("dateparution desc")}&limit=100`;
  const map = new Map<string, any>();
  const r = await fetch(url);
  if (!r.ok) return map;
  const data = await r.json();
  const adresseCount: Record<string, number> = {};

  for (const rec of data?.results ?? []) {
    let jug: any = null,
      pers: any = null;
    try {
      jug = rec.jugement ? JSON.parse(rec.jugement) : null;
    } catch {}
    try {
      pers = rec.listepersonnes ? JSON.parse(rec.listepersonnes) : null;
    } catch {}
    const famille = jug?.famille ?? "";
    const nature = (jug?.nature ?? "").toLowerCase();
    if (/cl[oô]ture/i.test(famille)) continue; // on ne garde QUE les procédures vivantes
    let etat: EtatDifficulte | null = null;
    if (/ouverture/i.test(famille)) etat = nature.includes("redressement") ? "redressement" : "liquidation";
    else if (/avis|d[ée]p[oô]t/i.test(famille)) etat = "avis_en_cours";
    if (!etat) continue;

    const siren =
      digits(Array.isArray(rec.registre) ? rec.registre[0] : "") ||
      digits(pers?.personne?.numeroImmatriculation?.numeroIdentification);
    if (!siren) continue;
    const adr = pers?.personne?.adresseSiegeSocial;
    const adrTxt = adr
      ? [adr.numeroVoie, adr.typeVoie, adr.nomVoie, adr.codePostal, adr.ville].filter(Boolean).join(" ")
      : null;
    if (adrTxt) adresseCount[adrTxt] = (adresseCount[adrTxt] ?? 0) + 1;

    if (!map.has(siren)) {
      map.set(siren, {
        etat,
        bodacc_id: rec.id,
        bodacc_date: rec.dateparution,
        mandataire: jug?.complementJugement ?? null,
        adresse: adrTxt,
      });
    }
  }
  for (const v of map.values()) {
    if (v.adresse && adresseCount[v.adresse] > 3) v.domiciliation_probable = true;
  }
  return map;
}

// ---------- Orchestrateur : recherche de prospects ----------
export interface FiltresProspection {
  familles: FamilleMetier[]; // familles métier ciblées
  zone: Zone; // CP, commune INSEE ou département
  ageMin?: number; // âge dirigeant minimum (filtre côté appli)
  ancienneteMin?: number; // ancienneté minimale (années)
  enDifficulteUniquement?: boolean;
  scoreMin?: number;
}

export async function rechercherProspects(f: FiltresProspection): Promise<ResultatProspection> {
  const nafCodes = [...new Set(f.familles.flatMap((fam) => NAF_PAR_FAMILLE[fam] ?? []))];
  const [{ liste: commerces, tronque }, diff] = await Promise.all([
    chercherCommerces(nafCodes, f.zone),
    chercherDifficultes(f.zone),
  ]);

  const out: Prospect[] = [];
  const vus = new Set<string>();

  for (const e of commerces) {
    const siren = e?.siren ?? null;
    if (siren && vus.has(siren)) continue;
    if (siren) vus.add(siren);

    // garde-fou chaînes
    const nbEt = e?.nombre_etablissements ?? 1;
    const cat = e?.categorie_entreprise ?? null;
    if (nbEt > 5 || cat === "ETI" || cat === "GE") continue;

    const dir = extraireDirigeant(e?.dirigeants ?? []);
    const age = dir?.annee ? ANNEE - dir.annee : null;
    const naf = e?.activite_principale ?? e?.siege?.activite_principale ?? null;
    const fam =
      familleMetier(null, naf) === "non_precise" ? familleMetier(e?.nom_complet, naf) : familleMetier(null, naf);
    const dateCrea = e?.date_creation ?? null;
    const anc = dateCrea ? ANNEE - Number(String(dateCrea).slice(0, 4)) : null;
    const d = siren ? diff.get(siren) : null;
    const etat: EtatDifficulte = d?.etat ?? "sain";
    const etab = etabZone(e, f.zone); // l'établissement DANS la zone (vrai local), pas le siège

    // filtres
    if (f.enDifficulteUniquement && etat === "sain") continue;
    if (f.ageMin != null && (age == null || age < f.ageMin)) continue;
    if (f.ancienneteMin != null && (anc == null || anc < f.ancienneteMin)) continue;

    const base: Partial<Prospect> = { dirigeant_age: age, etat, anciennete_annees: anc };
    const { score, detail } = scoreProspect(base);
    if (f.scoreMin != null && score < f.scoreMin) continue;

    out.push({
      siren,
      denomination: e?.nom_raison_sociale ?? e?.nom_complet ?? null,
      naf,
      famille_metier: fam,
      famille_label: METIER_LABEL[fam],
      adresse: etab?.adresse ?? e?.siege?.adresse ?? null,
      code_postal: etab?.code_postal ?? null,
      commune: etab?.libelle_commune ?? null,
      dirigeant_nom: dir?.nom || null,
      dirigeant_annee_naissance: dir?.annee ?? null,
      dirigeant_age: age,
      dirigeant_qualite: dir?.qualite || null,
      etat,
      bodacc_id: d?.bodacc_id ?? null,
      bodacc_date: d?.bodacc_date ?? null,
      mandataire: d?.mandataire ?? null,
      date_creation: dateCrea,
      anciennete_annees: anc,
      nombre_etablissements: nbEt,
      categorie_entreprise: cat,
      domiciliation_probable: !!d?.domiciliation_probable,
      score,
      score_detail: detail,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return { prospects: out, total_commerces: commerces.length, tronque };
}

// ---------- Mapping vers une ligne de la table `prospects` (pour l'enregistrement) ----------
export function toProspectRow(p: Prospect) {
  return {
    siren: p.siren,
    denomination: p.denomination,
    naf: p.naf,
    famille_metier: p.famille_metier,
    adresse: p.adresse,
    code_postal: p.code_postal,
    commune: p.commune,
    dirigeant_nom: p.dirigeant_nom,
    dirigeant_annee_naissance: p.dirigeant_annee_naissance,
    dirigeant_age: p.dirigeant_age,
    dirigeant_qualite: p.dirigeant_qualite,
    etat: p.etat,
    bodacc_id: p.bodacc_id,
    bodacc_date: p.bodacc_date,
    mandataire: p.mandataire,
    date_creation: p.date_creation,
    anciennete_annees: p.anciennete_annees,
    nombre_etablissements: p.nombre_etablissements,
    categorie_entreprise: p.categorie_entreprise,
    score: p.score,
    score_detail: p.score_detail,
    domiciliation_probable: p.domiciliation_probable,
    statut: "nouveau",
    source: "recherche",
  };
}

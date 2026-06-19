// src/lib/radar.ts
// Radar quotidien — veille BODACC Île-de-France : ce qui a bougé récemment.
//   • Nouvelles difficultés (procédures collectives ouvertes)
//   • Nouvelles cessions de fonds (pouls du marché + comparables de prix)
//   • Nouvelles immatriculations (commerces qui ouvrent)
// Appel direct depuis le front (BODACC = gratuit, CORS ouvert). Pas de persistance :
// le Dashboard affiche le flux en direct. Réutilise familleMetier() de metier.ts.

import { familleMetier, METIER_LABEL, type FamilleMetier } from "@/lib/metier";

const API_BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

export const DEPARTEMENTS_IDF = ["75", "77", "78", "91", "92", "93", "94", "95"];

export type RadarType = "difficulte" | "cession" | "immatriculation";
export const RADAR_TYPE_LABEL: Record<RadarType, string> = {
  difficulte: "Difficulté",
  cession: "Cession de fonds",
  immatriculation: "Immatriculation",
};

export interface RadarItem {
  type: RadarType;
  type_label: string;
  denomination: string | null;
  activite: string | null;
  famille: FamilleMetier;
  famille_label: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  departement: string | null;
  siren: string | null;
  date: string | null;          // date de parution
  etat: string | null;          // difficulté : "redressement" | "liquidation"
  prix: number | null;          // cession : prix stipulé
  mandataire: string | null;    // difficulté : mandataire judiciaire à contacter
  bodacc_id: string | null;
  url: string | null;
}

const digits = (s: any) => String(s ?? "").replace(/\D/g, "");
const parse = (s: any) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// --- Détecteur « commerce avec fonds cessible » (vs BTP / services / holding / SCI) ---
const RE_EXCLU = /b[âa]timent|\bbtp\b|ma[çc]onn|gros\s?œuvre|gros oeuvre|second\s?œuvre|second oeuvre|terrassement|plomberie|[ée]lectricit[ée] g[ée]n[ée]rale|holding|participation|\bsci\b|soci[ée]t[ée] civile|marchand de bien|promotion immobili|agence immobili|transaction immobili|transport|messagerie|d[ée]m[ée]nagement|nettoyage|s[ée]curit[ée]|gardiennage|informatique|logiciel|d[ée]veloppement web|conseil|ing[ée]nierie|finance|assurance|comptab|avocat|notaire|location de|holding|n[ée]goce en gros|import[- ]export/i;
const RE_COMMERCE = /boucher|charcuter|poissonn|fromager|primeur|[ée]picerie|alimentation g[ée]n[ée]rale|superette|supermarch|caviste|cave [àa]|\btabac\b|presse|pharmacie|parapharm|optique|lunett|bijouter|horloger|\bfleur|boulang|p[âa]tiss|viennoiser|chocolat|confiser|salon de th[ée]|glacier|restaur|brasserie|bistrot|\bbar\b|\bcaf[ée]\b|pizz|cr[êe]p|kebab|burger|sandwich|tacos|snack|traiteur|coiffure|barbier|esth[ée]t|ongle|institut de beaut|spa\b|massage|garage|carross|m[ée]caniq|pneu|boutique|magasin|pr[êe]t[- ]?[àa][- ]?porter|habillement|chaussure|maroquin|librairie|papeter|jouet|bazar|quincaill|droguer|animaler|toilettage|d[ée]p[ôo]t[- ]vente|commerce de d[ée]tail|vente au d[ée]tail/i;

function estCommerce(activite: string | null | undefined): boolean {
  const t = activite ?? "";
  if (!t.trim()) return false;
  if (RE_EXCLU.test(t) && !RE_COMMERCE.test(t)) return false;
  return RE_COMMERCE.test(t);
}

function adresseTxt(a: any): string | null {
  if (!a) return null;
  return [a.numeroVoie, a.typeVoie, a.nomVoie, a.codePostal, a.ville].filter(Boolean).join(" ") || null;
}

// Prix stipulé d'une cession, depuis le texte origineFonds ("prix stipulé de 360000.00 euros").
function prixCession(etab: any): number | null {
  const t = etab?.origineFonds ?? "";
  const m = t.match(/prix stipul[ée] de\s+([\d  .,]+)\s*euros/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[ .]/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// Date de référence (il y a `jours` jours) au format AAAA-MM-JJ.
function depuis(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

// BODACC pagine par 100 max ; on récupère jusqu'à `pages` pages (offset) pour capter
// le sous-ensemble commerce noyé dans le volume (surtout les immatriculations).
async function bodacc(famille: string, since: string, pages = 4): Promise<any[]> {
  const dep = DEPARTEMENTS_IDF.map((d) => `"${d}"`).join(",");
  const where = `familleavis="${famille}" and numerodepartement in (${dep}) and dateparution >= "${since}"`;
  const base = `${API_BODACC}?where=${encodeURIComponent(where)}&order_by=${encodeURIComponent("dateparution desc")}&limit=100`;
  const out: any[] = [];
  for (let p = 0; p < pages; p++) {
    const r = await fetch(`${base}&offset=${p * 100}`);
    if (!r.ok) break;
    const res = (await r.json())?.results ?? [];
    out.push(...res);
    if (res.length < 100) break;
  }
  return out;
}

function commun(rec: any): Partial<RadarItem> {
  const pers = parse(rec.listepersonnes)?.personne;
  const etab = parse(rec.listeetablissements)?.etablissement;
  const activite = etab?.activite ?? pers?.activite ?? null;
  const fam = familleMetier(activite, null);
  const adr = etab?.adresse ?? pers?.adresseSiegeSocial ?? null;
  return {
    denomination: pers?.denomination ?? rec.commercant ?? null,
    activite,
    famille: fam,
    famille_label: METIER_LABEL[fam],
    adresse: adresseTxt(adr) ?? null,
    code_postal: adr?.codePostal ?? rec.cp ?? null,
    ville: adr?.ville ?? rec.ville ?? null,
    departement: rec.numerodepartement ?? null,
    siren: digits(Array.isArray(rec.registre) ? rec.registre[0] : "") || digits(pers?.numeroImmatriculation?.numeroIdentification) || null,
    date: rec.dateparution ?? null,
    bodacc_id: rec.id ?? null,
    url: rec.url_complete ?? null,
  };
}

/**
 * Radar du jour IDF. `jours` = fenêtre glissante (défaut 3, pour ne rien manquer si on
 * n'ouvre pas l'app chaque jour). `types` = signaux à inclure. `famillesCible` (optionnel)
 * = ne garder que ces familles métier ; sinon on exclut juste les "non précisé".
 */
export async function radarDuJour(opts?: {
  jours?: number;
  types?: RadarType[];
  famillesCible?: FamilleMetier[];
}): Promise<RadarItem[]> {
  const jours = opts?.jours ?? 1;
  const types = opts?.types ?? ["difficulte", "cession", "immatriculation"];
  const since = depuis(jours);
  const items: RadarItem[] = [];

  // 1) Difficultés (procédures collectives OUVERTES uniquement)
  if (types.includes("difficulte")) {
    for (const rec of await bodacc("collective", since)) {
      const jug = parse(rec.jugement);
      const fam = jug?.famille ?? "";
      if (!/ouverture/i.test(fam)) continue; // exclut clôtures, avis, etc.
      const nature = (jug?.nature ?? "").toLowerCase();
      items.push({
        ...(commun(rec) as RadarItem),
        type: "difficulte",
        type_label: RADAR_TYPE_LABEL.difficulte,
        etat: nature.includes("redressement") ? "redressement" : "liquidation",
        prix: null,
        mandataire: jug?.complementJugement ?? null,
      });
    }
  }

  // 2) Cessions de fonds (avec prix si présent)
  if (types.includes("cession")) {
    for (const rec of await bodacc("vente", since)) {
      const etab = parse(rec.listeetablissements)?.etablissement;
      items.push({
        ...(commun(rec) as RadarItem),
        type: "cession",
        type_label: RADAR_TYPE_LABEL.cession,
        etat: null,
        prix: prixCession(etab),
        mandataire: null,
      });
    }
  }

  // 3) Immatriculations
  if (types.includes("immatriculation")) {
    for (const rec of await bodacc("creation", since)) {
      items.push({
        ...(commun(rec) as RadarItem),
        type: "immatriculation",
        type_label: RADAR_TYPE_LABEL.immatriculation,
        etat: null,
        prix: null,
        mandataire: null,
      });
    }
  }

  // On ne garde QUE les commerces (fonds cessible) — exclut BTP/services/holding/SCI.
  // `famillesCible` (optionnel) restreint encore à certaines familles.
  const cible = opts?.famillesCible;
  const filtres = items.filter((it) => {
    if (!estCommerce(it.activite)) return false;
    if (cible && cible.length) return cible.includes(it.famille);
    return true;
  });

  // Tri : difficultés d'abord, puis par date décroissante.
  const poids: Record<RadarType, number> = { difficulte: 0, cession: 1, immatriculation: 2 };
  filtres.sort((a, b) => poids[a.type] - poids[b.type] || String(b.date).localeCompare(String(a.date)));
  return filtres;
}

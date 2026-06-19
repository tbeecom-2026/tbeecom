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
const API_ENTREPRISES = "https://recherche-entreprises.api.gouv.fr/search";

// État administratif réel par SIREN (A = actif, C/F = cessé/radié), via l'Annuaire.
// Sert à écarter les sociétés déjà radiées dont une vieille procédure traîne dans BODACC.
async function etatsParSiren(sirens: string[]): Promise<Map<string, string | null>> {
  const m = new Map<string, string | null>();
  const uniques = [...new Set(sirens.filter(Boolean))].slice(0, 40); // plafond de sécurité
  const LIMIT = 4; // recherche-entreprises limite ~7 req/s -> on bride par petits lots
  for (let i = 0; i < uniques.length; i += LIMIT) {
    await Promise.all(
      uniques.slice(i, i + LIMIT).map(async (s) => {
        try {
          const r = await fetch(`${API_ENTREPRISES}?q=${s}&per_page=1&minimal=true`);
          if (r.status === 429) {
            m.set(s, null);
            return;
          } // throttlé -> on garde le lead par défaut
          const d = r.ok ? await r.json() : null;
          const res = (d?.results ?? []).find((x: any) => x?.siren === s) ?? (d?.results ?? [])[0];
          m.set(s, res?.etat_administratif ?? null);
        } catch {
          m.set(s, null);
        }
      }),
    );
  }
  return m;
}

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
  date: string | null; // date de parution
  etat: string | null; // difficulté : "redressement" | "liquidation"
  prix: number | null; // cession : prix stipulé
  mandataire: string | null; // difficulté : mandataire judiciaire à contacter
  bodacc_id: string | null;
  url: string | null;
}

const digits = (s: any) => String(s ?? "").replace(/\D/g, "");
const parse = (s: any) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

// --- Détecteur « commerce avec fonds cessible » (vs BTP / services / holding / SCI) ---
const RE_EXCLU =
  /b[âa]timent|\bbtp\b|ma[çc]onn|gros\s?œuvre|gros oeuvre|second\s?œuvre|second oeuvre|terrassement|plomberie|[ée]lectricit[ée] g[ée]n[ée]rale|holding|participation|\bsci\b|soci[ée]t[ée] civile|marchand de bien|promotion immobili|agence immobili|transaction immobili|transport|messagerie|d[ée]m[ée]nagement|nettoyage|s[ée]curit[ée]|gardiennage|informatique|logiciel|d[ée]veloppement web|conseil|ing[ée]nierie|finance|assurance|comptab|avocat|notaire|location de|holding|n[ée]goce en gros|import[- ]export/i;
const RE_COMMERCE =
  /boucher|charcuter|poissonn|fromager|primeur|[ée]picerie|alimentation g[ée]n[ée]rale|superette|supermarch|caviste|cave [àa]|\btabac\b|presse|pharmacie|parapharm|optique|lunett|bijouter|horloger|\bfleur|boulang|p[âa]tiss|viennoiser|chocolat|confiser|salon de th[ée]|glacier|restaur|brasserie|bistrot|\bbar\b|\bcaf[ée]\b|pizz|cr[êe]p|kebab|burger|sandwich|tacos|snack|traiteur|coiffure|barbier|esth[ée]t|ongle|institut de beaut|spa\b|massage|garage|carross|m[ée]caniq|pneu|boutique|magasin|pr[êe]t[- ]?[àa][- ]?porter|habillement|chaussure|maroquin|librairie|papeter|jouet|bazar|quincaill|droguer|animaler|toilettage|d[ée]p[ôo]t[- ]vente|commerce de d[ée]tail|vente au d[ée]tail/i;

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
// Gère point OU virgule décimale (sans confondre milliers et décimale).
function prixCession(etab: any): number | null {
  const m = (etab?.origineFonds ?? "").match(/prix stipul[ée] de\s+([\d  .,]+)\s*euros/i);
  if (!m) return null;
  let s = String(m[1]).trim().replace(/\s/g, "");
  const lc = s.lastIndexOf(","),
    ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc > -1) s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) || n <= 0 ? null : n;
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
    siren:
      digits(Array.isArray(rec.registre) ? rec.registre[0] : "") ||
      digits(pers?.numeroImmatriculation?.numeroIdentification) ||
      null,
    date: rec.dateparution ?? null,
    bodacc_id: rec.id ?? null,
    url: rec.url_complete ?? null,
  };
}

// Cache mémoire du radar (15 min) : évite de tout re-télécharger à chaque retour sur le
// Dashboard (et de marteler les API), ce qui faisait "disparaître" le radar au 2e affichage.
const _radarCache = new Map<string, { t: number; data: RadarItem[] }>();
const RADAR_TTL = 15 * 60 * 1000;

/**
 * Radar du jour IDF. `jours` = fenêtre glissante (défaut 1). `types` = signaux à inclure.
 * `famillesCible` (optionnel) = ne garder que ces familles ; sinon tous les commerces.
 * Résultat mis en cache 15 min (clé = jours + types + familles).
 */
export async function radarDuJour(opts?: {
  jours?: number;
  types?: RadarType[];
  famillesCible?: FamilleMetier[];
}): Promise<RadarItem[]> {
  const jours = opts?.jours ?? 1;
  const types = opts?.types ?? ["difficulte", "cession", "immatriculation"];
  const _key = JSON.stringify([jours, [...types].sort(), [...(opts?.famillesCible ?? [])].sort()]);
  const _hit = _radarCache.get(_key);
  if (_hit && Date.now() - _hit.t < RADAR_TTL) return _hit.data; // retour instantané, pas de refetch
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

  // Écarter les sociétés DÉJÀ RADIÉES parmi les difficultés (décalage BODACC : une vieille
  // procédure peut concerner une société entre-temps radiée = morte, plus un lead).
  // On vérifie l'état réel par SIREN ; on retire seulement les états confirmés "C"/"F".
  const sirensDiff = filtres.filter((i) => i.type === "difficulte").map((i) => i.siren ?? "");
  let finale = filtres;
  if (sirensDiff.length) {
    const etats = await etatsParSiren(sirensDiff);
    finale = filtres.filter((i) => {
      if (i.type !== "difficulte") return true;
      const e = etats.get(i.siren ?? "");
      return e !== "C" && e !== "F"; // garde actif ("A") ou inconnu (null)
    });
  }

  // Tri : difficultés d'abord, puis par date décroissante.
  const poids: Record<RadarType, number> = { difficulte: 0, cession: 1, immatriculation: 2 };
  finale.sort((a, b) => poids[a.type] - poids[b.type] || String(b.date).localeCompare(String(a.date)));
  _radarCache.set(_key, { t: Date.now(), data: finale }); // mise en cache (15 min)
  return finale;
}

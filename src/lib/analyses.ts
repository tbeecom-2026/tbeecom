// src/lib/analyses.ts
// Analyses de marché à partir de BODACC (gratuit). Trois lectures :
//   1) parZone   : classement géographique (group_by côté serveur = 1 appel, complet).
//   2) parMois / parMoisMulti : tendance temporelle (1 petit "count" par mois).
//   3) parActivite : répartition par famille métier (échantillon classé côté client).
// Filtre MÉTIER : par mots-clés d'activité (BODACC n'a pas de code NAF) -> appliqué dans le where.
// Réutilise familleMetier()/METIER_LABEL de metier.ts.

import { familleMetier, METIER_LABEL, type FamilleMetier } from "@/lib/metier";

const API_BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

export type EvtType = "cession" | "creation" | "difficulte";
export const EVT_LABEL: Record<EvtType, string> = {
  cession: "Cessions de fonds",
  creation: "Créations d'entreprises",
  difficulte: "Procédures collectives",
};
const FAMILLE_AVIS: Record<EvtType, string> = { cession: "vente", creation: "creation", difficulte: "collective" };

export interface ZoneEvt {
  departement?: string;
} // "idf"/vide = toute l'Île-de-France ; sinon un département IDF
export const DEPTS_IDF = ["75", "77", "78", "91", "92", "93", "94", "95"];
// Fragment de filtre géographique : un département précis, sinon toute l'Île-de-France.
function clauseZone(dep?: string): string {
  if (dep && dep !== "idf") return ` and numerodepartement="${dep}"`;
  return ` and numerodepartement in (${DEPTS_IDF.map((d) => `"${d}"`).join(",")})`;
}

// Mots-clés d'activité par famille (filtre plein-texte BODACC). Imparfait mais directionnel.
const MOTS_CLES: Partial<Record<FamilleMetier, string>> = {
  restauration_assise: '("restaurant" or "brasserie" or "pizz" or "bistrot" or "creperie" or "trattoria")',
  restauration_rapide:
    '("restauration rapide" or "fast" or "kebab" or "burger" or "sandwich" or "emporter" or "tacos" or "snack")',
  bar_cafe_tabac: '("bar" or "café" or "tabac" or "pub")',
  boulangerie_patisserie: '("boulangerie" or "patisserie" or "pâtisserie" or "viennoiserie" or "chocolat")',
  garage_carrosserie: '("garage" or "carrosserie" or "mécanique" or "pneu")',
  fleuriste: '("fleur" or "fleuriste")',
  coiffure_esthetique: '("coiffure" or "esthétique" or "barbier" or "ongle" or "institut de beauté")',
};
function clauseFamille(f?: FamilleMetier): string {
  return f && MOTS_CLES[f] ? ` and ${MOTS_CLES[f]}` : "";
}

const enc = encodeURIComponent;
function depuisMois(mois: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - mois);
  return d.toISOString().slice(0, 10);
}
function whereBase(type: EvtType, zone: ZoneEvt, mois: number, extra = "", famille?: FamilleMetier): string {
  let w = `familleavis="${FAMILLE_AVIS[type]}" and dateparution>="${depuisMois(mois)}"`;
  w += clauseZone(zone.departement);
  w += clauseFamille(famille);
  return extra ? `${w} and ${extra}` : w;
}

// ---------- 1) Classement par zone (agrégat serveur) ----------
export interface LigneZone {
  zone: string;
  nb: number;
}
export async function parZone(
  type: EvtType,
  zone: ZoneEvt,
  mois = 12,
  limit = 20,
  famille?: FamilleMetier,
): Promise<LigneZone[]> {
  const champ = zone.departement && zone.departement !== "idf" ? "cp" : "numerodepartement";
  const where = whereBase(type, zone, mois, "", famille);
  const url = `${API_BODACC}?where=${enc(where)}&group_by=${champ}&select=${enc(`${champ} as zone, count(*) as nb`)}&order_by=${enc("nb desc")}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  return (d?.results ?? [])
    .filter((x: any) => x?.zone)
    .map((x: any) => ({ zone: String(x.zone), nb: Number(x.nb) || 0 }));
}

// ---------- 2) Tendance mensuelle (un count par mois) ----------
export interface LigneMois {
  mois: string;
  nb: number;
}
export async function parMois(type: EvtType, zone: ZoneEvt, mois = 12, famille?: FamilleMetier): Promise<LigneMois[]> {
  const out: LigneMois[] = [];
  const now = new Date();
  const reqs: Promise<void>[] = [];
  for (let k = mois - 1; k >= 0; k--) {
    const debut = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const fin = new Date(now.getFullYear(), now.getMonth() - k + 1, 1);
    const ds = debut.toISOString().slice(0, 10);
    const fs = fin.toISOString().slice(0, 10);
    const label = `${String(debut.getMonth() + 1).padStart(2, "0")}/${debut.getFullYear()}`;
    let w = `familleavis="${FAMILLE_AVIS[type]}" and dateparution>="${ds}" and dateparution<"${fs}"`;
    w += clauseZone(zone.departement);
    w += clauseFamille(famille);
    const url = `${API_BODACC}?where=${enc(w)}&limit=1`;
    const idx = out.length;
    out.push({ mois: label, nb: 0 });
    reqs.push(
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          out[idx].nb = Number(d?.total_count ?? 0);
        })
        .catch(() => {}),
    );
  }
  await Promise.all(reqs);
  return out;
}

// ---------- 2bis) Évolution comparée des 3 signaux ----------
export interface LigneMoisMulti {
  mois: string;
  cession: number;
  creation: number;
  difficulte: number;
}
export async function parMoisMulti(zone: ZoneEvt, mois = 12, famille?: FamilleMetier): Promise<LigneMoisMulti[]> {
  const [c, cr, d] = await Promise.all([
    parMois("cession", zone, mois, famille),
    parMois("creation", zone, mois, famille),
    parMois("difficulte", zone, mois, famille),
  ]);
  return c.map((row, i) => ({ mois: row.mois, cession: row.nb, creation: cr[i]?.nb ?? 0, difficulte: d[i]?.nb ?? 0 }));
}

// ---------- 3) Répartition par famille métier (échantillon classé) ----------
export interface LigneActivite {
  famille: FamilleMetier;
  label: string;
  nb: number;
}
export async function parActivite(
  type: EvtType,
  zone: ZoneEvt,
  mois = 12,
  maxRecords = 600,
  famille?: FamilleMetier,
): Promise<{ repartition: LigneActivite[]; echantillon: number; renseignes: number }> {
  const where = whereBase(type, zone, mois, "", famille);
  const base = `${API_BODACC}?where=${enc(where)}&order_by=${enc("dateparution desc")}&limit=100`;
  const compte = new Map<FamilleMetier, number>();
  let n = 0;
  for (let p = 0; p * 100 < maxRecords; p++) {
    const r = await fetch(`${base}&offset=${p * 100}`);
    if (!r.ok) break;
    const res = (await r.json())?.results ?? [];
    for (const rec of res) {
      let act: string | null = null;
      try {
        act = JSON.parse(rec.listeetablissements ?? "null")?.etablissement?.activite ?? null;
      } catch {}
      if (!act) {
        try {
          act = JSON.parse(rec.listepersonnes ?? "null")?.personne?.activite ?? null;
        } catch {}
      }
      const fam = familleMetier(act, null);
      compte.set(fam, (compte.get(fam) ?? 0) + 1);
      n++;
    }
    if (res.length < 100) break;
  }
  const renseignes = n - (compte.get("non_precise") ?? 0);
  compte.delete("non_precise");
  const repartition = [...compte.entries()]
    .map(([famille2, nb]) => ({ famille: famille2, label: METIER_LABEL[famille2], nb }))
    .sort((a, b) => b.nb - a.nb);
  return { repartition, echantillon: n, renseignes };
}

// ---------- 3bis) Répartition par SECTEUR (comptage EXCLUSIF par mots-clés) ----------
// On compte côté serveur (count BODACC) secteur par secteur, dans l'ORDRE ci-dessous
// (spécifique -> générique). Chaque secteur exclut les mots-clés des secteurs précédents :
// une annonce n'est comptée qu'une seule fois -> les parts totalisent 100 %, sans doublon.
// "Autre commerce" = total − Σ (annonces dont le texte d'activité ne matche aucun secteur).
// Aucun appel à recherche-entreprises : que du BODACC (pas de rate limit).
const SECTEURS: { label: string; kw: string }[] = [
  { label: "Fleuriste", kw: '"fleur"' },
  { label: "Pharmacie / Optique", kw: '("pharmacie" or "parapharmacie" or "opticien" or "optique")' },
  { label: "Boulangerie / Pâtisserie", kw: '("boulangerie" or "pâtisserie" or "patisserie" or "viennoiserie")' },
  {
    label: "Boucherie / Traiteur",
    kw: '("boucherie" or "charcuterie" or "poissonnerie" or "traiteur" or "fromagerie")',
  },
  {
    label: "Coiffure / Esthétique",
    kw: '("coiffure" or "esthétique" or "barbier" or "institut de beauté" or "ongle" or "manucure")',
  },
  { label: "Garage / Auto", kw: '("garage" or "carrosserie" or "mécanique automobile" or "pneumatique")' },
  { label: "Cave / Caviste", kw: '("caviste" or "cave à vin" or "vins et spiritueux")' },
  { label: "Salon de thé / Glacier", kw: '("salon de thé" or "glacier" or "chocolat" or "confiserie")' },
  {
    label: "Alimentation / Épicerie",
    kw: '("épicerie" or "alimentation générale" or "supérette" or "supermarché" or "primeur" or "fruits et légumes")',
  },
  { label: "Tabac / Presse", kw: '("tabac" or "presse" or "loto")' },
  {
    label: "Restauration rapide",
    kw: '("restauration rapide" or "kebab" or "burger" or "sandwich" or "tacos" or "snack")',
  },
  {
    label: "Restauration assise",
    kw: '("restaurant" or "brasserie" or "bistrot" or "pizz" or "trattoria" or "creperie")',
  },
  { label: "Bar / Café", kw: '("bar" or "café" or "pub" or "taverne")' },
  { label: "Librairie / Papeterie", kw: '("librairie" or "papeterie")' },
  { label: "Habillement / Chaussures", kw: '("prêt-à-porter" or "habillement" or "chaussures" or "maroquinerie")' },
  { label: "Bijouterie / Horlogerie", kw: '("bijouterie" or "horlogerie" or "joaillerie")' },
  { label: "Bazar / Déco / Cadeaux", kw: '("bazar" or "décoration" or "cadeaux" or "quincaillerie" or "droguerie")' },
];

export interface SecteurCount {
  label: string;
  nb: number;
}
export async function parRepartition(
  type: EvtType,
  zone: ZoneEvt,
  mois = 12,
): Promise<{ secteurs: SecteurCount[]; total: number }> {
  const base = whereBase(type, zone, mois);
  const countUrl = (extra: string) => `${API_BODACC}?where=${enc(`${base} and ${extra}`)}&limit=1`;
  const count = (extra: string) =>
    fetch(countUrl(extra))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Number(d?.total_count ?? 0))
      .catch(() => 0);
  const totalP = fetch(`${API_BODACC}?where=${enc(base)}&limit=1`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => Number(d?.total_count ?? 0))
    .catch(() => 0);
  // Comptage exclusif : chaque secteur exclut les mots-clés des précédents.
  const prev: string[] = [];
  const reqs = SECTEURS.map((s) => {
    const excl = prev.length ? `${s.kw} and not (${prev.join(" or ")})` : s.kw;
    prev.push(s.kw);
    return count(excl).then((nb) => ({ label: s.label, nb }));
  });
  const [total, secteurs] = await Promise.all([totalP, Promise.all(reqs)]);
  const somme = secteurs.reduce((a, b) => a + b.nb, 0);
  const out = secteurs.filter((s) => s.nb > 0).sort((a, b) => b.nb - a.nb);
  const autre = Math.max(0, total - somme);
  if (autre > 0) out.push({ label: "Autre commerce", nb: autre });
  return { secteurs: out, total };
}

export function libelleZone(z: string): string {
  if (/^75\d{3}$/.test(z)) return `Paris ${Number(z.slice(3))}e`;
  return z;
}

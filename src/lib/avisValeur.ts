// src/lib/avisValeur.ts
// Avis de valeur d'un FONDS DE COMMERCE (v2) — affiné par ADRESSE (proximité réelle).
//   1) Comparables de cession (BODACC) de même famille, GÉOCODÉS, triés par distance à l'adresse.
//      Rayon qui s'élargit seulement si trop peu de comparables (0,5 -> 1 -> 2 -> 3 -> 5 km).
//   2) Multiple du chiffre d'affaires selon la famille (repères marché FDC).
// Sans adresse : repli sur une zone (CP/département). 100 % gratuit (BODACC + Base Adresse Nationale).
// NB : indicatif. L'open data ne capte pas le micro-emplacement (n° de rue, flux, terrasse, bail) :
// l'outil resserre le champ, l'expert pose le prix.

import { familleMetier, METIER_LABEL, type FamilleMetier } from "@/lib/metier";

const API_BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
const API_GEOCODE = "https://api-adresse.data.gouv.fr/search/";

// Repères de valorisation en % du CA HT (bas/haut) par famille (REFERENTIEL_METIERS_FDC.md). Indicatif.
export const BANDES_CA: Record<FamilleMetier, { bas: number; haut: number }> = {
  restauration_assise: { bas: 0.5, haut: 1.2 },
  restauration_rapide: { bas: 0.4, haut: 0.9 },
  bar_cafe_tabac: { bas: 0.8, haut: 2.0 },
  boulangerie_patisserie: { bas: 0.7, haut: 1.1 },
  fleuriste: { bas: 0.4, haut: 0.8 },
  coiffure_esthetique: { bas: 0.4, haut: 0.8 },
  garage_carrosserie: { bas: 0.3, haut: 0.6 },
  autre: { bas: 0.4, haut: 0.9 },
  non_precise: { bas: 0.4, haut: 0.9 },
};

export interface Comparable {
  denomination: string | null;
  activite: string | null;
  adresse: string | null; // rue
  code_postal: string | null;
  ville: string | null;
  prix: number;
  date: string | null;
  url: string | null;
  distance_km: number | null; // distance à l'adresse cible (mode proximité)
}

export interface Stats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  moyenne: number;
}
export interface ZoneEstim {
  codePostal?: string;
  departement?: string;
}

const digits = (s: any) => String(s ?? "").replace(/\D/g, "");
const parse = (s: any) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

export function parseMontant(raw: string): number | null {
  let s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return null;
  const lc = s.lastIndexOf(","),
    ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc > -1) s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) || n <= 0 ? null : n;
}
function prixCession(etab: any): number | null {
  const m = (etab?.origineFonds ?? "").match(/prix stipul[ée] de\s+([\d  .,]+)\s*euros/i);
  return m ? parseMontant(m[1]) : null;
}
function adresseEtab(etab: any): string | null {
  const a = etab?.adresse;
  return a ? [a.numeroVoie, a.typeVoie, a.nomVoie].filter(Boolean).join(" ") || null : null;
}

// --- Géocodage (Base Adresse Nationale) ---
export interface Point {
  lat: number;
  lon: number;
  citycode: string;
  cp: string;
  label: string;
}
export async function geocode(adresse: string): Promise<Point | null> {
  if (!adresse?.trim()) return null;
  try {
    const r = await fetch(`${API_GEOCODE}?q=${encodeURIComponent(adresse)}&limit=1`);
    const f = (r.ok ? await r.json() : null)?.features?.[0];
    if (!f) return null;
    const [lon, lat] = f.geometry.coordinates;
    return {
      lat,
      lon,
      citycode: f.properties?.citycode ?? "",
      cp: f.properties?.postcode ?? "",
      label: f.properties?.label ?? adresse,
    };
  } catch {
    return null;
  }
}
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371,
    dLat = ((lat2 - lat1) * Math.PI) / 180,
    dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const quantile = (s: number[], p: number) => {
  if (!s.length) return 0;
  const i = (s.length - 1) * p,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};
function stats(prix: number[]): Stats {
  const s = [...prix].sort((a, b) => a - b),
    n = s.length;
  return {
    n,
    min: n ? s[0] : 0,
    q1: quantile(s, 0.25),
    median: quantile(s, 0.5),
    q3: quantile(s, 0.75),
    max: n ? s[n - 1] : 0,
    moyenne: n ? Math.round(s.reduce((a, b) => a + b, 0) / n) : 0,
  };
}
function whereZone(z: ZoneEstim): string {
  if (z.codePostal) return `cp="${digits(z.codePostal).slice(0, 5)}"`;
  return `numerodepartement="${digits(z.departement).slice(0, 3)}"`;
}
function moisAvant(mois: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - mois);
  return d.toISOString().slice(0, 10);
}

/** Comparables BODACC bruts (même famille + zone + fenêtre). */
export async function comparablesFonds(
  famille: FamilleMetier,
  zone: ZoneEstim,
  moisRetour = 24,
  maxPages = 6,
): Promise<Comparable[]> {
  const since = moisAvant(moisRetour);
  const where = `familleavis="vente" and ${whereZone(zone)} and dateparution >= "${since}"`;
  const base = `${API_BODACC}?where=${encodeURIComponent(where)}&order_by=${encodeURIComponent("dateparution desc")}&limit=100`;
  const comps: Comparable[] = [];
  for (let p = 0; p < maxPages; p++) {
    const r = await fetch(`${base}&offset=${p * 100}`);
    if (!r.ok) break;
    const res = (await r.json())?.results ?? [];
    for (const rec of res) {
      const etab = parse(rec.listeetablissements)?.etablissement;
      if (familleMetier(etab?.activite, null) !== famille) continue;
      const prix = prixCession(etab);
      if (prix == null) continue;
      const a = etab?.adresse;
      comps.push({
        denomination: rec.commercant ?? null,
        activite: etab?.activite ?? null,
        adresse: adresseEtab(etab),
        code_postal: a?.codePostal ?? rec.cp ?? null,
        ville: a?.ville ?? rec.ville ?? null,
        prix,
        date: rec.dateparution ?? null,
        url: rec.url_complete ?? null,
        distance_km: null,
      });
    }
    if (res.length < 100) break;
  }
  return comps;
}

export interface EntreeEstimation {
  famille: FamilleMetier;
  adresse?: string; // mode proximité (recommandé)
  zone?: ZoneEstim; // repli si pas d'adresse
  ca?: number | null;
  moisRetour?: number;
  comparablesMin?: number; // seuil pour élargir le rayon (défaut 5)
}

export interface Estimation {
  famille: FamilleMetier;
  famille_label: string;
  mode: "proximite" | "zone";
  cible_label: string | null; // adresse géocodée
  rayon_km: number | null; // rayon retenu (mode proximité)
  comparables: Comparable[]; // triés par distance (proximité) ou prix (zone)
  stats: Stats;
  fourchette_comparables: { bas: number; median: number; haut: number } | null;
  multiple_ca: { ca: number; pct_bas: number; pct_haut: number; bas: number; haut: number } | null;
  fourchette_retenue: { bas: number; haut: number } | null;
  fiabilite: "faible" | "moyenne" | "bonne";
}

const RAYONS = [0.5, 1, 2, 3, 5];

export async function estimationFonds(e: EntreeEstimation): Promise<Estimation> {
  const min = e.comparablesMin ?? 5;
  let mode: "proximite" | "zone" = "zone";
  let cibleLabel: string | null = null;
  let rayon: number | null = null;
  let selection: Comparable[] = [];

  const cible = e.adresse ? await geocode(e.adresse) : null;
  if (cible) {
    mode = "proximite";
    cibleLabel = cible.label;
    const dep = (cible.citycode || cible.cp).slice(0, 2);
    const bruts = await comparablesFonds(e.famille, { departement: dep }, e.moisRetour ?? 24);
    // géocoder les comparables (cap 80) et calculer la distance
    await Promise.all(
      bruts.slice(0, 80).map(async (c) => {
        const g = await geocode([c.adresse, c.code_postal, c.ville].filter(Boolean).join(" "));
        c.distance_km = g ? Math.round(distanceKm(cible.lat, cible.lon, g.lat, g.lon) * 100) / 100 : null;
      }),
    );
    const avecDist = bruts.filter((c) => c.distance_km != null).sort((a, b) => a.distance_km! - b.distance_km!);
    // rayon croissant jusqu'à atteindre `min` comparables
    for (const R of RAYONS) {
      rayon = R;
      selection = avecDist.filter((c) => c.distance_km! <= R);
      if (selection.length >= min) break;
    }
    if (selection.length < min) {
      selection = avecDist.slice(0, Math.max(min, 6));
      rayon = selection.length ? selection[selection.length - 1].distance_km : null;
    }
  } else {
    const zone = e.zone ?? { departement: "75" };
    cibleLabel = zone.codePostal
      ? `CP ${digits(zone.codePostal).slice(0, 5)}`
      : `département ${digits(zone.departement).slice(0, 3)}`;
    selection = (await comparablesFonds(e.famille, zone, e.moisRetour ?? 24)).sort((a, b) => b.prix - a.prix);
  }

  const st = stats(selection.map((c) => c.prix));
  const fComps = st.n >= 3 ? { bas: Math.round(st.q1), median: Math.round(st.median), haut: Math.round(st.q3) } : null;

  let mult: Estimation["multiple_ca"] = null;
  if (e.ca && e.ca > 0) {
    const b = BANDES_CA[e.famille] ?? BANDES_CA.autre;
    mult = {
      ca: e.ca,
      pct_bas: b.bas,
      pct_haut: b.haut,
      bas: Math.round(e.ca * b.bas),
      haut: Math.round(e.ca * b.haut),
    };
  }

  let retenue: Estimation["fourchette_retenue"] = null;
  if (fComps && mult)
    retenue = { bas: Math.round((fComps.bas + mult.bas) / 2), haut: Math.round((fComps.haut + mult.haut) / 2) };
  else if (fComps) retenue = { bas: fComps.bas, haut: fComps.haut };
  else if (mult) retenue = { bas: mult.bas, haut: mult.haut };

  const fiabilite: Estimation["fiabilite"] = st.n >= 8 ? "bonne" : st.n >= 3 ? "moyenne" : "faible";

  return {
    famille: e.famille,
    famille_label: METIER_LABEL[e.famille],
    mode,
    cible_label: cibleLabel,
    rayon_km: rayon,
    comparables: selection,
    stats: st,
    fourchette_comparables: fComps,
    multiple_ca: mult,
    fourchette_retenue: retenue,
    fiabilite,
  };
}

// ---------- Document « Avis de valeur » (HTML style TBEECOM) ----------
const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function genererAvisValeurHtml(
  est: Estimation,
  ctx?: { enseigne?: string; adresse?: string; agence?: any },
): string {
  const a = ctx?.agence ?? {};
  const lieu =
    est.mode === "proximite"
      ? `${est.cible_label ?? ctx?.adresse ?? ""} · comparables dans un rayon de ${est.rayon_km ?? "—"} km`
      : (est.cible_label ?? "");
  const fiabBadge = { faible: "#B91C1C", moyenne: "#D2963C", bonne: "#2F855A" }[est.fiabilite];
  const comps = est.comparables.slice(0, 12);
  const colDist = est.mode === "proximite";
  const ligneComps = comps.length
    ? comps
        .map(
          (c) =>
            `<tr><td>${c.denomination ?? "—"}</td><td>${(c.activite ?? "").slice(0, 38)}</td><td>${[c.adresse, c.ville].filter(Boolean).join(", ")}</td>${colDist ? `<td style="text-align:right">${c.distance_km != null ? c.distance_km + " km" : "—"}</td>` : ""}<td style="text-align:right">${eur(c.prix)}</td><td>${c.date ?? ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="${colDist ? 6 : 5}" style="color:#9aa3af">Aucun comparable</td></tr>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avis de valeur — ${ctx?.enseigne ?? est.famille_label}</title>
  <style>
    body{font-family:"Inter","Segoe UI",Arial,sans-serif;color:#1f2733;line-height:1.5;font-size:13px;margin:0}
    .page{max-width:820px;margin:0 auto;padding:32px 40px}
    h1{font-family:"Playfair Display",Georgia,serif;color:#42546C;font-size:22px;text-align:center;margin:.2em 0}
    h2{font-family:"Playfair Display",Georgia,serif;color:#42546C;font-size:15px;margin:18px 0 6px;border-bottom:2px solid #D2963C;padding-bottom:3px}
    .head{display:flex;justify-content:space-between;border-bottom:3px solid #42546C;padding-bottom:10px}
    .brand{font-family:"Playfair Display",Georgia,serif;font-size:24px;color:#42546C;letter-spacing:1px}.brand b{color:#D2963C}
    .agence{font-size:11px;color:#6b7280;text-align:right}
    .estim{background:#F4F6F9;border:1px solid #D2963C;border-radius:8px;padding:14px 18px;margin:14px 0;text-align:center}
    .estim .val{font-size:26px;font-weight:700;color:#42546C}
    table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}th,td{border-bottom:1px solid #e2e7ee;padding:5px 7px;text-align:left}th{color:#6b7280;font-weight:600}
    .note{font-size:11px;color:#6b7280}.badge{display:inline-block;padding:2px 8px;border-radius:10px;color:#fff;font-size:11px;font-weight:700}
  </style></head><body><div class="page">
  <div class="head"><div class="brand">TBE<b>E</b>COM</div>
    <div class="agence">${a.raison_sociale ?? "MENESGUEN Immobilier"} — TBEECOM<br>${a.siege ?? "128 rue de la Boétie, 75008 Paris"}<br>contact@tbeecom.com</div></div>
  <h1>Avis de valeur — fonds de commerce</h1>
  <p style="text-align:center;color:#6b7280">${ctx?.enseigne ? `<b>${ctx.enseigne}</b> — ` : ""}${est.famille_label}${lieu ? ` · ${lieu}` : ""}</p>
  <div class="estim"><div class="note">Fourchette de valorisation estimée</div>
    <div class="val">${est.fourchette_retenue ? `${eur(est.fourchette_retenue.bas)} — ${eur(est.fourchette_retenue.haut)}` : "Données insuffisantes"}</div>
    <div class="note">Fiabilité : <span class="badge" style="background:${fiabBadge}">${est.fiabilite}</span> · ${est.stats.n} comparable(s)${colDist && est.rayon_km ? ` dans ${est.rayon_km} km` : ""}</div></div>
  <h2>Méthode</h2>
  <p>Avis croisant deux approches : (1) les <b>comparables de cession</b> de ${est.famille_label.toLowerCase()} publiés au BODACC ${est.mode === "proximite" ? "les plus <b>proches</b> de l'adresse (géolocalisés)" : "sur la zone"} sur 24 mois ; (2) le cas échéant un <b>multiple du chiffre d'affaires</b> selon les usages. La fourchette retenue en est la synthèse.</p>
  ${
    est.fourchette_comparables
      ? `
  <h2>1. Comparables de cession (BODACC)</h2>
  <p>Sur ${est.stats.n} cessions : médiane <b>${eur(est.stats.median)}</b>, fourchette interquartile ${eur(est.fourchette_comparables.bas)} — ${eur(est.fourchette_comparables.haut)} (min ${eur(est.stats.min)}, max ${eur(est.stats.max)}).</p>
  <table><thead><tr><th>Enseigne</th><th>Activité</th><th>Adresse</th>${colDist ? "<th style='text-align:right'>Dist.</th>" : ""}<th style="text-align:right">Prix</th><th>Date</th></tr></thead><tbody>${ligneComps}</tbody></table>`
      : `<h2>1. Comparables de cession</h2><p class="note">Trop peu de comparables (${est.stats.n}) pour une fourchette robuste — élargir la période ou la zone.</p>`
  }
  ${est.multiple_ca ? `<h2>2. Multiple du chiffre d'affaires</h2><p>CA HT <b>${eur(est.multiple_ca.ca)}</b> × ${Math.round(est.multiple_ca.pct_bas * 100)}-${Math.round(est.multiple_ca.pct_haut * 100)} % : <b>${eur(est.multiple_ca.bas)} — ${eur(est.multiple_ca.haut)}</b>.</p>` : ""}
  <h2>Réserves</h2>
  <p class="note">Avis indicatif (données publiques BODACC + Base Adresse Nationale + repères de marché). Ne constitue ni une expertise ni un engagement de prix. La valeur réelle dépend du micro-emplacement (rue, n°, flux), du bail, du matériel et de la rentabilité (EBE), que ces données ne capturent pas. Fait le ${new Date().toLocaleDateString("fr-FR")}.</p>
  </div></body></html>`;
}

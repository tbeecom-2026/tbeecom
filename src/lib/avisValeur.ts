// src/lib/avisValeur.ts
// Avis de valeur d'un FONDS DE COMMERCE (v1) — deux approches croisées :
//   1) Comparables de cession (BODACC) : mêmes famille + zone + fenêtre de mois -> fourchette.
//   2) Multiple du chiffre d'affaires selon la famille (repères marché FDC).
// 100 % gratuit (BODACC). Réutilise familleMetier() de metier.ts.
// NB : indicatif, ne remplace pas une expertise ; toujours afficher n (nb de comparables) + sources.

import { familleMetier, METIER_LABEL, type FamilleMetier } from "@/lib/metier";

const API_BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

// Repères de valorisation en % du CA HT (fourchette basse / haute), par famille.
// Source : REFERENTIEL_METIERS_FDC.md (notes de valorisation). Indicatif.
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
  code_postal: string | null;
  ville: string | null;
  prix: number;
  date: string | null;
  url: string | null;
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

export interface ZoneEstim { codePostal?: string; departement?: string }

const digits = (s: any) => String(s ?? "").replace(/\D/g, "");
const parse = (s: any) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// Parse un montant FR/EN : "360000.00" (point décimal), "140000,00" (virgule),
// "350 000,00", "1.250.000,00"… sans confondre séparateur de milliers et décimale.
export function parseMontant(raw: string): number | null {
  let s = String(raw ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc > -1) s = s.replace(",", ".");
  // sinon : seulement des points (décimale) ou rien -> on garde tel quel
  const n = Number(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function prixCession(etab: any): number | null {
  const m = (etab?.origineFonds ?? "").match(/prix stipul[ée] de\s+([\d  .,]+)\s*euros/i);
  return m ? parseMontant(m[1]) : null;
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

function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function stats(prix: number[]): Stats {
  const s = [...prix].sort((a, b) => a - b);
  const n = s.length;
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

/** Comparables de cession (BODACC) pour une famille + zone + fenêtre (mois). */
export async function comparablesFonds(
  famille: FamilleMetier,
  zone: ZoneEstim,
  moisRetour = 24,
  maxPages = 6,
): Promise<{ comparables: Comparable[]; stats: Stats }> {
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
      const activite = etab?.activite ?? null;
      if (familleMetier(activite, null) !== famille) continue; // même famille métier
      const prix = prixCession(etab);
      if (prix == null) continue;
      const adr = etab?.adresse;
      comps.push({
        denomination: rec.commercant ?? null,
        activite,
        code_postal: adr?.codePostal ?? rec.cp ?? null,
        ville: adr?.ville ?? rec.ville ?? null,
        prix,
        date: rec.dateparution ?? null,
        url: rec.url_complete ?? null,
      });
    }
    if (res.length < 100) break;
  }
  comps.sort((a, b) => b.prix - a.prix);
  return { comparables: comps, stats: stats(comps.map((c) => c.prix)) };
}

export interface EntreeEstimation {
  famille: FamilleMetier;
  zone: ZoneEstim;
  ca?: number | null;          // CA HT annuel (si connu) -> approche multiple
  moisRetour?: number;
}

export interface Estimation {
  famille: FamilleMetier;
  famille_label: string;
  zone: ZoneEstim;
  comparables: Comparable[];
  stats: Stats;
  // approche comparables (quartiles, robuste aux extrêmes)
  fourchette_comparables: { bas: number; median: number; haut: number } | null;
  // approche multiple du CA
  multiple_ca: { ca: number; pct_bas: number; pct_haut: number; bas: number; haut: number } | null;
  // fourchette retenue (synthèse)
  fourchette_retenue: { bas: number; haut: number } | null;
  fiabilite: "faible" | "moyenne" | "bonne"; // selon le nb de comparables
}

export async function estimationFonds(e: EntreeEstimation): Promise<Estimation> {
  const { comparables, stats: st } = await comparablesFonds(e.famille, e.zone, e.moisRetour ?? 24);

  const fComps = st.n >= 3 ? { bas: Math.round(st.q1), median: Math.round(st.median), haut: Math.round(st.q3) } : null;

  let mult: Estimation["multiple_ca"] = null;
  if (e.ca && e.ca > 0) {
    const b = BANDES_CA[e.famille] ?? BANDES_CA.autre;
    mult = { ca: e.ca, pct_bas: b.bas, pct_haut: b.haut, bas: Math.round(e.ca * b.bas), haut: Math.round(e.ca * b.haut) };
  }

  // Synthèse : si on a les deux, on mélange (moyenne des bornes) ; sinon celle dispo.
  let retenue: Estimation["fourchette_retenue"] = null;
  if (fComps && mult) {
    retenue = { bas: Math.round((fComps.bas + mult.bas) / 2), haut: Math.round((fComps.haut + mult.haut) / 2) };
  } else if (fComps) {
    retenue = { bas: fComps.bas, haut: fComps.haut };
  } else if (mult) {
    retenue = { bas: mult.bas, haut: mult.haut };
  }

  const fiabilite: Estimation["fiabilite"] = st.n >= 8 ? "bonne" : st.n >= 3 ? "moyenne" : "faible";

  return {
    famille: e.famille,
    famille_label: METIER_LABEL[e.famille],
    zone: e.zone,
    comparables,
    stats: st,
    fourchette_comparables: fComps,
    multiple_ca: mult,
    fourchette_retenue: retenue,
    fiabilite,
  };
}

// ---------- Document « Avis de valeur » (HTML style TBEECOM, à remettre au client) ----------
const eur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function genererAvisValeurHtml(
  est: Estimation,
  ctx?: { enseigne?: string; adresse?: string; agence?: any },
): string {
  const a = ctx?.agence ?? {};
  const zoneLabel = est.zone.codePostal ? `CP ${est.zone.codePostal}` : `département ${est.zone.departement}`;
  const fiabBadge = { faible: "#B91C1C", moyenne: "#D2963C", bonne: "#2F855A" }[est.fiabilite];
  const comps = est.comparables.slice(0, 12);

  const ligneComps = comps.length
    ? comps.map((c) =>
        `<tr><td>${c.denomination ?? "—"}</td><td>${(c.activite ?? "").slice(0, 40)}</td><td>${c.ville ?? ""} ${c.code_postal ?? ""}</td><td style="text-align:right">${eur(c.prix)}</td><td>${c.date ?? ""}</td></tr>`,
      ).join("")
    : `<tr><td colspan="5" style="color:#9aa3af">Aucun comparable sur la période</td></tr>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>Avis de valeur — ${ctx?.enseigne ?? est.famille_label}</title>
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
    table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}
    th,td{border-bottom:1px solid #e2e7ee;padding:5px 7px;text-align:left}
    th{color:#6b7280;font-weight:600}
    .note{font-size:11px;color:#6b7280}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;color:#fff;font-size:11px;font-weight:700}
  </style></head><body><div class="page">
  <div class="head">
    <div class="brand">TBE<b>E</b>COM</div>
    <div class="agence">${a.raison_sociale ?? "MENESGUEN Immobilier"} — TBEECOM<br>${a.siege ?? "128 rue de la Boétie, 75008 Paris"}<br>contact@tbeecom.com</div>
  </div>

  <h1>Avis de valeur — fonds de commerce</h1>
  <p style="text-align:center;color:#6b7280">${ctx?.enseigne ? `<b>${ctx.enseigne}</b> — ` : ""}${est.famille_label}${ctx?.adresse ? ` · ${ctx.adresse}` : ` · ${zoneLabel}`}</p>

  <div class="estim">
    <div class="note">Fourchette de valorisation estimée</div>
    <div class="val">${est.fourchette_retenue ? `${eur(est.fourchette_retenue.bas)} — ${eur(est.fourchette_retenue.haut)}` : "Données insuffisantes"}</div>
    <div class="note">Fiabilité : <span class="badge" style="background:${fiabBadge}">${est.fiabilite}</span> · ${est.stats.n} comparable(s)</div>
  </div>

  <h2>Méthode</h2>
  <p>Cet avis croise deux approches : (1) les <b>comparables de cession</b> de ${est.famille_label.toLowerCase()} publiés au BODACC sur la zone (${zoneLabel}) au cours des 24 derniers mois ; (2) le cas échéant, un <b>multiple du chiffre d'affaires</b> selon les usages de la profession. La fourchette retenue est la synthèse de ces approches.</p>

  ${est.fourchette_comparables ? `
  <h2>1. Comparables de cession (BODACC)</h2>
  <p>Sur ${est.stats.n} cessions comparables : médiane <b>${eur(est.stats.median)}</b>, fourchette interquartile ${eur(est.fourchette_comparables.bas)} — ${eur(est.fourchette_comparables.haut)} (min ${eur(est.stats.min)}, max ${eur(est.stats.max)}).</p>
  <table><thead><tr><th>Enseigne</th><th>Activité</th><th>Lieu</th><th style="text-align:right">Prix</th><th>Date</th></tr></thead><tbody>${ligneComps}</tbody></table>
  ` : `<h2>1. Comparables de cession</h2><p class="note">Trop peu de comparables sur la zone/période pour une fourchette robuste (${est.stats.n}). Élargir la zone (département) ou la période.</p>`}

  ${est.multiple_ca ? `
  <h2>2. Multiple du chiffre d'affaires</h2>
  <p>Sur la base d'un CA HT de <b>${eur(est.multiple_ca.ca)}</b> et d'un usage de ${Math.round(est.multiple_ca.pct_bas * 100)} % à ${Math.round(est.multiple_ca.pct_haut * 100)} % du CA pour cette activité : <b>${eur(est.multiple_ca.bas)} — ${eur(est.multiple_ca.haut)}</b>.</p>` : ""}

  <h2>Réserves</h2>
  <p class="note">Avis de valeur indicatif établi à partir de données publiques (BODACC, Annuaire des Entreprises) et de repères de marché. Il ne constitue ni une expertise au sens réglementaire, ni un engagement sur un prix. La valeur réelle dépend de l'emplacement précis, du bail, de l'état du matériel, de la rentabilité (EBE) et des conditions de marché. Fait le ${new Date().toLocaleDateString("fr-FR")}.</p>

  </div></body></html>`;
}

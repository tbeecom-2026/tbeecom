// src/lib/analyses.ts
// Analyses de marché à partir de BODACC (gratuit). Trois lectures :
//   1) parZone   : classement géographique (group_by côté serveur = 1 appel, complet).
//   2) parMois   : tendance temporelle (1 petit appel "count" par mois).
//   3) parActivite : répartition par famille métier (échantillon classé côté client).
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

export interface ZoneEvt { departement?: string } // vide = national ; sinon un département

const enc = encodeURIComponent;
function depuisMois(mois: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - mois);
  return d.toISOString().slice(0, 10);
}
function whereBase(type: EvtType, zone: ZoneEvt, mois: number, extra = ""): string {
  let w = `familleavis="${FAMILLE_AVIS[type]}" and dateparution>="${depuisMois(mois)}"`;
  if (zone.departement) w += ` and numerodepartement="${zone.departement}"`;
  return extra ? `${w} and ${extra}` : w;
}

// ---------- 1) Classement par zone (agrégat serveur) ----------
export interface LigneZone { zone: string; nb: number }
export async function parZone(
  type: EvtType,
  zone: ZoneEvt,
  mois = 12,
  limit = 20,
): Promise<LigneZone[]> {
  // Si un département est ciblé -> on détaille par code postal ; sinon par département.
  const champ = zone.departement ? "cp" : "numerodepartement";
  const where = whereBase(type, zone, mois);
  const url = `${API_BODACC}?where=${enc(where)}&group_by=${champ}&select=${enc(`${champ} as zone, count(*) as nb`)}&order_by=${enc("nb desc")}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  return (d?.results ?? [])
    .filter((x: any) => x?.zone)
    .map((x: any) => ({ zone: String(x.zone), nb: Number(x.nb) || 0 }));
}

// ---------- 2) Tendance mensuelle (un count par mois) ----------
export interface LigneMois { mois: string; nb: number }
export async function parMois(type: EvtType, zone: ZoneEvt, mois = 12): Promise<LigneMois[]> {
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
    if (zone.departement) w += ` and numerodepartement="${zone.departement}"`;
    const url = `${API_BODACC}?where=${enc(w)}&limit=1`;
    const idx = out.length;
    out.push({ mois: label, nb: 0 });
    reqs.push(
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { out[idx].nb = Number(d?.total_count ?? 0); })
        .catch(() => {}),
    );
  }
  await Promise.all(reqs);
  return out;
}

// ---------- 3) Répartition par famille métier (échantillon classé) ----------
export interface LigneActivite { famille: FamilleMetier; label: string; nb: number }
export async function parActivite(
  type: EvtType,
  zone: ZoneEvt,
  mois = 12,
  maxRecords = 600,
): Promise<{ repartition: LigneActivite[]; echantillon: number; renseignes: number }> {
  const where = whereBase(type, zone, mois);
  const base = `${API_BODACC}?where=${enc(where)}&order_by=${enc("dateparution desc")}&limit=100`;
  const compte = new Map<FamilleMetier, number>();
  let n = 0;
  for (let p = 0; p * 100 < maxRecords; p++) {
    const r = await fetch(`${base}&offset=${p * 100}`);
    if (!r.ok) break;
    const res = (await r.json())?.results ?? [];
    for (const rec of res) {
      let act: string | null = null;
      try { act = JSON.parse(rec.listeetablissements ?? "null")?.etablissement?.activite ?? null; } catch {}
      if (!act) { try { act = JSON.parse(rec.listepersonnes ?? "null")?.personne?.activite ?? null; } catch {} }
      const fam = familleMetier(act, null);
      compte.set(fam, (compte.get(fam) ?? 0) + 1);
      n++;
    }
    if (res.length < 100) break;
  }
  const renseignes = n - (compte.get("non_precise") ?? 0);
  compte.delete("non_precise"); // activité non renseignée dans BODACC : exclue du camembert
  const repartition = [...compte.entries()]
    .map(([famille, nb]) => ({ famille, label: METIER_LABEL[famille], nb }))
    .sort((a, b) => b.nb - a.nb);
  return { repartition, echantillon: n, renseignes };
}

// Libellé lisible d'une zone (CP parisien -> arrondissement).
export function libelleZone(z: string): string {
  if (/^75\d{3}$/.test(z)) return `Paris ${Number(z.slice(3))}e`;
  return z;
}

// src/lib/adresseEntreprises.ts
// Autocomplétion d'adresse (Base Adresse Nationale) + recherche des sociétés
// immatriculées à une adresse (API Recherche Entreprises, /near_point).
// APIs publiques, gratuites, CORS ouvert -> appelables depuis le front.

const API_BAN = "https://api-adresse.data.gouv.fr/search/";
const API_ENT = "https://recherche-entreprises.api.gouv.fr";

export interface AdresseSuggestion {
  label: string; housenumber?: string; street?: string;
  postcode?: string; citycode?: string; city?: string;
  lat: number; lon: number;
}

export async function autocompleteAdresse(q: string): Promise<AdresseSuggestion[]> {
  if (!q || q.trim().length < 3) return [];
  try {
    const r = await fetch(`${API_BAN}?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.features ?? []).map((f: any) => ({
      label: f.properties?.label,
      housenumber: f.properties?.housenumber,
      street: f.properties?.street,
      postcode: f.properties?.postcode,
      citycode: f.properties?.citycode,
      city: f.properties?.city,
      lat: f.geometry?.coordinates?.[1],
      lon: f.geometry?.coordinates?.[0],
    }));
  } catch { return []; }
}

export interface SocieteCandidate {
  siren: string | null; siret: string | null;
  denomination: string | null; enseigne: string | null;
  naf: string | null; adresse: string | null;
  actif: boolean; ca: number | null;
}

const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Sociétés implantées près d'un point (adresse). ref permet de filtrer sur le numéro de voie exact. */
export async function societesAAdresse(
  lat: number, lon: number, ref?: { numero?: string; voie?: string },
): Promise<SocieteCandidate[]> {
  try {
    const r = await fetch(`${API_ENT}/near_point?lat=${lat}&long=${lon}&radius=0.08&per_page=25`);
    if (!r.ok) return [];
    const d = await r.json();
    const out: SocieteCandidate[] = [];
    for (const e of (d?.results ?? [])) {
      const etabs = (e.matching_etablissements ?? []).filter((x: any) => x?.etat_administratif === "A");
      const etab = etabs[0] ?? e.siege;
      if (!etab) continue;
      const ens = (etab.liste_enseignes ?? [])[0] ?? e.nom_commercial ?? null;
      const fin = e.finances ? (Object.values(e.finances).slice(-1)[0] as any) : null;
      out.push({
        siren: e.siren ?? null,
        siret: etab.siret ?? null,
        denomination: e.nom_complet ?? e.nom_raison_sociale ?? null,
        enseigne: ens,
        naf: etab.activite_principale ?? e.activite_principale ?? null,
        adresse: etab.adresse ?? null,
        actif: (e.etat_administratif ?? "A") === "A" && (etab.etat_administratif ?? "A") === "A",
        ca: fin?.ca ?? null,
      });
    }
    // Filtre sur le numéro de voie (adresse exacte) si dispo, avec repli
    let list = out;
    if (ref?.numero) {
      const rx = new RegExp(`(^|\\D)${ref.numero}(\\D|$)`);
      const exact = out.filter((c) => c.adresse && rx.test(c.adresse));
      if (ref.voie) {
        const v = norm(ref.voie).split(/\s+/).filter((w) => w.length > 3)[0];
        const exact2 = exact.filter((c) => c.adresse && norm(c.adresse).includes(v ?? ""));
        if (exact2.length) list = exact2;
        else if (exact.length) list = exact;
      } else if (exact.length) list = exact;
    }
    // Dédupe par SIREN, actifs d'abord
    const seen = new Set<string>(); const res: SocieteCandidate[] = [];
    for (const c of [...list.filter((c) => c.actif), ...list.filter((c) => !c.actif)]) {
      const k = c.siren ?? c.siret ?? JSON.stringify(c);
      if (seen.has(k)) continue; seen.add(k); res.push(c);
    }
    return res.slice(0, 15);
  } catch { return []; }
}

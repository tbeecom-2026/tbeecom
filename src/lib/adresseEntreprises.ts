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

/** Types de voie génériques à ignorer dans la comparaison du nom de voie. */
const TYPE_VOIE = new Set(["BOULEVARD","BD","AVENUE","AV","RUE","PLACE","PL","ALLEE","IMPASSE","CHEMIN","ROUTE","QUAI","COURS","VOIE","PASSAGE","SQUARE","DE","DU","DES","LA","LE","LES","D","L","ET","AUX","SUR"]);

function memeVoie(libelleApi: string | null | undefined, voieBAN?: string): boolean {
  if (!voieBAN) return true;
  const tokens = norm(voieBAN).split(/\s+/).filter((w) => w.length > 2 && !TYPE_VOIE.has(w));
  if (!tokens.length) return true;
  const cible = norm(libelleApi ?? "");
  return tokens.some((t) => cible.includes(t));
}

/** Sociétés immatriculées EXACTEMENT à l'adresse (numéro de voie + CP + nom de voie). */
export async function societesAAdresse(
  lat: number, lon: number, ref?: { numero?: string; voie?: string; cp?: string },
): Promise<SocieteCandidate[]> {
  try {
    const r = await fetch(`${API_ENT}/near_point?lat=${lat}&long=${lon}&radius=0.06&per_page=50`);
    if (!r.ok) return [];
    const d = await r.json();
    const numRefN = ref?.numero != null && /^\d+/.test(String(ref.numero)) ? parseInt(String(ref.numero), 10) : null;
    const cpRef = ref?.cp ?? null;
    const TOLERANCE = 2; // on accepte le numéro cherché à +/- 2 (adresses d'angle, décalages)

    const matchAdresse = (x: any): boolean => {
      if (!x) return false;
      let numOk = true;
      if (numRefN != null) {
        const n = parseInt(String(x.numero_voie ?? ""), 10);
        numOk = isFinite(n) && Math.abs(n - numRefN) <= TOLERANCE;
      }
      const cpOk = cpRef ? String(x.code_postal ?? "") === cpRef : true;
      return numOk && cpOk && memeVoie(x.libelle_voie ?? x.adresse, ref?.voie);
    };

    const res: SocieteCandidate[] = [];
    const seen = new Set<string>();
    for (const e of (d?.results ?? [])) {
      const etabsAll = [...(e.matching_etablissements ?? []), e.siege].filter(Boolean);
      const matched = etabsAll.filter(matchAdresse);
      if (!matched.length) continue; // pas à l'adresse exacte -> écarté
      const etab = matched.find((x: any) => x.etat_administratif === "A") ?? matched[0];
      const key = e.siren ?? etab.siret ?? "";
      if (seen.has(key)) continue; seen.add(key);
      const ens = (etab.liste_enseignes ?? [])[0] ?? e.nom_commercial ?? null;
      const fin = e.finances ? (Object.values(e.finances).slice(-1)[0] as any) : null;
      res.push({
        siren: e.siren ?? null,
        siret: etab.siret ?? null,
        denomination: e.nom_complet ?? e.nom_raison_sociale ?? null,
        enseigne: ens,
        naf: etab.activite_principale ?? e.activite_principale ?? null,
        adresse: etab.adresse ?? null,
        actif: (etab.etat_administratif ?? "A") === "A",
        ca: fin?.ca ?? null,
      });
    }
    // tri par proximité du numéro cherché, puis actifs d'abord
    const numOf = (a: SocieteCandidate) => { const m = String(a.adresse ?? "").match(/\d+/); return m ? parseInt(m[0], 10) : 9999; };
    res.sort((a, b) => Math.abs(numOf(a) - (numRefN ?? 0)) - Math.abs(numOf(b) - (numRefN ?? 0)));
    return [...res.filter((c) => c.actif), ...res.filter((c) => !c.actif)].slice(0, 15);
  } catch { return []; }
}

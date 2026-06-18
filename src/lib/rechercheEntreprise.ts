// src/lib/rechercheEntreprise.ts
// Récupération d'infos entreprise via l'API publique gratuite de l'État
// (Annuaire des Entreprises : https://recherche-entreprises.api.gouv.fr).
// Aucune clé requise, CORS ouvert -> appelable directement depuis le front.
// Sert à pré-remplir une fiche contact "société" depuis un SIRET/SIREN ou un nom.

const API = "https://recherche-entreprises.api.gouv.fr/search";

export interface InfoEntreprise {
  siren: string | null;
  siret: string | null;            // SIRET du siège (ou de l'établissement au bon CP)
  denomination: string | null;
  forme_code: string | null;       // code catégorie juridique INSEE (ex. "5499")
  forme_juridique: string | null;  // libellé (SARL, SAS…) déduit du code INSEE
  num_tva: string | null;          // TVA intracom FR calculée depuis le SIREN
  naf: string | null;              // code APE/NAF (ex. 56.10C)
  naf_libelle: string | null;      // libellé NAF (ex. "Restauration traditionnelle")
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
  dirigeant: string | null;        // "Prénom NOM (qualité)" du 1er dirigeant
  date_creation: string | null;
  actif: boolean;                  // false si l'entreprise est cessée/radiée
}

export interface CandidatEntreprise extends InfoEntreprise {
  nombre_etablissements: number;
}

// Codes catégorie juridique INSEE les plus courants -> libellé.
const FORMES: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC",
  "5410": "SARL", "5415": "SARL", "5426": "SARL", "5430": "SARL", "5499": "SARL",
  "5498": "EURL",
  "5710": "SAS",
  "5720": "SASU",
  "5505": "SA", "5510": "SA", "5515": "SA",
  "5385": "SAS", // (SE / divers)
  "6540": "SCI",
  "6220": "GIE",
  "9220": "Association",
};

// Libellés NAF (rév. 2) — sous-ensemble couvrant les activités de fonds de commerce
// fréquentes ; repli sur le code brut si absent. Clé = code sans espace, en majuscule.
const NAF_LIBELLES: Record<string, string> = {
  "10.71C": "Boulangerie et boulangerie-pâtisserie",
  "10.71D": "Pâtisserie",
  "10.13B": "Charcuterie",
  "47.11B": "Supérette",
  "47.11C": "Supermarché",
  "47.11D": "Magasin d'alimentation générale",
  "47.11F": "Hypermarché",
  "47.21Z": "Commerce de détail de fruits et légumes",
  "47.22Z": "Commerce de détail de viandes et produits à base de viande",
  "47.23Z": "Commerce de détail de poissons, crustacés et mollusques",
  "47.24Z": "Commerce de détail de pain, pâtisserie et confiserie",
  "47.25Z": "Commerce de détail de boissons",
  "47.26Z": "Commerce de détail de produits à base de tabac",
  "47.29Z": "Autre commerce de détail alimentaire en magasin spécialisé",
  "47.41Z": "Commerce de détail d'ordinateurs et de logiciels",
  "47.51Z": "Commerce de détail de textiles",
  "47.52B": "Commerce de détail de quincaillerie, bricolage",
  "47.53Z": "Commerce de détail de tapis, moquettes et revêtements",
  "47.54Z": "Commerce de détail d'appareils électroménagers",
  "47.59A": "Commerce de détail de meubles",
  "47.61Z": "Commerce de détail de livres",
  "47.62Z": "Commerce de détail de journaux et papeterie",
  "47.64Z": "Commerce de détail d'articles de sport",
  "47.71Z": "Commerce de détail d'habillement",
  "47.72A": "Commerce de détail de la chaussure",
  "47.72B": "Commerce de détail de maroquinerie et d'articles de voyage",
  "47.73Z": "Commerce de détail de produits pharmaceutiques (pharmacie)",
  "47.75Z": "Commerce de détail de parfumerie et de produits de beauté",
  "47.76Z": "Commerce de détail de fleurs, plantes, animaux de compagnie",
  "47.77Z": "Commerce de détail d'articles d'horlogerie et de bijouterie",
  "47.78C": "Autres commerces de détail spécialisés divers",
  "45.11Z": "Commerce de voitures et de véhicules automobiles légers",
  "45.20A": "Entretien et réparation de véhicules automobiles légers",
  "45.20B": "Entretien et réparation d'autres véhicules automobiles",
  "45.32Z": "Commerce de détail d'équipements automobiles",
  "45.40Z": "Commerce et réparation de motocycles",
  "55.10Z": "Hôtels et hébergement similaire",
  "56.10A": "Restauration traditionnelle",
  "56.10B": "Cafétérias et autres libres-services",
  "56.10C": "Restauration de type rapide",
  "56.21Z": "Services des traiteurs",
  "56.29A": "Restauration collective sous contrat",
  "56.30Z": "Débits de boissons (bar, café)",
  "96.02A": "Coiffure",
  "96.02B": "Soins de beauté",
  "96.04Z": "Entretien corporel (spa, bien-être)",
  "96.09Z": "Autres services personnels",
  "93.13Z": "Activités des centres de culture physique (fitness)",
  "68.10Z": "Activités des marchands de biens immobiliers",
  "68.20A": "Location de logements",
  "68.20B": "Location de terrains et d'autres biens immobiliers",
  "68.31Z": "Agences immobilières",
  "68.32A": "Administration d'immeubles et autres biens immobiliers",
  "70.10Z": "Activités des sièges sociaux",
  "70.22Z": "Conseil pour les affaires et la gestion",
  "64.20Z": "Activités des sociétés holding",
  "82.99Z": "Autres activités de soutien aux entreprises",
  "95.23Z": "Réparation de chaussures et d'articles en cuir",
  "95.25Z": "Réparation d'articles d'horlogerie et de bijouterie",
};

function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

function libelleNaf(code: string | null | undefined): string | null {
  if (!code) return null;
  const k = code.toUpperCase().replace(/\s/g, "");
  return NAF_LIBELLES[k] ?? null;
}

// Clé TVA intracommunautaire française à partir du SIREN.
export function tvaFrFromSiren(siren: string | null): string | null {
  const s = digits(siren);
  if (s.length !== 9) return null;
  const cle = (12 + 3 * (Number(s) % 97)) % 97;
  return `FR${String(cle).padStart(2, "0")}${s}`;
}

function mapResult(r: any, cpVoulu?: string): InfoEntreprise {
  const siege = r?.siege ?? {};
  // Choisir le SIRET : si un CP est fourni, préférer l'établissement qui matche ce CP.
  let etab = siege;
  if (cpVoulu) {
    const m = (r?.matching_etablissements ?? []).find((e: any) => e?.code_postal === cpVoulu && e?.etat_administratif === "A")
      ?? (r?.matching_etablissements ?? []).find((e: any) => e?.code_postal === cpVoulu);
    if (m) etab = m;
  }
  const dir = (r?.dirigeants ?? [])[0];
  const dirTxt = dir
    ? [dir.prenoms, dir.nom].filter(Boolean).join(" ").trim() + (dir.qualite ? ` (${dir.qualite})` : "")
    : null;
  const siren = r?.siren ?? null;
  const nafCode = r?.activite_principale ?? siege?.activite_principale ?? null;
  return {
    siren,
    siret: etab?.siret ?? siege?.siret ?? null,
    denomination: r?.nom_raison_sociale ?? r?.nom_complet ?? null,
    forme_code: r?.nature_juridique != null ? String(r.nature_juridique) : null,
    forme_juridique: FORMES[String(r?.nature_juridique)] ?? (r?.nature_juridique ? `Code ${r.nature_juridique}` : null),
    num_tva: tvaFrFromSiren(siren),
    naf: nafCode,
    naf_libelle: libelleNaf(nafCode),
    adresse: etab?.adresse ?? siege?.adresse ?? null,
    code_postal: etab?.code_postal ?? siege?.code_postal ?? null,
    commune: etab?.libelle_commune ?? siege?.libelle_commune ?? null,
    dirigeant: dirTxt,
    date_creation: r?.date_creation ?? null,
    actif: (r?.etat_administratif ?? "A") === "A",
  };
}

/** Recherche directe par SIREN (9) ou SIRET (14). Retourne l'entreprise ou null. */
export async function chercherParSiret(siretOuSiren: string): Promise<InfoEntreprise | null> {
  const num = digits(siretOuSiren);
  if (num.length !== 9 && num.length !== 14) return null;
  const cp = num.length === 14 ? undefined : undefined;
  const res = await fetch(`${API}?q=${num}&per_page=1`);
  if (!res.ok) throw new Error(`API entreprises: ${res.status}`);
  const data = await res.json();
  const r = (data?.results ?? [])[0];
  return r ? mapResult(r, cp) : null;
}

/** Recherche par nom (+ code postal optionnel). Retourne une liste de candidats à proposer à l'utilisateur. */
export async function chercherParNom(nom: string, codePostal?: string): Promise<CandidatEntreprise[]> {
  const params = new URLSearchParams({ q: nom, per_page: "5" });
  if (codePostal) params.set("code_postal", digits(codePostal).slice(0, 5));
  const res = await fetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error(`API entreprises: ${res.status}`);
  const data = await res.json();
  return (data?.results ?? []).map((r: any) => ({
    ...mapResult(r, codePostal),
    nombre_etablissements: r?.nombre_etablissements ?? 1,
  }));
}

// src/lib/metier.ts
// Normalisation des métiers de fonds de commerce.
// nature_activite est saisi en texte libre (~156 orthographes : fleuriste/Fleuriste,
// CREPERIE/Crêperie, GARAGE MECANIQUE…). On le ramène aux 7 familles + "Autre"
// définies dans REFERENTIEL_METIERS_FDC.md (§2).

export type FamilleMetier =
  | "restauration_assise"
  | "bar_cafe_tabac"
  | "restauration_rapide"
  | "boulangerie_patisserie"
  | "garage_carrosserie"
  | "fleuriste"
  | "coiffure_esthetique"
  | "autre"
  | "non_precise";

export const METIER_LABEL: Record<FamilleMetier, string> = {
  restauration_assise: "Restauration assise",
  bar_cafe_tabac: "Bar / Café / Tabac",
  restauration_rapide: "Restauration rapide",
  boulangerie_patisserie: "Boulangerie / Pâtisserie",
  garage_carrosserie: "Garage / Carrosserie",
  fleuriste: "Fleuriste",
  coiffure_esthetique: "Coiffure / Esthétique",
  autre: "Autre commerce",
  non_precise: "Non précisé",
};

// minuscule + sans accents, pour matcher quelle que soit la saisie
function strip(s?: string | null): string {
  return (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Renvoie la famille métier à partir de la nature d'activité (texte libre).
 * Repli sur type_commerce si la nature est vide. Ordre de test = du plus
 * spécifique au plus ambigu (ex. "bar" l'emporte sur "brasserie").
 */
export function familleMetier(natureActivite?: string | null, typeCommerce?: string | null): FamilleMetier {
  const n = strip(natureActivite);
  const has = (...kw: string[]) => kw.some((k) => n.includes(k));

  if (n) {
    if (has("fleur")) return "fleuriste";
    if (has("garage", "carross", "mecaniq", "vhu", "pneu", "automobile", "reparation auto", "controle technique"))
      return "garage_carrosserie";
    if (
      has(
        "coiff",
        "barbier",
        "esthet",
        "ongle",
        "institut de beaute",
        "spa",
        "massage",
        "epilation",
        "parfum",
        "beaute",
      )
    )
      return "coiffure_esthetique";
    if (
      has("boulang", "patiss", "viennois", "chocolat", "confiser", "salon de the", "terminal de cuisson", "point chaud")
    )
      return "boulangerie_patisserie";
    if (
      has(
        "rapide",
        "fast",
        "kebab",
        "burger",
        "sandwich",
        "snack",
        "tacos",
        "emporter",
        "friterie",
        "food truck",
        "saladerie",
      )
    )
      return "restauration_rapide";
    if (has("tabac", "bar ", "bar,", "bar-", "café", "cafe", "pub", "taverne", " bar")) return "bar_cafe_tabac";
    if (has("restaur", "brasserie", "pizz", "crep", "bistrot", "grill", "trattoria", "creperie"))
      return "restauration_assise";
    return "autre";
  }

  // Pas de nature précise → on ne devine pas : "non précisé" (incite à compléter la donnée).
  // (type_commerce est trop grossier : "Commerce de services", "Restaurant, bar"…)
  void typeCommerce;
  return "non_precise";
}

// ---------- Libellé de l'activité réelle (pour ne plus afficher "Autre commerce") ----------
// Table NAF (rév. 2) des commerces courants. Clé = code sans espace, en majuscule.
const NAF_LIBELLES: Record<string, string> = {
  "47.73Z": "Pharmacie",
  "47.74Z": "Commerce d'articles médicaux et orthopédiques",
  "47.75Z": "Parfumerie / produits de beauté",
  "47.78A": "Commerce d'optique",
  "47.77Z": "Horlogerie / bijouterie",
  "47.71Z": "Habillement",
  "47.72A": "Chaussures",
  "47.72B": "Maroquinerie / articles de voyage",
  "47.51Z": "Textiles",
  "47.61Z": "Librairie",
  "47.62Z": "Presse / papeterie",
  "47.65Z": "Jeux et jouets",
  "47.64Z": "Articles de sport",
  "47.59A": "Meubles",
  "47.53Z": "Tapis / revêtements",
  "47.54Z": "Électroménager",
  "47.52B": "Quincaillerie / bricolage",
  "47.41Z": "Informatique",
  "47.78C": "Commerce de détail divers",
  "47.22Z": "Boucherie / charcuterie",
  "47.23Z": "Poissonnerie",
  "47.21Z": "Primeur (fruits et légumes)",
  "47.24Z": "Boulangerie / pâtisserie (détail)",
  "47.25Z": "Caviste / boissons",
  "47.26Z": "Tabac",
  "47.29Z": "Épicerie fine / alimentation spécialisée",
  "47.11B": "Supérette",
  "47.11C": "Supermarché",
  "47.11D": "Alimentation générale",
  "47.76Z": "Fleuriste / animalerie",
  "47.78B": "Charbons et combustibles",
  "10.71C": "Boulangerie",
  "10.71D": "Pâtisserie",
  "10.13B": "Charcuterie (fabrication)",
  "45.11Z": "Vente de véhicules",
  "45.20A": "Garage / entretien auto",
  "45.20B": "Carrosserie",
  "45.32Z": "Équipements automobiles",
  "45.40Z": "Vente / réparation de motos",
  "56.10A": "Restauration traditionnelle",
  "56.10C": "Restauration rapide",
  "56.21Z": "Traiteur",
  "56.30Z": "Bar / café / débit de boissons",
  "96.02A": "Coiffure",
  "96.02B": "Soins de beauté",
  "96.04Z": "Spa / bien-être",
  "96.09Z": "Autres services personnels",
  "93.13Z": "Salle de sport / fitness",
  "95.23Z": "Cordonnerie",
  "95.25Z": "Réparation horlogerie / bijouterie",
  "55.10Z": "Hôtel / hébergement",
  "75.00Z": "Vétérinaire",
};

export function libelleNaf(code?: string | null): string | null {
  if (!code) return null;
  return NAF_LIBELLES[code.toUpperCase().replace(/\s/g, "")] ?? null;
}

// Capitalise + tronque un texte d'activité libre (BODACC) pour l'affichage.
function cleanActivite(t?: string | null, max = 46): string | null {
  const s = (t ?? "").trim();
  if (!s) return null;
  const c = s.charAt(0).toUpperCase() + s.slice(1);
  return c.length > max ? c.slice(0, max) + "…" : c;
}

/**
 * Libellé d'activité à AFFICHER. Si la famille est nommée → son libellé.
 * Sinon (autre / non précisé) : le libellé NAF (prospection : on a le code NAF),
 * à défaut le texte d'activité brut (radar : texte libre BODACC), à défaut "Autre commerce".
 */
export function activiteLisible(famille: FamilleMetier, naf?: string | null, activiteTexte?: string | null): string {
  if (famille !== "autre" && famille !== "non_precise") return METIER_LABEL[famille];
  return libelleNaf(naf) ?? cleanActivite(activiteTexte) ?? METIER_LABEL[famille];
}

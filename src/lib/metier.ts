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
    if (has("garage", "carross", "mecaniq", "vhu", "pneu", "automobile", "reparation auto", "controle technique")) return "garage_carrosserie";
    if (has("coiff", "barbier", "esthet", "ongle", "institut de beaute", "spa", "massage", "epilation", "parfum", "beaute")) return "coiffure_esthetique";
    if (has("boulang", "patiss", "viennois", "chocolat", "confiser", "salon de the", "terminal de cuisson", "point chaud")) return "boulangerie_patisserie";
    if (has("rapide", "fast", "kebab", "burger", "sandwich", "snack", "tacos", "emporter", "friterie", "food truck", "saladerie")) return "restauration_rapide";
    if (has("tabac", "bar ", "bar,", "bar-", "café", "cafe", "pub", "taverne", " bar")) return "bar_cafe_tabac";
    if (has("restaur", "brasserie", "pizz", "crep", "bistrot", "grill", "trattoria", "creperie")) return "restauration_assise";
    return "autre";
  }

  // Pas de nature précise → on ne devine pas : "non précisé" (incite à compléter la donnée).
  // (type_commerce est trop grossier : "Commerce de services", "Restaurant, bar"…)
  void typeCommerce;
  return "non_precise";
}

/**
 * honoraires.ts
 * Calcul automatique des honoraires TBEECOM depuis le barème Supabase
 */

export interface BaremeTranche {
  id: string;
  ordre: number;
  type_trans: string;
  prix_min: number | null;
  prix_max: number | null;
  type_calcul: "forfait" | "pourcentage";
  valeur: number;
  libelle: string | null;
}

/**
 * Applique le barème FDC à un prix de vente.
 * Retourne { montant, pct } — pct est null pour les forfaits.
 */
export function calcHonoraires(
  prix: number,
  bareme: BaremeTranche[]
): { montant: number; pct: number | null } | null {
  if (!prix || prix <= 0 || !bareme.length) return null;

  // Trier par ordre croissant
  const tranches = [...bareme]
    .filter((t) => t.type_trans === "fdc")
    .sort((a, b) => a.ordre - b.ordre);

  for (const t of tranches) {
    const dansMin = t.prix_min == null || prix >= t.prix_min;
    const dansMax = t.prix_max == null || prix <= t.prix_max;
    if (dansMin && dansMax) {
      if (t.type_calcul === "forfait") {
        return { montant: t.valeur, pct: null };
      } else {
        const montant = Math.round(prix * t.valeur / 100);
        return { montant, pct: t.valeur };
      }
    }
  }
  return null;
}

/**
 * Calcule le % effectif à partir du montant et du prix
 * (utile pour affichage quand c'est un forfait)
 */
export function pctEffectif(montant: number, prix: number): number {
  if (!prix) return 0;
  return Math.round((montant / prix) * 10000) / 100; // 2 décimales
}

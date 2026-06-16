// src/lib/mandatStatus.ts
// Etat d'echeance d'un mandat, calcule a partir de la date de fin.
//  - rouge   : date de fin depassee
//  - orange  : fin proche (<= ALERTE_FIN_MANDAT_JOURS jours)
//  - vert    : mandat en cours
// + retrait automatique en base des biens dont le mandat est depasse.
import { supabase } from "@/lib/supabaseClient";

// Delai (en jours) avant la fin du mandat a partir duquel on alerte en orange.
export const ALERTE_FIN_MANDAT_JOURS = 30;

export type MandatDateLevel = "expired" | "soon" | "ok" | "none";

export interface MandatDateState {
  level: MandatDateLevel;
  label: string;
  className: string; // classes Tailwind a passer au <Badge>
  jours: number | null; // jours restants (negatif si depasse)
}

function toMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calcule l'etat d'echeance d'un mandat depuis sa date de fin (string ISO ou null). */
export function getMandatDateState(dateFin: string | null | undefined): MandatDateState {
  if (!dateFin) return { level: "none", label: "", className: "", jours: null };

  const fin = toMidnight(new Date(dateFin));
  if (isNaN(fin.getTime())) return { level: "none", label: "", className: "", jours: null };

  const today = toMidnight(new Date());
  const jours = Math.round((fin.getTime() - today.getTime()) / 86_400_000);

  if (jours < 0) {
    return {
      level: "expired",
      label: "Date de fin de mandat dépassée",
      className: "bg-red-600 text-white hover:bg-red-600",
      jours,
    };
  }
  if (jours <= ALERTE_FIN_MANDAT_JOURS) {
    return {
      level: "soon",
      label: jours === 0 ? "Mandat expire aujourd'hui" : `Fin de mandat dans ${jours} j`,
      className: "bg-orange-500 text-white hover:bg-orange-500",
      jours,
    };
  }
  return {
    level: "ok",
    label: "Mandat en cours",
    className: "bg-emerald-600 text-white hover:bg-emerald-600",
    jours,
  };
}

/**
 * Passe en "Retiré" tout bien dont le mandat est depasse et qui etait encore "Sur le marché".
 * Idempotent : ne touche pas aux biens Vendu / Sous compromis / Archivé / deja Retiré.
 * A appeler au chargement des listes.
 */
export async function retirerMandatsExpires(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { error } = await supabase
    .from("mandats")
    .update({ statut: "Retiré", date_retire: today })
    .lt("mandat_date_fin", today)
    .eq("statut", "Sur le marché");
  if (error) console.error("retirerMandatsExpires:", error.message);
}

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
      label: "Date de mandat dépassée",
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
 * Couleur d'un bien "vendu" selon QUI a réalisé la vente (libellé Netty).
 *  - Réalisé par l'agence OU en inter-agences -> violet (VOTRE vente, mise en avant)
 *  - Réalisé par un confrère / entre particuliers -> bleu (vendu hors agence)
 */
export function getVenduClass(issue?: string | null): string {
  const votreVente = issue === "Réalisé par l'agence" || issue === "Réalisé en inter-agences";
  return votreVente ? "bg-violet-600 text-white hover:bg-violet-600" : "bg-blue-500 text-white hover:bg-blue-500";
}

// Libellés Netty reconnus (colonne J / observations du registre).
const TERMES_NETTY = [
  "Arrivé à terme",
  "Mandat saisi",
  "Réalisé par l'agence",
  "Réalisé en inter-agences",
  "Réalisé par un confrère",
  "Réalisé entre particuliers",
  "Annulé",
  "Non signé",
];

/** Ramène une observation brute (avec notes éventuelles) au libellé Netty court. */
export function nettyLabel(obs?: string | null): string {
  const s = String(obs ?? "").trim();
  const low = s.toLowerCase();
  for (const t of TERMES_NETTY) if (low.startsWith(t.toLowerCase())) return t;
  return s || "—";
}

/** Couleur d'un badge selon le libellé Netty. */
export function getIssueBadgeClass(obs?: string | null): string {
  const t = nettyLabel(obs);
  switch (t) {
    case "Réalisé par l'agence":
    case "Réalisé en inter-agences":
      return "bg-violet-600 text-white hover:bg-violet-600"; // votre vente
    case "Réalisé par un confrère":
    case "Réalisé entre particuliers":
      return "bg-blue-500 text-white hover:bg-blue-500"; // vendu hors agence
    case "Mandat saisi":
      return "bg-emerald-600 text-white hover:bg-emerald-600"; // actif
    case "Arrivé à terme":
      return "bg-slate-500 text-white hover:bg-slate-500"; // expiré
    case "Annulé":
    case "Non signé":
      return "bg-zinc-500 text-white hover:bg-zinc-500"; // sans suite
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

/** Libellés Netty considérés comme "vente réalisée". */
const VENTE_LABELS = new Set([
  "Réalisé par l'agence",
  "Réalisé en inter-agences",
  "Réalisé par un confrère",
  "Réalisé entre particuliers",
]);

export interface MandatEtat {
  label: string;
  className: string;
}

/**
 * État réel d'un mandat à afficher dans la colonne "État".
 * - Vente réalisée  -> libellé + couleur Netty (violet/bleu)
 * - Annulé / Non signé -> gris
 * - Sinon (Mandat saisi, Arrivé à terme, vide) -> calculé depuis la date de fin
 *   (date_fin sinon date_debut + 18 mois) : Arrivé à terme / Fin proche / En cours.
 */
export function getMandatEtat(
  obs: string | null | undefined,
  dateDebut: string | null | undefined,
  dateFin: string | null | undefined,
): MandatEtat {
  const t = nettyLabel(obs);

  if (VENTE_LABELS.has(t)) {
    return { label: t, className: getIssueBadgeClass(obs) };
  }
  if (t === "Annulé" || t === "Non signé") {
    return { label: t, className: "bg-zinc-500 text-white hover:bg-zinc-500" };
  }

  // Calcul par date de fin (réelle ou date_debut + 18 mois).
  let fin: Date | null = null;
  if (dateFin) {
    const d = new Date(dateFin);
    if (!isNaN(d.getTime())) fin = d;
  }
  if (!fin && dateDebut) {
    const d = new Date(dateDebut);
    if (!isNaN(d.getTime())) {
      d.setMonth(d.getMonth() + 18);
      fin = d;
    }
  }
  if (!fin) {
    return { label: "En cours", className: "bg-emerald-600 text-white hover:bg-emerald-600" };
  }

  const today = toMidnight(new Date());
  const finM = toMidnight(fin);
  const jours = Math.round((finM.getTime() - today.getTime()) / 86_400_000);

  if (jours < 0) {
    return { label: "Arrivé à terme", className: "bg-slate-500 text-white hover:bg-slate-500" };
  }
  if (jours <= ALERTE_FIN_MANDAT_JOURS) {
    return { label: "Fin proche", className: "bg-orange-500 text-white hover:bg-orange-500" };
  }
  return { label: "En cours", className: "bg-emerald-600 text-white hover:bg-emerald-600" };
}

/**
 * Passe en "Retiré" tout bien dont le mandat est depasse et qui etait encore "Sur le marché".
 * Idempotent : ne touche pas aux biens Vendu / Sous compromis / Archivé / deja Retiré.
 * A appeler au chargement des listes.
 */
export async function retirerMandatsExpires(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  // NB : le statut est stocké en CODE ('sur_le_marche', 'retire'...), pas en libellé.
  const { error } = await supabase
    .from("mandats")
    .update({ statut: "retire", date_retire: today })
    .lt("mandat_date_fin", today)
    .eq("statut", "sur_le_marche");
  if (error) console.error("retirerMandatsExpires:", error.message);
}

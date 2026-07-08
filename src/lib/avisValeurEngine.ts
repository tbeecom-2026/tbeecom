// src/lib/avisValeurEngine.ts
// Moteur d'avis de valeur TBEECOM — méthodologie validée (double scénario).
// Fonctions PURES et testables (aucun réseau, aucune dépendance UI).
//
// Trois méthodes croisées :
//   A — barème professionnel : CA moyen 3 ans × ratio(curseur) [Q1 / moyen / Q3]
//   B — rentabilité retraitée : EBE retraité × coef ; si EBE retraité <= 0, bascule sur
//       le SDE (revenu de l'exploitant = EBE normalisé avant sa rémunération) × 1,8 (S1) / 1,6 (S2)
//   C — comparables de marché (médiane BODACC), garde-fou
// Pondération : A 40 % / B 35 % / C 25 % (méthode B fiable, >= 2 bilans).
// Le curseur (0..100) est l'UNIQUE levier du négociateur ; tout se recalcule en cascade.

export interface Exercice {
  annee: number;
  ca_ht: number;
  ebe: number;                 // résultat d'exploitation + dotations
  dont_loyers?: number | null; // poste "loyers et redevances" de la liasse (pour normalisation)
}

export interface BaremeFdc {
  activite: string;
  ratio_moyen: number;         // % du CA HT
  q1: number;                  // % du CA HT
  q3: number;                  // % du CA HT
  n_mutations?: number | null;
}

export interface EntreeAvis {
  exercices: Exercice[];                 // 0 à 3 exercices (ordre quelconque, triés en interne)
  bareme: BaremeFdc;
  loyerReference: number;                // loyer + charges courant (quittance/bail), €/an
  loyerReclame?: number | null;          // loyer déplafonné réclamé, €/an (scénario 2)
  remunerationExploitant?: number;       // défaut 35 000 €/an chargés
  nbExploitants?: number;                // défaut 1
  chargesNonRecurrentes?: number;        // retraitement méthode B
  proprietaireMurs?: boolean;
  loyerMarcheSiProprietaire?: number | null;
  comparableMedian?: number | null;      // méthode C
  curseurRetenu: number;                 // 0..100 (levier négociateur)
  ecartCurseurS2?: number;               // décote curseur du scénario 2 (défaut 12 points)
  indemniteOccupation?: boolean;         // déclenche le double scénario
  contentieuxBail?: boolean;             // idem
  dureeRestanteAnnees?: number | null;
  scores?: Record<string, number>;       // 10 critères, -2..+2
  nbBilans?: number;                     // défaut = exercices.length
  documents?: { bail?: boolean; quittance?: boolean; fichesPaie?: boolean };
}

export interface Methode { code: "A" | "B" | "C"; libelle: string; valeur: number | null; detail: string; }

export interface Scenario {
  nom: string;
  curseur: number;                 // 0..100
  ratioPct: number;                // % du CA appliqué
  methodes: { A: Methode; B: Methode; C: Methode };
  ponderation: { A: number; B: number; C: number };
  valeurCentrale: number | null;
  fourchetteBasse: number | null;
  fourchetteHaute: number | null;
}

export interface ResultatAvis {
  caMoyen: number | null;
  ebeParExercice: { annee: number; ebe: number; ebeNormalise: number }[];
  sde: number | null;              // revenu de l'exploitant (EBE normalisé, dernier exercice)
  ebeRetraiteMoyen: number | null; // moyenne EBE normalisé - rémunération exploitant
  tauxEffort: number | null;
  tauxEffortS2: number | null;
  doubleScenario: boolean;
  scenarios: Scenario[];           // 1 ou 2
  fiabilite: "A" | "B" | "C" | "D";
  largeurFourchette: number;       // 0.10 / 0.15 / 0.20
  alertes: string[];
  mentions: string[];              // mentions de complétude à imprimer
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round = (x: number) => Math.round(x);
const isPos = (v: any): v is number => typeof v === "number" && isFinite(v) && v > 0;

/** Ratio (% du CA) interpolé le long du barème Q1 — moyen — Q3 selon la position du curseur (0..100). */
export function ratioDepuisCurseur(b: BaremeFdc, curseur: number): number {
  const c = clamp(curseur, 0, 100);
  if (c <= 50) return b.q1 + (c / 50) * (b.ratio_moyen - b.q1);
  return b.ratio_moyen + ((c - 50) / 50) * (b.q3 - b.ratio_moyen);
}

/** Score normalisé 0..1 depuis 10 notes -2..+2 (0,5 = neutre). curseur proposé = score × 100. */
export function curseurPropose(scores?: Record<string, number>): number {
  const vals = Object.values(scores ?? {}).map((n) => clamp(Number(n) || 0, -2, 2));
  const somme = vals.reduce((s, n) => s + n, 0);
  const nb = 10; // grille à 10 critères
  const norm = clamp((somme + 2 * nb) / (4 * nb), 0, 1); // (somme + 20) / 40
  return round(norm * 100);
}

/** EBE normalisé : rétablit le loyer courant si le poste "loyers" d'un exercice s'écarte de +30 % de la référence. */
function ebeNormaliseEx(ex: Exercice, loyerRef: number): number {
  if (isPos(ex.dont_loyers) && loyerRef > 0 && Math.abs((ex.dont_loyers as number) - loyerRef) > 0.3 * loyerRef) {
    return round(ex.ebe + ((ex.dont_loyers as number) - loyerRef));
  }
  return round(ex.ebe);
}

function ponderationSelonBilans(nbBilans: number, methodeBDispo: boolean): { A: number; B: number; C: number } {
  if (nbBilans <= 0) return { A: 0.70, B: 0.0, C: 0.30 };
  if (nbBilans === 1) return { A: 0.55, B: methodeBDispo ? 0.20 : 0, C: 0.25 };
  return { A: 0.40, B: methodeBDispo ? 0.35 : 0, C: 0.25 };
}

function construireScenario(
  nom: string, curseur: number, bareme: BaremeFdc, caMoyen: number | null,
  valeurB: number | null, detB: string, comparable: number | null,
  nbBilans: number, largeur: number,
): Scenario {
  const ratioPct = ratioDepuisCurseur(bareme, curseur);
  const vA = caMoyen != null ? round(caMoyen * ratioPct / 100) : null;
  const detA = caMoyen != null
    ? `CA HT moyen ${caMoyen.toLocaleString("fr-FR")} € × ${ratioPct.toFixed(1)} % (barème ${bareme.q1}–${bareme.q3} %, moyen ${bareme.ratio_moyen} %)`
    : "CA indisponible";
  const vC = isPos(comparable) ? round(comparable) : null;

  const methodes = {
    A: { code: "A" as const, libelle: "Barème % du CA", valeur: vA, detail: detA },
    B: { code: "B" as const, libelle: "Rentabilité retraitée", valeur: valeurB, detail: detB },
    C: { code: "C" as const, libelle: "Comparables de marché", valeur: vC, detail: vC != null ? "Médiane des cessions comparables (BODACC)" : "Pas de comparable exploitable" },
  };

  const base = ponderationSelonBilans(nbBilans, valeurB != null);
  const dispo = { A: vA, B: valeurB, C: vC };
  let wsum = 0, acc = 0;
  (["A", "B", "C"] as const).forEach((k) => { if (dispo[k] != null && base[k] > 0) { acc += (dispo[k] as number) * base[k]; wsum += base[k]; } });
  const valeurCentrale = wsum ? round(acc / wsum) : null;
  const ponderation = {
    A: wsum && dispo.A != null ? base.A / wsum : 0,
    B: wsum && dispo.B != null ? base.B / wsum : 0,
    C: wsum && dispo.C != null ? base.C / wsum : 0,
  };
  return {
    nom, curseur, ratioPct,
    methodes, ponderation, valeurCentrale,
    fourchetteBasse: valeurCentrale != null ? round(valeurCentrale * (1 - largeur)) : null,
    fourchetteHaute: valeurCentrale != null ? round(valeurCentrale * (1 + largeur)) : null,
  };
}

export function evaluerAvis(e: EntreeAvis): ResultatAvis {
  const alertes: string[] = [];
  const mentions: string[] = [];
  const exs = [...e.exercices].filter((x) => isPos(x.ca_ht)).sort((a, b) => a.annee - b.annee);
  const nbBilans = e.nbBilans ?? exs.length;
  const loyerRef = e.loyerReference ?? 0;
  const remu = (e.remunerationExploitant ?? 35000) * (e.nbExploitants ?? 1);

  // CA moyen (moyenne simple des exercices disponibles)
  const caMoyen = exs.length ? round(exs.reduce((s, x) => s + x.ca_ht, 0) / exs.length) : null;

  // EBE normalisés
  const ebeParExercice = exs.map((x) => ({ annee: x.annee, ebe: round(x.ebe), ebeNormalise: ebeNormaliseEx(x, loyerRef) }));
  const exN = exs[exs.length - 1];
  const sde = exN ? ebeNormaliseEx(exN, loyerRef) : null; // revenu exploitant (dernier exercice normalisé)

  // EBE retraité moyen = moyenne EBE normalisé - rémunération exploitant + retraitements
  let ebeRetraiteMoyen: number | null = null;
  if (ebeParExercice.length) {
    const moyEbeNorm = ebeParExercice.reduce((s, x) => s + x.ebeNormalise, 0) / ebeParExercice.length;
    ebeRetraiteMoyen = round(
      moyEbeNorm - remu + (e.chargesNonRecurrentes ?? 0)
      - (e.proprietaireMurs ? (e.loyerMarcheSiProprietaire ?? 0) : 0),
    );
  }

  // Méthode B : valeur (nominal si EBE retraité > 0, sinon SDE × multiple)
  const score01 = curseurPropose(e.scores) / 100;
  function valeurBpour(sdeScenario: number | null, multSde: number): { v: number | null; det: string } {
    if (ebeRetraiteMoyen != null && ebeRetraiteMoyen > 0) {
      const coef = score01 >= 0.6 ? 3 : 2.5;
      return { v: round(ebeRetraiteMoyen * coef), det: `EBE retraité ${ebeRetraiteMoyen.toLocaleString("fr-FR")} € × ${coef}` };
    }
    if (isPos(sdeScenario)) {
      return { v: round((sdeScenario as number) * multSde), det: `SDE (revenu exploitant) ${round(sdeScenario as number).toLocaleString("fr-FR")} € × ${multSde} — rentabilité nette proche de zéro` };
    }
    return { v: null, det: "Rentabilité non exploitable" };
  }

  // Taux d'effort
  const tauxEffort = caMoyen && exN && isPos(exN.ca_ht) ? loyerRef / (exN.ca_ht as number) : (caMoyen ? loyerRef / caMoyen : null);
  const surcoutS2 = Math.max(0, (e.loyerReclame ?? 0) - loyerRef);
  const tauxEffortS2 = (exN && isPos(exN.ca_ht) && e.loyerReclame) ? (e.loyerReclame as number) / (exN.ca_ht as number) : null;

  // Largeur de fourchette et fiabilité selon complétude
  const largeur = nbBilans <= 0 ? 0.20 : nbBilans === 1 ? 0.15 : 0.10;
  if (nbBilans === 2) mentions.push("L'analyse repose sur deux exercices au lieu de trois : la tendance du chiffre d'affaires est appréciée sur une seule variation annuelle.");
  if (nbBilans === 1) mentions.push("Un seul exercice a été fourni : aucune tendance ne peut être établie, la fourchette est élargie à ±15 %. La production des deux exercices précédents est indispensable avant toute transaction.");
  if (nbBilans <= 0) mentions.push("Aucun document comptable n'a été fourni : l'estimation repose sur un chiffre d'affaires déclaratif non vérifié. Ce document ne constitue qu'un ordre de grandeur.");
  if (!e.documents?.bail && e.documents?.quittance) mentions.push("Le bail commercial n'a pas été fourni : le loyer est connu par quittance mais la durée restante, la destination et les clauses sont inconnues. L'analyse du droit au bail est indicative.");
  if (!e.documents?.bail && !e.documents?.quittance) mentions.push("Ni bail ni quittance fournis : la charge locative retenue est déclarative. Le taux d'effort et le droit au bail ne peuvent être fiabilisés.");
  if (!e.documents?.fichesPaie) mentions.push("Les fiches de paie n'ont pas été fournies : la structure de la masse salariale (dont emplois familiaux éventuels) n'a pas pu être vérifiée.");

  const bail = !!e.documents?.bail, quittance = !!e.documents?.quittance;
  const fiabilite: ResultatAvis["fiabilite"] =
    nbBilans >= 3 && bail && quittance ? "A"
    : nbBilans >= 2 && (bail || quittance) ? "B"
    : nbBilans >= 1 ? "C" : "D";

  // Double scénario
  const doubleScenario = !!(e.indemniteOccupation || e.contentieuxBail
    || (e.dureeRestanteAnnees != null && e.dureeRestanteAnnees < 2 && e.loyerReclame && loyerRef < 0.8 * (e.loyerReclame as number)));

  if (e.indemniteOccupation) alertes.push("La quittance/le bail mentionne une indemnité d'occupation : bail probablement expiré ou en renouvellement contesté. Double scénario activé.");

  const scenarios: Scenario[] = [];
  const bS1 = valeurBpour(sde, 1.8);
  scenarios.push(construireScenario(
    doubleScenario ? "Scénario 1 — bail sécurisé" : "Valeur retenue",
    e.curseurRetenu, e.bareme, caMoyen, bS1.v, bS1.det, e.comparableMedian ?? null, nbBilans, largeur,
  ));
  if (doubleScenario) {
    const sdeS2 = sde != null ? sde - surcoutS2 : null;
    const bS2 = valeurBpour(sdeS2, 1.6);
    scenarios.push(construireScenario(
      "Scénario 2 — loyer déplafonné",
      clamp(e.curseurRetenu - (e.ecartCurseurS2 ?? 12), 0, 100), e.bareme, caMoyen, bS2.v, bS2.det, e.comparableMedian ?? null, nbBilans, largeur,
    ));
  }

  // Alertes de divergence A/B
  for (const s of scenarios) {
    const a = s.methodes.A.valeur, b = s.methodes.B.valeur;
    if (a != null && b != null && a > 0 && Math.abs(a - b) / a > 0.4) {
      alertes.push(`${s.nom} : les méthodes patrimoniale (${round(a).toLocaleString("fr-FR")} €) et de rentabilité (${round(b).toLocaleString("fr-FR")} €) divergent fortement — l'affaire vaut davantage par son emplacement et son CA que par sa rentabilité actuelle. Point de négociation probable.`);
      break;
    }
  }

  return {
    caMoyen, ebeParExercice, sde, ebeRetraiteMoyen,
    tauxEffort, tauxEffortS2, doubleScenario, scenarios,
    fiabilite, largeurFourchette: largeur, alertes, mentions,
  };
}

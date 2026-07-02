// src/lib/estimation.ts
// Moteur d'estimation d'un fonds de commerce (v2) — méthode croisée, resserrée.
// Voir METHODO_ESTIMATION_FDC.md. Logique PURE (aucun appel réseau, aucune dépendance UI)
// pour être testable isolément. Le formulaire fournit les entrées, la page appelle estimer().
//
// 3 méthodes : A) % du CA (barème) placé par score ; B) multiple d'EBE retraité ;
// C) comparables (garde-fou). + ajustements BAIL (taux d'effort, durée, écart loyer/marché,
// plancher droit au bail). Sortie : valeur centrale + fourchette ±10 % + détail justifié.

export type Famille =
  | "restauration_assise" | "restauration_rapide" | "bar_cafe_tabac"
  | "boulangerie_patisserie" | "fleuriste" | "coiffure_esthetique"
  | "garage_carrosserie" | "autre";

/** Plage de multiple d'EBE retraité par famille (repères marché, éditables). */
export const MULTIPLE_EBE: Record<Famille, { bas: number; haut: number }> = {
  restauration_assise:   { bas: 3.0, haut: 5.0 },
  restauration_rapide:   { bas: 2.5, haut: 4.0 },
  bar_cafe_tabac:        { bas: 3.0, haut: 5.5 },
  boulangerie_patisserie:{ bas: 3.0, haut: 4.5 },
  fleuriste:             { bas: 2.0, haut: 3.5 },
  coiffure_esthetique:   { bas: 2.0, haut: 3.5 },
  garage_carrosserie:    { bas: 2.5, haut: 4.0 },
  autre:                 { bas: 2.5, haut: 4.5 },
};

/** Taux d'effort « sain » de référence (loyer+charges+TF)/CA HT, par famille. */
export const SEUIL_TAUX_EFFORT: Record<Famille, number> = {
  restauration_assise: 0.10, restauration_rapide: 0.10, bar_cafe_tabac: 0.10,
  boulangerie_patisserie: 0.06, fleuriste: 0.12, coiffure_esthetique: 0.12,
  garage_carrosserie: 0.08, autre: 0.10,
};

/** Plancher « droit au bail » : différentiel de loyer plafonné et décoté (risque déplafonnement + actualisation). */
export const DROIT_AU_BAIL = { plafondAnnees: 6, coef: 0.7 };

/** Prime de zone geographique (macro-localisation, distincte du micro-emplacement). Le bareme etant national. */
export type ZoneGeo =
  | "paris_hypercentre" | "grande_metropole" | "grande_ville"
  | "ville_moyenne" | "peripherie" | "petite_ville_rural";
export const COEF_ZONE: Record<ZoneGeo, number> = {
  paris_hypercentre: 1.15, grande_metropole: 1.10, grande_ville: 1.05,
  ville_moyenne: 1.00, peripherie: 0.95, petite_ville_rural: 0.88,
};
export const ZONE_LABEL: Record<ZoneGeo, string> = {
  paris_hypercentre: "Paris hyper-centre / hyper-prime",
  grande_metropole: "Grande metropole (centre)",
  grande_ville: "Grande ville",
  ville_moyenne: "Ville moyenne (reference)",
  peripherie: "Peripherie / zone commerciale",
  petite_ville_rural: "Petite ville / rural",
};

/** Critères de scoring et leur poids (note attendue : -2 à +2). */
export const CRITERES_SCORE = [
  { key: "emplacement",          label: "Emplacement / flux",                 poids: 2.0 },
  { key: "evolution_ca",         label: "Évolution du CA (3 ans)",            poids: 1.5 },
  { key: "rentabilite",          label: "Rentabilité (marge EBE)",            poids: 1.5 },
  { key: "qualite_bail",         label: "Qualité du bail",                    poids: 1.5 },
  { key: "taux_effort",          label: "Taux d'effort",                      poids: 1.0 },
  { key: "dependance_exploitant",label: "Indépendance vs exploitant",         poids: 1.5 },
  { key: "etat_materiel",        label: "État matériel / local",              poids: 1.0 },
  { key: "concurrence",          label: "Concurrence / barrières",            poids: 1.0 },
  { key: "main_oeuvre",          label: "Équipe en place",                    poids: 1.0 },
  { key: "notoriete",            label: "Notoriété / contrats récurrents",    poids: 1.0 },
] as const;

export type CritereKey = (typeof CRITERES_SCORE)[number]["key"];

export interface BaremeActivite {
  activite: string;
  ratio_moyen_pct_ca: number;
  q1_pct_ca: number;
  q3_pct_ca: number;
  refs?: number;
}

export interface EntreeEstimation {
  famille: Famille;
  bareme: BaremeActivite;
  caN?: number | null;
  caN1?: number | null;
  caN2?: number | null;
  ebeComptable?: number | null;
  reintegrationRemunerationDirigeant?: number | null;
  salaireDirigeantNormatif?: number | null;
  proprietaireMurs?: boolean;
  loyerMarcheSiProprietaire?: number | null;
  autresRetraitements?: number | null;
  loyerAnnuel?: number | null;
  chargesAnnuelles?: number | null;
  taxeFonciere?: number | null;
  dureeRestanteAnnees?: number | null;
  valeurLocativeMarcheAnnuelle?: number | null;
  valeurMaterielAjoutee?: number | null;
  comparableMedian?: number | null;
  zone?: ZoneGeo;
  scores?: Partial<Record<CritereKey, number>>;
}

export interface DetailMethode { libelle: string; valeur: number | null; detail: string; }

export interface ResultatEstimation {
  caMoyen: number | null;
  scoreGlobal: number;
  methodeA: DetailMethode;
  methodeB: DetailMethode;
  methodeC: DetailMethode;
  ebeRetraite: number | null;
  tauxEffort: number | null;
  droitAuBailPlancher: number | null;
  coefBail: number;
  coefZone: number;
  valeurCentrale: number | null;
  fourchetteBasse: number | null;
  fourchetteHaute: number | null;
  ponderation: { A: number; B: number; C: number };
  alertes: string[];
  fiabilite: "faible" | "moyenne" | "bonne";
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (v: any): number | null => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);

/** Score global normalisé 0..1 (0.5 = neutre). */
export function calculScore(scores?: Partial<Record<CritereKey, number>>): number {
  let somme = 0, poidsTot = 0;
  for (const c of CRITERES_SCORE) {
    const n = clamp(Number(scores?.[c.key] ?? 0), -2, 2);
    somme += n * c.poids;
    poidsTot += c.poids;
  }
  if (!poidsTot) return 0.5;
  return clamp(somme / (2 * poidsTot) + 0.5, 0, 1);
}

/** Place une valeur entre bas et haut selon le score, avec ancrage sur `moyen` à 0.5. */
function positionner(bas: number, moyen: number, haut: number, score: number): number {
  if (score <= 0.5) return bas + (moyen - bas) * (score / 0.5);
  return moyen + (haut - moyen) * ((score - 0.5) / 0.5);
}

export function estimer(e: EntreeEstimation): ResultatEstimation {
  const alertes: string[] = [];

  const cs = [num(e.caN), num(e.caN1), num(e.caN2)];
  const poidsAns = [3, 2, 1];
  let sc = 0, sp = 0;
  cs.forEach((c, i) => { if (c != null) { sc += c * poidsAns[i]; sp += poidsAns[i]; } });
  const caMoyen = sp ? Math.round(sc / sp) : null;

  const score = calculScore(e.scores);

  let vA: number | null = null, detA = "CA manquant";
  if (caMoyen != null) {
    const pct = positionner(e.bareme.q1_pct_ca, e.bareme.ratio_moyen_pct_ca, e.bareme.q3_pct_ca, score) / 100;
    vA = Math.round(caMoyen * pct);
    detA = `CA HT moyen ${caMoyen.toLocaleString("fr-FR")} € x ${(pct * 100).toFixed(1)} % `
      + `(bareme ${e.bareme.q1_pct_ca}-${e.bareme.q3_pct_ca} %, moyen ${e.bareme.ratio_moyen_pct_ca} %)`;
  }

  let ebeRetraite: number | null = null, vB: number | null = null, detB = "EBE non renseigne";
  if (num(e.ebeComptable) != null) {
    ebeRetraite =
      (e.ebeComptable ?? 0)
      + (e.reintegrationRemunerationDirigeant ?? 0)
      - (e.salaireDirigeantNormatif ?? 0)
      - (e.proprietaireMurs ? (e.loyerMarcheSiProprietaire ?? 0) : 0)
      + (e.autresRetraitements ?? 0);
    ebeRetraite = Math.round(ebeRetraite);
    if (ebeRetraite > 0) {
      const m = MULTIPLE_EBE[e.famille] ?? MULTIPLE_EBE.autre;
      const mult = positionner(m.bas, (m.bas + m.haut) / 2, m.haut, score);
      vB = Math.round(ebeRetraite * mult);
      detB = `EBE retraite ${ebeRetraite.toLocaleString("fr-FR")} € x ${mult.toFixed(2)} (plage ${m.bas}-${m.haut})`;
    } else {
      detB = `EBE retraite <= 0 (${ebeRetraite.toLocaleString("fr-FR")} €) - methode non applicable`;
      alertes.push("EBE retraite negatif ou nul : la rentabilite ne soutient pas la valeur du fonds.");
    }
  }

  const vC = num(e.comparableMedian);
  const detC = vC != null ? `Mediane des cessions comparables (BODACC)` : "Pas de comparable exploitable";

  const loyer = num(e.loyerAnnuel) ?? 0;
  const coutOccupation = loyer + (e.chargesAnnuelles ?? 0) + (e.taxeFonciere ?? 0);
  const tauxEffort = caMoyen ? coutOccupation / caMoyen : null;
  const seuil = SEUIL_TAUX_EFFORT[e.famille] ?? 0.10;
  const vlm = num(e.valeurLocativeMarcheAnnuelle);
  const duree = e.dureeRestanteAnnees ?? null;

  let coefBail = 1;
  if (tauxEffort != null) {
    if (tauxEffort > seuil * 1.5) { coefBail -= 0.05; alertes.push(
      `Taux d'effort eleve (${(tauxEffort * 100).toFixed(1)} % vs seuil ~${(seuil * 100).toFixed(0)} %) : decote appliquee.`); }
    else if (tauxEffort <= seuil * 0.7) coefBail += 0.04;
    if (tauxEffort > 0.15) alertes.push("Taux d'effort > 15 % : soutenabilite du loyer a surveiller.");
  }
  const loyerSousMarche = vlm != null && loyer > 0 && loyer < vlm;
  if (duree != null) {
    if (duree < 2 && loyerSousMarche) { coefBail -= 0.10; alertes.push(
      "Bail a echeance < 2 ans avec loyer sous le marche : risque de deplafonnement au renouvellement -> decote."); }
    else if (duree < 3) { coefBail -= 0.05; alertes.push("Bail proche du terme (< 3 ans) : incertitude -> legere decote."); }
    else if (duree >= 6) coefBail += 0.03;
  }
  if (vlm != null && loyer > vlm * 1.05) { coefBail -= 0.05; alertes.push("Loyer superieur au marche (sur-loue) : decote."); }
  coefBail = clamp(coefBail, 0.85, 1.10);

  const coefZone = COEF_ZONE[e.zone ?? "ville_moyenne"];

  // Alertes fines (on signale chaque element, meme mineur)
  if (num(e.caN) != null && num(e.caN2) != null && (e.caN as number) < (e.caN2 as number) * 0.95)
    alertes.push("CA en baisse sur 3 ans : tendance defavorable prise en compte.");
  if (num(e.ebeComptable) == null)
    alertes.push("EBE non renseigne : estimation basee sur le CA et les comparables (moins precise).");
  if (loyer > 0 && vlm == null)
    alertes.push("Valeur locative de marche non renseignee : droit au bail et risque de deplafonnement non evalues.");
  if (ebeRetraite != null && ebeRetraite > 0 && caMoyen && ebeRetraite / caMoyen < 0.05)
    alertes.push("Marge d'EBE retraite faible (< 5 % du CA) : rentabilite fragile.");

  let droitAuBail: number | null = null;
  if (loyerSousMarche && duree != null) {
    // différentiel plafonné (max N années) et décoté (déplafonnement + actualisation)
    droitAuBail = Math.round((vlm! - loyer) * clamp(duree, 0, DROIT_AU_BAIL.plafondAnnees) * DROIT_AU_BAIL.coef);
  }

  const dispo = { A: vA, B: vB, C: vC };
  const base = num(e.ebeComptable) != null && vB != null
    ? { A: 0.3, B: 0.5, C: 0.2 }
    : { A: 0.7, B: 0.0, C: 0.3 };
  let wsum = 0, acc = 0;
  (["A", "B", "C"] as const).forEach((k) => {
    const v = dispo[k]; if (v != null && base[k] > 0) { acc += v * base[k]; wsum += base[k]; }
  });
  let valeurCentrale: number | null = wsum ? Math.round(acc / wsum) : null;
  const ponderation = wsum
    ? { A: dispo.A != null ? base.A / wsum : 0, B: dispo.B != null ? base.B / wsum : 0, C: dispo.C != null ? base.C / wsum : 0 }
    : { A: 0, B: 0, C: 0 };

  if (vA != null && vB != null) {
    const ecart = Math.abs(vA - vB) / Math.min(vA, vB);
    if (ecart > 0.4) alertes.push(
      `Ecart important entre methode CA (${vA.toLocaleString("fr-FR")} €) et methode EBE (${vB.toLocaleString("fr-FR")} €) : verifier la rentabilite reelle.`);
  }

  if (valeurCentrale != null) {
    valeurCentrale = Math.round(valeurCentrale * coefBail * coefZone);
    if (e.valeurMaterielAjoutee) valeurCentrale += Math.round(e.valeurMaterielAjoutee);
    if (droitAuBail != null && valeurCentrale < droitAuBail) {
      valeurCentrale = droitAuBail;
      alertes.push("Valeur ramenee au plancher du droit au bail (l'emplacement vaut plus que l'exploitation).");
    }
  }

  const fourchetteBasse = valeurCentrale != null ? Math.round(valeurCentrale * 0.9) : null;
  const fourchetteHaute = valeurCentrale != null ? Math.round(valeurCentrale * 1.1) : null;

  let pts = 0;
  if (cs.filter((c) => c != null).length >= 2) pts++;
  if (num(e.ebeComptable) != null) pts += 2;
  if (loyer > 0 && vlm != null && duree != null) pts++;
  if (vC != null) pts++;
  const fiabilite = pts >= 4 ? "bonne" : pts >= 2 ? "moyenne" : "faible";

  return {
    caMoyen, scoreGlobal: score,
    methodeA: { libelle: "% du chiffre d'affaires", valeur: vA, detail: detA },
    methodeB: { libelle: "Multiple d'EBE retraite", valeur: vB, detail: detB },
    methodeC: { libelle: "Comparables (controle)", valeur: vC, detail: detC },
    ebeRetraite, tauxEffort, droitAuBailPlancher: droitAuBail, coefBail, coefZone,
    valeurCentrale, fourchetteBasse, fourchetteHaute, ponderation, alertes, fiabilite,
  };
}

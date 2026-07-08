import { describe, it, expect } from "vitest";
import { evaluerAvis, ratioDepuisCurseur, curseurPropose, type EntreeAvis } from "./avisValeurEngine";

// Cas réel de référence : bar-brasserie Saint-Cloud (rapport modèle TBEECOM).
const barSaintCloud: EntreeAvis = {
  exercices: [
    { annee: 2023, ca_ht: 140105, ebe: 24520, dont_loyers: null },
    { annee: 2024, ca_ht: 157812, ebe: 33658, dont_loyers: 13665 },
    { annee: 2025, ca_ht: 183650, ebe: 32058, dont_loyers: 27074 },
  ],
  bareme: { activite: "Bar (débit de boissons)", ratio_moyen: 100.3, q1: 60.12, q3: 121.04, n_mutations: 984 },
  loyerReference: 13726,
  loyerReclame: 27000,
  remunerationExploitant: 35000,
  nbExploitants: 1,
  comparableMedian: 130000,
  curseurRetenu: 46.5,           // ratio ≈ 97,5 % du CA
  indemniteOccupation: true,     // déclenche le double scénario
  documents: { bail: true, quittance: true, fichesPaie: true },
};

describe("moteur avis de valeur — cas bar Saint-Cloud", () => {
  const r = evaluerAvis(barSaintCloud);

  it("CA moyen 3 ans = 160 522 €", () => expect(r.caMoyen).toBe(160522));
  it("SDE (EBE 2025 normalisé loyer courant) ≈ 45 406 €", () => expect(r.sde).toBe(45406));
  it("EBE retraité moyen proche de zéro", () => expect(Math.abs(r.ebeRetraiteMoyen!)).toBeLessThan(1500));
  it("indice de fiabilité A (3 bilans + bail + quittance)", () => expect(r.fiabilite).toBe("A"));
  it("double scénario activé", () => expect(r.doubleScenario).toBe(true));
  it("deux scénarios produits", () => expect(r.scenarios).toHaveLength(2));

  const s1 = r.scenarios[0], s2 = r.scenarios[1];
  it("S1 méthode A ≈ 156 500 €", () => expect(s1.methodes.A.valeur!).toBeGreaterThan(154000) && expect(s1.methodes.A.valeur!).toBeLessThan(159000));
  it("S1 méthode B (SDE × 1,8) ≈ 82 000 €", () => { expect(s1.methodes.B.valeur!).toBeGreaterThan(79000); expect(s1.methodes.B.valeur!).toBeLessThan(84000); });
  it("S1 valeur centrale ≈ 124 000 €", () => { expect(s1.valeurCentrale!).toBeGreaterThan(120000); expect(s1.valeurCentrale!).toBeLessThan(128000); });
  it("S1 pondération 40/35/25", () => {
    expect(s1.ponderation.A).toBeCloseTo(0.40, 2);
    expect(s1.ponderation.B).toBeCloseTo(0.35, 2);
    expect(s1.ponderation.C).toBeCloseTo(0.25, 2);
  });
  it("S1 fourchette ±10 %", () => {
    expect(s1.fourchetteBasse!).toBe(Math.round(s1.valeurCentrale! * 0.9));
    expect(s1.fourchetteHaute!).toBe(Math.round(s1.valeurCentrale! * 1.1));
  });
  it("S2 valeur centrale < S1 et ordre de grandeur ~105 000 €", () => {
    expect(s2.valeurCentrale!).toBeLessThan(s1.valeurCentrale!);
    expect(s2.valeurCentrale!).toBeGreaterThan(100000);
    expect(s2.valeurCentrale!).toBeLessThan(112000);
  });
});

describe("fonctions unitaires", () => {
  const b = { activite: "x", ratio_moyen: 100.3, q1: 60.12, q3: 121.04 };
  it("ratio au milieu = moyenne du barème", () => expect(ratioDepuisCurseur(b, 50)).toBeCloseTo(100.3, 5));
  it("ratio à 0 = Q1, à 100 = Q3", () => { expect(ratioDepuisCurseur(b, 0)).toBeCloseTo(60.12, 5); expect(ratioDepuisCurseur(b, 100)).toBeCloseTo(121.04, 5); });
  it("curseur proposé : toutes notes neutres → 50", () => expect(curseurPropose({})).toBe(50));
  it("curseur proposé : toutes notes +2 → 100", () => {
    const s: Record<string, number> = {}; for (let i = 0; i < 10; i++) s["c" + i] = 2;
    expect(curseurPropose(s)).toBe(100);
  });
});

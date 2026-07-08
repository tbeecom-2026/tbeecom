// src/lib/avisValeurRapport.ts
// Générateur du rapport "AVIS DE VALEUR" (HTML imprimable A4, structure fidèle au modèle TBEECOM).
// Rien n'est bloquant : si des documents manquent, l'avis est produit MAIS l'absence est signalée
// clairement (bandeau de synthèse + indice de fiabilité + section "Limites").
import type { EntreeAvis, ResultatAvis, Scenario } from "@/lib/avisValeurEngine";

// ── Grille des 10 critères (ordre et libellés du modèle) ─────────────────────
export const CRITERES_RAPPORT: { key: string; label: string }[] = [
  { key: "emplacement",           label: "Emplacement / flux" },
  { key: "evolution_ca",          label: "Évolution du CA (3 ans)" },
  { key: "rentabilite",           label: "Rentabilité retraitée" },
  { key: "qualite_bail",          label: "Qualité du bail" },
  { key: "taux_effort",           label: "Taux d'effort" },
  { key: "dependance_exploitant", label: "Dépendance aux exploitants" },
  { key: "licence",               label: "Licence / barrières" },
  { key: "main_oeuvre",           label: "Équipe en place" },
  { key: "etat_materiel",         label: "Matériel / local" },
  { key: "notoriete",             label: "Notoriété / ancienneté" },
];

export interface ExerciceDetail {
  annee: number;
  ca_ht?: number | null;
  croissance?: number | null;             // en fraction (0.126 = +12,6 %)
  achats?: number | null;
  autres_charges_externes?: number | null;
  dont_loyers?: number | null;
  impots_taxes?: number | null;
  salaires?: number | null;
  charges_sociales?: number | null;
  resultat_exploitation?: number | null;
  ebe?: number | null;
  benefice?: number | null;
}

export interface RapportCtx {
  agence?: any;
  enseigne?: string;
  identification?: {
    denomination?: string; formeJuridique?: string; siren?: string; siret?: string;
    naf?: string; activite?: string; dateCreation?: string; anciennete?: string;
    adresse?: string; effectif?: string; bailleur?: string;
  };
  dateRapport?: string;
  destinataire?: string;                   // ex. "gérants de la société"
  exercicesDetail?: ExerciceDetail[];      // lignes de liasse (sinon dérivé de entree.exercices)
  curseurPropose?: number;
  curseurRetenu?: number;
  justificationCurseur?: string;
  commentaires?: Record<string, string>;   // commentaire par critère (clé = CRITERES_RAPPORT.key)
  lectureChiffres?: string;                // override du paragraphe d'analyse financière
  bailTexte?: string;                      // override du texte de la section bail
  prixPresentation?: number;               // sinon = borne haute S1 arrondie
  valeurNegociation?: number;              // sinon = valeur centrale S1 arrondie
  avisTexte?: string;
  sources?: string[];
}

const eur = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const eur0 = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? "n.d." : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
const pct1 = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : (n * 100).toFixed(1).replace(".", ",") + " %");
const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const arr1000 = (n: number) => Math.round(n / 1000) * 1000;

const FIAB_LABEL: Record<string, string> = {
  A: "A — dossier complet", B: "B — dossier partiel", C: "C — dossier incomplet", D: "D — déclaratif (aucun bilan)",
};

function documentsManquants(e: EntreeAvis): string[] {
  const nb = e.nbExercices ?? e.exercices.length;
  const out: string[] = [];
  if (nb < 3) out.push(`analyse sur ${nb} exercice(s) — 3 années sont recommandées (un bilan en couvre 2, soit au moins 2 bilans)`);
  if (!e.documents?.bail) out.push("bail commercial non fourni");
  if (!e.documents?.quittance) out.push("quittance de loyer non fournie");
  if (!e.documents?.fichesPaie) out.push("fiches de paie non fournies");
  return out;
}

const CSS = `
 *{box-sizing:border-box}
 html,body{margin:0;padding:0}
 body{font-family:"Inter","Segoe UI",Arial,sans-serif;color:#2b2f36;line-height:1.55;font-size:12.5px;background:#fff}
 .doc{max-width:820px;margin:0 auto}
 .page{padding:26px 40px 40px;position:relative;page-break-after:always;min-height:1040px}
 .page:last-child{page-break-after:auto}
 h1.cover{font-family:"Playfair Display",Georgia,serif;color:#42556C;font-size:34px;letter-spacing:2px;text-align:center;margin:0}
 .cover-sub{text-align:center;color:#8a7a5a;font-size:15px;margin-top:4px;letter-spacing:.05em}
 .brandmark{font-family:"Playfair Display",Georgia,serif;font-size:30px;color:#42556C;letter-spacing:2px;text-align:center;margin:60px 0 30px}
 .brandmark b{color:#D2913D}
 .idbox{border:1.5px solid #D2913D;border-radius:12px;background:#F7F4EE;padding:18px 22px;margin:34px auto 0;max-width:600px;font-size:13px}
 .idbox .l{display:flex;gap:8px;margin:5px 0}
 .idbox .l .k{color:#6b5d45;min-width:150px;font-weight:600}
 .cover-foot{text-align:center;color:#8a8f98;font-size:12px;margin-top:40px}
 .fiab{display:inline-block;margin-top:14px;padding:6px 16px;border-radius:999px;font-weight:700;font-size:13px;border:2px solid #D2913D;color:#9a6a1e;background:#FBF3E6}
 .fiab.A{border-color:#2F855A;color:#2F855A;background:#EEF7F0}
 .fiab.D,.fiab.C{border-color:#B45309;color:#B45309;background:#FDF3E7}
 h2{font-family:"Playfair Display",Georgia,serif;color:#42556C;font-size:18px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #D2913D}
 h3{color:#42556C;font-size:14px;margin:16px 0 6px}
 p{margin:8px 0}
 .runhead{display:flex;justify-content:space-between;font-size:10px;color:#9a8f7a;border-bottom:1px solid #E7E0D3;padding-bottom:5px;margin-bottom:14px;letter-spacing:.02em}
 .runfoot{position:absolute;bottom:16px;left:40px;right:40px;display:flex;justify-content:space-between;font-size:9.5px;color:#a79c88;border-top:1px solid #E7E0D3;padding-top:6px}
 .scbox{border:1.5px solid #D2913D;border-radius:12px;background:#F7F4EE;padding:16px 20px;margin:12px 0}
 .scbox .t{font-weight:700;color:#42556C;font-size:13.5px}
 .scbox .v{font-size:26px;font-weight:800;color:#42556C;margin:6px 0 2px}
 .scbox .f{color:#6b6f77;font-size:12.5px}
 .banner{border-left:5px solid #B45309;background:#FDF3E7;border-radius:8px;padding:12px 16px;margin:14px 0}
 .banner .bt{font-weight:800;color:#B45309;font-size:13px;margin-bottom:4px}
 .banner ul{margin:4px 0 0;padding-left:18px;color:#7c5b2a}
 .banner.ok{border-left-color:#2F855A;background:#EEF7F0}
 .banner.ok .bt{color:#2F855A}
 table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
 th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #EAE4D8}
 thead th{background:#42556C;color:#fff;font-weight:600;font-size:11.5px}
 td.n,th.n{text-align:right;white-space:nowrap}
 tr.tot td{font-weight:700;background:#F7F4EE}
 .note{background:#FBF3E6;border:1px solid #F0D9B0;border-radius:8px;padding:8px 12px;font-size:11.5px;color:#7c5b2a;margin:8px 0}
 .gauge{height:12px;border-radius:6px;background:linear-gradient(90deg,#2F855A 0%,#2F855A 40%,#D2913D 40%,#D2913D 66%,#B91C1C 66%,#B91C1C 100%);position:relative;margin:8px 0 4px}
 .gauge .cur{position:absolute;top:-4px;width:3px;height:20px;background:#22262c;border-radius:2px}
 .slider{position:relative;height:40px;margin:16px 0 6px}
 .slider .track{position:absolute;top:16px;left:0;right:0;height:6px;border-radius:3px;background:linear-gradient(90deg,#E7C9A0,#D2913D)}
 .slider .tick{position:absolute;top:8px;width:2px;height:22px;background:#42556C}
 .slider .lbl{position:absolute;top:-2px;font-size:10.5px;color:#6b5d45;transform:translateX(-50%)}
 .slider .val{position:absolute;top:26px;font-size:10.5px;color:#42556C;font-weight:700;transform:translateX(-50%)}
 .slider .marker{position:absolute;top:10px;width:12px;height:12px;border-radius:50%;transform:translate(-50%,0)}
 .slider .marker.prop{background:#fff;border:2px solid #9a8f7a}
 .slider .marker.ret{background:#D2913D;border:2px solid #9a6a1e}
 .legend{display:flex;gap:18px;font-size:10.5px;color:#6b5d45;margin-top:14px}
 .legend .d{width:11px;height:11px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:-1px}
 .avisbox{border:2px solid #42556C;border-radius:12px;background:#F7F4EE;padding:16px 20px;margin:14px 0;font-size:13px}
 .avisbox .t{font-weight:800;color:#42556C;margin-bottom:6px}
 .good{color:#2F855A;font-weight:700}.bad{color:#B45309;font-weight:700}.mut{color:#8a8f98}
 ul.tight{margin:6px 0;padding-left:20px}ul.tight li{margin:3px 0}
 .legal{font-size:11px;color:#6b6f77;font-style:italic}
 @page{size:A4;margin:14mm}
 @media print{.page{padding:0 0 30px;min-height:auto}.doc{max-width:none}.runfoot{position:static;margin-top:24px}}
`;

function runFoot(n: number, total: number): string {
  return `<div class="runfoot"><span>TBEECOM — Cession &amp; reprise de fonds de commerce — tbeecom.com</span><span>Page ${n} / ${total}</span></div>`;
}
function runHead(activite: string): string {
  return `<div class="runhead"><span>TBEECOM</span><span>Avis de valeur — ${esc(activite)}</span></div>`;
}

// ── Génération ───────────────────────────────────────────────────────────────
export function genererRapportAvis(e: EntreeAvis, res: ResultatAvis, ctx: RapportCtx = {}): string {
  const id = ctx.identification ?? {};
  const activite = id.activite ?? e.bareme.activite;
  const date = ctx.dateRapport ?? new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const s1 = res.scenarios[0];
  const s2 = res.scenarios[1];
  const manquants = documentsManquants(e);
  const scores = e.scores ?? {};
  const curProp = ctx.curseurPropose ?? Math.round((e.curseurRetenu ?? 50));
  const curRet = ctx.curseurRetenu ?? e.curseurRetenu;

  const exs = ctx.exercicesDetail ?? e.exercices.map((x) => ({ annee: x.annee, ca_ht: x.ca_ht, ebe: x.ebe, dont_loyers: x.dont_loyers }));
  const exsTri = [...exs].sort((a, b) => a.annee - b.annee);

  const TOTAL = 7;
  let pg = 0;
  const P: string[] = [];
  const openPage = (withHead = true) => `<div class="page">${withHead ? runHead(activite) : ""}`;

  // ══ PAGE 1 — COUVERTURE ═════════════════════════════════════════════════
  P.push(`<div class="page">
   <div class="brandmark">TBE<b>E</b>COM</div>
   <h1 class="cover">AVIS DE VALEUR</h1>
   <div class="cover-sub">Fonds de commerce — ${esc(activite)}</div>
   <div class="idbox">
     <div class="l"><span class="k">Établissement</span><span>${esc(id.denomination ?? ctx.enseigne ?? "—")}</span></div>
     <div class="l"><span class="k">Adresse</span><span>${esc(id.adresse ?? "—")}</span></div>
     <div class="l"><span class="k">SIREN — NAF</span><span>${esc(id.siren ?? "—")}${id.naf ? " — " + esc(id.naf) : ""}</span></div>
     <div class="l"><span class="k">Exercices analysés</span><span>${exsTri.map((x) => x.annee).join(", ") || "—"}</span></div>
   </div>
   <div class="cover-foot">
     Rapport établi le ${esc(date)}<br>
     Document confidentiel${ctx.destinataire ? " — destiné aux " + esc(ctx.destinataire) : ""}<br>
     <span class="fiab ${res.fiabilite}">Indice de fiabilité TBEECOM : ${FIAB_LABEL[res.fiabilite]}</span>
   </div>
  ${runFoot(1, TOTAL)}</div>`);

  // ══ PAGE 2 — SYNTHÈSE + IDENTIFICATION ═════════════════════════════════
  const forts = CRITERES_RAPPORT.filter((c) => Number(scores[c.key] ?? 0) >= 1).map((c) => c.label);
  const vigil = CRITERES_RAPPORT.filter((c) => Number(scores[c.key] ?? 0) <= -1).map((c) => c.label);
  const scBloc = (s: Scenario) => `<div class="scbox">
     <div class="t">${esc(s.nom)}</div>
     <div class="v">${eur(s.valeurCentrale)}</div>
     <div class="f">Fourchette ${eur(s.fourchetteBasse)} – ${eur(s.fourchetteHaute)}</div>
   </div>`;
  const bandeauFiab = manquants.length
    ? `<div class="banner"><div class="bt">⚠ Estimation produite avec des éléments manquants — précision réduite (indice ${res.fiabilite})</div>
        <div>L'estimation reste valable mais les éléments suivants n'ont pas été fournis :</div>
        <ul>${manquants.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
        <div style="margin-top:6px">Détail des conséquences en section 8 (Hypothèses et limites).</div></div>`
    : `<div class="banner ok"><div class="bt">✓ Dossier complet (indice A)</div><div>Tous les documents requis ont été fournis : l'estimation repose sur des données vérifiées.</div></div>`;

  P.push(`${openPage()}
   <h2>1. Synthèse de l'avis de valeur</h2>
   <p>Le présent rapport estime la valeur du fonds de commerce${id.activite ? " de " + esc(id.activite.toLowerCase()) : ""}${id.adresse ? " exploité au " + esc(id.adresse) : ""}. L'estimation croise trois méthodes complémentaires (barème professionnel en pourcentage du chiffre d'affaires, rentabilité retraitée, comparables de marché), conformément à la pratique des professionnels de l'évaluation.</p>
   ${res.doubleScenario ? `<p>Un élément juridique domine cette évaluation (bail en renouvellement contesté / indemnité d'occupation). L'issue de la procédure modifiera la charge locative future, donc la valeur du fonds. <b>Deux scénarios</b> sont présentés.</p>` : ""}
   ${res.scenarios.map(scBloc).join("")}
   <p class="mut">Ces valeurs s'entendent pour le fonds de commerce complet (clientèle, droit au bail, enseigne, licence, matériel), hors murs, hors stocks et hors trésorerie.</p>
   ${(forts.length || vigil.length) ? `<p>${forts.length ? "<b>Points forts :</b> " + esc(forts.join(", ")) + ". " : ""}${vigil.length ? "<b>Points de vigilance :</b> " + esc(vigil.join(", ")) + "." : ""}</p>` : ""}
   ${bandeauFiab}
   <h2 style="margin-top:22px">2. Identification de l'entreprise</h2>
   <table>
     <tbody>
       <tr><td style="width:38%">Dénomination</td><td>${esc(id.denomination ?? ctx.enseigne ?? "—")}</td></tr>
       <tr><td>Forme juridique</td><td>${esc(id.formeJuridique ?? "—")}</td></tr>
       <tr><td>SIREN / SIRET</td><td>${esc(id.siren ?? "—")}${id.siret ? " / " + esc(id.siret) : ""}</td></tr>
       <tr><td>Activité (NAF)</td><td>${esc(id.naf ?? "—")}${id.activite ? " — " + esc(id.activite) : ""}</td></tr>
       <tr><td>Création</td><td>${esc(id.dateCreation ?? "—")}${id.anciennete ? " — " + esc(id.anciennete) : ""}</td></tr>
       <tr><td>Adresse</td><td>${esc(id.adresse ?? "—")}</td></tr>
       <tr><td>Effectif</td><td>${esc(id.effectif ?? "—")}</td></tr>
       <tr><td>Bailleur</td><td>${esc(id.bailleur ?? "—")}</td></tr>
     </tbody>
   </table>
  ${closePageAfterCover()}`);
  function closePageAfterCover() { pg = 2; return runFoot(2, TOTAL) + "</div>"; }

  // ══ PAGE 3 — ANALYSE FINANCIÈRE ════════════════════════════════════════
  const lignes: { k: string; get: (x: ExerciceDetail) => any; fmt?: (v: any) => string }[] = [
    { k: "Chiffre d'affaires HT", get: (x) => x.ca_ht },
    { k: "Croissance du CA", get: (x) => x.croissance, fmt: (v) => v == null ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1).replace(".", ",") + " %" },
    { k: "Achats de marchandises", get: (x) => x.achats },
    { k: "Autres charges externes", get: (x) => x.autres_charges_externes },
    { k: "dont loyers et redevances", get: (x) => x.dont_loyers },
    { k: "Impôts et taxes", get: (x) => x.impots_taxes },
    { k: "Salaires du personnel", get: (x) => x.salaires },
    { k: "Charges sociales", get: (x) => x.charges_sociales },
    { k: "Résultat d'exploitation", get: (x) => x.resultat_exploitation },
    { k: "EBE (résultat d'exploitation + dotations)", get: (x) => x.ebe },
    { k: "Bénéfice de l'exercice", get: (x) => x.benefice },
  ];
  const finRows = lignes.map((L) => {
    const cells = exsTri.map((x) => `<td class="n">${L.fmt ? L.fmt(L.get(x)) : eur0(L.get(x))}</td>`).join("");
    return `<tr><td>${L.k}</td>${cells}</tr>`;
  }).join("");
  const lecture = ctx.lectureChiffres ?? defautLecture(res);
  P.push(`${openPage()}
   <h2>3. Analyse financière</h2>
   <table>
     <thead><tr><th>Poste (€)</th>${exsTri.map((x) => `<th class="n">${x.annee}</th>`).join("")}</tr></thead>
     <tbody>${finRows}</tbody>
   </table>
   <h3>Lecture des chiffres</h3>
   <p>${lecture}</p>
   ${res.ebeParExercice.some((x, i) => x.ebe !== x.ebeNormalise) ? `<div class="note">Normalisation appliquée : le poste « loyers » d'un exercice s'écartant fortement du loyer courant, l'EBE a été recalculé « à loyer courant » pour comparer les exercices entre eux (SDE retenu : ${eur(res.sde)}).</div>` : ""}
  ${closePageN(3)}`);
  function closePageN(n: number) { pg = n; return runFoot(n, TOTAL) + "</div>"; }

  // ══ PAGE 4 — LE BAIL ═══════════════════════════════════════════════════
  const teLbl = res.tauxEffort != null ? pct1(res.tauxEffort) : "—";
  const teS2 = res.tauxEffortS2 != null ? pct1(res.tauxEffortS2) : null;
  P.push(`${openPage()}
   <h2>4. Le bail : l'élément déterminant du dossier</h2>
   <p>La valeur d'un fonds repose en grande partie sur le droit au bail : le droit de rester dans les lieux à un loyer donné.</p>
   <h3>4.1 Taux d'effort (loyer + charges ÷ chiffre d'affaires)</h3>
   <p>Au loyer de référence (${eur(e.loyerReference)}/an), le taux d'effort ressort à <b>${teLbl}</b> du CA. Pour ce type d'activité, la zone saine se situe autour de 6 à 10 %.${teS2 ? ` Au loyer réclamé (${eur(e.loyerReclame)}/an), il passerait à <b>${teS2}</b>, à la limite de la zone critique.` : ""}</p>
   ${e.indemniteOccupation || e.contentieuxBail ? `<h3>4.2 Procédure de déplafonnement en cours</h3>
   <p>Les quittances sont émises au titre d'une « indemnité d'occupation » : le bail est en renouvellement contesté, le bailleur demandant le déplafonnement à la valeur locative de marché (art. L.145-33 et L.145-34 du Code de commerce). La hausse éventuelle est en principe lissée (plafonnement de la variation à 10 %/an, loi Pinel). Tant que la procédure n'est pas purgée, il subsiste une incertitude sur la charge locative future et un risque de rappel d'indemnités : cette incertitude se matérialise par le double scénario.</p>` : ""}
   <h3>4.3 Droit au bail</h3>
   <p>${ctx.bailTexte ?? "Si le local est loué sous la valeur locative de marché, cet avantage constitue un « droit au bail » qui donne un plancher de valeur au fonds. Une procédure de déplafonnement vise précisément à résorber cet avantage — c'est ce que traduit l'écart entre les deux scénarios."}</p>
   ${!e.documents?.bail ? `<div class="note">Le bail commercial n'a pas été fourni : durée restante, destination et clauses sont inconnues. L'analyse du droit au bail est indicative.</div>` : ""}
  ${closePageN(4)}`);

  // ══ PAGE 5 — LES TROIS MÉTHODES ════════════════════════════════════════
  const mA = s1.methodes.A, mB = s1.methodes.B, mC = s1.methodes.C;
  const divergence = res.alertes.find((a) => a.includes("divergent"));
  P.push(`${openPage()}
   <h2>5. Les trois méthodes d'évaluation</h2>
   <h3>5.1 Méthode A — barème professionnel (% du chiffre d'affaires)</h3>
   <p>Pour l'activité « ${esc(e.bareme.activite)} », le barème TBEECOM retient${e.bareme.n_mutations ? " (sur " + e.bareme.n_mutations.toLocaleString("fr-FR") + " mutations)" : ""} : ratio moyen <b>${String(e.bareme.ratio_moyen).replace(".", ",")} %</b> du CA, Q1 <b>${String(e.bareme.q1).replace(".", ",")} %</b>, Q3 <b>${String(e.bareme.q3).replace(".", ",")} %</b>. La grille de notation (section 6) positionne le curseur dans cette fourchette.</p>
   <ul class="tight">${res.scenarios.map((s) => `<li>${esc(s.nom)} : ${s.ratioPct.toFixed(1).replace(".", ",")} % × CA moyen ${eur(res.caMoyen)} = <b>${eur(s.methodes.A.valeur)}</b></li>`).join("")}</ul>
   <h3>5.2 Méthode B — rentabilité retraitée</h3>
   <p>Un repreneur achète un revenu futur. On part de l'EBE, on le normalise (loyer courant rétabli), puis on déduit le coût d'un exploitant salarié au prix du marché (${eur(e.remunerationExploitant ?? 35000)}/an${(e.nbExploitants ?? 1) > 1 ? " × " + (e.nbExploitants) : ""}). ${res.ebeRetraiteMoyen != null && res.ebeRetraiteMoyen <= 0 ? `Ici l'excédent résiduel est proche de zéro : on valorise alors le « revenu de l'exploitant » (SDE = ${eur(res.sde)}) avec un multiple prudent.` : "L'EBE retraité soutient directement la valeur."}</p>
   <ul class="tight">${res.scenarios.map((s) => `<li>${esc(s.nom)} : <b>${eur(s.methodes.B.valeur)}</b> <span class="mut">(${esc(s.methodes.B.detail)})</span></li>`).join("")}</ul>
   <h3>5.3 Méthode C — comparables de marché (garde-fou)</h3>
   <p>${mC.valeur != null ? `Référence de cession la plus proche retenue : <b>${eur(mC.valeur)}</b> (médiane des comparables BODACC géolocalisés).` : "Aucun comparable BODACC exploitable sur la période — méthode non contributive."}</p>
   ${divergence ? `<div class="note">${esc(divergence)}</div>` : ""}
  ${closePageN(5)}`);

  // ══ PAGE 6 — GRILLE + RÉCONCILIATION ═══════════════════════════════════
  const noteTxt = (n: number) => (n > 0 ? "+" : "") + n;
  const gridRows = CRITERES_RAPPORT.map((c) => {
    const n = Number(scores[c.key] ?? 0);
    const cls = n > 0 ? "good" : n < 0 ? "bad" : "mut";
    return `<tr><td>${c.label}</td><td class="n ${cls}">${noteTxt(n)}</td><td>${esc(ctx.commentaires?.[c.key] ?? "")}</td></tr>`;
  }).join("");
  const posSlider = (cur: number) => Math.max(0, Math.min(100, cur));
  const reconRows = ["A", "B", "C"].map((k) => {
    const lbl = k === "A" ? "A — Barème % CA" : k === "B" ? "B — Rentabilité" : "C — Comparables";
    const cells = res.scenarios.map((s) => `<td class="n">${eur((s.methodes as any)[k].valeur)}</td>`).join("");
    const pond = Math.round(((s1.ponderation as any)[k] ?? 0) * 100);
    return `<tr><td>${lbl} <span class="mut">(${pond} %)</span></td>${cells}</tr>`;
  }).join("");
  const prixPres = ctx.prixPresentation ?? (s1.fourchetteHaute != null ? arr1000(s1.fourchetteHaute) : null);
  const valNego = ctx.valeurNegociation ?? (s1.valeurCentrale != null ? arr1000(s1.valeurCentrale) : null);
  P.push(`${openPage()}
   <h2>6. Grille de notation de l'affaire</h2>
   <p>Chaque critère est noté de −2 (très défavorable) à +2 (très favorable). Cette grille justifie la position du curseur dans la fourchette du barème.</p>
   <table><thead><tr><th>Critère</th><th class="n">Note</th><th>Commentaire</th></tr></thead><tbody>${gridRows}</tbody></table>
   <div class="slider">
     <div class="track"></div>
     <div class="tick" style="left:0%"></div><div class="lbl" style="left:0%">Q1 · ${String(e.bareme.q1).replace(".", ",")} %</div>
     <div class="tick" style="left:50%"></div><div class="lbl" style="left:50%">Moyenne · ${String(e.bareme.ratio_moyen).replace(".", ",")} %</div>
     <div class="tick" style="left:100%"></div><div class="lbl" style="left:100%">Q3 · ${String(e.bareme.q3).replace(".", ",")} %</div>
     <div class="marker prop" style="left:${posSlider(curProp)}%"></div>
     ${curRet != null ? `<div class="marker ret" style="left:${posSlider(curRet)}%"></div><div class="val" style="left:${posSlider(curRet)}%">retenu ${s1.ratioPct.toFixed(1).replace(".", ",")} %</div>` : ""}
   </div>
   <div class="legend"><span><span class="d" style="background:#fff;border:2px solid #9a8f7a"></span>Proposé par la grille (${curProp} %)</span>${curRet != null ? `<span><span class="d" style="background:#D2913D"></span>Retenu par le négociateur (${curRet} %)</span>` : ""}</div>
   ${ctx.justificationCurseur ? `<p><b>Justification du positionnement :</b> ${esc(ctx.justificationCurseur)}</p>` : ""}
   <h2 style="margin-top:22px">7. Réconciliation et avis de valeur</h2>
   <table>
     <thead><tr><th>Méthode</th>${res.scenarios.map((s) => `<th class="n">${esc(s.nom.replace(/^Scénario \\d+ — /, "").replace("Valeur retenue", "Valeur"))}</th>`).join("")}</tr></thead>
     <tbody>
       ${reconRows}
       <tr class="tot"><td>Valeur centrale pondérée</td>${res.scenarios.map((s) => `<td class="n">${eur(s.valeurCentrale)}</td>`).join("")}</tr>
       <tr><td>Fourchette (±${Math.round(res.largeurFourchette * 100)} %)</td>${res.scenarios.map((s) => `<td class="n">${eur(s.fourchetteBasse)} – ${eur(s.fourchetteHaute)}</td>`).join("")}</tr>
     </tbody>
   </table>
   <div class="avisbox"><div class="t">Avis TBEECOM</div>${ctx.avisTexte ? esc(ctx.avisTexte) : `Prix de présentation conseillé autour de <b>${eur(prixPres)}</b>, valeur de négociation autour de <b>${eur(valNego)}</b>.${res.doubleScenario ? " La sécurisation du bail avant mise en vente est le levier n°1 pour défendre le haut de la fourchette." : ""}`}</div>
  ${closePageN(6)}`);

  // ══ PAGE 7 — HYPOTHÈSES, LIMITES, SOURCES ══════════════════════════════
  const mentions = res.mentions.length ? res.mentions : ["Aucune réserve de complétude : dossier complet."];
  P.push(`${openPage()}
   <h2>8. Hypothèses, points à vérifier et limites</h2>
   ${manquants.length ? `<div class="banner"><div class="bt">Documents manquants signalés</div><ul>${manquants.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
   <p>Cet avis repose sur les documents transmis et sur des sources publiques. Conséquences des éléments manquants et réserves :</p>
   <ul class="tight">${mentions.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
   ${res.alertes.length ? `<h3>Points d'attention du calcul</h3><ul class="tight">${res.alertes.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
   <p class="legal">Le présent document constitue un avis de valeur indicatif. Il ne constitue ni une expertise judiciaire, ni un engagement d'achat ou de vente, ni un conseil juridique ou fiscal. La valeur définitive résultera de la négociation et des vérifications d'usage (due diligence).</p>
   <h3>Sources</h3>
   <ul class="tight">${(ctx.sources ?? defautSources(e)).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  ${closePageN(7)}`);

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avis de valeur — ${esc(ctx.enseigne ?? activite)}</title><style>${CSS}</style></head><body><div class="doc">${P.join("\n")}</div></body></html>`;
}

// Paragraphe d'analyse par défaut (généré depuis les chiffres si non fourni)
function defautLecture(res: ResultatAvis): string {
  const exs = res.ebeParExercice;
  if (exs.length >= 2) {
    return `Le chiffre d'affaires et la rentabilité sont analysés sur ${exs.length} exercice(s). L'EBE normalisé du dernier exercice (revenu de l'exploitant) ressort à ${eur(res.sde)} ; après rémunération d'un exploitant au prix du marché, l'excédent économique retraité moyen s'établit à ${eur(res.ebeRetraiteMoyen)}. La structure de rentabilité est ${res.ebeRetraiteMoyen != null && res.ebeRetraiteMoyen <= 0 ? "modeste une fois le travail de l'exploitant rémunéré" : "positive après rémunération de l'exploitant"}.`;
  }
  return `L'analyse financière repose sur les éléments disponibles. EBE / revenu de l'exploitant retenu : ${eur(res.sde)}.`;
}
function defautSources(e: EntreeAvis): string[] {
  const src = ["Documents comptables transmis (liasses fiscales / quittances) le cas échéant",
    "Annuaire des entreprises (data.gouv.fr) et INSEE",
    "BODACC (API open data DILA) — cessions de fonds",
    `Barème professionnel des mutations de fonds de commerce — activité « ${e.bareme.activite} »${e.bareme.n_mutations ? " (n = " + e.bareme.n_mutations + ")" : ""}`];
  return src;
}

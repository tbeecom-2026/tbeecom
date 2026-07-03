// src/lib/avisValeurV2.ts
// Avis de valeur PDF (HTML imprimable), 2 modes :
//   - "nego"   : interne, complet (méthodes détaillées, grille d'appréciation, alertes, coefficients)
//   - "client" : vendeur, présentable, camembert de méthodologie, indicateurs, atouts (SANS la grille)
// Design cartes, orange TBC, optimisé impression (fonds clairs non imprimés par défaut).
import type { EntreeEstimation, ResultatEstimation } from "@/lib/estimation";
import { CRITERES_SCORE, ZONE_LABEL, type CritereKey } from "@/lib/estimation";

const eur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number | null | undefined) => (n == null ? "—" : (n * 100).toFixed(1) + " %");
const noteLabel: Record<string, string> = { "-2": "Très défavorable", "-1": "Défavorable", "0": "Neutre", "1": "Favorable", "2": "Très favorable" };

const ATOUTS: Record<string, string> = {
  emplacement: "Emplacement de qualité, bon passage",
  evolution_ca: "Chiffre d'affaires bien orienté",
  rentabilite: "Bonne rentabilité",
  qualite_bail: "Bail de qualité",
  taux_effort: "Loyer bien dimensionné",
  dependance_exploitant: "Affaire facilement transmissible",
  etat_materiel: "Matériel et local en bon état",
  concurrence: "Position concurrentielle favorable",
  main_oeuvre: "Équipe en place",
  notoriete: "Bonne notoriété, clientèle fidèle",
};

// Camembert (donut) SVG imprimable
function donut(parts: { label: string; value: number; color: string }[]): string {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const segs = parts.filter((p) => p.value > 0).map((p) => {
    const len = C * (p.value / total);
    const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${p.color}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
    off += len; return s;
  }).join("");
  return `<svg viewBox="0 0 140 140" width="132" height="132">${segs}<circle cx="70" cy="70" r="41" fill="#fff"/></svg>`;
}

const CSS = `
 *{box-sizing:border-box}
 body{font-family:"Inter","Segoe UI",Arial,sans-serif;color:#2b2f36;line-height:1.5;font-size:13px;margin:0;background:#fff}
 .page{max-width:840px;margin:0 auto;padding:26px 34px}
 .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #D2963C;padding-bottom:12px}
 .brand{font-family:"Playfair Display",Georgia,serif;font-size:26px;color:#42546C;letter-spacing:1px}
 .brand b{color:#D2963C}
 .agence{font-size:11px;color:#8a8f98;text-align:right;line-height:1.6}
 h1{font-family:"Playfair Display",Georgia,serif;color:#42546C;font-size:23px;text-align:center;margin:18px 0 2px}
 .sub{text-align:center;color:#8a8f98;font-size:12.5px;margin-bottom:2px}
 .sub b{color:#42546C}
 .stitle{font-family:"Playfair Display",Georgia,serif;color:#42546C;font-size:15px;margin:22px 0 10px;display:flex;align-items:center;gap:8px}
 .stitle::before{content:"";width:18px;height:3px;background:#D2963C;border-radius:2px;display:inline-block}
 .hero{border:1.5px solid #D2963C;border-radius:14px;background:#FBF8F2;padding:20px;text-align:center;margin:14px 0}
 .hero .lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a9946f}
 .hero .range{font-size:30px;font-weight:800;color:#42546C;margin:6px 0;letter-spacing:.5px}
 .hero .central{font-size:15px;color:#2F855A;font-weight:700}
 .pill{display:inline-block;margin-top:6px;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid #D2963C;color:#B45309;background:#FDF6EA}
 .pill.bonne{border-color:#2F855A;color:#2F855A;background:#EEF7F0}
 .pill.faible{border-color:#B91C1C;color:#B91C1C;background:#FBEDED}
 .methods{display:flex;gap:12px;flex-wrap:wrap}
 .method{flex:1;min-width:200px;border:1px solid #EAE4D8;border-top:3px solid #D2963C;border-radius:10px;padding:12px 14px}
 .method .m-lbl{font-size:10.5px;color:#8a8f98;text-transform:uppercase;letter-spacing:.04em}
 .method .m-val{font-size:20px;font-weight:800;color:#42546C;margin:3px 0}
 .method .m-det{font-size:10.5px;color:#9a9fa8;line-height:1.4}
 .pond{font-size:11px;color:#8a8f98;margin-top:10px;text-align:center;border-top:1px dotted #EAE4D8;padding-top:8px}
 .cols{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
 .card{flex:1;min-width:290px;border:1px solid #EAE4D8;border-radius:12px;padding:6px 16px 10px}
 .card .ch{font-family:"Playfair Display",Georgia,serif;color:#42546C;font-size:13.5px;margin:10px 0 4px;border-bottom:1px solid #F0EAdf;padding-bottom:6px}
 .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dotted #EEE7DA;font-size:12.5px}
 .row:last-child{border-bottom:none}
 .row .k{color:#5b616b}.row .v{font-weight:600;color:#2b2f36;white-space:nowrap}
 .row .v.good{color:#2F855A}.row .v.bad{color:#B45309}
 .stats{display:flex;gap:12px;flex-wrap:wrap}
 .stat{flex:1;min-width:120px;border:1px solid #EAE4D8;border-radius:10px;padding:10px 12px;text-align:center}
 .stat .s-lbl{font-size:10px;color:#8a8f98;text-transform:uppercase;letter-spacing:.03em}
 .stat .s-val{font-size:18px;font-weight:800;color:#42546C;margin-top:3px}
 .donutwrap{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
 .legend{font-size:12px;flex:1;min-width:200px}
 .legend .li{display:flex;align-items:center;gap:8px;margin:6px 0}
 .legend .dot{width:11px;height:11px;border-radius:3px;display:inline-block;flex:none}
 .legend .lv{margin-left:auto;font-weight:700;color:#42546C;white-space:nowrap}
 .atouts{list-style:none;padding:0;margin:6px 0;display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}
 .atouts li{font-size:12.5px;color:#2b2f36;padding-left:20px;position:relative}
 .atouts li::before{content:"✓";position:absolute;left:0;color:#D2963C;font-weight:800}
 .methodo{font-size:12px;color:#5b616b;line-height:1.6;margin-top:4px}
 .alertes{border:1px solid #F0C88A;border-left:4px solid #D2963C;border-radius:10px;background:#FDF9F1;padding:10px 16px;margin-top:12px}
 .alertes .a-t{font-weight:700;color:#B45309;font-size:12.5px;margin-bottom:4px}
 .alertes ul{margin:0;padding-left:18px;color:#7c5b2a;font-size:12px}
 .alertes li{margin:3px 0}
 .foot{font-size:10.5px;color:#9a9fa8;margin-top:18px;border-top:1px solid #EAE4D8;padding-top:10px}
 @page{margin:13mm}
 @media print{ .page{padding:0} .hero,.pill,.method,.card,.stat,.alertes{background:#fff !important} }
`;

function entete(a: any) {
  return `<div class="head">
   <div class="brand">TBE<b>E</b>COM</div>
   <div class="agence">${a.raison_sociale ?? "MENESGUEN Immobilier"} — TBEECOM<br>${a.siege ?? "128 rue de la Boétie, 75008 Paris"}<br>contact@tbeecom.com</div>
 </div>`;
}

export function genererAvisValeurV2Html(
  entree: EntreeEstimation,
  res: ResultatEstimation,
  ctx?: { enseigne?: string; adresse?: string; agence?: any },
  mode: "nego" | "client" = "nego",
): string {
  const a = ctx?.agence ?? {};
  const scores = entree.scores ?? {};
  const duree = entree.dureeRestanteAnnees != null ? `${Math.round(entree.dureeRestanteAnnees * 12)} mois` : "—";
  const titre = `${ctx?.enseigne ? `<b>${ctx.enseigne}</b> — ` : ""}${entree.bareme.activite}${ctx?.adresse ? ` · ${ctx.adresse}` : ""}`;

  const hero = `<div class="hero">
   <div class="lbl">Valeur vénale estimée du fonds de commerce</div>
   <div class="range">${eur(res.fourchetteBasse)} — ${eur(res.fourchetteHaute)}</div>
   <div class="central">Valeur centrale retenue : ${eur(res.valeurCentrale)}</div>
   ${mode === "nego" ? `<div><span class="pill ${res.fiabilite}">Fiabilité : ${res.fiabilite}</span></div>` : ""}
 </div>`;

  const donutParts = [
    { label: "% du chiffre d'affaires", value: res.ponderation.A, color: "#D2963C", v: res.methodeA.valeur },
    { label: "Rentabilité (EBE)", value: res.ponderation.B, color: "#42546C", v: res.methodeB.valeur },
    { label: "Comparables du marché", value: res.ponderation.C, color: "#2F855A", v: res.methodeC.valeur },
  ].filter((p) => p.value > 0);
  const legend = donutParts.map((p) =>
    `<div class="li"><span class="dot" style="background:${p.color}"></span>${p.label}<span class="lv">${eur(p.v)} · ${(p.value * 100).toFixed(0)} %</span></div>`).join("");
  const camembert = `<div class="donutwrap">${donut(donutParts)}<div class="legend">${legend}</div></div>`;

  const stats = `<div class="stats">
    <div class="stat"><div class="s-lbl">CA HT moyen</div><div class="s-val">${eur(res.caMoyen)}</div></div>
    <div class="stat"><div class="s-lbl">EBE retraité</div><div class="s-val">${eur(res.ebeRetraite)}</div></div>
    <div class="stat"><div class="s-lbl">Loyer annuel</div><div class="s-val">${eur(entree.loyerAnnuel)}</div></div>
    <div class="stat"><div class="s-lbl">Taux d'effort</div><div class="s-val">${pct(res.tauxEffort)}</div></div>
  </div>`;

  let corps: string;
  if (mode === "client") {
    const atouts = CRITERES_SCORE.filter((c) => Number((scores as any)[c.key] ?? 0) >= 1)
      .map((c) => `<li>${ATOUTS[c.key] ?? c.label}</li>`).join("");
    corps = `
 ${hero}
 <div class="stitle">Comment cette valeur est établie</div>
 <div class="cols">
   <div class="card"><div class="ch">Méthodes d'évaluation croisées</div>${camembert}</div>
   <div class="card"><div class="ch">Indicateurs clés</div>${stats}</div>
 </div>
 ${atouts ? `<div class="stitle">Atouts du fonds</div><ul class="atouts">${atouts}</ul>` : ""}
 <div class="stitle">Méthodologie</div>
 <p class="methodo">Cette valorisation croise trois approches reconnues : la méthode des <b>barèmes professionnels</b> (pourcentage du chiffre d'affaires selon l'activité), la méthode de <b>rentabilité</b> (multiple de l'excédent brut d'exploitation retraité) et les <b>comparables de cession</b> du secteur. La valeur est ensuite ajustée en fonction des caractéristiques du <b>bail</b> (loyer, durée, valeur locative de marché) et de la <b>localisation</b>. Il en résulte une fourchette resserrée et une valeur centrale de référence pour la commercialisation.</p>`;
  } else {
    const methodCard = (m: { libelle: string; valeur: number | null; detail: string }) =>
      `<div class="method"><div class="m-lbl">${m.libelle}</div><div class="m-val">${eur(m.valeur)}</div><div class="m-det">${m.detail}</div></div>`;
    const bailRows = [
      ["Loyer annuel", eur(entree.loyerAnnuel), ""],
      ["Charges + taxe foncière", eur((entree.chargesAnnuelles ?? 0) + (entree.taxeFonciere ?? 0)), ""],
      ["Taux d'effort", pct(res.tauxEffort), res.tauxEffort != null && res.tauxEffort > 0.15 ? "bad" : ""],
      ["Valeur locative de marché", eur(entree.valeurLocativeMarcheAnnuelle), ""],
      ["Durée restante du bail", duree, ""],
      ["EBE retraité", eur(res.ebeRetraite), ""],
      ["Ajustement bail", `× ${res.coefBail.toFixed(2)}`, res.coefBail < 1 ? "bad" : res.coefBail > 1 ? "good" : ""],
      ["Prime de zone", `× ${res.coefZone.toFixed(2)}`, res.coefZone < 1 ? "bad" : res.coefZone > 1 ? "good" : ""],
      ["Plancher droit au bail", eur(res.droitAuBailPlancher), ""],
    ].map(([k, v, cls]) => `<div class="row"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`).join("");
    const scoreRows = CRITERES_SCORE.map((c) => {
      const n = Number((scores as any)[c.key as CritereKey] ?? 0);
      const cls = n > 0 ? "good" : n < 0 ? "bad" : "";
      return `<div class="row"><span class="k">${c.label}</span><span class="v ${cls}">${noteLabel[String(n)] ?? n}</span></div>`;
    }).join("");
    const alertes = res.alertes.length
      ? `<div class="alertes"><div class="a-t">Points de vigilance (${res.alertes.length})</div><ul>${res.alertes.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : "";
    corps = `
 ${hero}
 <div class="stitle">Méthodes d'évaluation croisées</div>
 <div class="methods">${methodCard(res.methodeA)}${methodCard(res.methodeB)}${methodCard(res.methodeC)}</div>
 <div class="pond">Pondération — % du CA : ${(res.ponderation.A * 100).toFixed(0)} % · EBE : ${(res.ponderation.B * 100).toFixed(0)} % · comparables : ${(res.ponderation.C * 100).toFixed(0)} % · CA HT moyen : ${eur(res.caMoyen)} · score qualitatif : ${(res.scoreGlobal * 100).toFixed(0)} %</div>
 <div class="stitle">Analyse du bail & appréciation</div>
 <div class="cols">
   <div class="card"><div class="ch">Bail & ajustements</div>${bailRows}</div>
   <div class="card"><div class="ch">Grille d'appréciation (interne)</div>${scoreRows}</div>
 </div>
 ${alertes}`;
  }

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avis de valeur — ${ctx?.enseigne ?? entree.bareme.activite}</title>
<style>${CSS}</style></head><body><div class="page">
 ${entete(a)}
 <h1>Avis de valeur — fonds de commerce</h1>
 <p class="sub">${titre}</p>
 <p class="sub">${ZONE_LABEL[entree.zone ?? "ville_moyenne"]}${mode === "nego" ? "" : ""}</p>
 ${corps}
 <div class="foot">Avis de valeur indicatif établi selon la méthode des barèmes professionnels (% du CA), la méthode de rentabilité (multiple d'EBE retraité) et les comparables de cession, ajusté des caractéristiques du bail et de la localisation. Il ne constitue ni une expertise judiciaire ni un engagement de prix ; la valeur définitive relève de l'appréciation des parties. Établi le ${new Date().toLocaleDateString("fr-FR")}.</div>
</div></body></html>`;
}

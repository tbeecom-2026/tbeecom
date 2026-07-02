// src/lib/avisValeurV2.ts
// Génère l'« Avis de valeur » PDF (HTML imprimable) à partir du moteur estimation.ts.
import type { EntreeEstimation, ResultatEstimation } from "@/lib/estimation";
import { CRITERES_SCORE, ZONE_LABEL, type CritereKey } from "@/lib/estimation";

const eur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number | null | undefined) => (n == null ? "—" : (n * 100).toFixed(1) + " %");
const noteLabel: Record<string, string> = { "-2": "Très défavorable", "-1": "Défavorable", "0": "Neutre", "1": "Favorable", "2": "Très favorable" };

export function genererAvisValeurV2Html(
  entree: EntreeEstimation,
  res: ResultatEstimation,
  ctx?: { enseigne?: string; adresse?: string; agence?: any },
): string {
  const a = ctx?.agence ?? {};
  const fiab = { faible: "#B91C1C", moyenne: "#D2963C", bonne: "#2F855A" }[res.fiabilite];

  const ligneMethode = (m: { libelle: string; valeur: number | null; detail: string }) =>
    `<tr><td>${m.libelle}</td><td style="text-align:right;font-weight:600">${eur(m.valeur)}</td><td style="color:#6b7280;font-size:11px">${m.detail}</td></tr>`;

  const scores = entree.scores ?? {};
  const ligneScore = CRITERES_SCORE.map((c) => {
    const n = Number((scores as any)[c.key as CritereKey] ?? 0);
    return `<tr><td>${c.label}</td><td style="text-align:center">${noteLabel[String(n)] ?? n}</td></tr>`;
  }).join("");

  const alertes = res.alertes.length
    ? `<ul style="margin:4px 0 0;padding-left:18px">${res.alertes.map((x) => `<li style="margin:2px 0">${x}</li>`).join("")}</ul>`
    : `<p class="note">Aucune alerte particulière.</p>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avis de valeur — ${ctx?.enseigne ?? entree.bareme.activite}</title>
<style>
 body{font-family:"Inter","Segoe UI",Arial,sans-serif;color:#1f2733;line-height:1.5;font-size:13px;margin:0}
 .page{max-width:820px;margin:0 auto;padding:30px 40px}
 h1{font-family:"Playfair Display",Georgia,serif;color:#42546C;font-size:22px;text-align:center;margin:.2em 0}
 h2{font-family:"Playfair Display",Georgia,serif;color:#42546C;font-size:15px;margin:18px 0 6px;border-bottom:2px solid #D2963C;padding-bottom:3px}
 .head{display:flex;justify-content:space-between;border-bottom:3px solid #42546C;padding-bottom:10px}
 .brand{font-family:"Playfair Display",Georgia,serif;font-size:24px;color:#42546C;letter-spacing:1px}.brand b{color:#D2963C}
 .agence{font-size:11px;color:#6b7280;text-align:right}
 .estim{background:#F4F6F9;border:1px solid #D2963C;border-radius:8px;padding:14px 18px;margin:14px 0;text-align:center}
 .estim .val{font-size:26px;font-weight:700;color:#42546C}
 .estim .cen{font-size:15px;color:#2F855A;font-weight:600}
 table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}
 th,td{border-bottom:1px solid #e2e7ee;padding:5px 7px;text-align:left}th{color:#6b7280;font-weight:600}
 .note{font-size:11px;color:#6b7280}
 .badge{display:inline-block;padding:2px 8px;border-radius:10px;color:#fff;font-size:11px;font-weight:700}
 .alertes{background:#FFF7ED;border:1px solid #FDBA74;border-radius:6px;padding:8px 12px;font-size:12px;color:#9A3412}
 .grid2{display:flex;gap:16px}.grid2>div{flex:1}
</style></head><body><div class="page">
 <div class="head"><div class="brand">TBE<b>E</b>COM</div>
  <div class="agence">${a.raison_sociale ?? "MENESGUEN Immobilier"} — TBEECOM<br>${a.siege ?? "128 rue de la Boétie, 75008 Paris"}<br>contact@tbeecom.com</div></div>
 <h1>Avis de valeur — fonds de commerce</h1>
 <p style="text-align:center;color:#6b7280">${ctx?.enseigne ? `<b>${ctx.enseigne}</b> — ` : ""}${entree.bareme.activite}${ctx?.adresse ? ` · ${ctx.adresse}` : ""} · ${ZONE_LABEL[entree.zone ?? "ville_moyenne"]}</p>

 <div class="estim">
  <div class="note">Valeur vénale estimée du fonds de commerce</div>
  <div class="val">${eur(res.fourchetteBasse)} — ${eur(res.fourchetteHaute)}</div>
  <div class="cen">Valeur centrale retenue : ${eur(res.valeurCentrale)}</div>
  <div class="note">Fiabilité : <span class="badge" style="background:${fiab}">${res.fiabilite}</span></div>
 </div>

 <h2>Méthodes d'évaluation croisées</h2>
 <table><thead><tr><th>Méthode</th><th style="text-align:right">Valeur</th><th>Détail</th></tr></thead>
 <tbody>${ligneMethode(res.methodeA)}${ligneMethode(res.methodeB)}${ligneMethode(res.methodeC)}</tbody></table>
 <p class="note">Pondération retenue — % du CA : ${(res.ponderation.A * 100).toFixed(0)} %, EBE : ${(res.ponderation.B * 100).toFixed(0)} %, comparables : ${(res.ponderation.C * 100).toFixed(0)} %. CA HT moyen : ${eur(res.caMoyen)}. Score qualitatif global : ${(res.scoreGlobal * 100).toFixed(0)} %.</p>

 <div class="grid2">
  <div>
   <h2>Analyse du bail</h2>
   <table>
    <tr><td>Loyer annuel</td><td style="text-align:right">${eur(entree.loyerAnnuel)}</td></tr>
    <tr><td>Charges + taxe foncière</td><td style="text-align:right">${eur((entree.chargesAnnuelles ?? 0) + (entree.taxeFonciere ?? 0))}</td></tr>
    <tr><td>Taux d'effort</td><td style="text-align:right">${pct(res.tauxEffort)}</td></tr>
    <tr><td>Valeur locative de marché</td><td style="text-align:right">${eur(entree.valeurLocativeMarcheAnnuelle)}</td></tr>
    <tr><td>Durée restante du bail</td><td style="text-align:right">${entree.dureeRestanteAnnees != null ? entree.dureeRestanteAnnees + " an(s)" : "—"}</td></tr>
    <tr><td>Ajustement bail</td><td style="text-align:right">× ${res.coefBail.toFixed(2)}</td></tr>
    <tr><td>Prime de zone</td><td style="text-align:right">× ${res.coefZone.toFixed(2)}</td></tr>
    <tr><td>Plancher droit au bail</td><td style="text-align:right">${eur(res.droitAuBailPlancher)}</td></tr>
   </table>
  </div>
  <div>
   <h2>Grille d'appréciation</h2>
   <table><tbody>${ligneScore}</tbody></table>
  </div>
 </div>

 <h2>Points de vigilance</h2>
 <div class="alertes">${alertes}</div>

 <h2>Réserves</h2>
 <p class="note">Avis de valeur indicatif établi selon la méthode des barèmes professionnels (% du CA), la méthode de rentabilité (multiple d'EBE retraité) et les comparables de cession, ajusté des caractéristiques du bail et de la localisation. Il ne constitue ni une expertise judiciaire ni un engagement de prix. La valeur définitive relève de l'appréciation des parties. Établi le ${new Date().toLocaleDateString("fr-FR")}.</p>
</div></body></html>`;
}

/**
 * generateMandat.ts
 * Génération des mandats TBEECOM en HTML → impression PDF navigateur
 * Trois types : simple, exclusif, avenant
 */

import type { Mandat, Contact, MandatVendeur } from "@/types/database";
import type { AgenceParametres } from "@/lib/agence";
import { supabase } from "@/lib/supabaseClient";

// ── Helpers ────────────────────────────────────────────────────────────────
function euros(n: number | null | undefined): string {
  if (!n) return "[ _________ ]";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function eurosLettres(n: number | null | undefined): string {
  if (!n) return "[ en lettres ]";
  const units = ["","un","deux","trois","quatre","cinq","six","sept","huit","neuf",
    "dix","onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
  const tens = ["","","vingt","trente","quarante","cinquante","soixante","soixante","quatre-vingt","quatre-vingt"];
  function toWords(num: number): string {
    if (num === 0) return "zéro";
    if (num < 20) return units[num];
    if (num < 100) {
      const t = Math.floor(num / 10), u = num % 10;
      if (t === 7) return "soixante-" + (u === 1 ? "et-onze" : toWords(10 + u));
      if (t === 9) return "quatre-vingt-" + toWords(10 + u);
      return tens[t] + (u === 1 && t !== 8 ? "-et-un" : u > 0 ? "-" + units[u] : (t === 8 ? "s" : ""));
    }
    if (num < 1000) {
      const h = Math.floor(num / 100), r = num % 100;
      return (h === 1 ? "cent" : units[h] + " cent") + (r > 0 ? " " + toWords(r) : (h > 1 ? "s" : ""));
    }
    const m = Math.floor(num / 1000), r = num % 1000;
    return (m === 1 ? "mille" : toWords(m) + " mille") + (r > 0 ? " " + toWords(r) : "");
  }
  return toWords(Math.round(n)) + " euros";
}

function fdate(d: string | null | undefined): string {
  if (!d) return "[ JJ/MM/AAAA ]";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/**
 * Retourne un <span contenteditable> :
 * - si la valeur existe : fond légèrement coloré, éditable
 * - si vide : placeholder visible en orange, prêt à saisir
 */
function val(v: string | null | undefined, placeholder = "_______________"): string {
  const filled = v && v.trim();
  if (filled) {
    return `<span contenteditable="true" class="editable editable-filled">${v!.trim()}</span>`;
  }
  return `<span contenteditable="true" class="editable editable-empty">${placeholder}</span>`;
}

function dateExpiration(dateDebut: string | null | undefined): string {
  if (!dateDebut) return "[ JJ/MM/AAAA ]";
  const d = new Date(dateDebut);
  d.setMonth(d.getMonth() + 3);
  return d.toLocaleDateString("fr-FR");
}

// ── CSS commun ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    font-size: 9.5pt;
    color: #1E293B;
    background: #fff;
    line-height: 1.5;
  }

  .page { max-width: 210mm; margin: 0 auto; padding: 18mm 18mm 22mm; }

  /* En-tête */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6mm; }
  .header-brand { font-size: 22pt; font-weight: 700; color: #C9A84C; letter-spacing: -0.5px; }
  .header-info { font-size: 7.5pt; color: #64748B; text-align: right; line-height: 1.6; }
  .gold-line { border: none; border-top: 1.5px solid #C9A84C; margin: 3mm 0; }
  .thin-line  { border: none; border-top: 0.4px solid #D4B86A; margin: 3mm 0; }

  /* Titre document */
  .doc-title { text-align: center; margin: 4mm 0 2mm; }
  .doc-title h1 { font-size: 13pt; font-weight: 700; color: #1E293B; letter-spacing: 0.3px; }
  .doc-title p  { font-size: 9pt; color: #C9A84C; font-weight: 500; margin-top: 1mm; }

  /* Tableau de synthèse */
  .summary-table { width: 100%; border-collapse: collapse; margin: 4mm 0; }
  .summary-table td { padding: 2.5mm 4mm; border: 0.3px solid #D4B86A; vertical-align: middle; font-size: 8.5pt; }
  .summary-table td:first-child { background: #F0E8D0; font-weight: 600; color: #334155; width: 42%; }
  .summary-table td:last-child  { background: #F8F5EE; color: #1E293B; }

  /* Section parties */
  .partie-title { font-weight: 700; font-size: 9pt; color: #1E293B; margin: 4mm 0 2mm; }
  .partie-table  { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  .partie-table td { padding: 2mm 3.5mm; border: 0.3px solid #D4B86A; font-size: 8pt; vertical-align: top; }
  .partie-table td:first-child { background: #F0E8D0; font-weight: 600; color: #334155; width: 38%; }
  .partie-table td:last-child  { background: #F8F5EE; }

  /* Section titre entre les parties */
  .convention { text-align: center; font-weight: 700; font-size: 10pt; color: #1E293B;
    margin: 5mm 0 3mm; border-top: 1.5px solid #C9A84C; border-bottom: 1.5px solid #C9A84C;
    padding: 2.5mm 0; }

  /* ── Champs éditables ────────────────────────────────────────── */
  .editable {
    display: inline-block;
    min-width: 60px;
    border-radius: 2px;
    padding: 0 2px;
    outline: none;
    transition: background 0.15s;
  }
  .editable-filled {
    background: rgba(201,168,76,0.12);
    border-bottom: 1px dashed #C9A84C;
    color: #1E293B;
  }
  .editable-filled:hover, .editable-filled:focus {
    background: rgba(201,168,76,0.25);
    border-bottom: 1px solid #C9A84C;
  }
  .editable-empty {
    background: rgba(251,146,60,0.12);
    border-bottom: 1.5px dashed #F97316;
    color: #C2410C;
    font-style: italic;
  }
  .editable-empty:hover, .editable-empty:focus {
    background: rgba(251,146,60,0.22);
    border-bottom: 1.5px solid #F97316;
    color: #1E293B;
    font-style: normal;
  }

  /* ── Barre d'outils impression (masquée à l'impression) ──────── */
  .print-toolbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #1E293B; border-bottom: 2px solid #C9A84C;
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 20px; gap: 12px;
    font-family: 'Inter', sans-serif; font-size: 13px; color: #F8FAFC;
  }
  .print-toolbar .info { font-size: 11px; color: #94A3B8; }
  .print-toolbar button {
    padding: 7px 18px; border: none; border-radius: 6px; cursor: pointer;
    font-weight: 600; font-size: 13px;
  }
  .btn-print { background: #C9A84C; color: #1E293B; }
  .btn-print:hover { background: #D4B86A; }
  .btn-close { background: #334155; color: #F8FAFC; }
  .btn-close:hover { background: #475569; }
  @media print {
    .print-toolbar { display: none !important; }
    .page { padding-top: 18mm; }
    .editable-filled { background: none; border-bottom: none; }
    .editable-empty { background: none; border-bottom: 1px solid #999; color: #000; font-style: normal; }
  }
  body { padding-top: 52px; }

  /* Articles */
  .article { margin-bottom: 4mm; page-break-inside: avoid; }
  .article-title { font-size: 9pt; font-weight: 700; color: #C9A84C;
    margin-bottom: 2mm; padding-bottom: 1mm;
    border-bottom: 0.4px solid #D4B86A; }
  .article p  { margin-bottom: 2mm; text-align: justify; }
  .article ul { margin: 1mm 0 2mm 6mm; }
  .article li { margin-bottom: 1mm; }

  /* Clause pénale */
  .caps { font-weight: 700; font-size: 8pt; text-align: justify; margin: 2mm 0; }

  /* RGPD */
  .checkbox { margin: 1.5mm 0; }

  /* Signatures */
  .sig-section { margin-top: 6mm; }
  .sig-title { text-align: center; font-weight: 700; font-size: 10pt;
    border-top: 1.5px solid #C9A84C; border-bottom: 1.5px solid #C9A84C;
    padding: 2mm 0; margin: 4mm 0 3mm; }
  .sig-date { text-align: center; margin-bottom: 4mm; font-size: 9pt; }
  .sig-grid { display: flex; gap: 5mm; }
  .sig-box  { flex: 1; border: 0.5px solid #D4B86A; background: #F8F5EE;
    padding: 3.5mm; min-height: 35mm; }
  .sig-box strong { display: block; font-size: 9pt; margin-bottom: 2mm; }
  .sig-line { border-top: 0.4px solid #334155; margin-top: 18mm; padding-top: 1mm;
    font-size: 7.5pt; color: #64748B; }

  /* Pied de page */
  .footer-note { font-size: 7pt; color: #94A3B8; margin-top: 6mm; text-align: center;
    border-top: 0.4px solid #D4B86A; padding-top: 2mm; }

  /* IMPRESSION */
  @media print {
    body { font-size: 9pt; }
    .page { padding: 15mm 15mm 20mm; }
    .no-print { display: none !important; }
    @page { size: A4; margin: 0; }
  }
`;

// ── En-tête commun ─────────────────────────────────────────────────────────
function headerHtml(typeDoc: string, subtitle: string): string {
  return `
    <div class="header">
      <div>
        <div class="header-brand">TBEECOM</div>
        <div style="font-size:7.5pt;color:#64748B;margin-top:1mm;">
          MENESGUEN Immobilier — EURL · 128 rue de la Boétie, 75008 Paris
        </div>
      </div>
      <div class="header-info">
        Tél. +33 6 07 03 78 01 · tbc@tbeecom.fr · tbeecom.fr<br/>
        RCS Paris n° 849 721 469 · TVA FR54 849721469<br/>
        Carte Pro. CPI 7501 2019 000 041 080 — CCI Paris IDF<br/>
        RC Pro Beazley Solutions — MA034L20ANPM
      </div>
    </div>
    <hr class="gold-line"/>
    <div class="doc-title">
      <h1>${typeDoc}</h1>
      <p>${subtitle}</p>
    </div>`;
}

// ── Tableau cédant ─────────────────────────────────────────────────────────
function cedantTable(contact: Contact | null | undefined): string {
  const nom = contact ? `${contact.prenom ?? ""} ${contact.nom}`.trim() : "[ _________________ ]";
  const societe = val(contact?.societe);
  const tel = val(contact?.telephone);
  const email = val(contact?.email);
  const adresse = contact?.adresse
    ? `${contact.adresse}${contact.code_postal ? ", " + contact.code_postal : ""}${contact.commune ? " " + contact.commune : ""}`
    : "[ _________________ ]";

  return `
    <table class="partie-table">
      <tr><td>Société / Raison sociale</td><td><b>${societe}</b></td></tr>
      <tr><td>Forme juridique — Capital</td><td>[ SARL / SAS / EI ... ] &nbsp;—&nbsp; Capital : [ _______ ] €</td></tr>
      <tr><td>Siège social</td><td>${adresse}</td></tr>
      <tr><td>Immatriculation RCS</td><td>RCS [ Ville ] — n° [ _________________ ]</td></tr>
      <tr><td>Représentant(e)</td><td><b>${nom}</b> — Qualité : [ Gérant / Président ... ]</td></tr>
      <tr><td>Téléphone</td><td>${tel}</td></tr>
      <tr><td>Adresse e-mail</td><td>${email}</td></tr>
    </table>`;
}

// ── Bloc mandataire fixe ───────────────────────────────────────────────────
function mandataireHtml(suivi_par: string | null | undefined): string {
  const agent = val(suivi_par, "[ Prénom NOM de l'agent ]");
  return `
    <div class="partie-title">L'INTERMÉDIAIRE (Mandataire)</div>
    <p>La société <b>TBEECOM</b>, exploitée par <b>MENESGUEN Immobilier</b>, EURL au capital de 22 000 €,
    128 rue de la Boétie 75008 Paris — RCS Paris n° 849&nbsp;721&nbsp;469,
    Carte Professionnelle CPI 7501 2019 000 041 080 (CCI Paris IDF),
    TVA FR54&nbsp;849&nbsp;721&nbsp;469, assurée en RC Pro par Beazley Solutions International Limited,
    1 rue Saint-Georges 75009 Paris, police n°&nbsp;MA034L20ANPM —
    <em>déclarant ne pouvoir ni recevoir ni détenir d'autres fonds que ceux représentatifs
    de sa rémunération.</em></p>
    <p>Représentée par <b>Bertrand MENESGUEN</b>, Gérant, et/ou <b>${agent}</b>,
    agent commercial RSAC n°&nbsp;[ __________ ], ayant tous pouvoirs à l'effet des présentes.</p>
    <p>Ci-après désigné(e) <b>« l'INTERMÉDIAIRE »</b> ou <b>« l'AGENCE »</b>, d'autre part,</p>`;
}

// ── Clauses communes RGPD + élection de domicile ──────────────────────────
function clauseRgpd(): string {
  return `
    <div class="article">
      <div class="article-title">ARTICLE 7 — PROTECTION DES DONNÉES PERSONNELLES (RGPD)</div>
      <p>Les données à caractère personnel collectées sont traitées par TBEECOM pour les finalités
      d'exécution du présent contrat, de gestion de la relation client et de respect des obligations
      Tracfin. Elles sont conservées pendant la durée du contrat augmentée des délais légaux de
      prescription. Droits d'accès, rectification, suppression et opposition :
      <b>bertrand.menesguen@tbeecom.fr</b> — Réclamations CNIL : www.cnil.fr.</p>
      <p class="checkbox">☐ &nbsp; Le CÉDANT reconnaît avoir pris connaissance et accepte expressément
      les présentes dispositions relatives à la protection de ses données personnelles.</p>
    </div>
    <div class="article">
      <div class="article-title">ARTICLE 8 — ÉLECTION DE DOMICILE ET DROIT APPLICABLE</div>
      <p>Les parties font élection de domicile à leurs adresses respectives. Toute modification
      est notifiée dans les 8 jours par lettre recommandée avec AR. Le présent contrat est soumis
      au droit français. Tout litige sera soumis à la juridiction compétente du ressort de Paris,
      après tentative préalable de règlement amiable.</p>
    </div>`;
}

// ── Bloc signatures ────────────────────────────────────────────────────────
function signaturesHtml(): string {
  const today = new Date().toLocaleDateString("fr-FR");
  return `
    <div class="sig-section">
      <div class="sig-title">DATE ET SIGNATURES</div>
      <p class="sig-date">Fait à <b>Paris</b>, le <b>${today}</b> — En deux exemplaires originaux,
      un remis à chaque partie.</p>
      <div class="sig-grid">
        <div class="sig-box">
          <strong>LE CÉDANT</strong>
          Signature précédée de la mention manuscrite<br/><em>« Lu et approuvé »</em>
          <div class="sig-line">Nom, Qualité, Cachet de la société</div>
        </div>
        <div class="sig-box">
          <strong>L'INTERMÉDIAIRE — TBEECOM</strong>
          Bertrand MENESGUEN — Gérant<br/>
          Et/ou l'agent commercial référent
          <div class="sig-line">Signature et cachet de l'agence</div>
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════
// MANDAT SIMPLE
// ══════════════════════════════════════════════════════════════════════════
export function generateMandatSimple(
  mandat: Partial<Mandat>,
  vendeurs: (MandatVendeur & { contact?: Contact })[]
): string {
  const contact = vendeurs[0]?.contact;
  const ht = mandat.honoraires_montant ?? null;
  const ttc = ht ? Math.round(ht * 1.2) : null;
  const pct = mandat.honoraires_pct ?? (ht && mandat.prix_net_vendeur
    ? Math.round((ht / mandat.prix_net_vendeur) * 100 * 10) / 10 : null);

  return `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Mandat Simple N°${mandat.numero_registre ?? "___"} — TBEECOM</title>
    <style>${CSS}</style>
  </head><body>
  <div class="page">
    ${headerHtml(
      `CONTRAT DE MISSION DE CESSION — N°&nbsp;${mandat.numero_registre ?? "___"}`,
      "MANDAT SIMPLE (NON EXCLUSIF) · FONDS DE COMMERCE"
    )}

    <table class="summary-table" style="margin-top:4mm;">
      <tr><td>N° de Mandat</td><td><b>${mandat.numero_registre ?? "[ _____ ]"}</b></td></tr>
      <tr><td>Référence interne</td><td>${val(mandat.reference)}</td></tr>
      <tr><td>Activité / Enseigne</td><td>${val(mandat.enseigne ?? mandat.nature_activite ?? mandat.sous_type)}</td></tr>
      <tr><td>Adresse du fonds</td><td>${val(mandat.adresse)}${mandat.code_postal ? ", " + mandat.code_postal : ""}${mandat.commune ? " " + mandat.commune : ""}</td></tr>
      <tr><td>Date d'entrée en vigueur</td><td>${fdate(mandat.date_sur_le_marche)}</td></tr>
      <tr><td>Date d'expiration initiale</td><td>${dateExpiration(mandat.date_sur_le_marche)} &nbsp;(3 mois — renouvelable, 12 mois max.)</td></tr>
      <tr><td>Agent référent</td><td>${val(mandat.suivi_par)}</td></tr>
    </table>

    <div class="convention">ENTRE LES SOUSSIGNÉS</div>

    <div class="partie-title">LE CÉDANT (propriétaire du fonds)</div>
    ${cedantTable(contact)}
    <p>Ci-après désigné(e) <b>« le CÉDANT »</b>, d'une part,</p>
    <hr class="thin-line"/>
    ${mandataireHtml(mandat.suivi_par)}

    <div class="convention">IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT</div>

    <div class="article">
      <div class="article-title">ARTICLE 1 — OBJET DE LA MISSION</div>
      <p>Par les présentes, le CÉDANT confère à l'INTERMÉDIAIRE, qui l'accepte, une <b>mission non exclusive
      de cession</b> du fonds de commerce ci-après désigné, aux prix, charges et conditions définis
      aux présentes. Cette mission implique une obligation de moyens et non de résultat.</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 2 — DÉSIGNATION ET COMPOSITION DU FONDS</div>
      <p><b>Nature de l'activité :</b> ${val(mandat.nature_activite ?? mandat.sous_type ?? mandat.type_commerce)}<br/>
      <b>Enseigne :</b> ${val(mandat.enseigne)}<br/>
      <b>Adresse d'exploitation :</b> ${val(mandat.adresse)}${mandat.code_postal ? " — " + mandat.code_postal : ""}${mandat.commune ? " " + mandat.commune : ""}</p>
      <p><b>Éléments constitutifs inclus dans la cession :</b></p>
      <ul>
        <li>La clientèle et l'achalandage y attachés</li>
        <li>L'enseigne et le nom commercial</li>
        <li>Les stocks, évalués contradictoirement au jour de l'acte définitif</li>
        <li>Les agencements, installations, matériels et mobiliers servant à l'exploitation</li>
        <li>Le droit au bail commercial (si applicable)</li>
      </ul>
      <p><b>Effectif salarié :</b> ${mandat.effectif != null ? mandat.effectif + " salarié(s)" : "[ ___ ] salarié(s)"}</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 3 — PRIX DE CESSION ET RÉMUNÉRATION DE L'INTERMÉDIAIRE</div>
      <table class="summary-table">
        <tr><td>Prix net cédant (hors honoraires)</td><td><b>${euros(mandat.prix_net_vendeur)}</b> — ${eurosLettres(mandat.prix_net_vendeur)}</td></tr>
        <tr><td>Prix de présentation acquéreurs</td><td>${euros(mandat.prix_demande)}</td></tr>
        <tr><td>Honoraires de l'Agence</td><td>${euros(ht)} HT — soit <b>${euros(ttc)} TTC</b></td></tr>
        <tr><td>Taux d'honoraires</td><td>${pct ? pct + " % HT du prix net cédant" : "[ ___ ] %"}</td></tr>
        <tr><td>Honoraires à la charge de</td><td>${val(mandat.honoraires_charge, "[ Acquéreur / Cédant ]")}</td></tr>
      </table>
      <p>Les honoraires sont exigibles à la conclusion effective de la cession constatée par acte écrit. En cas
      d'exercice d'un droit de préemption, le bénéficiaire est subrogé dans les droits de l'acquéreur,
      honoraires inclus.</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 4 — DURÉE ET CONDITIONS DE RÉSILIATION</div>
      <p>La présente mission est consentie pour une durée initiale de <b>3 (trois) mois</b> à compter de
      sa signature. Elle se renouvelle par tacite reconduction par périodes de 3 mois, dans la limite
      de <b>12 (douze) mois</b> au total.</p>
      <p>Passé le délai initial de 3 mois, chaque partie peut résilier le présent contrat à tout moment,
      sous préavis de <b>15 jours</b> adressé par lettre recommandée avec AR.</p>
      <p class="caps">ATTENTION : pendant la durée du mandat et durant les 12 mois suivant son expiration,
      le CÉDANT s'interdit de traiter directement ou indirectement avec tout acquéreur présenté par
      l'INTERMÉDIAIRE, sous peine de devoir verser une indemnité forfaitaire égale au montant TTC
      des honoraires prévus aux présentes.</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 5 — ENGAGEMENTS DU CÉDANT</div>
      <p>Le CÉDANT déclare n'avoir consenti aucun mandat exclusif en cours de validité portant sur
      ce fonds et s'engage à :</p>
      <ul>
        <li>Remettre sans délai tous les documents nécessaires : bail commercial, bilans des 3 derniers exercices, contrats de travail, état des nantissements et privilèges, diagnostics obligatoires</li>
        <li>Permettre l'organisation des visites dans des conditions satisfaisantes</li>
        <li>Informer l'Agence sans délai de toute modification juridique ou matérielle affectant le fonds</li>
        <li>Répondre dans les meilleurs délais à toute proposition transmise par l'Agence</li>
        <li>Informer l'Agence des date, heure et lieu de signature de tout acte de cession</li>
        <li>Exécuter le présent mandat de bonne foi et ne pas priver l'INTERMÉDIAIRE de la rémunération à laquelle il aurait légitimement droit</li>
      </ul>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 6 — ENGAGEMENTS ET POUVOIRS DE L'INTERMÉDIAIRE</div>
      <p>L'INTERMÉDIAIRE, tenu d'une obligation de moyens, s'engage à :</p>
      <ul>
        <li>Prospecter activement et présenter le Fonds à tous acquéreurs potentiels</li>
        <li>Diffuser l'annonce sur le site TBEECOM et les principaux portails spécialisés</li>
        <li>Adresser un compte-rendu écrit après chaque visite ou contact qualifié</li>
        <li>Vérifier la solvabilité et la capacité juridique de chaque candidat acquéreur</li>
        <li>Assister le CÉDANT dans toutes les étapes de la négociation jusqu'à la signature</li>
        <li>Respecter les obligations Tracfin (art. L. 562-1 CMF) et l'engagement de non-discrimination</li>
      </ul>
    </div>

    ${clauseRgpd()}
    ${signaturesHtml()}

    <p class="footer-note">TBEECOM / MENESGUEN Immobilier — Document confidentiel — Mandat n°&nbsp;${mandat.numero_registre ?? "___"}</p>
  </div>
  
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════
// MANDAT EXCLUSIF
// ══════════════════════════════════════════════════════════════════════════
export function generateMandatExclusif(
  mandat: Partial<Mandat>,
  vendeurs: (MandatVendeur & { contact?: Contact })[]
): string {
  const contact = vendeurs[0]?.contact;
  const ht = mandat.honoraires_montant ?? null;
  const ttc = ht ? Math.round(ht * 1.2) : null;
  const pct = mandat.honoraires_pct ?? (ht && mandat.prix_net_vendeur
    ? Math.round((ht / mandat.prix_net_vendeur) * 100 * 10) / 10 : null);

  return `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"/>
    <title>Mandat Exclusif N°${mandat.numero_registre ?? "___"} — TBEECOM</title>
    <style>${CSS}</style>
  </head><body>
  <div class="page">
    ${headerHtml(
      `CONTRAT DE MISSION EXCLUSIVE DE CESSION — N°&nbsp;${mandat.numero_registre ?? "___"}`,
      "MANDAT EXCLUSIF · FONDS DE COMMERCE"
    )}

    <table class="summary-table" style="margin-top:4mm;">
      <tr><td>N° de Mandat</td><td><b>${mandat.numero_registre ?? "[ _____ ]"}</b></td></tr>
      <tr><td>Référence interne</td><td>${val(mandat.reference)}</td></tr>
      <tr><td>Activité / Enseigne</td><td>${val(mandat.enseigne ?? mandat.nature_activite ?? mandat.sous_type)}</td></tr>
      <tr><td>Adresse du fonds</td><td>${val(mandat.adresse)}${mandat.code_postal ? ", " + mandat.code_postal : ""}${mandat.commune ? " " + mandat.commune : ""}</td></tr>
      <tr><td>Date d'entrée en vigueur</td><td>${fdate(mandat.date_sur_le_marche)}</td></tr>
      <tr><td>Date d'expiration initiale</td><td>${dateExpiration(mandat.date_sur_le_marche)} &nbsp;(3 mois — résiliable après 3 mois avec préavis 15j)</td></tr>
      <tr><td>Agent référent</td><td>${val(mandat.suivi_par)}</td></tr>
    </table>

    <div class="convention">ENTRE LES SOUSSIGNÉS</div>

    <div class="partie-title">LE CÉDANT (propriétaire du fonds)</div>
    ${cedantTable(contact)}
    <p>Ci-après désigné(e) <b>« le CÉDANT »</b>, d'une part,</p>
    <hr class="thin-line"/>
    ${mandataireHtml(mandat.suivi_par)}

    <div class="convention">IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT</div>

    <div class="article">
      <div class="article-title">ARTICLE 1 — OBJET DE LA MISSION EXCLUSIVE</div>
      <p>Par les présentes, le CÉDANT confère à l'INTERMÉDIAIRE, qui l'accepte, une <b>mission EXCLUSIVE
      de cession</b> du fonds de commerce ci-après désigné. Durant toute la durée de ce mandat, le CÉDANT
      s'engage à n'accorder aucun autre mandat de vente à un tiers et à orienter vers l'INTERMÉDIAIRE
      toute demande qu'il recevrait directement.</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 2 — DÉSIGNATION ET COMPOSITION DU FONDS</div>
      <p><b>Nature de l'activité :</b> ${val(mandat.nature_activite ?? mandat.sous_type ?? mandat.type_commerce)}<br/>
      <b>Enseigne :</b> ${val(mandat.enseigne)}<br/>
      <b>Adresse d'exploitation :</b> ${val(mandat.adresse)}${mandat.code_postal ? " — " + mandat.code_postal : ""}${mandat.commune ? " " + mandat.commune : ""}</p>
      <ul>
        <li>La clientèle et l'achalandage y attachés</li>
        <li>L'enseigne et le nom commercial</li>
        <li>Les stocks, évalués contradictoirement au jour de l'acte définitif</li>
        <li>Les agencements, installations, matériels et mobiliers servant à l'exploitation</li>
        <li>Le droit au bail commercial (si applicable)</li>
      </ul>
      <p><b>Effectif salarié :</b> ${mandat.effectif != null ? mandat.effectif + " salarié(s)" : "[ ___ ] salarié(s)"}</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 3 — PRIX ET RÉMUNÉRATION</div>
      <table class="summary-table">
        <tr><td>Prix net cédant</td><td><b>${euros(mandat.prix_net_vendeur)}</b> — ${eurosLettres(mandat.prix_net_vendeur)}</td></tr>
        <tr><td>Prix de présentation</td><td>${euros(mandat.prix_demande)}</td></tr>
        <tr><td>Honoraires HT / TTC</td><td>${euros(ht)} HT — soit <b>${euros(ttc)} TTC</b></td></tr>
        <tr><td>Taux</td><td>${pct ? pct + " % HT du prix net cédant" : "[ ___ ] %"}</td></tr>
        <tr><td>Honoraires à la charge de</td><td>${val(mandat.honoraires_charge, "[ Acquéreur / Cédant ]")}</td></tr>
      </table>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 4 — DURÉE, EXCLUSIVITÉ ET RÉSILIATION</div>
      <p>Mission exclusive consentie pour <b>3 (trois) mois</b>, renouvelable par tacite reconduction par
      périodes de 3 mois, dans la limite de <b>12 (douze) mois</b> au total. Conformément à l'article 78
      al. 2 du décret du 20 juillet 1972, passé 3 mois, résiliation possible par préavis de <b>15 jours</b>
      par LRAR. La résiliation est globale et ne peut être partielle.</p>
      <p class="caps">CLAUSE PÉNALE : pendant la durée du mandat et durant les 12 mois suivant son
      expiration, le CÉDANT s'interdit de vendre le fonds directement ou via un tiers, ou de traiter
      avec tout acquéreur présenté par l'INTERMÉDIAIRE, sous peine de verser une indemnité forfaitaire
      égale au montant TTC des honoraires prévus aux présentes.</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 5 — ENGAGEMENTS RENFORCÉS DU CÉDANT</div>
      <ul>
        <li>N'avoir consenti aucun autre mandat en cours de validité et s'interdire d'en consentir un nouveau pendant toute la durée des présentes</li>
        <li>Transmettre sans délai à l'INTERMÉDIAIRE toutes les demandes reçues directement</li>
        <li>Fournir tous les documents nécessaires : bail, bilans N-1, N-2, N-3, contrats de travail, état des nantissements et privilèges, diagnostics</li>
        <li>Permettre les visites dans des conditions optimales de présentation</li>
        <li>Informer l'Agence sans délai de toute modification affectant le fonds</li>
      </ul>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 6 — ENGAGEMENTS RENFORCÉS DE L'INTERMÉDIAIRE</div>
      <p>En contrepartie de l'exclusivité accordée, l'INTERMÉDIAIRE s'engage à :</p>
      <ul>
        <li>Déployer une stratégie de commercialisation active et documentée</li>
        <li>Diffuser l'annonce sur le site TBEECOM et l'ensemble des portails spécialisés</li>
        <li>Adresser un compte-rendu écrit après chaque visite ou contact qualifié</li>
        <li>Réaliser une présentation professionnelle du fonds (photos, descriptif, fiche technique)</li>
        <li>Vérifier la solvabilité et la capacité juridique de chaque candidat</li>
        <li>Assister le CÉDANT dans toutes les étapes de la négociation</li>
      </ul>
    </div>

    ${clauseRgpd()}
    ${signaturesHtml()}

    <p class="footer-note">TBEECOM / MENESGUEN Immobilier — Document confidentiel — Mandat exclusif n°&nbsp;${mandat.numero_registre ?? "___"}</p>
  </div>
  
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════
// AVENANT
// ══════════════════════════════════════════════════════════════════════════
export function generateAvenant(
  mandat: Partial<Mandat>,
  vendeurs: (MandatVendeur & { contact?: Contact })[],
  numAvenant = 1,
  nouvPrix?: number,
  nouvHonoraires?: number
): string {
  const contact = vendeurs[0]?.contact;
  const ht = nouvHonoraires ?? mandat.honoraires_montant ?? null;
  const ttc = ht ? Math.round(ht * 1.2) : null;
  const today = new Date().toLocaleDateString("fr-FR");

  return `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"/>
    <title>Avenant N°${numAvenant} — Mandat ${mandat.numero_registre ?? "___"} — TBEECOM</title>
    <style>${CSS}</style>
  </head><body>
  <div class="page">
    ${headerHtml(
      `AVENANT N°${numAvenant} — MANDAT DE CESSION N°&nbsp;${mandat.numero_registre ?? "___"}`,
      "MODIFICATION DES CONDITIONS · FONDS DE COMMERCE"
    )}

    <table class="summary-table" style="margin-top:4mm;">
      <tr><td>N° de l'Avenant</td><td><b>${numAvenant}</b></td></tr>
      <tr><td>Mandat concerné</td><td>N° <b>${mandat.numero_registre ?? "[ _____ ]"}</b> — Réf. ${val(mandat.reference)} — Signé le ${fdate(mandat.date_sur_le_marche)}</td></tr>
      <tr><td>Fonds concerné</td><td>${val(mandat.enseigne ?? mandat.nature_activite)} — ${val(mandat.adresse)}${mandat.commune ? ", " + mandat.commune : ""}</td></tr>
      <tr><td>Nature de la modification</td><td>[ Modification du prix / Prorogation / Autre : _________ ]</td></tr>
      <tr><td>Date d'entrée en vigueur</td><td>${today}</td></tr>
    </table>

    <div class="convention">ENTRE LES SOUSSIGNÉS</div>

    <div class="partie-title">LE CÉDANT</div>
    ${cedantTable(contact)}
    <p>Ci-après <b>« le CÉDANT »</b>, d'une part,</p>
    <hr class="thin-line"/>
    <div class="partie-title">L'INTERMÉDIAIRE</div>
    <p><b>TBEECOM</b> / MENESGUEN Immobilier — 128 rue de la Boétie, 75008 Paris —
    Représentée par <b>Bertrand MENESGUEN</b>, Gérant,
    et/ou <b>${val(mandat.suivi_par, "[ agent commercial ]")}</b>, agent commercial.</p>
    <p>Ci-après <b>« l'INTERMÉDIAIRE »</b>, d'autre part,</p>

    <div class="convention">MODIFICATIONS CONVENUES</div>

    <div class="article">
      <div class="article-title">ARTICLE 1 — RAPPEL DU CONTRAT INITIAL</div>
      <p>Le présent avenant modifie le contrat de mission de cession n°&nbsp;<b>${mandat.numero_registre ?? "[ _____ ]"}</b>
      signé le <b>${fdate(mandat.date_sur_le_marche)}</b>, portant sur le fonds de commerce de
      <b>${val(mandat.nature_activite ?? mandat.enseigne ?? mandat.type_commerce)}</b>
      situé <b>${val(mandat.adresse)}${mandat.commune ? ", " + mandat.commune : ""}</b>.</p>
      <p>Toutes les clauses non modifiées par le présent avenant demeurent inchangées et pleinement applicables.</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 2 — MODIFICATION DU PRIX (si applicable)</div>
      <p>Le prix de cession est modifié comme suit :</p>
      <table class="summary-table">
        <tr><td>Ancien prix net cédant</td><td>${euros(mandat.prix_net_vendeur)}</td></tr>
        <tr><td>Nouveau prix net cédant</td><td><b>${euros(nouvPrix)}</b> — ${eurosLettres(nouvPrix)}</td></tr>
        <tr><td>Nouveaux honoraires HT / TTC</td><td>${euros(ht)} HT — soit <b>${euros(ttc)} TTC</b></td></tr>
      </table>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 3 — PROROGATION DE DURÉE (si applicable)</div>
      <p><b>Nouvelle date d'expiration :</b> [ JJ/MM/AAAA ]</p>
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 4 — AUTRES MODIFICATIONS (si applicable)</div>
      <p>[ ______________________________________________________________ ]</p>
      <p>[ ______________________________________________________________ ]</p>
    </div>

    <p class="caps" style="margin:4mm 0;">TOUTES LES AUTRES CLAUSES ET CONDITIONS DU CONTRAT INITIAL
    DEMEURENT INCHANGÉES ET CONSERVENT LEUR PLEIN EFFET.</p>

    ${signaturesHtml()}

    <p class="footer-note">TBEECOM — Avenant n°${numAvenant} au Mandat n°&nbsp;${mandat.numero_registre ?? "___"}</p>
  </div>
  
  </body></html>`;
}

// ── Barre d'outils injectée dans chaque document ───────────────────────────
const TOOLBAR_HTML = `
<div class="print-toolbar" id="tbeecom-toolbar">
  <div>
    <strong style="color:#C9A84C">TBEECOM</strong>
    <span class="info" style="margin-left:16px">
      Cliquez sur les champs <span style="color:#F97316;font-style:italic">en orange</span> pour les compléter,
      sur les champs <span style="color:#C9A84C">en doré</span> pour les modifier.
    </span>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn-close" onclick="window.close()">✕ Fermer</button>
    <button class="btn-print" onclick="window.print()">🖨 Imprimer / PDF</button>
  </div>
</div>`;

// ── Ouverture dans un nouvel onglet ────────────────────────────────────────
export function openMandat(html: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Veuillez autoriser les pop-ups pour générer le mandat.");
    return;
  }
  // Injecte la toolbar juste après <body>
  const htmlWithToolbar = html.replace("<body>", `<body>${TOOLBAR_HTML}`);
  win.document.write(htmlWithToolbar);
  win.document.close();
}


// ══════════════════════════════════════════════════════════════════════════
// V2 — Générateur générique paramétré par agence_parametres
// Couvre 7 natures × 3 formes (Fonds de commerce, Droit au bail, Murs commerciaux,
// Local pro, Cession de titres, Recherche, Location).
// ══════════════════════════════════════════════════════════════════════════

export interface MandatDraft {
  id?: string;
  numero?: string | null;
  nature_mandat?: string | null;
  forme_mandat?: string | null;
  mandant_id?: string | null;
  mandant_nom?: string | null;
  reference_bien?: string | null;
  designation_bien?: string | null;
  adresse_bien?: string | null;
  activite_bien?: string | null;
  surfaces_bien?: string | null;
  prix?: number | null;
  prix_net_vendeur?: number | null;
  loyer?: number | null;
  honoraires_montant?: number | null;
  honoraires_charge?: string | null;
  duree_mois?: number | null;
  date_signature?: string | null;
  preavis_jours?: number | null;
  observations?: string | null;
  negociateur?: string | null;
  criteres_recherche?: string | null;
  prix_max_recherche?: number | null;
  bail_activites?: string | null;
  bail_duree_restante?: string | null;
  bail_garanties?: string | null;
  bail_charges?: number | null;
  bail_taxe_fonciere?: string | number | null;
  bail_indexation?: string | null;
  bail_fiscalite?: string | null;
  effectif?: number | null;
  composition?: string | null;
  description_locaux?: string | null;
  comp_clientele?: boolean | null;
  comp_enseigne?: boolean | null;
  comp_nom_commercial?: boolean | null;
  comp_stocks?: boolean | null;
  comp_materiel?: boolean | null;
  avenant_de?: string | null;
  avenant_numero?: number | null;
  delegation_mandat_ref?: string | null;
  delegation_de?: string | null;
  delegation_honoraires_ref?: number | null;
  delegation_part_delegataire?: number | null;
  delegation_part_mode?: string | null;
  delegataire_raison_sociale?: string | null;
  delegataire_forme?: string | null;
  delegataire_capital?: string | null;
  delegataire_siege?: string | null;
  delegataire_rcs?: string | null;
  delegataire_siret?: string | null;
  delegataire_carte_t?: string | null;
  delegataire_cci?: string | null;
  delegataire_rcp?: string | null;
  delegataire_representant?: string | null;
  delegataire_email?: string | null;
  delegataire_telephone?: string | null;
}

const NATURE_CODE_TO_LABEL: Record<string, string> = {
  fdc: "Fonds de commerce",
  droit_bail: "Droit au bail",
  murs: "Murs commerciaux",
  local_pro: "Local / immobilier d'entreprise",
  titres: "Cession de titres",
  recherche: "Recherche",
  location: "Location",
  delegation: "Délégation de mandat",
};

function normNature(n?: string | null): string {
  if (!n) return "Fonds de commerce";
  return NATURE_CODE_TO_LABEL[n] ?? n;
}

function normForme(f?: string | null): string {
  const x = (f ?? "Simple").toString().trim().toLowerCase();
  if (x === "exclusif" || x === "exclusive" || x === "exclusif (non semi)") return "Exclusif";
  if (x.startsWith("semi")) return "Semi-exclusif";
  return "Simple";
}


function agenceHeader(a: AgenceParametres | null): string {
  if (!a) {
    return `<div class="header-brand">[ Nom commercial ]</div>
      <div style="font-size:7.5pt;color:#64748B;margin-top:1mm;">[ Raison sociale ]</div>`;
  }
  return `<div class="header-brand">${a.nom_commercial ?? a.raison_sociale ?? "[ Agence ]"}</div>
    <div style="font-size:7.5pt;color:#64748B;margin-top:1mm;">
      ${a.raison_sociale ?? ""}${a.forme_juridique ? ` — ${a.forme_juridique}` : ""}${a.capital ? ` au capital de ${euros(a.capital)}` : ""}<br/>
      ${a.siege ?? ""}
    </div>`;
}

function agenceMentions(a: AgenceParametres | null): string {
  if (!a) return `<span style="color:#C2410C">[ Paramètres « Mon agence » non renseignés ]</span>`;
  const parts: string[] = [];
  if (a.rcs)    parts.push(`RCS ${a.rcs}`);
  if (a.siret)  parts.push(`SIRET ${a.siret}`);
  if (a.ape)    parts.push(`APE ${a.ape}`);
  if (a.tva)    parts.push(`TVA ${a.tva}`);
  if (a.carte_t_numero) parts.push(`Carte Pro. CPI ${a.carte_t_numero}${a.carte_t_cci ? ` — ${a.carte_t_cci}` : ""}`);
  if (a.rcp_assureur || a.rcp_contrat) {
    parts.push(`RC Pro ${a.rcp_assureur ?? ""}${a.rcp_contrat ? ` — n° ${a.rcp_contrat}` : ""}${a.rcp_courtier ? ` (courtier : ${a.rcp_courtier})` : ""}${a.rcp_couverture ? ` — couverture ${a.rcp_couverture}` : ""}`);
  }
  if (a.sans_maniement_fonds) {
    parts.push(`<em>déclare ne pouvoir ni recevoir ni détenir d'autres fonds que ceux représentatifs de sa rémunération</em>`);
  } else if (a.garantie_financiere) {
    parts.push(`Garantie financière : ${a.garantie_financiere}`);
  }
  return parts.join(" · ");
}

function mandataireV2(a: AgenceParametres | null, suivi_par: string | null | undefined): string {
  const agent = val(suivi_par, "[ agent commercial référent ]");
  const nom = a?.nom_commercial ?? a?.raison_sociale ?? "[ Agence ]";
  const gerant = a?.gerant_nom ?? "[ Gérant(e) ]";
  return `
    <div class="partie-title">L'INTERMÉDIAIRE (Mandataire)</div>
    <p>La société <b>${nom}</b>${a?.raison_sociale && a?.nom_commercial && a.raison_sociale !== a.nom_commercial ? ` (${a.raison_sociale})` : ""}, ${a?.forme_juridique ?? ""}${a?.capital ? ` au capital de ${euros(a.capital)}` : ""}, ${a?.siege ?? "[ siège ]"} — ${agenceMentions(a)}.</p>
    <p>Représentée par <b>${gerant}</b>, et/ou <b>${agent}</b>, ayant tous pouvoirs à l'effet des présentes.</p>
    <p>Ci-après désigné(e) <b>« l'INTERMÉDIAIRE »</b> ou <b>« l'AGENCE »</b>, d'autre part,</p>`;
}

function objetLibelle(nature: string): { titre: string; partieAdverse: string; objetDoc: string } {
  switch (nature) {
    case "Droit au bail":            return { titre: "MANDAT DE CESSION DE DROIT AU BAIL", partieAdverse: "LE CÉDANT (titulaire du droit au bail)", objetDoc: "cession du droit au bail" };
    case "Murs commerciaux":         return { titre: "MANDAT DE VENTE — MURS COMMERCIAUX", partieAdverse: "LE VENDEUR (propriétaire des murs)", objetDoc: "vente des murs commerciaux" };
    case "Local / immobilier d'entreprise": return { titre: "MANDAT DE VENTE — LOCAL / IMMOBILIER D'ENTREPRISE", partieAdverse: "LE VENDEUR", objetDoc: "vente du bien immobilier à usage professionnel" };
    case "Cession de titres":        return { titre: "MANDAT DE CESSION DE TITRES SOCIAUX", partieAdverse: "LE CÉDANT (associé / actionnaire)", objetDoc: "cession des titres de la société" };
    case "Recherche":                return { titre: "MANDAT DE RECHERCHE", partieAdverse: "LE MANDANT (acquéreur)", objetDoc: "recherche d'un bien correspondant aux critères ci-après" };
    case "Location":                 return { titre: "MANDAT DE LOCATION", partieAdverse: "LE BAILLEUR", objetDoc: "location du local" };
    case "Fonds de commerce":
    default:                         return { titre: "MANDAT DE CESSION — FONDS DE COMMERCE", partieAdverse: "LE CÉDANT (propriétaire du fonds)", objetDoc: "cession du fonds de commerce" };
  }
}

function renderAvenant(
  draft: MandatDraft,
  parent: any | null,
  agence: AgenceParametres | null,
  c: any | null,
): string {
  const numAvenant = draft.avenant_numero != null ? String(draft.avenant_numero) : "—";
  const numParent = parent?.numero ?? "[ ___ ]";
  const titre = `AVENANT N° ${numAvenant} AU MANDAT N° ${numParent}`;

  // Identité mandant (réutilise les mêmes règles que le mandat)
  const mandantNomComplet = [c?.civilite, c?.prenom, c?.nom].filter(Boolean).join(" ").trim();
  const mandantNom = (c?.societe && c.societe.trim())
    ? c.societe.trim()
    : (mandantNomComplet || draft.mandant_nom || parent?.mandant_nom || null);
  const mandantAdresse = c
    ? [c.adresse, c.code_postal, c.commune].filter(Boolean).join(" ").trim()
    : null;
  const mandantRows: string[] = [];
  mandantRows.push(`<tr><td>Nom / Raison sociale</td><td><b>${val(mandantNom)}</b></td></tr>`);
  if (c?.societe) {
    const formeCapital = [c.forme_juridique, c.capital ? `Capital : ${euros(c.capital)}` : null].filter(Boolean).join(" — ");
    if (formeCapital) mandantRows.push(`<tr><td>Forme / Capital</td><td>${val(formeCapital)}</td></tr>`);
    const rcsSiret = c.rcs ?? c.siret;
    if (rcsSiret) mandantRows.push(`<tr><td>RCS / SIRET</td><td>${val(rcsSiret)}</td></tr>`);
    const representant = [mandantNomComplet, c.fonction].filter(Boolean).join(" — ");
    if (representant) mandantRows.push(`<tr><td>Représentée par</td><td>${val(representant)}</td></tr>`);
  }
  mandantRows.push(`<tr><td>Adresse</td><td>${val(mandantAdresse, "[ adresse du mandant ]")}</td></tr>`);
  if (c?.telephone) mandantRows.push(`<tr><td>Téléphone</td><td>${val(c.telephone)}</td></tr>`);
  if (c?.email) mandantRows.push(`<tr><td>Email</td><td>${val(c.email)}</td></tr>`);

  // Rappel du mandat initial
  const rappel: string[] = [];
  rappel.push(`<tr><td>Mandat initial n°</td><td><b>${numParent}</b></td></tr>`);
  if (parent?.date_signature) rappel.push(`<tr><td>Date de signature</td><td>${fdate(parent.date_signature)}</td></tr>`);
  if (parent?.nature_mandat || parent?.forme_mandat) rappel.push(`<tr><td>Nature / Forme</td><td>${parent?.nature_mandat ?? "—"} — ${parent?.forme_mandat ?? "—"}</td></tr>`);
  if (parent?.designation_bien) rappel.push(`<tr><td>Désignation du bien</td><td>${val(parent.designation_bien)}</td></tr>`);
  if (parent?.adresse_bien) rappel.push(`<tr><td>Adresse du bien</td><td>${val(parent.adresse_bien)}</td></tr>`);
  if (parent?.prix != null) rappel.push(`<tr><td>Prix initial</td><td>${euros(parent.prix)}</td></tr>`);
  if (parent?.prix_net_vendeur != null) rappel.push(`<tr><td>Prix net initial</td><td>${euros(parent.prix_net_vendeur)}</td></tr>`);
  if (parent?.loyer != null) rappel.push(`<tr><td>Loyer initial</td><td>${euros(parent.loyer)}</td></tr>`);
  if (parent?.honoraires_montant != null) {
    const ttcP = Math.round(parent.honoraires_montant * 1.2);
    rappel.push(`<tr><td>Honoraires initiaux</td><td>${euros(parent.honoraires_montant)} HT — ${euros(ttcP)} TTC${parent.honoraires_charge ? ` (à la charge de ${parent.honoraires_charge})` : ""}</td></tr>`);
  }
  if (parent?.duree_mois != null) rappel.push(`<tr><td>Durée initiale</td><td>${parent.duree_mois} mois</td></tr>`);

  // Modifications convenues (uniquement ce qui change)
  const mods: string[] = [];
  const changed = (a: any, b: any) => (a ?? null) !== (b ?? null) && (a !== "" && a != null);
  if (changed(draft.prix, parent?.prix)) mods.push(`<tr><td>Nouveau prix de présentation</td><td><b>${euros(draft.prix)}</b></td></tr>`);
  if (changed(draft.prix_net_vendeur, parent?.prix_net_vendeur)) mods.push(`<tr><td>Nouveau prix net</td><td><b>${euros(draft.prix_net_vendeur)}</b> — ${eurosLettres(draft.prix_net_vendeur)}</td></tr>`);
  if (changed(draft.loyer, parent?.loyer)) mods.push(`<tr><td>Nouveau loyer</td><td><b>${euros(draft.loyer)}</b></td></tr>`);
  if (changed(draft.honoraires_montant, parent?.honoraires_montant) || changed(draft.honoraires_charge, parent?.honoraires_charge)) {
    const ht = draft.honoraires_montant ?? null;
    const ttc = ht ? Math.round(ht * 1.2) : null;
    mods.push(`<tr><td>Nouveaux honoraires</td><td><b>${euros(ht)} HT — ${euros(ttc)} TTC</b>${draft.honoraires_charge ? ` (à la charge de ${draft.honoraires_charge})` : ""}</td></tr>`);
  }
  if (changed(draft.duree_mois, parent?.duree_mois)) mods.push(`<tr><td>Nouvelle durée</td><td><b>${draft.duree_mois ?? "—"} mois</b></td></tr>`);
  if (changed(draft.date_signature, parent?.date_signature)) mods.push(`<tr><td>Nouvelle date de signature</td><td>${fdate(draft.date_signature)}</td></tr>`);

  const objet = draft.observations && draft.observations.trim() ? draft.observations.trim() : "";

  return `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${titre} — ${agence?.nom_commercial ?? "Agence"}</title>
    <style>${CSS}</style>
  </head><body>
  <div class="page">
    <div class="header">
      <div>${agenceHeader(agence)}</div>
      <div class="header-info">${agenceMentions(agence)}</div>
    </div>
    <hr class="gold-line"/>
    <div class="doc-title">
      <h1>${titre}</h1>
      <p>AVENANT</p>
    </div>

    <div class="convention">ENTRE LES SOUSSIGNÉS</div>

    <div class="partie-title">LE MANDANT</div>
    <table class="partie-table">${mandantRows.join("")}</table>
    <p>Ci-après désigné(e) <b>« le MANDANT »</b>, d'une part,</p>
    <hr class="thin-line"/>
    ${mandataireV2(agence, draft.negociateur)}

    <div class="convention">IL A ÉTÉ CONVENU CE QUI SUIT</div>

    <div class="article">
      <div class="article-title">ARTICLE 1 — RAPPEL DU MANDAT INITIAL</div>
      <table class="summary-table">${rappel.join("")}</table>
    </div>

    ${objet ? `
    <div class="article">
      <div class="article-title">ARTICLE 2 — OBJET DE L'AVENANT</div>
      <p>${val(objet)}</p>
    </div>` : ""}

    <div class="article">
      <div class="article-title">ARTICLE ${objet ? "3" : "2"} — MODIFICATIONS CONVENUES</div>
      ${mods.length
        ? `<table class="summary-table">${mods.join("")}</table>`
        : `<p><em>Aucune modification chiffrée renseignée — préciser ci-dessus l'objet de l'avenant.</em></p>`}
    </div>

    <div class="article">
      <p><b>Toutes les autres clauses et conditions du mandat initial demeurent inchangées et conservent leur plein effet.</b></p>
    </div>

    ${signaturesHtml()}

    <p class="footer-note">${agence?.nom_commercial ?? "Agence"} — Avenant n°&nbsp;${numAvenant} au mandat N°&nbsp;${numParent} — Document confidentiel</p>
  </div>
  </body></html>`;
}

export async function generateMandatV2(draft: MandatDraft, agence: AgenceParametres | null): Promise<string> {
  // Récupération du contact mandant pour son identité complète
  let c: any = null;
  if (draft.mandant_id) {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", draft.mandant_id)
      .limit(1);
    c = (data as any[])?.[0] ?? null;
  }

  // ── Si c'est un AVENANT, générer un document d'avenant ─────────────
  if (draft.avenant_de) {
    const { data: pd } = await supabase
      .from("registre_mandats")
      .select("*")
      .eq("id", draft.avenant_de)
      .limit(1);
    const parent = (pd as any[])?.[0] ?? null;
    return renderAvenant(draft, parent, agence, c);
  }

  const nature = normNature(draft.nature_mandat);

  // ── DÉLÉGATION (inter-agences) — document à part, NE consomme PAS de n° de registre ──
  if (nature === "Délégation de mandat" || draft.delegation_de) {
    let parent: any = null;
    if (draft.delegation_de) {
      const { data: pd } = await supabase
        .from("registre_mandats")
        .select("*")
        .eq("id", draft.delegation_de)
        .limit(1);
      parent = (pd as any[])?.[0] ?? null;
    }
    return renderDelegation(draft, parent, agence);
  }

  const forme = normForme(draft.forme_mandat);
  const isExcl = forme === "Exclusif";
  const isSemi = forme === "Semi-exclusif";
  const isRecherche = nature === "Recherche";
  const isLocation = nature === "Location";


  const { titre, partieAdverse, objetDoc } = objetLibelle(nature);
  const numero = draft.numero ?? "[ _____ ]";
  const ht = draft.honoraires_montant ?? null;
  const ttc = ht ? Math.round(ht * 1.2) : null;
  const dureeMois = draft.duree_mois ?? 3;
  const preavis = draft.preavis_jours ?? 15;

  // ── Bloc identité MANDANT (contact lié) ────────────────────────────
  const mandantNomComplet = [c?.civilite, c?.prenom, c?.nom].filter(Boolean).join(" ").trim();
  const mandantNom = (c?.societe && c.societe.trim())
    ? c.societe.trim()
    : (mandantNomComplet || draft.mandant_nom || null);
  const mandantAdresse = c
    ? [c.adresse, c.code_postal, c.commune].filter(Boolean).join(" ").trim()
    : null;
  const mandantRows: string[] = [];
  mandantRows.push(`<tr><td>Nom / Raison sociale</td><td><b>${val(mandantNom)}</b></td></tr>`);
  if (c?.societe) {
    const formeCapital = [c.forme_juridique, c.capital ? `Capital : ${euros(c.capital)}` : null]
      .filter(Boolean).join(" — ");
    if (formeCapital) mandantRows.push(`<tr><td>Forme / Capital</td><td>${val(formeCapital)}</td></tr>`);
    const rcsSiret = c.rcs ?? c.siret;
    if (rcsSiret) mandantRows.push(`<tr><td>RCS / SIRET</td><td>${val(rcsSiret)}</td></tr>`);
    const representant = [mandantNomComplet, c.fonction].filter(Boolean).join(" — ");
    if (representant) mandantRows.push(`<tr><td>Représentée par</td><td>${val(representant)}</td></tr>`);
  }
  mandantRows.push(`<tr><td>Adresse</td><td>${val(mandantAdresse, "[ adresse du mandant ]")}</td></tr>`);
  if (c?.telephone) mandantRows.push(`<tr><td>Téléphone</td><td>${val(c.telephone)}</td></tr>`);
  if (c?.email) mandantRows.push(`<tr><td>Email</td><td>${val(c.email)}</td></tr>`);


  // synthèse spécifique
  const synthese: string[] = [];
  synthese.push(`<tr><td>N° de Mandat</td><td><b>${numero}</b></td></tr>`);
  synthese.push(`<tr><td>Nature / Forme</td><td><b>${nature}</b> — ${forme}${isExcl ? " <span style='color:#B91C1C;font-weight:700'>(EXCLUSIF — caractères très apparents)</span>" : ""}</td></tr>`);
  if (draft.reference_bien) synthese.push(`<tr><td>Référence interne</td><td>${val(draft.reference_bien)}</td></tr>`);
  if (!isRecherche) {
    synthese.push(`<tr><td>Désignation</td><td>${val(draft.designation_bien ?? draft.activite_bien)}</td></tr>`);
    synthese.push(`<tr><td>Adresse</td><td>${val(draft.adresse_bien)}</td></tr>`);
    if (draft.activite_bien) synthese.push(`<tr><td>Activité</td><td>${val(draft.activite_bien)}</td></tr>`);
    if (draft.surfaces_bien) synthese.push(`<tr><td>Surfaces</td><td>${val(draft.surfaces_bien)}</td></tr>`);
  }
  synthese.push(`<tr><td>Date de signature</td><td>${fdate(draft.date_signature)}</td></tr>`);
  synthese.push(`<tr><td>Durée</td><td><b>${dureeMois} mois</b>${isExcl || isSemi ? ` — préavis de résiliation ${preavis} j après 3 mois (LRAR)` : ""}</td></tr>`);
  synthese.push(`<tr><td>Négociateur</td><td>${val(draft.negociateur)}</td></tr>`);

  // prix
  const prixBloc: string[] = [];
  if (isLocation) {
    prixBloc.push(`<tr><td>Loyer mensuel HC</td><td><b>${euros(draft.loyer)}</b></td></tr>`);
  } else if (isRecherche) {
    prixBloc.push(`<tr><td>Critères</td><td>${val(draft.criteres_recherche)}</td></tr>`);
    prixBloc.push(`<tr><td>Prix maximum</td><td><b>${euros(draft.prix_max_recherche)}</b></td></tr>`);
  } else {
    prixBloc.push(`<tr><td>Prix de présentation</td><td>${euros(draft.prix)}</td></tr>`);
    prixBloc.push(`<tr><td>Prix net ${nature === "Murs commerciaux" || nature === "Local / immobilier d'entreprise" ? "vendeur" : "cédant"}</td><td><b>${euros(draft.prix_net_vendeur)}</b> — ${eurosLettres(draft.prix_net_vendeur)}</td></tr>`);
  }
  if (ht != null) {
    prixBloc.push(`<tr><td>Honoraires</td><td>${euros(ht)} HT — soit <b>${euros(ttc)} TTC</b></td></tr>`);
  }
  prixBloc.push(`<tr><td>Honoraires à la charge de</td><td>${val(draft.honoraires_charge, "[ Acquéreur / Cédant ]")}</td></tr>`);

  // clauses exclusivité
  const clauseExclu = isExcl ? `
    <p class="caps" style="font-size:9pt;background:#FEF3C7;padding:2mm;border:1px solid #F59E0B;">
      MANDAT EXCLUSIF — Pendant toute la durée du présent mandat, ${nature === "Recherche" ? "le MANDANT" : "le MANDANT"} s'interdit de traiter directement
      ou par l'intermédiaire d'un tiers. Toute violation entraîne le paiement d'une indemnité forfaitaire
      égale au montant TTC des honoraires prévus aux présentes (clause pénale plafonnée aux honoraires).
    </p>` : isSemi ? `
    <p class="caps" style="font-size:9pt;">
      MANDAT SEMI-EXCLUSIF — Le MANDANT conserve la faculté de traiter directement avec un acquéreur de
      sa propre connaissance ; il s'interdit en revanche tout autre mandat à un tiers professionnel.
    </p>` : "";

  return `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${titre} N°${numero} — ${agence?.nom_commercial ?? "Agence"}</title>
    <style>${CSS}</style>
  </head><body>
  <div class="page">
    <div class="header">
      <div>${agenceHeader(agence)}</div>
      <div class="header-info">${agenceMentions(agence)}</div>
    </div>
    <hr class="gold-line"/>
    <div class="doc-title">
      <h1>${titre} — N°&nbsp;${numero}</h1>
      <p>${forme.toUpperCase()}${isExcl ? " · EXCLUSIF" : ""}</p>
    </div>

    <table class="summary-table" style="margin-top:4mm;">
      ${synthese.join("")}
    </table>

    <div class="convention">ENTRE LES SOUSSIGNÉS</div>

    <div class="partie-title">${partieAdverse}</div>
    <table class="partie-table">
      ${mandantRows.join("")}
    </table>
    <p>Ci-après désigné(e) <b>« le MANDANT »</b>, d'une part,</p>
    <hr class="thin-line"/>
    ${mandataireV2(agence, draft.negociateur)}

    <div class="convention">IL A ÉTÉ CONVENU CE QUI SUIT</div>

    <div class="article">
      <div class="article-title">ARTICLE 1 — OBJET</div>
      <p>Le MANDANT confère à l'INTERMÉDIAIRE, qui l'accepte, un mandat de <b>${objetDoc}</b>
      dans la forme <b>${forme}</b>${isExcl ? " (EXCLUSIF)" : ""}.</p>
      ${clauseExclu}
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 2 — DÉSIGNATION</div>
      ${isRecherche
        ? `<p><b>Critères de recherche :</b> ${val(draft.criteres_recherche)}</p>
           <p><b>Prix maximum :</b> ${euros(draft.prix_max_recherche)}</p>`
        : `<p><b>Désignation :</b> ${val(draft.designation_bien)}<br/>
           <b>Adresse :</b> ${val(draft.adresse_bien)}<br/>
           ${draft.activite_bien ? `<b>Activité :</b> ${val(draft.activite_bien)}<br/>` : ""}
           ${draft.surfaces_bien ? `<b>Surfaces :</b> ${val(draft.surfaces_bien)}` : ""}</p>
           ${draft.description_locaux ? `<p><b>Description des locaux :</b><br/>${val(draft.description_locaux)}</p>` : ""}`}
    </div>

    <div class="article">
      <div class="article-title">ARTICLE 3 — ${isLocation ? "LOYER" : isRecherche ? "BUDGET" : "PRIX"} ET RÉMUNÉRATION</div>
      <table class="summary-table">${prixBloc.join("")}</table>
      <p>Les honoraires sont exigibles à la conclusion effective de l'opération constatée par acte écrit.</p>
    </div>

    ${nature === "Fonds de commerce" ? (() => {
      const elements: string[] = [];
      if (draft.comp_clientele !== false) elements.push("Clientèle et achalandage");
      if (draft.comp_enseigne !== false) elements.push("Enseigne");
      if (draft.comp_nom_commercial !== false) elements.push("Nom commercial");
      if (draft.comp_stocks !== false) elements.push("Stocks, évalués au jour de la cession");
      if (draft.comp_materiel !== false) elements.push("Agencements, matériel et mobilier");
      const liElems = elements.length ? `<ul>${elements.map(e => `<li>${e}</li>`).join("")}</ul>` : "";
      const effLine = draft.effectif != null ? `<p><b>Effectif salarié :</b> ${draft.effectif} salarié(s)</p>` : "";
      const notes = draft.composition && draft.composition.trim() ? `<p><b>Notes :</b> ${val(draft.composition)}</p>` : "";
      if (!liElems && !effLine && !notes) return "";
      return `
    <div class="article">
      <div class="article-title">COMPOSITION DU FONDS</div>
      ${liElems}
      ${effLine}
      ${notes}
    </div>`;
    })() : ""}

    ${(nature === "Fonds de commerce" || nature === "Droit au bail" || nature === "Murs commerciaux" || nature === "Local / immobilier d'entreprise") ? (() => {
      const rows: string[] = [];
      if (draft.bail_activites) rows.push(`<tr><td>Activités autorisées</td><td>${val(draft.bail_activites)}</td></tr>`);
      if (draft.bail_duree_restante) rows.push(`<tr><td>Durée restante du bail</td><td>${val(draft.bail_duree_restante)}</td></tr>`);
      if (draft.loyer != null) rows.push(`<tr><td>Loyer</td><td>${euros(draft.loyer)}</td></tr>`);
      if (draft.bail_garanties) rows.push(`<tr><td>Garanties (dépôt, caution…)</td><td>${val(draft.bail_garanties)}</td></tr>`);
      if (draft.bail_charges != null) rows.push(`<tr><td>Charges annuelles</td><td>${euros(draft.bail_charges)}</td></tr>`);
      if (draft.bail_taxe_fonciere) rows.push(`<tr><td>Taxe foncière</td><td>${val(String(draft.bail_taxe_fonciere))}</td></tr>`);
      if (draft.bail_indexation) rows.push(`<tr><td>Indexation</td><td>${val(draft.bail_indexation)}</td></tr>`);
      if (draft.bail_fiscalite) rows.push(`<tr><td>Fiscalité</td><td>${val(draft.bail_fiscalite)}</td></tr>`);
      if (rows.length === 0) return "";
      return `
    <div class="article">
      <div class="article-title">CARACTÉRISTIQUES DU BAIL</div>
      <table class="summary-table">${rows.join("")}</table>
    </div>`;
    })() : ""}

    <div class="article">
      <div class="article-title">ARTICLE 4 — DURÉE ET RÉSILIATION</div>
      <p>Le présent mandat est consenti pour une durée de <b>${dureeMois} (${dureeMois >= 10 ? dureeMois : "trois"}) mois</b>
      à compter de sa signature, dans la limite de <b>douze (12) mois</b> au total.</p>
      ${isExcl || isSemi ? `<p>Passé le délai initial de 3 mois, chaque partie peut résilier par préavis de
        <b>${preavis} jours</b> adressé par lettre recommandée avec AR (art. 78 al. 2 du décret du 20/07/1972).</p>` : ""}
      ${isExcl ? `<p class="caps">CLAUSE PÉNALE — En cas de violation de l'exclusivité, le MANDANT versera
        une indemnité forfaitaire <b>égale au montant TTC des honoraires</b> prévus aux présentes,
        sans pouvoir excéder ce montant.</p>` : ""}
    </div>

    ${clauseRgpd()}
    ${signaturesHtml()}

    <p class="footer-note">${agence?.nom_commercial ?? "Agence"} — Mandat n°&nbsp;${numero} — Document confidentiel</p>
  </div>
  </body></html>`;
}

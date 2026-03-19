/**
 * generateMandat.ts
 * Génération des mandats TBEECOM en HTML → impression PDF navigateur
 * Trois types : simple, exclusif, avenant
 */

import type { Mandat, Contact, MandatVendeur } from "@/types/database";

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

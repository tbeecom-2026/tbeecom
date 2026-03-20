/**
 * pdfParser.ts — Extraction et parsing des mandats TBEECOM depuis PDF
 * Utilise pdfjs-dist pour extraire le texte, puis des regex calées sur
 * le modèle TBEECOM pour remplir les champs mandat + contact.
 */
import * as pdfjsLib from "pdfjs-dist";

// Worker via import Vite URL (évite les problèmes de bundling)
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedContact {
  societe?: string;
  forme_juridique?: string;
  capital_social?: number;
  siren?: string;
  siret?: string;
  ville_rcs?: string;
  nom?: string;
  prenom?: string;
  qualite?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  code_postal?: string;
  commune?: string;
}

export interface ParsedMandat {
  numero_registre?: number;
  type_mandat?: string;
  type_commerce?: string;
  sous_type?: string;
  adresse?: string;
  code_postal?: string;
  commune?: string;
  prix_demande?: number;
  honoraires_pct?: number;
  honoraires_montant?: number;
  duree_mois?: number;
  contact?: ParsedContact;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clean(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function toInt(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s.replace(/[\s\u00a0]/g, ""), 10);
  return isNaN(n) ? undefined : n;
}

function toFloat(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.replace(",", ".").replace(/[\s\u00a0]/g, ""));
  return isNaN(n) ? undefined : n;
}

// Mapping type commerce extrait → valeurs connues du CRM
const TYPE_COMMERCE_MAP: Record<string, string> = {
  restaurant: "Restaurant/bar",
  bar: "Restaurant/bar",
  brasserie: "Restaurant/bar",
  café: "Restaurant/bar",
  cafe: "Restaurant/bar",
  alimentation: "Commerce d'alimentation",
  épicerie: "Commerce d'alimentation",
  epicerie: "Commerce d'alimentation",
  boulangerie: "Commerce d'alimentation",
  pâtisserie: "Commerce d'alimentation",
  patisserie: "Commerce d'alimentation",
  traiteur: "Commerce d'alimentation",
  hôtel: "Hôtel",
  hotel: "Hôtel",
  presse: "Presse/tabac",
  tabac: "Presse/tabac",
  librairie: "Presse/tabac",
  boutique: "Boutique",
  fleurs: "Boutique",
  fleuriste: "Boutique",
  mode: "Boutique",
  vêtements: "Boutique",
  vetements: "Boutique",
  bijouterie: "Boutique",
  garage: "Garage",
  automobile: "Garage",
  mécanique: "Garage",
  services: "Commerce de services",
  coiffure: "Commerce de services",
  esthétique: "Commerce de services",
  esthetique: "Commerce de services",
  pressing: "Commerce de services",
  laverie: "Commerce de services",
  pharmacie: "Commerce de services",
  optique: "Commerce de services",
};

function guessTypeCommerce(raw: string): string {
  const lower = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [key, val] of Object.entries(TYPE_COMMERCE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "Autres";
}

// ─── Extraction texte PDF ────────────────────────────────────────────────────

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstitue le texte en préservant l'ordre naturel de lecture
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n");
}

// ─── Parser principal ────────────────────────────────────────────────────────

export function parseMandatText(rawText: string): ParsedMandat {
  // Normalise les espaces multiples (pdfjs produit parfois des espaces en excès)
  const t = rawText.replace(/\s+/g, " ");

  const result: ParsedMandat = {};

  // ── N° mandat ─────────────────────────────────────────────────────────────
  const numMatch =
    t.match(/Mandat\s+n[o°]\s*(\d+)/i) ??
    t.match(/COMMERCE\s+N[O°]\s*(\d+)/i);
  if (numMatch) result.numero_registre = toInt(numMatch[1]);

  // ── Type mandat ───────────────────────────────────────────────────────────
  if (/CO[\s-]EXCLUSIF/i.test(t)) result.type_mandat = "co_exclusif";
  else if (/SEMI[\s-]EXCLUSIF/i.test(t)) result.type_mandat = "semi_exclusif";
  else if (/MANDAT\s+EXCLUSIF/i.test(t)) result.type_mandat = "exclusif";
  else if (/MANDAT\s+SIMPLE/i.test(t)) result.type_mandat = "simple";
  else if (/D[ÉE]L[ÉE]GATION/i.test(t)) result.type_mandat = "delegation";

  // ── Type de commerce (ex: "fonds de commerce de Fleurs") ─────────────────
  const tcMatch = t.match(/fonds\s+de\s+commerce\s+de\s+([\w\s''-]{2,40})(?=\s+Situ[ée]|\s+Compos|\s+La\s+client)/i);
  if (tcMatch) {
    const rawType = clean(tcMatch[1]);
    result.sous_type = rawType;
    result.type_commerce = guessTypeCommerce(rawType);
  }

  // ── Adresse du fonds ──────────────────────────────────────────────────────
  // "Situé 24 avenue Edouard Vaillant 92150 Suresnes"
  const addrMatch = t.match(/Situ[ée]\s+(.+?)\s+(\d{5})\s+([A-Z][A-Za-zÀ-ÿ\s'-]{2,30}?)(?:\s*\.|,|$)/);
  if (addrMatch) {
    result.adresse  = clean(addrMatch[1]);
    result.code_postal = addrMatch[2];
    result.commune  = clean(addrMatch[3]);
  }

  // ── Prix de vente ─────────────────────────────────────────────────────────
  // "deux cent mille euros ( 200000 €)"
  const prixMatch = t.match(/\(\s*([\d\s\u00a0]+)\s*€\s*\)/);
  if (prixMatch) result.prix_demande = toInt(prixMatch[1]);

  // ── Honoraires % HT ──────────────────────────────────────────────────────
  const honPctMatch = t.match(/([\d]+(?:[,.]\d+)?)\s*%\s*HT/i);
  if (honPctMatch) result.honoraires_pct = toFloat(honPctMatch[1]);

  // ── Honoraires montant HT ─────────────────────────────────────────────────
  // "18.000€ HT" ou "18 000 € HT"
  const honMontantMatch = t.match(/([\d][\d\s.,]*)\s*€\s*HT/i);
  if (honMontantMatch) result.honoraires_montant = toInt(honMontantMatch[1]);

  // ── Durée initiale ────────────────────────────────────────────────────────
  const dureeMatch = t.match(/dur[ée]e\s+de\s+(\d+)\s+mois/i);
  if (dureeMatch) result.duree_mois = toInt(dureeMatch[1]);

  // ── Contact / Mandant ─────────────────────────────────────────────────────
  const contact: ParsedContact = {};
  let hasContact = false;

  // Société : "La Société Aude Rose , SARL au capital social de 5000 euros"
  const societeMatch = t.match(
    /La\s+[Ss]oci[ée]t[ée]\s+([\w\s]+?)\s*,\s*(SARL|SAS|EURL|SA|SNC|EI|SASU|SCI)\s+au\s+capital/i
  );
  if (societeMatch) {
    contact.societe = clean(societeMatch[1]);
    contact.forme_juridique = societeMatch[2].toUpperCase();
    hasContact = true;
  }

  // Capital social
  const capitalMatch = t.match(/capital\s+social\s+de\s+([\d\s\u00a0]+)\s+euros/i);
  if (capitalMatch) contact.capital_social = toInt(capitalMatch[1]);

  // Adresse siège social : "siège social est situé 24 avenue... 92150 Suresnes ,"
  const siegeMatch = t.match(
    /si[eè]ge\s+social\s+est\s+situ[ée]\s+(.+?)\s+(\d{5})\s+([A-Z][A-Za-zÀ-ÿ\s'-]{2,30}?)\s*(?:,|immatricul)/i
  );
  if (siegeMatch) {
    contact.adresse    = clean(siegeMatch[1]);
    contact.code_postal = siegeMatch[2];
    contact.commune    = clean(siegeMatch[3]);
    hasContact = true;
  }

  // RCS + SIREN : "immatriculée au RCS de NANTERRE , sous le numéro 513 834 762"
  const rcsMatch = t.match(
    /RCS\s+de\s+([A-Z][A-Z\s]+?)\s*,?\s+sous\s+le\s+num[ée]ro\s+([\d\s]{9,14})/i
  );
  if (rcsMatch) {
    contact.ville_rcs = clean(rcsMatch[1]);
    const rawNum = rcsMatch[2].replace(/\s/g, "");
    if (rawNum.length >= 14) {
      contact.siret = rawNum.substring(0, 14);
      contact.siren = rawNum.substring(0, 9);
    } else {
      contact.siren = rawNum.substring(0, 9);
    }
    hasContact = true;
  }

  // Représentant + qualité — plusieurs patterns pour couvrir les variantes pdfjs
  // Pattern 1 : "représentée par Madame Aude Anglaret , agissant"
  const repMatch =
    t.match(/repr[ée]sent[ée]e?\s+par\s+(?:Madame|Monsieur|M\.|Mme\.?)\s+([\w\s'-]+?)\s*,\s*agissant/i) ??
    // Pattern 2 : sans virgule "représentée par Madame Aude Anglaret agissant"
    t.match(/repr[ée]sent[ée]e?\s+par\s+(?:Madame|Monsieur|M\.|Mme\.?)\s+([\w\s'-]+?)\s+agissant/i) ??
    // Pattern 3 : sans civilité "représentée par Aude Anglaret , agissant"
    t.match(/repr[ée]sent[ée]e?\s+par\s+([\w][A-Za-zÀ-ÿ\s'-]{3,40?}?)\s*,?\s*agissant/i);

  if (repMatch) {
    const parts = clean(repMatch[1]).split(/\s+/);
    contact.nom    = parts[parts.length - 1];
    contact.prenom = parts.slice(0, -1).join(" ") || undefined;
    hasContact = true;
  }

  // Fallback nom : dirigeant SIRENE (sera complété après si SIREN trouvé)
  // ou à défaut le nom de la société (pour satisfaire la contrainte NOT NULL)
  if (!contact.nom && contact.societe) {
    // Utilise le dernier mot de la société comme nom provisoire
    const words = contact.societe.trim().split(/\s+/);
    contact.nom    = words[words.length - 1];
    contact.prenom = words.slice(0, -1).join(" ") || undefined;
  }

  const qualiteMatch = t.match(/agissant\s+en\s+qualit[ée]\s+([\w\s'-]+?)(?:\s{2}|,|\.)/i);
  if (qualiteMatch) contact.qualite = clean(qualiteMatch[1]);

  // Téléphone mandant (première occurrence, avant TBEECOM)
  // On cherche "Téléphone : XXXXXXXXXX" dans la section mandant
  const sectionMandant = t.split(/Le MANDATAIRE/i)[0] ?? t;
  const telMatch = sectionMandant.match(/T[ée]l[ée]phone\s*:\s*([\d\s+]{8,15})/i);
  if (telMatch) {
    contact.telephone = telMatch[1].replace(/\s/g, "");
    hasContact = true;
  }

  // Email mandant
  const emailMatch = sectionMandant.match(
    /Adresse\s+[ée]lectronique\s*:\s*([a-zA-Z0-9._%+'-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (emailMatch) {
    contact.email = emailMatch[1];
    hasContact = true;
  }

  if (hasContact) result.contact = contact;

  return result;
}

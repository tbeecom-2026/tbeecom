// functions/api/extraire.ts
// Cloudflare Pages Function : lit un document (bilan / bail / quittance) via l'API Claude
// et renvoie les champs extraits en JSON. Clé requise : secret ANTHROPIC_API_KEY (Cloudflare).
// Modèle configurable via ANTHROPIC_MODEL (défaut : claude-sonnet-5).

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function prompt(type: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (type === "bilan") {
    return `Tu es expert-comptable. Analyse ce BILAN / compte de résultat.
Extrais et calcule en euros (nombres entiers, sans espaces ni symbole, virgule décimale interdite) :
- "annee" : année de l'exercice (nombre)
- "ca" : chiffre d'affaires HT
- "ebe" : Excédent Brut d'Exploitation. S'il n'est pas indiqué, CALCULE-le :
  EBE = Valeur ajoutée + subventions d'exploitation − impôts et taxes − charges de personnel
  (ou : CA − achats consommés − charges externes − impôts et taxes − charges de personnel).
- "resultat_net" : résultat net
- "remuneration_dirigeant" : rémunération annuelle du/des dirigeant(s) si visible, sinon null
Réponds UNIQUEMENT par un objet JSON avec ces clés (valeur numérique ou null). Aucune phrase autour.`;
  }
  if (type === "bail") {
    return `Analyse ce BAIL COMMERCIAL. Date du jour : ${today}.
Extrais (montants en euros, entiers) :
- "loyer_annuel" : loyer annuel (si mensuel, multiplie par 12)
- "charges_annuelles" : charges annuelles
- "taxe_fonciere" : montant de la taxe foncière si à la charge du locataire, sinon null
- "date_debut" : date de prise d'effet (AAAA-MM-JJ)
- "date_fin" : date de fin du bail en cours (AAAA-MM-JJ)
- "duree_bail_mois" : nombre de mois RESTANTS jusqu'au terme par rapport à la date du jour
- "destination" : destination/activité autorisée par le bail (texte)
Réponds UNIQUEMENT par un objet JSON avec ces clés (null si absent). Aucune phrase autour.`;
  }
  return `Analyse cette QUITTANCE DE LOYER. Extrais (euros, entiers) :
- "loyer_annuel" : loyer hors charges annualisé
- "charges_annuelles" : charges annualisées
- "periode" : période couverte (texte)
Réponds UNIQUEMENT par un objet JSON avec ces clés (null si absent). Aucune phrase autour.`;
}

function parseJson(text: string): any {
  const a = text.indexOf("{"); const b = text.lastIndexOf("}");
  if (a === -1 || b === -1) return {};
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return {}; }
}

export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context;
  if (!env.ANTHROPIC_API_KEY) return json({ error: "Clé API IA non configurée (ANTHROPIC_API_KEY manquant dans Cloudflare)." }, 500);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const { type, media_type, data } = body || {};
  if (!data || !media_type) return json({ error: "Fichier manquant." }, 400);

  const isPdf = media_type === "application/pdf";
  const docBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type, data } }
    : { type: "image", source: { type: "base64", media_type, data } };

  const payload = {
    model: env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: [docBlock, { type: "text", text: prompt(type) }] }],
  };

  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
  } catch (e: any) { return json({ error: "Appel IA impossible : " + (e?.message ?? "réseau") }, 502); }

  if (!r.ok) { const t = await r.text(); return json({ error: `IA erreur ${r.status}`, detail: t.slice(0, 300) }, 502); }
  const d: any = await r.json();
  const text = (d?.content ?? []).map((c: any) => c?.text ?? "").join("");
  return json({ fields: parseJson(text), raw: text });
}

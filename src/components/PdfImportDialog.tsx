/**
 * PdfImportDialog.tsx
 * Dialog d'import PDF mandat TBEECOM.
 *
 * mode="list"   → Cas 1 : crée un nouveau mandat depuis la liste
 * mode="detail" → Cas 2 : enrichit un mandat existant (mandatId requis)
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Upload, Loader2, AlertTriangle, CheckCircle2,
  User, Building2, Phone, Mail, MapPin, ExternalLink, X
} from "lucide-react";
import { extractTextFromPdf, parseMandatText, type ParsedMandat, type ParsedContact } from "@/lib/pdfParser";
import { lookupSiren } from "@/lib/sirene";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExistingContact {
  id: string;
  nom?: string;
  prenom?: string;
  societe?: string;
  commune?: string;
  siren?: string;
  email?: string;
  telephone?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "list" | "detail";
  mandatId?: string;       // requis en mode "detail"
  onSuccess?: () => void;  // callback après sauvegarde réussie
}

type Step = "upload" | "parsing" | "review" | "saving" | "done";

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 text-sm py-0.5">
      <span className="text-muted-foreground min-w-[140px] text-xs">{label}</span>
      <span className="font-medium text-foreground">{String(value)}</span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PdfImportDialog({ open, onClose, mode, mandatId, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep]                     = useState<Step>("upload");
  const [dragOver, setDragOver]             = useState(false);
  const [parsed, setParsed]                 = useState<ParsedMandat | null>(null);
  const [pdfFile, setPdfFile]               = useState<File | null>(null);
  const [duplicates, setDuplicates]         = useState<ExistingContact[]>([]);
  const [chosenContact, setChosenContact]   = useState<ExistingContact | null | "new">(undefined as any);
  const [sireneEnriched, setSireneEnriched] = useState(false);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  // ── Reset état interne à la fermeture ─────────────────────────────────────
  function handleClose() {
    setStep("upload"); setParsed(null); setPdfFile(null);
    setDuplicates([]); setChosenContact(undefined as any);
    setSireneEnriched(false); setErrorMsg(null);
    onClose();
  }

  // ── Traitement du fichier PDF ──────────────────────────────────────────────
  async function processPdf(file: File) {
    if (!file.type.includes("pdf")) {
      setErrorMsg("Le fichier sélectionné n'est pas un PDF."); return;
    }
    setPdfFile(file);
    setStep("parsing");
    setErrorMsg(null);

    try {
      // 1. Extraction texte
      const text = await extractTextFromPdf(file);

      // 2. Parsing regex
      const data = parseMandatText(text);
      setParsed(data);

      // 3. Enrichissement SIRENE si SIREN trouvé
      if (data.contact?.siren) {
        try {
          const { lookupSiren: ls } = await import("@/lib/sirene");
          const sireneData = await ls(data.contact.siren);
          if (sireneData) {
            // Fusionne les données SIRENE (priorité aux données du PDF)
            data.contact = {
              ...sireneData,            // données SIRENE comme base
              ...data.contact,          // données PDF écrasent si présentes
              forme_juridique: data.contact.forme_juridique ?? sireneData.forme_juridique,
              siren: data.contact.siren,
            } as ParsedContact;
            setSireneEnriched(true);
          }
        } catch {
          // SIRENE non disponible → on continue sans enrichissement
        }
      }

      // 4. Recherche doublons contact
      const dupes = await searchDuplicates(data.contact);
      setDuplicates(dupes);

      // Si doublons → attendre le choix. Sinon → "new" par défaut.
      setChosenContact(dupes.length > 0 ? undefined as any : "new");
      setStep("review");

    } catch (err: any) {
      setErrorMsg("Erreur lors de la lecture du PDF : " + (err?.message ?? "inconnue"));
      setStep("upload");
    }
  }

  // ── Recherche de doublons dans Supabase ────────────────────────────────────
  async function searchDuplicates(contact?: ParsedContact): Promise<ExistingContact[]> {
    if (!contact) return [];
    const found: ExistingContact[] = [];
    const seen = new Set<string>();

    // Recherche par SIREN (identifiant fiable)
    if (contact.siren) {
      const { data } = await supabase
        .from("contacts")
        .select("id, nom, prenom, societe, commune, siren, email, telephone")
        .eq("siren", contact.siren)
        .limit(5);
      (data ?? []).forEach((c: ExistingContact) => { if (!seen.has(c.id)) { found.push(c); seen.add(c.id); } });
    }

    // Recherche par nom de société (si pas déjà trouvé par SIREN)
    if (contact.societe && found.length === 0) {
      const { data } = await supabase
        .from("contacts")
        .select("id, nom, prenom, societe, commune, siren, email, telephone")
        .ilike("societe", `%${contact.societe.substring(0, 12)}%`)
        .limit(5);
      (data ?? []).forEach((c: ExistingContact) => { if (!seen.has(c.id)) { found.push(c); seen.add(c.id); } });
    }

    // Recherche par nom + prénom du représentant
    if (contact.nom && found.length === 0) {
      const { data } = await supabase
        .from("contacts")
        .select("id, nom, prenom, societe, commune, siren, email, telephone")
        .ilike("nom", `%${contact.nom}%`)
        .limit(5);
      (data ?? []).forEach((c: ExistingContact) => { if (!seen.has(c.id)) { found.push(c); seen.add(c.id); } });
    }

    return found;
  }

  // ── Sauvegarde en base ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!parsed) return;
    if (duplicates.length > 0 && chosenContact === undefined) {
      toast({ title: "Action requise", description: "Veuillez choisir si vous utilisez un contact existant ou en créez un nouveau.", variant: "destructive" });
      return;
    }
    setStep("saving");

    try {
      let contactId: string | null = null;

      // ── Contact ────────────────────────────────────────────────────────
      if (chosenContact && chosenContact !== "new") {
        // Utilise le contact existant choisi
        contactId = chosenContact.id;
      } else if (chosenContact === "new" && parsed.contact) {
        // Crée un nouveau contact
        const c = parsed.contact;
        const { data: newContact, error: cErr } = await supabase
          .from("contacts")
          .insert({
            nom: c.nom, prenom: c.prenom, email: c.email,
            telephone: c.telephone, societe: c.societe,
            forme_juridique: c.forme_juridique, capital_social: c.capital_social,
            siren: c.siren, siret: c.siret, ville_rcs: c.ville_rcs,
            adresse: c.adresse, code_postal: c.code_postal, commune: c.commune,
            roles: ["vendeur"],
            user_id: user?.id,
          })
          .select("id")
          .single();
        if (cErr) throw new Error("Erreur création contact : " + cErr.message);
        contactId = newContact.id;
      }

      // ── Mandat ─────────────────────────────────────────────────────────
      let finalMandatId = mandatId;

      const mandatPayload = {
        numero_registre: parsed.numero_registre,
        type_mandat:    parsed.type_mandat,
        type_commerce:  parsed.type_commerce,
        sous_type:      parsed.sous_type,
        adresse:        parsed.adresse,
        code_postal:    parsed.code_postal,
        commune:        parsed.commune,
        prix_demande:   parsed.prix_demande,
        honoraires_pct: parsed.honoraires_pct,
        honoraires_montant: parsed.honoraires_montant,
        user_id: user?.id,
      };

      if (mode === "list") {
        // Crée un nouveau mandat
        const ref = `FDC-${Date.now().toString(36).toUpperCase()}`;
        const { data: newMandat, error: mErr } = await supabase
          .from("mandats")
          .insert({ ...mandatPayload, statut: "sur_le_marche", reference: ref })
          .select("id")
          .single();
        if (mErr) throw new Error("Erreur création mandat : " + mErr.message);
        finalMandatId = newMandat.id;

      } else if (mode === "detail" && mandatId) {
        // Mode "detail" : enrichit les champs vides uniquement
        // Récupère d'abord le mandat existant
        const { data: existing } = await supabase
          .from("mandats").select("*").eq("id", mandatId).single();

        // Ne met à jour que les champs null/vides
        const updatePayload: Record<string, any> = {};
        for (const [key, val] of Object.entries(mandatPayload)) {
          if (val !== undefined && val !== null && !existing?.[key]) {
            updatePayload[key] = val;
          }
        }
        if (Object.keys(updatePayload).length > 0) {
          const { error: mErr } = await supabase
            .from("mandats").update(updatePayload).eq("id", mandatId);
          if (mErr) throw new Error("Erreur mise à jour mandat : " + mErr.message);
        }
      }

      // ── Lien mandat ↔ contact (mandat_vendeurs) ────────────────────────
      if (contactId && finalMandatId) {
        // Vérifie qu'il n'y a pas déjà un lien
        const { data: existing } = await supabase
          .from("mandat_vendeurs")
          .select("id")
          .eq("mandat_id", finalMandatId)
          .eq("contact_id", contactId)
          .maybeSingle();

        if (!existing) {
          await supabase.from("mandat_vendeurs").insert({
            mandat_id: finalMandatId, contact_id: contactId,
          });
        }
      }

      // ── Upload du PDF dans le bucket ───────────────────────────────────
      if (pdfFile && finalMandatId) {
        const path = `${finalMandatId}/${pdfFile.name}`;
        await supabase.storage.from("mandats-docs").upload(path, pdfFile, { upsert: true });
      }

      setStep("done");
      toast({ title: "Import réussi !", description: mode === "list" ? `Mandat N°${parsed.numero_registre ?? "?"} créé.` : "Fiche mandat enrichie." });

      setTimeout(() => {
        handleClose();
        if (mode === "list" && finalMandatId) navigate(`/mandats/${finalMandatId}`);
        else onSuccess?.();
      }, 1200);

    } catch (err: any) {
      setErrorMsg(err.message ?? "Erreur inconnue");
      setStep("review");
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processPdf(file);
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {mode === "list" ? "Importer un mandat depuis PDF" : "Enrichir la fiche depuis PDF"}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP : upload ─────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/60 hover:bg-secondary/40"}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Glisser-déposer le PDF ici</p>
              <p className="text-sm text-muted-foreground mt-1">ou cliquer pour sélectionner</p>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processPdf(f); }} />
            </div>
            {errorMsg && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <X className="h-4 w-4 shrink-0" />{errorMsg}
              </div>
            )}
          </div>
        )}

        {/* ── STEP : parsing ────────────────────────────────────────── */}
        {step === "parsing" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Lecture et analyse du PDF en cours…</p>
          </div>
        )}

        {/* ── STEP : review ─────────────────────────────────────────── */}
        {step === "review" && parsed && (
          <div className="space-y-5">

            {/* Données mandat extraites */}
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />Mandat extrait
              </p>
              <Row label="N° mandat"       value={parsed.numero_registre} />
              <Row label="Type"            value={parsed.type_mandat} />
              <Row label="Type de commerce" value={parsed.type_commerce} />
              <Row label="Sous-type"       value={parsed.sous_type} />
              <Row label="Adresse"         value={parsed.adresse} />
              <Row label="Code postal"     value={parsed.code_postal} />
              <Row label="Commune"         value={parsed.commune} />
              <Row label="Prix demandé"    value={parsed.prix_demande ? `${parsed.prix_demande.toLocaleString("fr-FR")} €` : undefined} />
              <Row label="Honoraires %"    value={parsed.honoraires_pct ? `${parsed.honoraires_pct}%` : undefined} />
              <Row label="Honoraires HT"   value={parsed.honoraires_montant ? `${parsed.honoraires_montant.toLocaleString("fr-FR")} €` : undefined} />
            </div>

            {/* Données contact extraites */}
            {parsed.contact && (
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Contact / Mandant{sireneEnriched && <Badge className="ml-2 text-[9px] bg-green-900/40 text-green-400 border-green-700/30">+ SIRENE enrichi</Badge>}
                </p>
                <Row label="Société"        value={parsed.contact.societe} />
                <Row label="Forme juridique" value={parsed.contact.forme_juridique} />
                <Row label="Capital social"  value={parsed.contact.capital_social ? `${parsed.contact.capital_social.toLocaleString("fr-FR")} €` : undefined} />
                <Row label="SIREN"           value={parsed.contact.siren} />
                <Row label="Représentant"    value={[parsed.contact.prenom, parsed.contact.nom].filter(Boolean).join(" ")} />
                <Row label="Qualité"         value={parsed.contact.qualite} />
                <Row label="Téléphone"       value={parsed.contact.telephone} />
                <Row label="Email"           value={parsed.contact.email} />
                <Row label="Adresse siège"   value={[parsed.contact.adresse, parsed.contact.code_postal, parsed.contact.commune].filter(Boolean).join(" ")} />
              </div>
            )}

            {/* ── Gestion des doublons ─────────────────────────────────── */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-amber-600/40 bg-amber-900/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {duplicates.length === 1
                    ? "Un contact existant pourrait correspondre"
                    : `${duplicates.length} contacts existants pourraient correspondre`}
                </p>

                {duplicates.map((c) => (
                  <div key={c.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-default ${chosenContact && (chosenContact as ExistingContact).id === c.id ? "border-primary/60 bg-primary/10" : "border-border/40 bg-secondary/30"}`}
                  >
                    <User className="h-8 w-8 text-muted-foreground shrink-0 bg-secondary rounded-full p-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.prenom} {c.nom}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.societe}{c.commune ? ` — ${c.commune}` : ""}</p>
                      {c.siren && <p className="text-xs text-muted-foreground">SIREN {c.siren}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/contacts/${c.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-3 w-3" />Voir
                        </a>
                      </Button>
                      <Button size="sm"
                        className={chosenContact && (chosenContact as ExistingContact).id === c.id ? "bg-primary" : ""}
                        onClick={() => setChosenContact(c)}
                      >
                        {chosenContact && (chosenContact as ExistingContact).id === c.id
                          ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Sélectionné</>
                          : "Utiliser ce contact"}
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="pt-1 border-t border-amber-800/30">
                  <Button size="sm" variant="ghost"
                    className={chosenContact === "new" ? "text-primary bg-primary/10" : "text-muted-foreground"}
                    onClick={() => setChosenContact("new")}
                  >
                    {chosenContact === "new" && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Non, c'est un homonyme — créer un nouveau contact
                  </Button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <X className="h-4 w-4 shrink-0" />{errorMsg}
              </div>
            )}

            {/* Boutons de validation */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button
                onClick={handleSave}
                disabled={duplicates.length > 0 && !chosenContact}
                className="bg-primary text-primary-foreground"
              >
                {mode === "list" ? "Créer le mandat" : "Enrichir la fiche"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP : saving ─────────────────────────────────────────── */}
        {step === "saving" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Enregistrement en cours…</p>
          </div>
        )}

        {/* ── STEP : done ───────────────────────────────────────────── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">Import réussi !</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

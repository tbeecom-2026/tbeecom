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
import { Input } from "@/components/ui/input";
import {
  FileText, Upload, Loader2, AlertTriangle, CheckCircle2,
  User, Building2, ExternalLink, X, ShieldAlert, ShieldCheck, Search,
} from "lucide-react";
import { extractTextFromPdf, parseMandatText, type ParsedContact } from "@/lib/pdfParser";
import { lookupSiren, lookupSiret, sireneToContact } from "@/lib/sirene";

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
  mandatId?: string;
  onSuccess?: () => void;
}

type Step = "upload" | "parsing" | "review" | "saving" | "done";

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="text-muted-foreground min-w-[140px] text-xs shrink-0">{label}</span>
      <span className="font-medium text-foreground text-sm">{String(value)}</span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PdfImportDialog({ open, onClose, mode, mandatId, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep]                         = useState<Step>("upload");
  const [dragOver, setDragOver]                 = useState(false);
  const [parsed, setParsed]                     = useState<ReturnType<typeof parseMandatText> | null>(null);
  const [rawText, setRawText]                   = useState("");
  const [pdfFile, setPdfFile]                   = useState<File | null>(null);
  const [duplicates, setDuplicates]             = useState<ExistingContact[]>([]);
  const [chosenContact, setChosenContact]       = useState<ExistingContact | "new" | null>(null);
  const [sireneEnriched, setSireneEnriched]     = useState(false);
  const [signatureWarning, setSignatureWarning] = useState<"ok" | "warn" | "unknown">("unknown");
  const [signatureConfirmee, setSignatureConfirmee] = useState(false);
  const [errorMsg, setErrorMsg]                 = useState<string | null>(null);
  // ── SIREN manuel ──────────────────────────────────────────────────────────
  const [sirenInput, setSirenInput]             = useState("");
  const [sireneLoading, setSireneLoading]       = useState(false);
  const [sireneError, setSireneError]           = useState<string | null>(null);

  // ── Reset ──────────────────────────────────────────────────────────────────
  function handleClose() {
    setStep("upload"); setParsed(null); setRawText(""); setPdfFile(null);
    setDuplicates([]); setChosenContact(null); setSireneEnriched(false);
    setSignatureWarning("unknown"); setSignatureConfirmee(false); setErrorMsg(null);
    setSirenInput(""); setSireneError(null);
    onClose();
  }

  // ── Lookup SIRENE manuel ───────────────────────────────────────────────────
  async function handleSireneManual() {
    const clean = sirenInput.replace(/\s/g, "");
    setSireneError(null);
    setSireneLoading(true);
    try {
      const result = clean.length === 14
        ? await lookupSiret(clean)
        : await lookupSiren(clean);
      const contactData = sireneToContact(result);

      // Met à jour le contact parsé avec les données SIRENE
      setParsed(prev => {
        if (!prev) return prev;
        const merged: ParsedContact = {
          ...(prev.contact ?? {}),
          societe:         contactData.societe         ?? prev.contact?.societe,
          forme_juridique: contactData.libelle_forme_juridique ?? prev.contact?.forme_juridique,
          capital_social:  contactData.capital_social  ?? prev.contact?.capital_social,
          siren:           result.siren,
          siret:           result.siret,
          adresse:         contactData.adresse         ?? prev.contact?.adresse,
          code_postal:     contactData.code_postal     ?? prev.contact?.code_postal,
          commune:         contactData.commune         ?? prev.contact?.commune,
          // Nom/prénom : SIRENE donne le dirigeant si pas encore trouvé
          nom:    prev.contact?.nom    ?? (result.nom_dirigeant?.split(" ").pop() ?? undefined),
          prenom: prev.contact?.prenom ?? (result.nom_dirigeant?.split(" ").slice(0, -1).join(" ") ?? undefined),
        };
        return { ...prev, contact: merged };
      });
      setSireneEnriched(true);

      // Relance la recherche de doublons avec le SIREN désormais connu
      const dupes = await searchDuplicates({ siren: result.siren });
      setDuplicates(dupes);
      setChosenContact(dupes.length > 0 ? null : "new");

    } catch (err: any) {
      setSireneError(err.message ?? "Entreprise introuvable");
    } finally {
      setSireneLoading(false);
    }
  }

  // ── Heuristique de détection des signatures ────────────────────────────────
  // Cherche si le nom/email du mandant apparaît dans la section signature du PDF
  function detectSignatureStatus(text: string, contact?: ParsedContact): "ok" | "warn" | "unknown" {
    const t = text.replace(/\s+/g, " ");
    const sigIdx = t.search(/DATE ET SIGNATURES/i);
    if (sigIdx === -1) return "unknown";

    const afterSig = t.slice(sigIdx).toLowerCase();

    // Indices positifs : le mail ou le nom du mandant apparaît après la section signature
    const identifiers = [
      contact?.email?.toLowerCase(),
      contact?.nom?.toLowerCase(),
      contact?.prenom?.toLowerCase(),
    ].filter(Boolean) as string[];

    const found = identifiers.some(id => afterSig.includes(id));

    // Indices négatifs : document "en attente"
    if (/en attente|not signed|awaiting|pending/i.test(afterSig)) return "warn";

    // Si on trouve l'identifiant du mandant près des signatures → OK
    if (found) return "ok";

    // Sinon on avertit sans bloquer
    return "warn";
  }

  // ── Traitement du PDF ──────────────────────────────────────────────────────
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
      setRawText(text);

      // 2. Parsing regex
      const data = parseMandatText(text);

      // 3. Enrichissement SIRENE si SIREN trouvé dans le PDF
      if (data.contact?.siren) {
        try {
          const sireneResult = await lookupSiren(data.contact.siren);
          const sireneContact = sireneToContact(sireneResult);

          // Fusionne : données PDF (plus précises) > données SIRENE (complément)
          data.contact = {
            ...data.contact,
            // Complète avec SIRENE uniquement si le PDF n'a pas la valeur
            societe:          data.contact.societe          ?? sireneContact.societe         ?? undefined,
            forme_juridique:  data.contact.forme_juridique  ?? sireneContact.libelle_forme_juridique ?? undefined,
            capital_social:   data.contact.capital_social   ?? (sireneContact.capital_social != null ? sireneContact.capital_social : undefined),
            siret:            data.contact.siret             ?? sireneContact.siret            ?? undefined,
            adresse:          data.contact.adresse           ?? sireneContact.adresse          ?? undefined,
            code_postal:      data.contact.code_postal       ?? sireneContact.code_postal      ?? undefined,
            commune:          data.contact.commune           ?? sireneContact.commune          ?? undefined,
          };
          setSireneEnriched(true);
        } catch {
          // API SIRENE indisponible — on continue avec les données du PDF seulement
        }
      }

      // 4. Pré-remplit le champ SIREN si extrait du PDF
      if (data.contact?.siren) setSirenInput(data.contact.siren);
      else if (data.contact?.siret) setSirenInput(data.contact.siret);

      // 5. Heuristique signature (option C)
      setSignatureWarning(detectSignatureStatus(text, data.contact));

      // 5. Recherche doublons
      const dupes = await searchDuplicates(data.contact);
      setDuplicates(dupes);
      setChosenContact(dupes.length > 0 ? null : "new");

      setParsed(data);
      setStep("review");

    } catch (err: any) {
      setErrorMsg("Erreur lors de la lecture du PDF : " + (err?.message ?? "inconnue"));
      setStep("upload");
    }
  }

  // ── Recherche doublons ─────────────────────────────────────────────────────
  async function searchDuplicates(contact?: ParsedContact): Promise<ExistingContact[]> {
    if (!contact) return [];
    const found: ExistingContact[] = [];
    const seen = new Set<string>();

    const push = (list: any[]) =>
      list?.forEach((c: ExistingContact) => { if (!seen.has(c.id)) { found.push(c); seen.add(c.id); } });

    // 1. Par SIREN (identifiant fiable)
    if (contact.siren) {
      const { data } = await supabase.from("contacts")
        .select("id, nom, prenom, societe, commune, siren, email, telephone")
        .eq("siren", contact.siren).limit(3);
      push(data ?? []);
    }

    // 2. Par nom société (si SIREN n'a rien donné)
    if (!found.length && contact.societe) {
      const { data } = await supabase.from("contacts")
        .select("id, nom, prenom, societe, commune, siren, email, telephone")
        .ilike("societe", `%${contact.societe.substring(0, 10)}%`).limit(3);
      push(data ?? []);
    }

    // 3. Par nom de famille du représentant
    if (!found.length && contact.nom) {
      const { data } = await supabase.from("contacts")
        .select("id, nom, prenom, societe, commune, siren, email, telephone")
        .ilike("nom", `%${contact.nom}%`).limit(3);
      push(data ?? []);
    }

    return found;
  }

  // ── Sauvegarde ─────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!parsed) return;
    if (duplicates.length > 0 && !chosenContact) {
      toast({ title: "Action requise", description: "Choisissez un contact existant ou créez-en un nouveau.", variant: "destructive" });
      return;
    }
    if (!signatureConfirmee) {
      toast({ title: "Confirmation requise", description: "Veuillez confirmer que le document est bien signé.", variant: "destructive" });
      return;
    }

    setStep("saving");
    try {
      // ── Contact ──────────────────────────────────────────────────────────
      let contactId: string | null = null;

      if (chosenContact && chosenContact !== "new") {
        contactId = chosenContact.id;
      } else if (chosenContact === "new" && parsed.contact) {
        const c = parsed.contact;
        // Construit les notes à partir des champs hors schéma
        const notesLines: string[] = [];
        if (c.ville_rcs) notesLines.push(`RCS : ${c.ville_rcs}`);
        if (c.qualite)   notesLines.push(`Qualité : ${c.qualite}`);

        const { data: newContact, error: cErr } = await supabase
          .from("contacts")
          .insert({
            nom: c.nom ?? c.societe ?? "À compléter",
            prenom: c.prenom ?? null,
            email: c.email ?? null,
            telephone: c.telephone, societe: c.societe,
            forme_juridique: c.forme_juridique,
            capital_social: c.capital_social ?? null,
            siren: c.siren ?? null, siret: c.siret ?? null,
            adresse: c.adresse, code_postal: c.code_postal, commune: c.commune,
            notes: notesLines.length ? notesLines.join("\n") : null,
            roles: ["vendeur"],
            user_id: user?.id,
          })
          .select("id").single();
        if (cErr) throw new Error("Erreur création contact : " + cErr.message);
        contactId = newContact.id;
      }

      // ── Mandat ───────────────────────────────────────────────────────────
      let finalMandatId = mandatId;

      const mandatPayload = {
        numero_registre:     parsed.numero_registre    ?? null,
        type_mandat:         parsed.type_mandat        ?? null,
        type_commerce:       parsed.type_commerce      ?? null,
        sous_type:           parsed.sous_type          ?? null,
        adresse:             parsed.adresse            ?? null,
        code_postal:         parsed.code_postal        ?? null,
        commune:             parsed.commune            ?? null,
        prix_demande:        parsed.prix_demande       ?? null,
        honoraires_pct:      parsed.honoraires_pct     ?? null,
        honoraires_montant:  parsed.honoraires_montant ?? null,
        user_id: user?.id,
      };

      if (mode === "list") {
        const ref = `FDC-${Date.now().toString(36).toUpperCase()}`;
        const { data: newMandat, error: mErr } = await supabase
          .from("mandats")
          .insert({ ...mandatPayload, statut: "sur_le_marche", reference: ref })
          .select("id").single();
        if (mErr) throw new Error("Erreur création mandat : " + mErr.message);
        finalMandatId = newMandat.id;

      } else if (mode === "detail" && mandatId) {
        // Enrichit uniquement les champs vides
        const { data: existing } = await supabase.from("mandats").select("*").eq("id", mandatId).single();
        const updatePayload: Record<string, any> = {};
        for (const [key, val] of Object.entries(mandatPayload)) {
          if (val !== null && val !== undefined && !(existing as any)?.[key]) {
            updatePayload[key] = val;
          }
        }
        if (Object.keys(updatePayload).length > 0) {
          const { error: mErr } = await supabase.from("mandats").update(updatePayload).eq("id", mandatId);
          if (mErr) throw new Error("Erreur mise à jour mandat : " + mErr.message);
        }
      }

      // ── Lien mandat_vendeurs ─────────────────────────────────────────────
      if (contactId && finalMandatId) {
        const { data: existing } = await supabase.from("mandat_vendeurs")
          .select("id").eq("mandat_id", finalMandatId).eq("contact_id", contactId).maybeSingle();
        if (!existing) {
          await supabase.from("mandat_vendeurs").insert({ mandat_id: finalMandatId, contact_id: contactId });
        }
      }

      // ── Upload PDF → Storage → mise à jour mandat.documents ─────────────
      if (pdfFile && finalMandatId) {
        const path = `${finalMandatId}/${Date.now()}_${pdfFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("mandats-docs").upload(path, pdfFile, { upsert: true });

        if (!upErr) {
          // Récupère l'URL publique
          const { data: { publicUrl } } = supabase.storage
            .from("mandats-docs").getPublicUrl(path);

          // Construit l'entrée document
          const newDoc = {
            type: "document",
            label: pdfFile.name.replace(/\.pdf$/i, ""),
            url: publicUrl,
            date: new Date().toISOString().split("T")[0],
          };

          // Fusionne avec les documents existants
          const { data: existingMandat } = await supabase
            .from("mandats").select("documents").eq("id", finalMandatId).single();
          const existingDocs: any[] = (existingMandat as any)?.documents ?? [];
          const updatedDocs = [...existingDocs, newDoc];

          await supabase.from("mandats").update({
            documents: updatedDocs,
            document_url: publicUrl,
          }).eq("id", finalMandatId);
        }
      }

      setStep("done");
      toast({
        title: "Import réussi !",
        description: mode === "list"
          ? `Mandat N°${parsed.numero_registre ?? "?"} créé.`
          : "Fiche mandat enrichie.",
      });

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

  // ── Canvalider ? ──────────────────────────────────────────────────────────
  const canSubmit =
    !!parsed &&
    (duplicates.length === 0 || !!chosenContact) &&
    signatureConfirmee;

  // ─── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {mode === "list" ? "Importer un mandat depuis PDF" : "Enrichir la fiche depuis PDF"}
          </DialogTitle>
        </DialogHeader>

        {/* ── UPLOAD ─────────────────────────────────────────────────── */}
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

        {/* ── PARSING ────────────────────────────────────────────────── */}
        {step === "parsing" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Lecture et analyse du PDF en cours…</p>
          </div>
        )}

        {/* ── REVIEW ─────────────────────────────────────────────────── */}
        {step === "review" && parsed && (
          <div className="space-y-4">

            {/* ── Alerte signature (Option C — heuristique) ───────────── */}
            {signatureWarning === "warn" && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-600/40 bg-amber-900/10 p-3">
                <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Signature incomplète possible</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    L'analyse du document ne permet pas de confirmer que <strong>les deux parties ont signé</strong>.
                    Vérifiez visuellement le PDF avant de continuer.
                  </p>
                </div>
              </div>
            )}
            {signatureWarning === "ok" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-700/40 bg-green-900/10 p-3 text-sm text-green-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Signature des deux parties détectée dans le document.
              </div>
            )}

            {/* ── Données mandat ──────────────────────────────────────── */}
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />Mandat extrait
              </p>
              <Row label="N° mandat"        value={parsed.numero_registre} />
              <Row label="Type"             value={parsed.type_mandat} />
              <Row label="Type de commerce" value={parsed.type_commerce} />
              <Row label="Sous-type"        value={parsed.sous_type} />
              <Row label="Adresse"          value={[parsed.adresse, parsed.code_postal, parsed.commune].filter(Boolean).join(" ")} />
              <Row label="Prix demandé"     value={parsed.prix_demande ? `${parsed.prix_demande.toLocaleString("fr-FR")} €` : undefined} />
              <Row label="Honoraires"       value={parsed.honoraires_pct ? `${parsed.honoraires_pct} % HT` : undefined} />
            </div>

            {/* ── Données contact ─────────────────────────────────────── */}
            {parsed.contact && (
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Contact / Mandant
                  {sireneEnriched && (
                    <Badge className="ml-2 text-[9px] bg-green-900/40 text-green-400 border-green-700/30">
                      + enrichi SIRENE
                    </Badge>
                  )}
                </p>
                <Row label="Société"         value={parsed.contact.societe} />
                <Row label="Forme juridique" value={parsed.contact.forme_juridique} />
                <Row label="Capital social"  value={parsed.contact.capital_social != null ? `${Number(parsed.contact.capital_social).toLocaleString("fr-FR")} €` : undefined} />
                <Row label="SIREN"           value={parsed.contact.siren} />
                <Row label="Représentant"    value={[parsed.contact.prenom, parsed.contact.nom].filter(Boolean).join(" ")} />
                <Row label="Qualité"         value={parsed.contact.qualite} />
                <Row label="Téléphone"       value={parsed.contact.telephone} />
                <Row label="Email"           value={parsed.contact.email} />
                <Row label="Adresse siège"   value={[parsed.contact.adresse, parsed.contact.code_postal, parsed.contact.commune].filter(Boolean).join(" ")} />
              </div>
            )}

            {/* ── SIREN / enrichissement SIRENE ──────────────────────── */}
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-primary" />
                SIREN / SIRET — vérification &amp; enrichissement
                {sireneEnriched && <Badge className="ml-1 text-[9px] bg-green-900/40 text-green-400 border-green-700/30">✓ enrichi</Badge>}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="SIREN (9 chiffres) ou SIRET (14 chiffres)"
                  value={sirenInput}
                  onChange={(e) => { setSirenInput(e.target.value); setSireneError(null); }}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleSireneManual}
                  disabled={
                    sireneLoading ||
                    (sirenInput.replace(/\s/g, "").length !== 9 &&
                     sirenInput.replace(/\s/g, "").length !== 14)
                  }
                  className="bg-primary text-primary-foreground shrink-0"
                >
                  {sireneLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Search className="h-3.5 w-3.5 mr-1.5" />Rechercher</>
                  }
                </Button>
              </div>
              {sireneError && (
                <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                  <X className="h-3 w-3" />{sireneError}
                </p>
              )}
              {!sirenInput && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  SIREN non trouvé dans le PDF — saisissez-le manuellement pour enrichir la fiche société.
                </p>
              )}
            </div>

            {/* ── Doublons contact ────────────────────────────────────── */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-amber-600/40 bg-amber-900/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {duplicates.length === 1 ? "Un contact existant pourrait correspondre" : `${duplicates.length} contacts existants pourraient correspondre`}
                </p>

                {duplicates.map((c) => {
                  const isSelected = chosenContact && chosenContact !== "new" && (chosenContact as ExistingContact).id === c.id;
                  return (
                    <div key={c.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${isSelected ? "border-primary/60 bg-primary/10" : "border-border/40 bg-secondary/30"}`}
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
                          className={isSelected ? "bg-primary text-primary-foreground" : ""}
                          onClick={() => setChosenContact(c)}
                        >
                          {isSelected ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Sélectionné</> : "Utiliser ce contact"}
                        </Button>
                      </div>
                    </div>
                  );
                })}

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

            {/* ── Option C : confirmation signature (obligatoire) ──────── */}
            <div className={`rounded-lg border p-4 transition-colors ${signatureConfirmee ? "border-green-700/40 bg-green-900/10" : "border-border/60 bg-secondary/30"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signatureConfirmee}
                  onChange={(e) => setSignatureConfirmee(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-yellow-500 shrink-0"
                />
                <span className="text-sm">
                  <span className="font-medium">Je confirme que ce mandat est signé par les deux parties</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Le mandant (vendeur) ET le mandataire (TBEECOM) ont tous deux apposé leur signature.
                  </span>
                </span>
              </label>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <X className="h-4 w-4 shrink-0" />{errorMsg}
              </div>
            )}

            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleSave} disabled={!canSubmit} className="bg-primary text-primary-foreground">
                {mode === "list" ? "Créer le mandat" : "Enrichir la fiche"}
              </Button>
            </div>
          </div>
        )}

        {/* ── SAVING ─────────────────────────────────────────────────── */}
        {step === "saving" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Enregistrement en cours…</p>
          </div>
        )}

        {/* ── DONE ───────────────────────────────────────────────────── */}
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

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";
import { submitLead, type LeadType } from "@/lib/leads";

interface Props {
  type: LeadType;
  referenceBien?: string;
  extraPayload?: Record<string, any>;
  submitLabel?: string;
  successMessage?: string;
  showMessage?: boolean;
}

export default function LeadForm({
  type, referenceBien, extraPayload,
  submitLabel = "Envoyer",
  successMessage = "Merci, votre message a bien été envoyé.",
  showMessage = true,
}: Props) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rgpd, setRgpd] = useState(false);

  if (done) {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-5 flex gap-3">
        <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">{successMessage}</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!rgpd) { setError("Merci d'accepter la politique de confidentialité."); return; }
    setSending(true);
    try {
      await submitLead({
        type,
        nom: (fd.get("nom") as string) || undefined,
        prenom: (fd.get("prenom") as string) || undefined,
        email: (fd.get("email") as string) || "",
        telephone: (fd.get("telephone") as string) || undefined,
        message: (fd.get("message") as string) || undefined,
        reference_bien: referenceBien,
        payload: extraPayload,
        rgpd_consent: true,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" name="prenom" autoComplete="given-name" />
        </div>
        <div>
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" name="nom" required autoComplete="family-name" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="telephone">Téléphone</Label>
          <Input id="telephone" name="telephone" type="tel" autoComplete="tel" />
        </div>
      </div>
      {showMessage && (
        <div>
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" name="message" rows={4} />
        </div>
      )}
      <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
        <Checkbox checked={rgpd} onCheckedChange={(v) => setRgpd(v === true)} className="mt-0.5" />
        <span>
          J'accepte que mes données soient utilisées par TBEECOM pour traiter ma demande,
          conformément à la <a href="/landingpage/mentions#rgpd" className="underline text-accent">politique RGPD</a>.
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={sending} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
        {sending ? "Envoi…" : submitLabel}
      </Button>
    </form>
  );
}

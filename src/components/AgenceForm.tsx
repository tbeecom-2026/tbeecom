import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2 } from "lucide-react";
import { EMPTY_AGENCE, getAgence, upsertAgence, type AgenceParametres } from "@/lib/agence";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function AgenceForm({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const [f, setF] = useState<AgenceParametres>(EMPTY_AGENCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAgence().then((a) => {
      if (a) setF({ ...EMPTY_AGENCE, ...a });
      setLoading(false);
    });
  }, []);

  const set = (k: keyof AgenceParametres, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    const { error } = await upsertAgence(f);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mon agence", description: "Paramètres enregistrés." });
  }

  if (loading) return <div className="text-sm text-muted-foreground">Chargement…</div>;

  const ro = !canEdit;

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="rounded-md border border-amber-700/40 bg-amber-950/30 p-3 text-xs text-amber-200/80">
          Lecture seule — seul un administrateur peut modifier ces informations.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Identité légale
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Raison sociale"><Input disabled={ro} value={f.raison_sociale ?? ""} onChange={(e) => set("raison_sociale", e.target.value)} /></Field>
          <Field label="Nom commercial"><Input disabled={ro} value={f.nom_commercial ?? ""} onChange={(e) => set("nom_commercial", e.target.value)} /></Field>
          <Field label="Forme juridique"><Input disabled={ro} value={f.forme_juridique ?? ""} onChange={(e) => set("forme_juridique", e.target.value)} /></Field>
          <Field label="Capital social (€)">
            <Input type="number" disabled={ro} value={f.capital ?? ""} onChange={(e) => set("capital", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Siège social">
            <Textarea disabled={ro} rows={2} value={f.siege ?? ""} onChange={(e) => set("siege", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="RCS"><Input disabled={ro} value={f.rcs ?? ""} onChange={(e) => set("rcs", e.target.value)} /></Field>
            <Field label="SIRET"><Input disabled={ro} value={f.siret ?? ""} onChange={(e) => set("siret", e.target.value)} /></Field>
            <Field label="Code APE"><Input disabled={ro} value={f.ape ?? ""} onChange={(e) => set("ape", e.target.value)} /></Field>
            <Field label="TVA intracom."><Input disabled={ro} value={f.tva ?? ""} onChange={(e) => set("tva", e.target.value)} /></Field>
          </div>
          <Field label="Gérant(e)"><Input disabled={ro} value={f.gerant_nom ?? ""} onChange={(e) => set("gerant_nom", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carte T &amp; assurances</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="N° Carte T (CPI)"><Input disabled={ro} value={f.carte_t_numero ?? ""} onChange={(e) => set("carte_t_numero", e.target.value)} /></Field>
          <Field label="CCI délivrante"><Input disabled={ro} value={f.carte_t_cci ?? ""} onChange={(e) => set("carte_t_cci", e.target.value)} /></Field>
          <Field label="RC Pro — Assureur"><Input disabled={ro} value={f.rcp_assureur ?? ""} onChange={(e) => set("rcp_assureur", e.target.value)} /></Field>
          <Field label="RC Pro — N° contrat"><Input disabled={ro} value={f.rcp_contrat ?? ""} onChange={(e) => set("rcp_contrat", e.target.value)} /></Field>
          <Field label="RC Pro — Courtier"><Input disabled={ro} value={f.rcp_courtier ?? ""} onChange={(e) => set("rcp_courtier", e.target.value)} /></Field>
          <Field label="RC Pro — Couverture"><Input disabled={ro} value={f.rcp_couverture ?? ""} onChange={(e) => set("rcp_couverture", e.target.value)} /></Field>
          <div className="md:col-span-2 flex items-center gap-3 rounded-md border border-border p-3">
            <Switch
              disabled={ro}
              checked={!!f.sans_maniement_fonds}
              onCheckedChange={(v) => set("sans_maniement_fonds", v)}
            />
            <div className="text-sm">
              <div className="font-medium">Sans maniement de fonds</div>
              <div className="text-xs text-muted-foreground">
                Si activé, mention « ne pouvant ni recevoir ni détenir d'autres fonds que ceux représentatifs de sa rémunération ».
                Sinon, indiquer la garantie financière ci-dessous.
              </div>
            </div>
          </div>
          <Field label="Garantie financière (si maniement de fonds)">
            <Input disabled={ro || !!f.sans_maniement_fonds} value={f.garantie_financiere ?? ""} onChange={(e) => set("garantie_financiere", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement…" : "Enregistrer Mon agence"}
          </Button>
        </div>
      )}
    </div>
  );
}

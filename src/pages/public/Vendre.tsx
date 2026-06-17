import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeadForm from "@/components/public/LeadForm";
import { TYPES_COMMERCE } from "@/lib/formatters";

const STEPS = ["Votre commerce", "Activité & chiffres", "Vos coordonnées"];

export default function Vendre() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setData(d => ({ ...d, [k]: v }));

  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-3xl sm:text-4xl">Vendre votre commerce</h1>
          <p className="mt-2 text-primary-foreground/80 max-w-2xl">
            Une estimation gratuite, confidentielle et sans engagement. Quelques minutes suffisent.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <ol className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1 flex items-center gap-2">
              <span className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= step ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              }`}>{i + 1}</span>
              <span className={`text-xs hidden sm:inline ${i === step ? "text-primary font-medium" : "text-muted-foreground"}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="flex-1 h-px bg-border" />}
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl text-primary">Parlez-nous de votre commerce</h2>
              <div>
                <Label>Type de commerce</Label>
                <Select value={data.type_commerce ?? ""} onValueChange={v => set("type_commerce", v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                  <SelectContent>
                    {TYPES_COMMERCE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Ville</Label>
                  <Input value={data.commune ?? ""} onChange={e => set("commune", e.target.value)} />
                </div>
                <div>
                  <Label>Code postal</Label>
                  <Input value={data.code_postal ?? ""} onChange={e => set("code_postal", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Surface commerciale (m²)</Label>
                <Input type="number" value={data.surface ?? ""} onChange={e => set("surface", e.target.value)} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl text-primary">Activité & chiffres</h2>
              <div>
                <Label>Nature de l'activité</Label>
                <Input value={data.nature_activite ?? ""} onChange={e => set("nature_activite", e.target.value)} placeholder="Ex. Restauration traditionnelle" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>CA annuel (€)</Label>
                  <Input type="number" value={data.ca_annuel ?? ""} onChange={e => set("ca_annuel", e.target.value)} />
                </div>
                <div>
                  <Label>Loyer mensuel (€)</Label>
                  <Input type="number" value={data.loyer ?? ""} onChange={e => set("loyer", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Raison de la vente (optionnel)</Label>
                <Textarea value={data.raison ?? ""} onChange={e => set("raison", e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl text-primary">Vos coordonnées</h2>
              <p className="text-sm text-muted-foreground">
                Nous vous recontactons sous 48h ouvrées avec une première analyse confidentielle.
              </p>
              <LeadForm
                type="vendre"
                extraPayload={data}
                submitLabel="Demander mon estimation"
                successMessage="Votre demande d'estimation est enregistrée. Nous vous recontactons sous 48h."
              />
            </div>
          )}
        </div>

        {step < 2 && (
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
            </Button>
            <Button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Continuer <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

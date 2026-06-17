import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeadForm from "@/components/public/LeadForm";
import { TYPES_COMMERCE } from "@/lib/formatters";

export default function Acheter() {
  const [data, setData] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setData(d => ({ ...d, [k]: v }));

  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-3xl sm:text-4xl">Créer une alerte acquéreur</h1>
          <p className="mt-2 text-primary-foreground/80 max-w-2xl">
            Recevez en avant-première les opportunités correspondant à vos critères.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 grid gap-6">
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl text-primary">Vos critères de recherche</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Type de commerce recherché</Label>
              <Select value={data.type_commerce ?? ""} onValueChange={v => set("type_commerce", v)}>
                <SelectTrigger><SelectValue placeholder="Tous types" /></SelectTrigger>
                <SelectContent>
                  {TYPES_COMMERCE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Secteur / ville</Label>
              <Input value={data.zone ?? ""} onChange={e => set("zone", e.target.value)} placeholder="Ex. Paris 11, Lille…" />
            </div>
            <div>
              <Label>Budget max (€)</Label>
              <Input type="number" value={data.budget_max ?? ""} onChange={e => set("budget_max", e.target.value)} />
            </div>
            <div>
              <Label>Apport disponible (€)</Label>
              <Input type="number" value={data.apport ?? ""} onChange={e => set("apport", e.target.value)} />
            </div>
            <div>
              <Label>Surface minimum (m²)</Label>
              <Input type="number" value={data.surface_min ?? ""} onChange={e => set("surface_min", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl text-primary">Vos coordonnées</h2>
          <p className="mt-1 text-sm text-muted-foreground">Vous recevrez les nouvelles annonces dès leur mise en ligne.</p>
          <div className="mt-5">
            <LeadForm
              type="acheter"
              extraPayload={data}
              submitLabel="Créer mon alerte"
              successMessage="Votre alerte est créée. Vous recevrez nos prochaines opportunités par email."
            />
          </div>
        </div>
      </section>
    </>
  );
}

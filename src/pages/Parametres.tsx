import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Info, Percent, Euro } from "lucide-react";
import { formatEuros } from "@/lib/formatters";
import type { BaremeTranche } from "@/lib/honoraires";

export default function Parametres() {
  const { toast } = useToast();
  const [tranches, setTranches] = useState<BaremeTranche[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("bareme_honoraires")
      .select("*")
      .eq("type_trans", "fdc")
      .order("ordre");
    setTranches((data as BaremeTranche[]) ?? []);
  }

  function updateTranche(id: string, field: keyof BaremeTranche, value: any) {
    setTranches((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  }

  async function handleSave() {
    setSaving(true);
    for (const t of tranches) {
      const { error } = await supabase
        .from("bareme_honoraires")
        .update({
          prix_min:    t.prix_min,
          prix_max:    t.prix_max,
          type_calcul: t.type_calcul,
          valeur:      t.valeur,
          libelle:     t.libelle,
        })
        .eq("id", t.id);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    toast({ title: "Barème mis à jour", description: "Les nouveaux taux sont actifs immédiatement." });
    setSaving(false);
  }

  // Aperçu : calcul sur quelques prix types
  const PRIX_EXEMPLES = [25000, 60000, 150000, 300000, 600000, 1000000];

  function simuler(prix: number): string {
    for (const t of tranches) {
      const dansMin = t.prix_min == null || prix >= t.prix_min;
      const dansMax = t.prix_max == null || prix <= t.prix_max;
      if (dansMin && dansMax) {
        if (t.type_calcul === "forfait") return `${formatEuros(t.valeur)} HT (forfait)`;
        return `${formatEuros(Math.round(prix * t.valeur / 100))} HT (${t.valeur}%)`;
      }
    }
    return "—";
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Barème des honoraires — Cession de fonds de commerce
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      {/* Info légale */}
      <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/40 rounded-lg p-4 text-sm text-amber-200/80">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p>
          Les prix ci-dessous doivent être effectivement appliqués dans une majorité des transactions.
          Il est possible d'y déroger <strong>seulement à la baisse</strong> pour des affaires particulières
          et dans les limites proches des conditions pratiquées.
          <span className="block mt-1 text-xs opacity-70">Note DGCCRF — Arrêté du 10/01/2017 — Honoraires à la charge de l'acquéreur.</span>
        </p>
      </div>

      {/* Tableau du barème */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Euro className="h-4 w-4 text-primary" />
            Barème FDC — Tranches de prix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Prix min (€)</th>
                  <th className="pb-3 pr-4">Prix max (€)</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Valeur</th>
                  <th className="pb-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tranches.map((t) => (
                  <tr key={t.id} className="hover:bg-secondary/20">
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="text-xs">{t.ordre}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Input
                        type="number"
                        value={t.prix_min ?? ""}
                        placeholder="—"
                        className="h-8 w-32 text-xs"
                        onChange={(e) => updateTranche(t.id, "prix_min", e.target.value ? Number(e.target.value) : null)}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <Input
                        type="number"
                        value={t.prix_max ?? ""}
                        placeholder="illimité"
                        className="h-8 w-32 text-xs"
                        onChange={(e) => updateTranche(t.id, "prix_max", e.target.value ? Number(e.target.value) : null)}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <Select
                        value={t.type_calcul}
                        onValueChange={(v) => updateTranche(t.id, "type_calcul", v)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="forfait">Forfait €</SelectItem>
                          <SelectItem value="pourcentage">Pourcentage %</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="relative">
                        <Input
                          type="number"
                          value={t.valeur}
                          className="h-8 w-24 text-xs pr-8"
                          onChange={(e) => updateTranche(t.id, "valeur", Number(e.target.value))}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {t.type_calcul === "pourcentage" ? "%" : "€"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <Input
                        value={t.libelle ?? ""}
                        placeholder="Description de la tranche"
                        className="h-8 text-xs"
                        onChange={(e) => updateTranche(t.id, "libelle", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Simulateur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Simulateur — Honoraires calculés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PRIX_EXEMPLES.map((prix) => (
              <div key={prix} className="bg-secondary/40 rounded-lg p-3 text-sm">
                <div className="text-muted-foreground text-xs mb-1">Prix de vente</div>
                <div className="font-semibold text-primary">{formatEuros(prix)}</div>
                <div className="text-xs mt-1.5 font-medium">{simuler(prix)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Le simulateur se met à jour en temps réel quand vous modifiez les tranches ci-dessus.
            Cliquez "Enregistrer" pour appliquer les modifications à tous les nouveaux mandats.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

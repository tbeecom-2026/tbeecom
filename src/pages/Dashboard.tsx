import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, Users, CheckCircle } from "lucide-react";
import { formatEuros, formatDate, getStatutBadge, TYPES_COMMERCE } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Mandat } from "@/types/database";

// --- Helpers "mandat vivant" (même logique que mandatStatus.ts : fin par date) ---
function toMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
// Fin effective d'un mandat : date_fin si renseignée, sinon date_debut + 18 mois.
function finEffective(m: { mandat_date_fin?: string | null; mandat_date_debut?: string | null }): Date | null {
  if (m.mandat_date_fin) {
    const f = new Date(m.mandat_date_fin);
    if (!isNaN(f.getTime())) return toMidnight(f);
  }
  if (m.mandat_date_debut) {
    const d = new Date(m.mandat_date_debut);
    if (!isNaN(d.getTime())) return toMidnight(addMonths(d, 18));
  }
  return null; // aucune date connue
}

export default function Dashboard() {
  const [mandatsActifs, setMandatsActifs] = useState(0);
  const [caPotentiel, setCaPotentiel] = useState(0);
  const [acquereursActifs, setAcquereursActifs] = useState(0);
  const [vendus, setVendus] = useState(0);
  const [derniersMandats, setDerniersMandats] = useState<Mandat[]>([]);
  const [chartData, setChartData] = useState<{ type: string; count: number }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const now = new Date();
    const today = toMidnight(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ data: surLeMarche }, { count: acquereurs }, { count: vendusMois }, { data: derniers }] = await Promise.all(
      [
        // On récupère les biens "sur le marché" AVEC leurs dates + honoraires pour filtrer/calculer côté client.
        supabase
          .from("mandats")
          .select("mandat_date_debut, mandat_date_fin, honoraires_montant, type_commerce")
          .eq("statut", "sur_le_marche"),
        supabase.from("recherches").select("*", { count: "exact", head: true }).eq("statut", "actif"),
        supabase
          .from("mandats")
          .select("*", { count: "exact", head: true })
          .eq("statut", "vendu")
          .gte("date_vendu", startOfMonth),
        supabase.from("mandats").select("*").order("created_at", { ascending: false }).limit(5),
      ],
    );

    // Ne garder que les mandats VIVANTS : fin effective >= aujourd'hui (ou aucune date connue).
    const vivants = (surLeMarche ?? []).filter((m) => {
      const fin = finEffective(m as any);
      return fin == null ? true : fin.getTime() >= today.getTime();
    });

    setMandatsActifs(vivants.length);
    // CA potentiel = somme des honoraires (commissions HT) des mandats vivants — PAS le prix des biens.
    setCaPotentiel(vivants.reduce((s, m: any) => s + (m.honoraires_montant ?? 0), 0));
    setAcquereursActifs(acquereurs ?? 0);
    setVendus(vendusMois ?? 0);
    setDerniersMandats((derniers as Mandat[]) ?? []);

    // Répartition par type de commerce : sur le périmètre des mandats vivants.
    const typeCounts: Record<string, number> = {};
    TYPES_COMMERCE.forEach((t) => (typeCounts[t] = 0));
    vivants.forEach((m: any) => {
      const t = m.type_commerce || "Autres";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    });
    setChartData(Object.entries(typeCounts).map(([type, count]) => ({ type, count })));
  }

  const kpis = [
    { label: "Mandats en cours", value: mandatsActifs, icon: FileText, fmt: (v: number) => String(v) },
    { label: "CA potentiel (honoraires)", value: caPotentiel, icon: DollarSign, fmt: formatEuros },
    { label: "Acquéreurs actifs", value: acquereursActifs, icon: Users, fmt: (v: number) => String(v) },
    { label: "Vendus ce mois", value: vendus, icon: CheckCircle, fmt: (v: number) => String(v) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">{kpi.fmt(kpi.value)}</p>
                </div>
                <kpi.icon className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mandats par type de commerce</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 20%, 27%)" />
                <XAxis
                  dataKey="type"
                  tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: "hsl(215, 20%, 65%)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(217, 33%, 17%)",
                    border: "1px solid hsl(217, 20%, 27%)",
                    color: "hsl(210, 40%, 96%)",
                  }}
                />
                <Bar dataKey="count" fill="hsl(43, 52%, 54%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Derniers mandats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Référence</th>
                  <th className="pb-2 pr-4">Commune</th>
                  <th className="pb-2 pr-4">Prix</th>
                  <th className="pb-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {derniersMandats.map((m) => {
                  const badge = getStatutBadge(m.statut);
                  return (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/50">
                      <td className="py-2 pr-4">
                        <Link to={`/mandats/${m.id}`} className="text-primary hover:underline">
                          {m.reference}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{m.commune}</td>
                      <td className="py-2 pr-4">{formatEuros(m.prix_demande)}</td>
                      <td className="py-2">
                        <Badge className={badge.color}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {derniersMandats.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Aucun mandat
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

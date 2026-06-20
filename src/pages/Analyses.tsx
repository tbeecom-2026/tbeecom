import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, MapPin, PieChart as PieIcon, TrendingUp } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import {
  parZone, parMois, parActivite, libelleZone,
  EVT_LABEL, type EvtType, type LigneZone, type LigneMois, type LigneActivite,
} from "@/lib/analyses";

const DEPARTEMENTS = [
  { code: "", label: "Toute la France" },
  { code: "75", label: "Paris (75)" },
  { code: "92", label: "Hauts-de-Seine (92)" },
  { code: "93", label: "Seine-Saint-Denis (93)" },
  { code: "94", label: "Val-de-Marne (94)" },
  { code: "91", label: "Essonne (91)" },
  { code: "95", label: "Val-d'Oise (95)" },
  { code: "78", label: "Yvelines (78)" },
  { code: "77", label: "Seine-et-Marne (77)" },
];
const PERIODES = [
  { v: 6, label: "6 mois" },
  { v: 12, label: "12 mois" },
  { v: 24, label: "24 mois" },
];
const COULEURS = ["#D2963C", "#42546C", "#2F855A", "#DD6B20", "#805AD5", "#319795", "#C53030", "#718096"];

const fmtZone = (z: string) => (z.length === 2 ? `Dépt ${z}` : libelleZone(z));

export default function Analyses() {
  const [type, setType] = useState<EvtType>("cession");
  const [dep, setDep] = useState<string>("75");
  const [mois, setMois] = useState<number>(12);

  const [zones, setZones] = useState<LigneZone[]>([]);
  const [serie, setSerie] = useState<LigneMois[]>([]);
  const [activite, setActivite] = useState<{ repartition: LigneActivite[]; renseignes: number; echantillon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setErreur(null);
    const zone = dep ? { departement: dep } : {};
    Promise.all([parZone(type, zone, mois, 15), parMois(type, zone, mois), parActivite(type, zone, mois)])
      .then(([z, s, a]) => {
        if (annule) return;
        setZones(z);
        setSerie(s);
        setActivite(a);
      })
      .catch((e) => !annule && setErreur(e?.message ?? "BODACC indisponible"))
      .finally(() => !annule && setLoading(false));
    return () => { annule = true; };
  }, [type, dep, mois]);

  const depLabel = DEPARTEMENTS.find((d) => d.code === dep)?.label ?? "France";
  const totalSerie = useMemo(() => serie.reduce((s, m) => s + m.nb, 0), [serie]);
  const topZone = zones[0];
  const topActivite = activite?.repartition[0];
  const totalActivite = useMemo(() => (activite?.repartition ?? []).reduce((s, r) => s + r.nb, 0), [activite]);

  const tendance = useMemo(() => {
    if (serie.length < 4) return null;
    const recent = serie.slice(-3).reduce((s, m) => s + m.nb, 0);
    const avant = serie.slice(-6, -3).reduce((s, m) => s + m.nb, 0);
    if (!avant) return null;
    const pct = Math.round(((recent - avant) / avant) * 100);
    return pct;
  }, [serie]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Analyses de marché
        </h1>
        <p className="text-sm text-muted-foreground">
          Ce que disent les données publiques (BODACC) : <b>{EVT_LABEL[type]}</b> · <b>{depLabel}</b> · <b>{mois} derniers mois</b>.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <Selecteur label="Que regarde-t-on ?" value={type} onChange={(v) => setType(v as EvtType)}
          options={[
            { v: "cession", label: "Cessions de fonds" },
            { v: "creation", label: "Créations d'entreprises" },
            { v: "difficulte", label: "Procédures collectives" },
          ]} />
        <Selecteur label="Zone" value={dep} onChange={setDep}
          options={DEPARTEMENTS.map((d) => ({ v: d.code, label: d.label }))} />
        <Selecteur label="Période" value={String(mois)} onChange={(v) => setMois(Number(v))}
          options={PERIODES.map((p) => ({ v: String(p.v), label: p.label }))} />
      </div>

      {erreur && (
        <div className="text-sm text-muted-foreground border border-border rounded p-3">
          BODACC momentanément indisponible — {erreur}
        </div>
      )}

      {/* Chiffres clés */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard titre="Total sur la période" valeur={loading ? null : totalSerie.toLocaleString("fr-FR")}
          sous={EVT_LABEL[type].toLowerCase()} />
        <KpiCard titre="Zone la plus active" valeur={loading ? null : topZone ? fmtZone(topZone.zone) : "—"}
          sous={topZone ? `${topZone.nb.toLocaleString("fr-FR")} sur la période` : ""} icone={<MapPin className="h-5 w-5" />} />
        <KpiCard titre="Activité dominante" valeur={loading ? null : topActivite ? topActivite.label : "—"}
          sous={topActivite && totalActivite ? `${Math.round((topActivite.nb / totalActivite) * 100)} % des activités connues` : ""}
          icone={<PieIcon className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Camembert : répartition par activité */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-5 w-5 text-primary" /> Répartition par activité
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {topActivite && totalActivite
                ? `${topActivite.label} domine (${Math.round((topActivite.nb / totalActivite) * 100)} %).`
                : "Répartition des activités."}
              {activite ? ` Sur ${activite.renseignes} annonces dont l'activité est renseignée.` : ""}
            </p>
          </CardHeader>
          <CardContent>
            {loading || !activite ? (
              <Skeleton className="h-72 w-full" />
            ) : activite.repartition.length === 0 ? (
              <Vide />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={activite.repartition}
                    dataKey="nb"
                    nameKey="label"
                    cx="50%" cy="50%"
                    outerRadius={105}
                    label={(e: any) => `${e.label} ${Math.round((e.nb / totalActivite) * 100)}%`}
                    labelLine={false}
                  >
                    {activite.repartition.map((_, i) => (
                      <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, n: any) => [`${v} (${Math.round((Number(v) / totalActivite) * 100)}%)`, n]}
                    contentStyle={{ backgroundColor: "hsl(217,33%,17%)", border: "1px solid hsl(217,20%,27%)", color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Classement par zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-5 w-5 text-primary" /> Où ça bouge le plus
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {dep ? "Classement par arrondissement / code postal." : "Classement par département."}
              {topZone ? ` En tête : ${fmtZone(topZone.zone)}.` : ""}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : zones.length === 0 ? (
              <Vide />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={zones.slice(0, 10).map((z) => ({ zone: fmtZone(z.zone), nb: z.nb }))} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,20%,27%)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="zone" width={90} tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217,33%,17%)", border: "1px solid hsl(217,20%,27%)", color: "#fff" }} />
                  <Bar dataKey="nb" fill="#D2963C" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="nb" position="right" fill="hsl(215,20%,75%)" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tendance mensuelle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" /> Évolution mois par mois
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {tendance != null
              ? `Tendance récente : ${tendance >= 0 ? "+" : ""}${tendance} % sur les 3 derniers mois vs les 3 précédents.`
              : "Évolution sur la période."}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,20%,27%)" />
                <XAxis dataKey="mois" tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217,33%,17%)", border: "1px solid hsl(217,20%,27%)", color: "#fff" }} />
                <Line type="monotone" dataKey="nb" stroke="#D2963C" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Source : BODACC (données publiques). Le dernier mois est souvent partiel (publications en cours).
        La répartition par activité est calculée sur un échantillon des annonces récentes dont l'activité est renseignée.
      </p>
    </div>
  );
}

function Selecteur({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground min-w-[180px]"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function KpiCard({ titre, valeur, sous, icone }: { titre: string; valeur: string | null; sous?: string; icone?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{titre}</p>
            {valeur == null ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1">{valeur}</p>}
            {sous && <p className="text-xs text-muted-foreground mt-0.5">{sous}</p>}
          </div>
          {icone && <div className="text-primary opacity-80">{icone}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Vide() {
  return <div className="py-12 text-center text-sm text-muted-foreground">Aucune donnée sur cette sélection.</div>;
}

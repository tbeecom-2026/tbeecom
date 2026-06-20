import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  MapPin,
  PieChart as PieIcon,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  parZone,
  parRepartition,
  parMoisMulti,
  libelleZone,
  EVT_LABEL,
  type EvtType,
  type LigneZone,
  type SecteurCount,
  type LigneMoisMulti,
} from "@/lib/analyses";
import { METIER_LABEL, type FamilleMetier } from "@/lib/metier";

// Métiers proposés au filtre (ceux pour lesquels metier.ts a des mots-clés fiables).
const FAMILLES_F: FamilleMetier[] = [
  "restauration_assise",
  "restauration_rapide",
  "bar_cafe_tabac",
  "boulangerie_patisserie",
  "fleuriste",
  "coiffure_esthetique",
  "garage_carrosserie",
];

const DEPARTEMENTS = [
  { code: "idf", label: "Toute l'Île-de-France" },
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
  { v: 12, label: "1 an" },
  { v: 24, label: "2 ans" },
];
const COULEURS = [
  "#D2963C",
  "#42546C",
  "#2F855A",
  "#DD6B20",
  "#805AD5",
  "#319795",
  "#C53030",
  "#D69E2E",
  "#38A169",
  "#3182CE",
  "#9F7AEA",
  "#718096",
];

const fmtZone = (z: string) => (z.length === 2 ? `Dépt ${z}` : libelleZone(z));

// Tendance sur la période (ignore le dernier mois, souvent partiel)
function tendance(vals: number[]): { pct: number; sens: "hausse" | "baisse" | "stable" } | null {
  const v = vals.slice(0, -1);
  if (v.length < 4) return null;
  const h = Math.ceil(v.length / 2);
  const recent = v.slice(-h).reduce((a, b) => a + b, 0);
  const avant = v.slice(0, v.length - h).reduce((a, b) => a + b, 0) || 1;
  const pct = Math.round(((recent - avant) / avant) * 100);
  return { pct, sens: Math.abs(pct) < 8 ? "stable" : pct > 0 ? "hausse" : "baisse" };
}

export default function Analyses() {
  const [type, setType] = useState<EvtType>("cession");
  const [dep, setDep] = useState<string>("75");
  const [mois, setMois] = useState<number>(12);
  const [famille, setFamille] = useState<string>(""); // "" = tous métiers

  const [zones, setZones] = useState<LigneZone[]>([]);
  const [serie, setSerie] = useState<LigneMoisMulti[]>([]);
  const [repart, setRepart] = useState<{ secteurs: SecteurCount[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setErreur(null);
    const zone = dep ? { departement: dep } : {};
    const fam = (famille || undefined) as FamilleMetier | undefined;
    // Le camembert "par secteur" n'a de sens que tous métiers confondus :
    // si un métier est sélectionné, on ne le calcule pas (économie de requêtes).
    const repP = fam ? Promise.resolve(null) : parRepartition(type, zone, mois);
    Promise.all([parZone(type, zone, mois, 15, fam), parMoisMulti(zone, mois, fam), repP])
      .then(([z, s, r]) => {
        if (annule) return;
        setZones(z);
        setSerie(s);
        setRepart(r);
      })
      .catch((e) => !annule && setErreur(e?.message ?? "BODACC indisponible"))
      .finally(() => !annule && setLoading(false));
    return () => {
      annule = true;
    };
  }, [type, dep, mois, famille]);

  const depLabel = DEPARTEMENTS.find((d) => d.code === dep)?.label ?? "France";
  const periodeLabel = PERIODES.find((p) => p.v === mois)?.label ?? `${mois} mois`;
  const familleLabel = famille ? METIER_LABEL[famille as FamilleMetier] : "Tous métiers";
  const cleType: "cession" | "creation" | "difficulte" = type;
  const totalType = useMemo(() => serie.reduce((s, m) => s + m[cleType], 0), [serie, cleType]);
  const topZone = zones[0];
  const totalRepart = repart?.total ?? 0;
  const topSecteur = repart?.secteurs.find((s) => s.label !== "Autre commerce") ?? repart?.secteurs[0];

  const tend = useMemo(
    () => ({
      cession: tendance(serie.map((m) => m.cession)),
      creation: tendance(serie.map((m) => m.creation)),
      difficulte: tendance(serie.map((m) => m.difficulte)),
    }),
    [serie],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Analyses de marché
        </h1>
        <p className="text-sm text-muted-foreground">
          Données publiques (BODACC) : <b>{EVT_LABEL[type]}</b> · <b>{depLabel}</b> · <b>{periodeLabel}</b> ·{" "}
          <b>{familleLabel}</b>.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Selecteur
          label="Que regarde-t-on ?"
          value={type}
          onChange={(v) => setType(v as EvtType)}
          options={[
            { v: "cession", label: "Cessions de fonds" },
            { v: "creation", label: "Créations d'entreprises" },
            { v: "difficulte", label: "Procédures collectives" },
          ]}
        />
        <Selecteur
          label="Zone"
          value={dep}
          onChange={setDep}
          options={DEPARTEMENTS.map((d) => ({ v: d.code, label: d.label }))}
        />
        <Selecteur
          label="Période"
          value={String(mois)}
          onChange={(v) => setMois(Number(v))}
          options={PERIODES.map((p) => ({ v: String(p.v), label: p.label }))}
        />
        <Selecteur
          label="Métier"
          value={famille}
          onChange={setFamille}
          options={[{ v: "", label: "Tous les métiers" }, ...FAMILLES_F.map((f) => ({ v: f, label: METIER_LABEL[f] }))]}
        />
      </div>

      {erreur && (
        <div className="text-sm text-muted-foreground border border-border rounded p-3">
          BODACC momentanément indisponible — {erreur}
        </div>
      )}

      {/* Verdicts de tendance — l'œil comprend en 1 seconde */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TendanceCard titre="Cessions de fonds" t={tend.cession} loading={loading} />
        <TendanceCard titre="Créations d'entreprises" t={tend.creation} loading={loading} />
        <TendanceCard titre="Procédures collectives" t={tend.difficulte} loading={loading} />
      </div>

      {/* Évolution comparée des 3 signaux */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" /> Évolution sur {periodeLabel} — {depLabel}
            {famille ? ` · ${familleLabel}` : ""}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Les 3 signaux mois par mois. Créations sur l'échelle de droite (bien plus nombreuses) ; cessions et
            difficultés sur la gauche.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={serie} margin={{ right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,20%,27%)" />
                <XAxis dataKey="mois" tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(217,33%,17%)",
                    border: "1px solid hsl(217,20%,27%)",
                    color: "#fff",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cession"
                  name="Cessions"
                  stroke="#D2963C"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="difficulte"
                  name="Difficultés"
                  stroke="#C53030"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="creation"
                  name="Créations (éch. droite)"
                  stroke="#42546C"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Camembert : répartition par secteur (comptage exact par mots-clés) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-5 w-5 text-primary" /> Répartition par secteur
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {famille ? (
                "Choisissez « Tous les métiers » pour voir la répartition par secteur."
              ) : (
                <>
                  {EVT_LABEL[type]}
                  {topSecteur && totalRepart
                    ? ` — ${topSecteur.label} en tête (${Math.round((topSecteur.nb / totalRepart) * 100)} %).`
                    : "."}
                  {repart ? ` ${totalRepart.toLocaleString("fr-FR")} annonces sur la période.` : ""}
                </>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {famille ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Filtre métier actif ({familleLabel}). Le camembert par secteur s'affiche quand aucun métier n'est
                sélectionné.
              </div>
            ) : loading || !repart ? (
              <Skeleton className="h-80 w-full" />
            ) : repart.secteurs.length === 0 ? (
              <Vide />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={repart.secteurs}
                    dataKey="nb"
                    nameKey="label"
                    cx="50%"
                    cy="45%"
                    outerRadius={95}
                    labelLine={false}
                    label={(e: any) => {
                      const pct = e.percent ? Math.round(e.percent * 100) : 0;
                      if (pct < 5) return "";
                      const RAD = Math.PI / 180;
                      const r = e.innerRadius + (e.outerRadius - e.innerRadius) * 0.55;
                      const x = e.cx + r * Math.cos(-e.midAngle * RAD);
                      const y = e.cy + r * Math.sin(-e.midAngle * RAD);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="#fff"
                          fontSize={13}
                          fontWeight={700}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {pct}%
                        </text>
                      );
                    }}
                  >
                    {repart.secteurs.map((s, i) => (
                      <Cell key={i} fill={s.label === "Autre commerce" ? "#718096" : COULEURS[i % COULEURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, n: any) => [
                      `${Number(v).toLocaleString("fr-FR")} (${Math.round((Number(v) / (totalRepart || 1)) * 100)}%)`,
                      n,
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(217,33%,17%)",
                      border: "1px solid hsl(217,20%,27%)",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
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
              {EVT_LABEL[type]}
              {famille ? ` · ${familleLabel}` : ""} —{" "}
              {dep && dep !== "idf" ? "par arrondissement / code postal" : "par département"}
              {topZone ? `. En tête : ${fmtZone(topZone.zone)}.` : "."}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-80 w-full" />
            ) : zones.length === 0 ? (
              <Vide />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={zones.slice(0, 10).map((z) => ({ zone: fmtZone(z.zone), nb: z.nb }))}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,20%,27%)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="zone" width={95} tick={{ fill: "hsl(215,20%,65%)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(217,33%,17%)",
                      border: "1px solid hsl(217,20%,27%)",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="nb" fill="#D2963C" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="nb" position="right" fill="hsl(215,20%,75%)" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Source : BODACC (données publiques). Le dernier mois est souvent partiel (publications en cours) et n'est pas
        compté dans la tendance. La répartition par secteur est un comptage par mots-clés d'activité (« Autre commerce »
        = annonces non rattachées à un secteur listé).
      </p>
    </div>
  );
}

function Selecteur({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground min-w-[180px]"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TendanceCard({
  titre,
  t,
  loading,
}: {
  titre: string;
  t: { pct: number; sens: "hausse" | "baisse" | "stable" } | null;
  loading: boolean;
}) {
  const conf = {
    hausse: { Icone: ArrowUpRight, txt: "En hausse", col: "#2F855A" },
    baisse: { Icone: ArrowDownRight, txt: "En baisse", col: "#C53030" },
    stable: { Icone: ArrowRight, txt: "Stable", col: "#A0AEC0" },
  };
  const c = t ? conf[t.sens] : null;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{titre}</p>
        {loading || !t || !c ? (
          <Skeleton className="h-7 w-28 mt-1" />
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <c.Icone className="h-5 w-5" style={{ color: c.col }} />
            <span className="text-lg font-bold" style={{ color: c.col }}>
              {c.txt}
            </span>
            <span className="text-sm text-muted-foreground">
              {t.pct >= 0 ? "+" : ""}
              {t.pct} %
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Vide() {
  return <div className="py-12 text-center text-sm text-muted-foreground">Aucune donnée sur cette sélection.</div>;
}

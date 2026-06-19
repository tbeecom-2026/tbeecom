import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calculator,
  Loader2,
  ExternalLink,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { METIER_LABEL, type FamilleMetier } from "@/lib/metier";
import {
  estimationFonds,
  genererAvisValeurHtml,
  type Estimation,
  type ZoneEstim,
} from "@/lib/avisValeur";
import { getAgence } from "@/lib/agence";
import { openMandat } from "@/lib/generateMandat";

const FAMILLES: FamilleMetier[] = [
  "restauration_assise",
  "restauration_rapide",
  "bar_cafe_tabac",
  "boulangerie_patisserie",
  "fleuriste",
  "coiffure_esthetique",
  "garage_carrosserie",
  "autre",
];

const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);

const fiabBadge: Record<Estimation["fiabilite"], string> = {
  faible: "bg-red-700 text-white",
  moyenne: "bg-amber-600 text-white",
  bonne: "bg-emerald-700 text-white",
};

export default function Estimation() {
  const [params] = useSearchParams();

  const [famille, setFamille] = useState<FamilleMetier>(
    (params.get("famille") as FamilleMetier) || "restauration_assise",
  );
  const [adresseInput, setAdresseInput] = useState(params.get("adresse") ?? "");
  const [niveau, setNiveau] = useState<"cp" | "dep">(
    params.get("departement") && !params.get("codePostal") ? "dep" : "cp",
  );
  const [codePostal, setCodePostal] = useState(params.get("codePostal") ?? "");
  const [departement, setDepartement] = useState(params.get("departement") ?? "");
  const [ca, setCa] = useState<string>(params.get("ca") ?? "");
  const [moisRetour, setMoisRetour] = useState<number>(24);

  const enseigne = params.get("enseigne") ?? "";

  const [loading, setLoading] = useState(false);
  const [est, setEst] = useState<Estimation | null>(null);

  // Auto-estimer si l'URL contient déjà adresse ou zone
  useEffect(() => {
    if ((adresseInput.trim() || codePostal || departement) && !est) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    const adr = adresseInput.trim();
    if (!adr) {
      if (niveau === "cp" && !codePostal.trim()) {
        toast.error("Renseigne une adresse ou un code postal");
        return;
      }
      if (niveau === "dep" && !departement.trim()) {
        toast.error("Renseigne une adresse ou un département");
        return;
      }
    }
    setLoading(true);
    try {
      const caNum = ca.trim() ? Number(ca.replace(/\s/g, "").replace(",", ".")) : null;
      const caFinal = caNum && caNum > 0 ? caNum : null;
      let res: Estimation;
      if (adr) {
        res = await estimationFonds({ famille, adresse: adr, ca: caFinal, moisRetour });
      } else {
        const zone: ZoneEstim =
          niveau === "cp"
            ? { codePostal: codePostal.trim() }
            : { departement: departement.trim() };
        res = await estimationFonds({ famille, zone, ca: caFinal, moisRetour });
      }
      setEst(res);
    } catch (e: any) {
      console.error(e);
      toast.error("Estimation indisponible", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  async function genererDocument() {
    if (!est) return;
    try {
      const agence = await getAgence();
      const html = genererAvisValeurHtml(est, {
        enseigne: enseigne || undefined,
        adresse: adresseInput.trim() || undefined,
        agence: agence ?? undefined,
      });
      openMandat(html);
    } catch (e: any) {
      console.error(e);
      toast.error("Impossible de générer le document", { description: e?.message });
    }
  }

  const fourchette = est?.fourchette_retenue;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Estimation d'un fonds de commerce</h1>
          <p className="text-xs text-slate-400">
            Avis de valeur indicatif basé sur les cessions BODACC + multiples du CA.
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Paramètres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Activité</Label>
              <Select value={famille} onValueChange={(v) => setFamille(v as FamilleMetier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILLES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {METIER_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Zone</Label>
              <Tabs value={niveau} onValueChange={(v) => setNiveau(v as "cp" | "dep")}>
                <TabsList className="bg-slate-900">
                  <TabsTrigger value="cp">Code postal</TabsTrigger>
                  <TabsTrigger value="dep">Département</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                {niveau === "cp" ? "Code postal" : "Département (n°)"}
              </Label>
              {niveau === "cp" ? (
                <Input
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                  placeholder="75017"
                  maxLength={5}
                />
              ) : (
                <Input
                  value={departement}
                  onChange={(e) => setDepartement(e.target.value)}
                  placeholder="75"
                  maxLength={3}
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CA HT annuel (facultatif)</Label>
              <Input
                value={ca}
                onChange={(e) => setCa(e.target.value)}
                placeholder="350000"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Période (mois)</Label>
              <Input
                type="number"
                min={6}
                max={60}
                value={moisRetour}
                onChange={(e) => setMoisRetour(Number(e.target.value) || 24)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={run} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estimation…
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" /> Estimer
                  </>
                )}
              </Button>
            </div>
          </div>

          {niveau === "cp" && (
            <p className="text-xs text-slate-400">
              Astuce : pour disposer d'assez de comparables, préférez le <b>département</b>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Résultats */}
      {est && (
        <>
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-primary/40">
            <CardContent className="py-6 text-center space-y-2">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Fourchette de valorisation
              </div>
              <div className="text-3xl font-bold text-primary">
                {fourchette
                  ? `${eur(fourchette.bas)} — ${eur(fourchette.haut)}`
                  : "Données insuffisantes"}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-slate-400">Fiabilité :</span>
                <Badge className={fiabBadge[est.fiabilite]}>{est.fiabilite}</Badge>
                <span className="text-slate-400">· {est.stats.n} comparable(s)</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Comparables */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Comparables BODACC</CardTitle>
              </CardHeader>
              <CardContent>
                {est.fourchette_comparables ? (
                  <div className="text-sm text-slate-300 mb-3">
                    Médiane : <b className="text-slate-100">{eur(est.stats.median)}</b> · Q1–Q3{" "}
                    {eur(est.fourchette_comparables.bas)} —{" "}
                    {eur(est.fourchette_comparables.haut)}
                  </div>
                ) : (
                  <div className="text-xs text-amber-400 flex items-center gap-1 mb-3">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Trop peu de comparables ({est.stats.n}). Élargissez la zone.
                  </div>
                )}

                <div className="rounded border border-slate-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="text-left p-2">Enseigne</th>
                        <th className="text-left p-2">Lieu</th>
                        <th className="text-right p-2">Prix</th>
                        <th className="text-left p-2">Date</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {est.comparables.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">
                            Aucun comparable
                          </td>
                        </tr>
                      )}
                      {est.comparables.slice(0, 15).map((c, i) => (
                        <tr key={i} className="border-t border-slate-700">
                          <td className="p-2 text-slate-200">{c.denomination ?? "—"}</td>
                          <td className="p-2 text-slate-400">
                            {c.ville ?? ""} {c.code_postal ?? ""}
                          </td>
                          <td className="p-2 text-right text-slate-100 font-medium">
                            {eur(c.prix)}
                          </td>
                          <td className="p-2 text-slate-400">{c.date ?? ""}</td>
                          <td className="p-2">
                            {c.url && (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Multiple CA + réserves */}
            <div className="space-y-4">
              {est.multiple_ca && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-base">Multiple du CA</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="text-slate-300">
                      CA HT : <b className="text-slate-100">{eur(est.multiple_ca.ca)}</b>
                    </div>
                    <div className="text-slate-300">
                      Application :{" "}
                      <b className="text-slate-100">
                        {Math.round(est.multiple_ca.pct_bas * 100)} % –{" "}
                        {Math.round(est.multiple_ca.pct_haut * 100)} %
                      </b>{" "}
                      du CA
                    </div>
                    <div className="text-lg text-primary font-semibold pt-2">
                      {eur(est.multiple_ca.bas)} — {eur(est.multiple_ca.haut)}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base">Réserves</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-400 space-y-2">
                  <p>
                    Avis indicatif à partir de données publiques. Ce n'est pas une expertise.
                    La valeur réelle dépend de l'emplacement, du bail, du matériel, de l'EBE et
                    des conditions de marché.
                  </p>
                </CardContent>
              </Card>

              <Button
                onClick={genererDocument}
                className="w-full"
                size="lg"
                variant="default"
              >
                <FileText className="mr-2 h-4 w-4" /> Générer le document
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

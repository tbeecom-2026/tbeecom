import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calculator, Loader2, FileText, AlertTriangle, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getAgence } from "@/lib/agence";
import { openMandat } from "@/lib/generateMandat";
import { estimationFonds } from "@/lib/avisValeur";
import baremes from "@/config/baremes_fdc.json";
import {
  estimer, CRITERES_SCORE, COEF_ZONE, ZONE_LABEL,
  type EntreeEstimation, type ResultatEstimation, type ZoneGeo, type Famille, type CritereKey,
} from "@/lib/estimation";
import { genererAvisValeurV2Html } from "@/lib/avisValeurV2";

interface BaremeRow { activite: string; naf: string[]; ratio_moyen_pct_ca: number; q1_pct_ca: number; q3_pct_ca: number; refs: number; famille: string; }
const ACTIVITES = (baremes as any).activites as BaremeRow[];

const eur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const num = (s: string): number | null => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return String(s ?? "").trim() !== "" && isFinite(n) ? n : null;
};
const NOTES = [
  { v: 2, l: "Très favorable" }, { v: 1, l: "Favorable" }, { v: 0, l: "Neutre" },
  { v: -1, l: "Défavorable" }, { v: -2, l: "Très défavorable" },
];
const ZONES = Object.keys(COEF_ZONE) as ZoneGeo[];
const fiabColor: Record<ResultatEstimation["fiabilite"], string> = {
  faible: "bg-red-700 text-white", moyenne: "bg-amber-600 text-white", bonne: "bg-emerald-700 text-white",
};

export default function Estimation() {
  const [params] = useSearchParams();

  // Activité (recherche dans le barème)
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const [bareme, setBareme] = useState<BaremeRow | null>(null);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ACTIVITES.filter((a) => a.activite.toLowerCase().includes(q)).slice(0, 40);
  }, [query]);

  const [zone, setZone] = useState<ZoneGeo>("ville_moyenne");
  const [adresse, setAdresse] = useState(params.get("adresse") ?? "");
  const [enseigne, setEnseigne] = useState(params.get("enseigne") ?? "");

  // CA 3 ans
  const [caN, setCaN] = useState(params.get("ca") ?? "");
  const [caN1, setCaN1] = useState("");
  const [caN2, setCaN2] = useState("");

  // Rentabilité
  const [ebe, setEbe] = useState("");
  const [remuReintegree, setRemuReintegree] = useState("");
  const [salaireNormatif, setSalaireNormatif] = useState("");
  const [proprietaireMurs, setProprietaireMurs] = useState(false);
  const [loyerMarcheMurs, setLoyerMarcheMurs] = useState("");
  const [autresRetraitements, setAutresRetraitements] = useState("");

  // Bail
  const [loyer, setLoyer] = useState("");
  const [loyerTVA, setLoyerTVA] = useState<"HT" | "TTC">("HT");
  const [charges, setCharges] = useState("");
  const [taxeFonciere, setTaxeFonciere] = useState("");
  const [dureeBail, setDureeBail] = useState("");
  const [vlm, setVlm] = useState("");
  const [vlmTVA, setVlmTVA] = useState<"HT" | "TTC">("HT");
  const [materiel, setMateriel] = useState("");

  const [scores, setScores] = useState<Record<CritereKey, number>>(
    Object.fromEntries(CRITERES_SCORE.map((c) => [c.key, 0])) as Record<CritereKey, number>,
  );

  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<ResultatEstimation | null>(null);
  const [entree, setEntree] = useState<EntreeEstimation | null>(null);
  const [comparables, setComparables] = useState<any[]>([]);

  // Pré-remplissage depuis un mandat
  useEffect(() => {
    const id = params.get("mandatId");
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("mandats").select("*").eq("id", id).single();
      if (!data) return;
      const m: any = data;
      const at = m.attributs ?? {};
      if (m.ca_annuel) setCaN(String(m.ca_annuel));
      if (m.enseigne && !enseigne) setEnseigne(String(m.enseigne));
      if (!adresse) setAdresse([m.adresse, m.code_postal, m.commune].filter(Boolean).join(" "));
      const loyerAn = at.loyer_annuel ?? (m.loyer_mensuel ? m.loyer_mensuel * 12 : null);
      if (loyerAn) setLoyer(String(loyerAn));
      const chAn = at.charges_annuelles ?? (m.charges_mensuelles ? m.charges_mensuelles * 12 : null);
      if (chAn) setCharges(String(chAn));
      if (at.taxe_fonciere_montant) setTaxeFonciere(String(at.taxe_fonciere_montant));
      if (at.murs_meme_proprietaire === "Oui") setProprietaireMurs(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setScore(k: CritereKey, v: number) { setScores((p) => ({ ...p, [k]: v })); }

  async function run() {
    if (!bareme) { toast.error("Choisis d'abord l'activité (barème)."); return; }
    if (num(caN) == null && num(caN1) == null && num(caN2) == null) {
      toast.error("Renseigne au moins un chiffre d'affaires."); return;
    }
    setLoading(true);
    try {
      // Méthode C : comparables BODACC (médiane), best-effort
      let comparableMedian: number | null = null;
      let comps: any[] = [];
      try {
        const cp = (adresse.match(/\b\d{5}\b/) ?? [])[0];
        if (adresse.trim() || cp) {
          const e = await estimationFonds({
            famille: bareme.famille as any,
            adresse: adresse.trim() || undefined,
            zone: cp ? { codePostal: cp } : undefined,
            ca: num(caN) ?? undefined,
          });
          comparableMedian = e.stats.n >= 3 ? e.stats.median : null;
          comps = e.comparables ?? [];
        }
      } catch { /* comparables indisponibles : on continue */ }

      const ent: EntreeEstimation = {
        famille: (bareme.famille as Famille) ?? "autre",
        bareme: { activite: bareme.activite, ratio_moyen_pct_ca: bareme.ratio_moyen_pct_ca, q1_pct_ca: bareme.q1_pct_ca, q3_pct_ca: bareme.q3_pct_ca, refs: bareme.refs },
        caN: num(caN), caN1: num(caN1), caN2: num(caN2),
        ebeComptable: num(ebe),
        reintegrationRemunerationDirigeant: num(remuReintegree),
        salaireDirigeantNormatif: num(salaireNormatif),
        proprietaireMurs,
        loyerMarcheSiProprietaire: num(loyerMarcheMurs),
        autresRetraitements: num(autresRetraitements),
        loyerAnnuel: num(loyer),
        chargesAnnuelles: num(charges),
        taxeFonciere: num(taxeFonciere),
        dureeRestanteAnnees: num(dureeBail),
        valeurLocativeMarcheAnnuelle: num(vlm),
        valeurMaterielAjoutee: num(materiel),
        comparableMedian,
        zone,
        scores,
      };
      setEntree(ent);
      setRes(estimer(ent));
      setComparables(comps.slice(0, 12));
    } catch (e: any) {
      toast.error("Estimation impossible", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  async function genererPDF() {
    if (!res || !entree) return;
    try {
      const agence = await getAgence();
      const html = genererAvisValeurV2Html(entree, res, {
        enseigne: enseigne || undefined, adresse: adresse || undefined, agence: agence ?? undefined,
      });
      openMandat(html);
    } catch (e: any) {
      toast.error("Impossible de générer le PDF", { description: e?.message });
    }
  }

  const N = (label: string, val: string, set: (v: string) => void, ph = "") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={val} onChange={(e) => set(e.target.value)} placeholder={ph} inputMode="numeric" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Estimation d'un fonds de commerce</h1>
          <p className="text-xs text-slate-400">Méthode croisée : % du CA (barème) · multiple d'EBE retraité · comparables · ajustée du bail et de la localisation.</p>
        </div>
      </div>

      {/* Activité + zone */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Activité & localisation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1 relative">
              <Label className="text-xs">Activité (barème) *</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-8"
                  value={bareme ? bareme.activite : query}
                  onChange={(e) => { setBareme(null); setQuery(e.target.value); setOpenList(true); }}
                  onFocus={() => setOpenList(true)}
                  placeholder="Rechercher : pizzeria, coiffeur, garage…"
                />
              </div>
              {openList && matches.length > 0 && !bareme && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded border border-slate-600 bg-slate-900 shadow-lg">
                  {matches.map((a, i) => (
                    <button key={i} type="button"
                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700"
                      onClick={() => { setBareme(a); setOpenList(false); setQuery(a.activite); }}>
                      <span className="text-slate-100">{a.activite}</span>
                      <span className="text-slate-500 text-xs"> · {a.ratio_moyen_pct_ca}% CA (Q1 {a.q1_pct_ca}–Q3 {a.q3_pct_ca})</span>
                    </button>
                  ))}
                </div>
              )}
              {bareme && (
                <p className="text-[11px] text-slate-400">Barème : {bareme.ratio_moyen_pct_ca}% du CA (Q1 {bareme.q1_pct_ca} – Q3 {bareme.q3_pct_ca}, {bareme.refs} réf.)</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zone géographique</Label>
              <Select value={zone} onValueChange={(v) => setZone(v as ZoneGeo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{ZONE_LABEL[z]} (×{COEF_ZONE[z].toFixed(2)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Enseigne</Label><Input value={enseigne} onChange={(e) => setEnseigne(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Adresse (pour les comparables)</Label><Input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="100 rue Montorgueil 75002 Paris" /></div>
          </div>
        </CardContent>
      </Card>

      {/* CA */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Chiffre d'affaires HT</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {N("CA dernier exercice (N)", caN, setCaN, "350000")}
          {N("CA N-1", caN1, setCaN1)}
          {N("CA N-2", caN2, setCaN2)}
        </CardContent>
      </Card>

      {/* Rentabilité */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Rentabilité (EBE retraité)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {N("EBE comptable", ebe, setEbe, "60000")}
            {N("Rémunération dirigeant réintégrée", remuReintegree, setRemuReintegree)}
            {N("Salaire dirigeant de marché (déduit)", salaireNormatif, setSalaireNormatif)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Propriétaire des murs</Label>
              <div className="flex items-center gap-2 h-10"><Switch checked={proprietaireMurs} onCheckedChange={setProprietaireMurs} /><span className="text-xs text-slate-400">{proprietaireMurs ? "Oui" : "Non"}</span></div>
            </div>
            {proprietaireMurs && N("Loyer de marché (déduit)", loyerMarcheMurs, setLoyerMarcheMurs)}
            {N("Autres retraitements (±)", autresRetraitements, setAutresRetraitements)}
          </div>
          <p className="text-[11px] text-slate-500">EBE retraité = EBE comptable + rémunération réintégrée − salaire de marché − loyer de marché (si propriétaire) ± autres. Laisser vide si l'EBE n'est pas connu (estimation basée sur le CA).</p>
        </CardContent>
      </Card>

      {/* Bail */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Bail commercial</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Loyer annuel</Label>
              <div className="flex gap-2">
                <Input value={loyer} onChange={(e) => setLoyer(e.target.value)} inputMode="numeric" placeholder="30000" />
                <Select value={loyerTVA} onValueChange={(v) => setLoyerTVA(v as any)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="HT">HT</SelectItem><SelectItem value="TTC">TTC</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {N("Charges annuelles", charges, setCharges)}
            {N("Taxe foncière annuelle", taxeFonciere, setTaxeFonciere)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {N("Durée restante du bail (années)", dureeBail, setDureeBail, "6")}
            <div className="space-y-1">
              <Label className="text-xs">Valeur locative de marché (loyer annuel)</Label>
              <div className="flex gap-2">
                <Input value={vlm} onChange={(e) => setVlm(e.target.value)} inputMode="numeric" placeholder="32000" />
                <Select value={vlmTVA} onValueChange={(v) => setVlmTVA(v as any)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="HT">HT</SelectItem><SelectItem value="TTC">TTC</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {N("Valeur du matériel à ajouter (optionnel)", materiel, setMateriel)}
          </div>
          <p className="text-[11px] text-slate-500">Le loyer et la valeur locative de marché sont comparés sur la même base (HT conseillé). Un loyer sous le marché crée un droit au bail ; un bail proche du terme fait courir un risque de déplafonnement.</p>
        </CardContent>
      </Card>

      {/* Scoring */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Grille d'appréciation (place la valeur dans le barème)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CRITERES_SCORE.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <Label className="text-xs flex-1">{c.label}</Label>
              <Select value={String(scores[c.key])} onValueChange={(v) => setScore(c.key, Number(v))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{NOTES.map((n) => <SelectItem key={n.v} value={String(n.v)}>{n.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={run} disabled={loading} size="lg" className="w-full">
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calcul…</> : <><Calculator className="mr-2 h-4 w-4" /> Estimer la valeur</>}
      </Button>

      {/* Résultat */}
      {res && (
        <>
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-primary/40">
            <CardContent className="py-6 text-center space-y-2">
              <div className="text-xs uppercase tracking-wider text-slate-400">Valeur vénale estimée du fonds</div>
              <div className="text-3xl font-bold text-primary">{eur(res.fourchetteBasse)} — {eur(res.fourchetteHaute)}</div>
              <div className="text-emerald-400 font-semibold">Valeur centrale : {eur(res.valeurCentrale)}</div>
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-slate-400">Fiabilité :</span><Badge className={fiabColor[res.fiabilite]}>{res.fiabilite}</Badge>
                <span className="text-slate-400">· score {(res.scoreGlobal * 100).toFixed(0)}% · zone ×{res.coefZone.toFixed(2)} · bail ×{res.coefBail.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {res.alertes.length > 0 && (
            <Card className="bg-amber-950/40 border-amber-700/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-300"><AlertTriangle className="h-4 w-4" /> Points de vigilance ({res.alertes.length})</CardTitle></CardHeader>
              <CardContent><ul className="list-disc pl-5 text-xs text-amber-200/90 space-y-1">{res.alertes.map((a, i) => <li key={i}>{a}</li>)}</ul></CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[res.methodeA, res.methodeB, res.methodeC].map((m, i) => (
              <Card key={i} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2"><CardTitle className="text-sm">{m.libelle}</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-slate-100">{eur(m.valeur)}</div>
                  <p className="text-[11px] text-slate-400 mt-1">{m.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Synthèse bail & pondération</CardTitle></CardHeader>
            <CardContent className="text-xs text-slate-300 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>CA HT moyen<br /><b className="text-slate-100">{eur(res.caMoyen)}</b></div>
              <div>Taux d'effort<br /><b className="text-slate-100">{res.tauxEffort != null ? (res.tauxEffort * 100).toFixed(1) + " %" : "—"}</b></div>
              <div>EBE retraité<br /><b className="text-slate-100">{eur(res.ebeRetraite)}</b></div>
              <div>Plancher droit au bail<br /><b className="text-slate-100">{eur(res.droitAuBailPlancher)}</b></div>
              <div>Pondération A/B/C<br /><b className="text-slate-100">{(res.ponderation.A * 100).toFixed(0)}/{(res.ponderation.B * 100).toFixed(0)}/{(res.ponderation.C * 100).toFixed(0)}</b></div>
            </CardContent>
          </Card>

          <Button onClick={genererPDF} size="lg" className="w-full"><FileText className="mr-2 h-4 w-4" /> Générer le PDF (avis de valeur)</Button>
        </>
      )}
    </div>
  );
}

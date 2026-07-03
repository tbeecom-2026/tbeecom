import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calculator, Loader2, FileText, AlertTriangle, Search, CheckCircle2, Building2, X, UserPlus, Save, Info, Upload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { getAgence } from "@/lib/agence";
import { openMandat } from "@/lib/generateMandat";
import { estimationFonds } from "@/lib/avisValeur";
import { tvaFrFromSiren } from "@/lib/rechercheEntreprise";
import { autocompleteAdresse, societesAAdresse, type AdresseSuggestion, type SocieteCandidate } from "@/lib/adresseEntreprises";
import baremes from "@/config/baremes_fdc.json";
import {
  estimer, CRITERES_SCORE, COEF_ZONE, ZONE_LABEL,
  type EntreeEstimation, type ResultatEstimation, type ZoneGeo, type Famille, type CritereKey,
} from "@/lib/estimation";
import { genererAvisValeurV2Html } from "@/lib/avisValeurV2";

interface BaremeRow { activite: string; naf: string[]; ratio_moyen_pct_ca: number; q1_pct_ca: number; q3_pct_ca: number; refs: number; famille: string; }
const ACTIVITES = (baremes as any).activites as BaremeRow[];
function baremeParNaf(naf: string | null): BaremeRow | null {
  if (!naf) return null;
  const code = naf.replace(/\./g, "").toUpperCase();
  return ACTIVITES.find((a) => a.naf.some((n) => n.toUpperCase() === code)) ?? null;
}

const eur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const num = (s: string): number | null => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return String(s ?? "").trim() !== "" && isFinite(n) ? n : null;
};
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
const DOCS: { type: "bilan" | "bail" | "quittance" | "paie"; slot: number; label: string }[] = [
  { type: "bilan", slot: 1, label: "Bilan N (dernier)" },
  { type: "bilan", slot: 2, label: "Bilan N-1" },
  { type: "bilan", slot: 3, label: "Bilan N-2" },
  { type: "bail", slot: 0, label: "Bail commercial" },
  { type: "quittance", slot: 0, label: "Quittance de loyer" },
  { type: "paie", slot: 0, label: "Fiches de paie (optionnel)" },
];
const NOTES = [
  { v: 2, l: "Très favorable" }, { v: 1, l: "Favorable" }, { v: 0, l: "Neutre" },
  { v: -1, l: "Défavorable" }, { v: -2, l: "Très défavorable" },
];
const CRITERE_AIDE: Record<string, string> = {
  emplacement: "Qualité de l'emplacement et du passage (flux piéton, visibilité, accès, stationnement).\n• Très favorable : emplacement n°1, rue très passante, grande visibilité.\n• Neutre : rue commerçante correcte, passage moyen.\n• Défavorable : emplacement secondaire, peu de passage, accès/parking difficiles.",
  evolution_ca: "Tendance du chiffre d'affaires sur les 3 dernières années.\n• Très favorable : croissance nette et régulière (> +5 %/an).\n• Neutre : CA stable.\n• Défavorable : baisse marquée ou en dents de scie.",
  rentabilite: "Marge d'EBE retraité rapportée au CA, comparée à la norme du métier (souvent 10–20 % du CA).\n• Très favorable : nettement au-dessus de la moyenne du secteur.\n• Neutre : dans la moyenne.\n• Défavorable : rentabilité faible ou nulle.",
  qualite_bail: "Solidité et souplesse du bail : durée restante, destination, clauses, niveau de loyer.\n• Très favorable : bail récent, longue durée devant soi, destination « tous commerces », pas de clause pénalisante.\n• Neutre : bail classique sans particularité.\n• Défavorable : bail proche du terme, destination étroite, clauses contraignantes, risque de non-renouvellement.",
  taux_effort: "Poids du loyer (loyer + charges + taxe foncière) sur le CA.\n• Très favorable : bien en dessous du seuil du métier, le local « respire ».\n• Neutre : dans la norme (≈ 8–12 %).\n• Défavorable : au-dessus du seuil (> 12–15 %), le loyer pèse trop.",
  dependance_exploitant: "L'affaire tourne-t-elle sans le patron ? (clientèle liée à l'enseigne ou à la personne).\n• Très favorable : clientèle fidèle au lieu/à l'enseigne, tout est transmissible sans perte.\n• Neutre : dépendance modérée au dirigeant.\n• Défavorable : tout repose sur le savoir-faire ou la personnalité du dirigeant (la clientèle risque de partir à la vente).",
  etat_materiel: "État et âge du matériel et du local, travaux et mises aux normes à prévoir.\n• Très favorable : matériel récent, local aux normes, rien à refaire.\n• Neutre : entretien correct, quelques postes à surveiller.\n• Défavorable : matériel vétuste, local à rénover, mises aux normes coûteuses.",
  concurrence: "Intensité de la concurrence et barrières à l'entrée (licence IV, agrément, exclusivité, emplacement rare).\n• Très favorable : peu de concurrence + barrières protectrices (licence, agrément, savoir-faire rare).\n• Neutre : concurrence normale.\n• Défavorable : forte concurrence, aucune barrière, facilement copiable à côté.",
  main_oeuvre: "Une équipe formée qui reste facilite la reprise.\n• Très favorable : personnel compétent, ancien, qui reste après la vente.\n• Neutre : petite équipe, situation stable.\n• Défavorable : mono-exploitant sans salarié, ou fort turn-over, savoir-faire non transmis.",
  notoriete: "Réputation (avis, bouche-à-oreille) et revenus récurrents (contrats B2B, abonnements, livraisons régulières).\n• Très favorable : excellente réputation + contrats récurrents qui sécurisent le CA.\n• Neutre : réputation correcte, peu de récurrent.\n• Défavorable : peu connu, aucun revenu récurrent, CA volatil.",
};
const ZONES = Object.keys(COEF_ZONE) as ZoneGeo[];
const fiabColor: Record<ResultatEstimation["fiabilite"], string> = {
  faible: "bg-red-700 text-white", moyenne: "bg-amber-600 text-white", bonne: "bg-emerald-700 text-white",
};

export default function Estimation() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const mandatId = params.get("mandatId");

  // Barème
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const [bareme, setBareme] = useState<BaremeRow | null>(null);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ACTIVITES.filter((a) => a.activite.toLowerCase().includes(q)).slice(0, 40);
  }, [query]);

  const [zone, setZone] = useState<ZoneGeo>("ville_moyenne");
  const [enseigne, setEnseigne] = useState(params.get("enseigne") ?? "");

  // Adresse + autocomplétion
  const [adresse, setAdresse] = useState(params.get("adresse") ?? "");
  const [adrSug, setAdrSug] = useState<AdresseSuggestion[]>([]);
  const [showAdr, setShowAdr] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const debounce = useRef<any>(null);

  // Sociétés à l'adresse
  const [societes, setSocietes] = useState<SocieteCandidate[]>([]);
  const [loadingSoc, setLoadingSoc] = useState(false);
  const [soc, setSoc] = useState<SocieteCandidate | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [savingMandat, setSavingMandat] = useState(false);

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
  const [loyerTVA, setLoyerTVA] = useState<"HT" | "TTC" | "Sans">("HT");
  const [charges, setCharges] = useState("");
  const [taxeFonciere, setTaxeFonciere] = useState("");
  const [dureeBail, setDureeBail] = useState("");
  const [vlm, setVlm] = useState("");
  const [vlmTVA, setVlmTVA] = useState<"HT" | "TTC" | "Sans">("HT");
  const [materiel, setMateriel] = useState("");

  const [scores, setScores] = useState<Record<CritereKey, number>>(
    Object.fromEntries(CRITERES_SCORE.map((c) => [c.key, 0])) as Record<CritereKey, number>,
  );

  const [loading, setLoading] = useState(false);
  const [imp, setImp] = useState<Record<string, "loading" | "ok" | "err" | undefined>>({});
  const [resumePaie, setResumePaie] = useState<string>("");
  const [res, setRes] = useState<ResultatEstimation | null>(null);
  const [entree, setEntree] = useState<EntreeEstimation | null>(null);

  useEffect(() => {
    if (!mandatId) return;
    (async () => {
      const { data } = await supabase.from("mandats").select("*").eq("id", mandatId).single();
      if (!data) return;
      const m: any = data; const at = m.attributs ?? {};
      if (m.ca_annuel) setCaN(String(m.ca_annuel));
      if (m.enseigne) setEnseigne(String(m.enseigne));
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

  function onAdresseChange(v: string) {
    setAdresse(v); setSoc(null); setContactId(null); setShowAdr(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => setAdrSug(await autocompleteAdresse(v)), 250);
  }

  async function choisirAdresse(s: AdresseSuggestion) {
    setAdresse(s.label); setAdrSug([]); setShowAdr(false);
    setCoords({ lat: s.lat, lon: s.lon });
    setLoadingSoc(true); setSocietes([]); setSoc(null);
    try {
      const list = await societesAAdresse(s.label, { numero: s.housenumber, voie: s.street, cp: s.postcode });
      setSocietes(list);
      if (!list.length) toast.info("Aucune société immatriculée à cette adresse exacte — saisie manuelle possible.");
    } finally { setLoadingSoc(false); }
  }

  function choisirSociete(c: SocieteCandidate) {
    setSoc(c); setSocietes([]); setContactId(null);
    if (c.enseigne || c.denomination) setEnseigne(c.enseigne || c.denomination || "");
    const b = baremeParNaf(c.naf);
    if (b) { setBareme(b); setQuery(b.activite); }
    if (c.ca && !num(caN)) setCaN(String(c.ca));
  }

  async function enregistrerContact() {
    if (!soc) return;
    setSavingContact(true);
    try {
      if (soc.siren) {
        const { data } = await supabase.from("contacts").select("id").eq("siren", soc.siren).limit(1);
        if (data && data.length) { setContactId(data[0].id); toast.success("Société déjà en contact — reliée."); setSavingContact(false); return; }
      }
      const row: any = {
        societe: soc.denomination, siren: soc.siren, siret: soc.siret,
        code_naf: soc.naf, num_tva: tvaFrFromSiren(soc.siren),
        adresse, roles: ["vendeur"], type_contact: "societe", user_id: user?.id,
      };
      const { data, error } = await supabase.from("contacts").insert(row).select("id").single();
      if (error) throw error;
      setContactId(data.id); toast.success("Société enregistrée dans les contacts.");
    } catch (e: any) { toast.error("Échec enregistrement contact", { description: e?.message }); }
    finally { setSavingContact(false); }
  }

  async function enregistrerSurMandat() {
    if (!mandatId) return;
    setSavingMandat(true);
    try {
      const { data: cur } = await supabase.from("mandats").select("attributs").eq("id", mandatId).single();
      const at: any = { ...((cur as any)?.attributs ?? {}) };
      if (soc?.siren) at.siren = soc.siren;
      if (res) at.estimation = {
        valeur_centrale: res.valeurCentrale, bas: res.fourchetteBasse, haut: res.fourchetteHaute,
        activite: bareme?.activite, date: new Date().toISOString().slice(0, 10),
      };
      const upd: any = { attributs: at };
      if (enseigne) upd.enseigne = enseigne;
      if (bareme?.activite) upd.nature_activite = bareme.activite;
      const { error } = await supabase.from("mandats").update(upd).eq("id", mandatId);
      if (error) throw error;
      toast.success("Enregistré sur la fiche du bien.");
    } catch (e: any) { toast.error("Échec de l'enregistrement", { description: e?.message }); }
    finally { setSavingMandat(false); }
  }

  function appliquer(type: string, slot: number, fld: any) {
    const S = (v: any) => (v != null && v !== "" ? String(v) : null);
    if (type === "bilan") {
      const ca = S(fld.ca);
      if (slot === 1) { if (ca) setCaN(ca); if (fld.ebe != null) setEbe(String(fld.ebe)); if (fld.remuneration_dirigeant != null) setRemuReintegree(String(fld.remuneration_dirigeant)); }
      else if (slot === 2 && ca) setCaN1(ca);
      else if (slot === 3 && ca) setCaN2(ca);
    } else if (type === "bail") {
      if (fld.loyer_annuel != null) setLoyer(String(fld.loyer_annuel));
      if (fld.charges_annuelles != null) setCharges(String(fld.charges_annuelles));
      if (fld.taxe_fonciere != null) setTaxeFonciere(String(fld.taxe_fonciere));
      if (fld.duree_bail_mois != null) setDureeBail(String(fld.duree_bail_mois));
    } else if (type === "quittance") {
      if (fld.loyer_annuel != null) setLoyer(String(fld.loyer_annuel));
      if (fld.charges_annuelles != null) setCharges(String(fld.charges_annuelles));
    } else if (type === "paie") {
      if (fld.remuneration_dirigeant != null) setRemuReintegree(String(fld.remuneration_dirigeant));
      const bits: string[] = [];
      if (fld.effectif != null) bits.push(`${fld.effectif} salarié(s)`);
      if (fld.masse_salariale_annuelle != null) bits.push(`masse salariale ${new Intl.NumberFormat("fr-FR").format(fld.masse_salariale_annuelle)} €/an`);
      if (fld.contrats) bits.push(String(fld.contrats));
      setResumePaie(bits.join(" · "));
    }
  }

  async function importer(type: "bilan" | "bail" | "quittance" | "paie", slot: number, file: File) {
    const key = slot ? `${type}${slot}` : type;
    setImp((p) => ({ ...p, [key]: "loading" }));
    try {
      const data = await toBase64(file);
      const r = await fetch("/api/extraire", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, media_type: file.type || "application/pdf", data, filename: file.name }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || `Erreur ${r.status}`);
      appliquer(type, slot, d.fields || {});
      setImp((p) => ({ ...p, [key]: "ok" }));
      toast.success("Document lu — vérifie les montants pré-remplis.");
    } catch (e: any) {
      setImp((p) => ({ ...p, [key]: "err" }));
      toast.error("Import impossible", { description: e?.message });
    }
  }

  function setScore(k: CritereKey, v: number) { setScores((p) => ({ ...p, [k]: v })); }

  async function run() {
    if (!bareme) { toast.error("Choisis d'abord l'activité (barème)."); return; }
    if (num(caN) == null && num(caN1) == null && num(caN2) == null) { toast.error("Renseigne au moins un chiffre d'affaires."); return; }
    setLoading(true);
    try {
      let comparableMedian: number | null = null;
      try {
        const cp = (adresse.match(/\b\d{5}\b/) ?? [])[0];
        if (adresse.trim() || cp) {
          const e = await estimationFonds({ famille: bareme.famille as any, adresse: adresse.trim() || undefined, zone: cp ? { codePostal: cp } : undefined, ca: num(caN) ?? undefined });
          comparableMedian = e.stats.n >= 3 ? e.stats.median : null;
        }
      } catch { /* comparables indisponibles */ }

      const ent: EntreeEstimation = {
        famille: (bareme.famille as Famille) ?? "autre",
        bareme: { activite: bareme.activite, ratio_moyen_pct_ca: bareme.ratio_moyen_pct_ca, q1_pct_ca: bareme.q1_pct_ca, q3_pct_ca: bareme.q3_pct_ca, refs: bareme.refs },
        caN: num(caN), caN1: num(caN1), caN2: num(caN2),
        ebeComptable: num(ebe), reintegrationRemunerationDirigeant: num(remuReintegree),
        salaireDirigeantNormatif: num(salaireNormatif), proprietaireMurs, loyerMarcheSiProprietaire: num(loyerMarcheMurs),
        autresRetraitements: num(autresRetraitements), loyerAnnuel: num(loyer), chargesAnnuelles: num(charges),
        taxeFonciere: num(taxeFonciere), dureeRestanteAnnees: num(dureeBail) != null ? Number((num(dureeBail)! / 12).toFixed(2)) : null, valeurLocativeMarcheAnnuelle: num(vlm),
        valeurMaterielAjoutee: num(materiel), comparableMedian, zone, scores,
      };
      setEntree(ent); setRes(estimer(ent));
    } catch (e: any) { toast.error("Estimation impossible", { description: e?.message }); }
    finally { setLoading(false); }
  }

  async function genererPDF() {
    if (!res || !entree) return;
    try {
      const agence = await getAgence();
      openMandat(genererAvisValeurV2Html(entree, res, { enseigne: enseigne || undefined, adresse: adresse || undefined, agence: agence ?? undefined }));
    } catch (e: any) { toast.error("Impossible de générer le PDF", { description: e?.message }); }
  }

  const N = (label: string, val: string, set: (v: string) => void, ph = "") => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Input value={val} onChange={(e) => set(e.target.value)} placeholder={ph} inputMode="numeric" /></div>
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

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Localisation & société</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Adresse (autocomplétion) */}
          <div className="space-y-1 relative">
            <Label className="text-xs">Adresse du fonds</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-8" value={adresse} onChange={(e) => onAdresseChange(e.target.value)}
                onFocus={() => setShowAdr(true)} placeholder="Commence à taper : 96 boulevard de la République, Saint-Cloud…" />
            </div>
            {showAdr && adrSug.length > 0 && (
              <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded border border-slate-600 bg-slate-900 shadow-lg">
                {adrSug.map((s, i) => (
                  <button key={i} type="button" className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 text-slate-100"
                    onClick={() => choisirAdresse(s)}>{s.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Sociétés à l'adresse */}
          {loadingSoc && <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche des sociétés à cette adresse…</div>}
          {societes.length > 0 && !soc && (
            <div className="rounded border border-slate-600 bg-slate-900/60 divide-y divide-slate-700">
              <div className="px-3 py-1.5 text-xs text-slate-400">Sociétés immatriculées à cette adresse — choisis la bonne :</div>
              {societes.map((c, i) => (
                <button key={i} type="button" className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-700" onClick={() => choisirSociete(c)}>
                  <div className="text-slate-100 font-medium flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" />{c.enseigne || c.denomination}{!c.actif && <span className="text-red-400 text-xs">(cessée)</span>}</div>
                  <div className="text-xs text-slate-400">{c.denomination} · SIREN {c.siren ?? "—"} · NAF {c.naf ?? "—"}{c.ca ? ` · CA ${eur(c.ca)}` : ""}</div>
                  <div className="text-[11px] text-slate-500">{c.adresse}</div>
                </button>
              ))}
            </div>
          )}

          {/* Société confirmée */}
          {soc && (
            <div className="rounded-lg border border-emerald-600/50 bg-emerald-950/30 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-emerald-100">{soc.enseigne || soc.denomination}</div>
                  <div className="text-xs text-slate-300">{soc.denomination} · SIREN {soc.siren ?? "—"} · NAF {soc.naf ?? "—"}</div>
                  <div className="text-xs text-slate-400">{soc.adresse}{soc.ca ? ` · CA publié : ${eur(soc.ca)} (à vérifier)` : ""}</div>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setSoc(null); setContactId(null); }}><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button type="button" size="sm" variant="outline" onClick={enregistrerContact} disabled={savingContact || !!contactId}>
                  <UserPlus className="mr-1 h-3.5 w-3.5" />{contactId ? "Contact enregistré ✓" : savingContact ? "…" : "Enregistrer comme contact"}
                </Button>
                {mandatId && (
                  <Button type="button" size="sm" variant="outline" onClick={enregistrerSurMandat} disabled={savingMandat}>
                    <Save className="mr-1 h-3.5 w-3.5" />{savingMandat ? "…" : "Enregistrer sur la fiche du bien"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Enseigne + Activité + Zone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Enseigne</Label><Input value={enseigne} onChange={(e) => setEnseigne(e.target.value)} /></div>
            <div className="space-y-1 relative">
              <Label className="text-xs">Activité (barème) *</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-8" value={bareme ? bareme.activite : query}
                  onChange={(e) => { setBareme(null); setQuery(e.target.value); setOpenList(true); }}
                  onFocus={() => setOpenList(true)} placeholder="pizzeria, coiffeur, garage…" />
              </div>
              {openList && matches.length > 0 && !bareme && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded border border-slate-600 bg-slate-900 shadow-lg">
                  {matches.map((a, i) => (
                    <button key={i} type="button" className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700"
                      onClick={() => { setBareme(a); setOpenList(false); setQuery(a.activite); }}>
                      <span className="text-slate-100">{a.activite}</span>
                      <span className="text-slate-500 text-xs"> · {a.ratio_moyen_pct_ca}% CA</span>
                    </button>
                  ))}
                </div>
              )}
              {bareme && <p className="text-[11px] text-slate-400">Barème : {bareme.ratio_moyen_pct_ca}% du CA (Q1 {bareme.q1_pct_ca} – Q3 {bareme.q3_pct_ca}, {bareme.refs} réf.)</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Zone géographique</Label>
              <Select value={zone} onValueChange={(v) => setZone(v as ZoneGeo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZONES.map((z) => <SelectItem key={z} value={z}>{ZONE_LABEL[z]} (×{COEF_ZONE[z].toFixed(2)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import IA */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Import automatique par IA</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] text-slate-400">Importe les documents : l'IA lit les <b>bilans</b> (CA + EBE calculé), le <b>bail</b> et la <b>quittance</b> (loyer, charges, durée) et pré-remplit les champs. Les montants restent à vérifier.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {DOCS.map((d) => {
              const key = d.slot ? `${d.type}${d.slot}` : d.type;
              const st = imp[key];
              return (
                <label key={key} className={`flex items-center justify-center gap-2 text-xs rounded border px-3 py-2 cursor-pointer transition ${st === "ok" ? "border-emerald-600 text-emerald-300" : st === "err" ? "border-red-600 text-red-300" : "border-slate-600 text-slate-200 hover:bg-slate-700"}`}>
                  {st === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : st === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                  {d.label}
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) importer(d.type, d.slot, file); e.currentTarget.value = ""; }} />
                </label>
              );
            })}
          </div>
          {resumePaie && <p className="text-[11px] text-emerald-300/90">👥 {resumePaie} — utile pour « Équipe en place » et le retraitement de la rémunération.</p>}
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
            <div className="space-y-1"><Label className="text-xs">Propriétaire des murs</Label>
              <div className="flex items-center gap-2 h-10"><Switch checked={proprietaireMurs} onCheckedChange={setProprietaireMurs} /><span className="text-xs text-slate-400">{proprietaireMurs ? "Oui" : "Non"}</span></div></div>
            {proprietaireMurs && N("Loyer de marché (déduit)", loyerMarcheMurs, setLoyerMarcheMurs)}
            {N("Autres retraitements (±)", autresRetraitements, setAutresRetraitements)}
          </div>
          <p className="text-[11px] text-slate-500">EBE retraité = EBE comptable + rémunération réintégrée − salaire de marché − loyer de marché (si propriétaire) ± autres. Laisser vide si l'EBE n'est pas connu.</p>
        </CardContent>
      </Card>

      {/* Bail */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Bail commercial</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Loyer annuel</Label>
              <div className="flex gap-2"><Input value={loyer} onChange={(e) => setLoyer(e.target.value)} inputMode="numeric" placeholder="30000" />
                <Select value={loyerTVA} onValueChange={(v) => setLoyerTVA(v as any)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="HT">HT</SelectItem><SelectItem value="TTC">TTC</SelectItem><SelectItem value="Sans">Pas de TVA</SelectItem></SelectContent></Select></div></div>
            {N("Charges annuelles", charges, setCharges)}
            {N("Taxe foncière annuelle", taxeFonciere, setTaxeFonciere)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {N("Durée restante du bail (mois)", dureeBail, setDureeBail, "72")}
            <div className="space-y-1"><Label className="text-xs">Valeur locative de marché (loyer annuel)</Label>
              <div className="flex gap-2"><Input value={vlm} onChange={(e) => setVlm(e.target.value)} inputMode="numeric" placeholder="32000" />
                <Select value={vlmTVA} onValueChange={(v) => setVlmTVA(v as any)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="HT">HT</SelectItem><SelectItem value="TTC">TTC</SelectItem><SelectItem value="Sans">Pas de TVA</SelectItem></SelectContent></Select></div></div>
            {N("Valeur du matériel à ajouter (optionnel)", materiel, setMateriel)}
          </div>
          <p className="text-[11px] text-slate-500">Loyer et valeur locative comparés sur la même base (HT conseillé). Un loyer sous le marché crée un droit au bail ; un bail proche du terme fait courir un risque de déplafonnement.</p>
        </CardContent>
      </Card>

      {/* Scoring */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-base">Grille d'appréciation (place la valeur dans le barème)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TooltipProvider delayDuration={100}>
          {CRITERES_SCORE.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <Label className="text-xs flex-1 flex items-center gap-1">
                {c.label}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-slate-500 hover:text-slate-200"><Info className="h-3.5 w-3.5" /></button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs whitespace-pre-line leading-relaxed">{CRITERE_AIDE[c.key]}</TooltipContent>
                </Tooltip>
              </Label>
              <Select value={String(scores[c.key])} onValueChange={(v) => setScore(c.key, Number(v))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{NOTES.map((n) => <SelectItem key={n.v} value={String(n.v)}>{n.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
          </TooltipProvider>
        </CardContent>
      </Card>

      <Button onClick={run} disabled={loading} size="lg" className="w-full">
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calcul…</> : <><Calculator className="mr-2 h-4 w-4" /> Estimer la valeur</>}
      </Button>

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
                <CardContent><div className="text-xl font-bold text-slate-100">{eur(m.valeur)}</div><p className="text-[11px] text-slate-400 mt-1">{m.detail}</p></CardContent>
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

          <div className="flex flex-wrap gap-3">
            <Button onClick={genererPDF} size="lg" className="flex-1"><FileText className="mr-2 h-4 w-4" /> Générer le PDF (avis de valeur)</Button>
            {mandatId && <Button onClick={enregistrerSurMandat} size="lg" variant="outline" disabled={savingMandat}><Save className="mr-2 h-4 w-4" /> Enregistrer sur la fiche du bien</Button>}
          </div>
        </>
      )}
    </div>
  );
}

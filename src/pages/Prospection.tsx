import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Radar, Search as SearchIcon, Save, UserPlus, X, Loader2, AlertTriangle } from "lucide-react";
import { METIER_LABEL, type FamilleMetier } from "@/lib/metier";
import {
  rechercherProspects,
  toProspectRow,
  type Prospect,
  type EtatDifficulte,
  type Zone,
} from "@/lib/prospection";

const FAMILLES: FamilleMetier[] = [
  "restauration_assise",
  "restauration_rapide",
  "bar_cafe_tabac",
  "boulangerie_patisserie",
  "fleuriste",
  "coiffure_esthetique",
  "garage_carrosserie",
];

const ETAT_LABEL: Record<EtatDifficulte, string> = {
  sain: "Sain",
  redressement: "Redressement",
  liquidation: "Liquidation",
  avis_en_cours: "Avis en cours",
};

function badgeEtat(etat: EtatDifficulte) {
  const cls: Record<EtatDifficulte, string> = {
    sain: "bg-slate-600/40 text-slate-200 border-slate-500",
    redressement: "bg-orange-600/30 text-orange-200 border-orange-500",
    liquidation: "bg-red-600/30 text-red-200 border-red-500",
    avis_en_cours: "bg-yellow-600/30 text-yellow-200 border-yellow-500",
  };
  return <Badge variant="outline" className={cls[etat]}>{ETAT_LABEL[etat]}</Badge>;
}

function badgeScore(score: number) {
  let cls = "bg-slate-600/40 text-slate-200 border-slate-500";
  if (score >= 70) cls = "bg-emerald-600/40 text-emerald-100 border-emerald-500";
  else if (score >= 50) cls = "bg-yellow-600/30 text-yellow-100 border-yellow-500";
  else if (score >= 30) cls = "bg-orange-600/30 text-orange-100 border-orange-500";
  return <Badge variant="outline" className={cls}>{score}</Badge>;
}

export default function Prospection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- Filtres ---
  const [familles, setFamilles] = useState<FamilleMetier[]>([]);
  const [niveauZone, setNiveauZone] = useState<"cp" | "commune" | "departement">("cp");
  const [zoneTexte, setZoneTexte] = useState("");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ancienneteMin, setAncienneteMin] = useState<string>("");
  const [enDifficulteUniquement, setEnDifficulteUniquement] = useState(false);
  const [scoreMin, setScoreMin] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Prospect[]>([]);
  const [tronque, setTronque] = useState(false);
  const [totalCommerces, setTotalCommerces] = useState(0);

  // --- Mes leads ---
  const [mesLeads, setMesLeads] = useState<any[]>([]);
  const [filtreStatut, setFiltreStatut] = useState<string>("all");
  const [filtreFamille, setFiltreFamille] = useState<string>("all");

  useEffect(() => {
    loadMesLeads();
  }, [filtreStatut, filtreFamille]);

  async function loadMesLeads() {
    let q = supabase.from("prospects").select("*").order("score", { ascending: false });
    if (filtreStatut !== "all") q = q.eq("statut", filtreStatut);
    if (filtreFamille !== "all") q = q.eq("famille_metier", filtreFamille);
    const { data, error } = await q;
    if (error) {
      toast.error("Impossible de charger les leads", { description: error.message });
      return;
    }
    setMesLeads(data ?? []);
  }

  function toggleFamille(f: FamilleMetier) {
    setFamilles((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function buildZone(): Zone | null {
    const t = zoneTexte.trim();
    if (!t) return null;
    if (niveauZone === "cp") return { codePostal: t.replace(/\D/g, "").slice(0, 5) };
    if (niveauZone === "commune") return { codeCommune: t.replace(/\D/g, "").slice(0, 5) };
    return { departement: t.replace(/\D/g, "").slice(0, 3) };
  }

  async function lancerRecherche() {
    const zone = buildZone();
    if (!zone) {
      toast.error("Zone géographique requise");
      return;
    }
    if (familles.length === 0) {
      toast.error("Sélectionne au moins une activité");
      return;
    }
    setLoading(true);
    setTronque(false);
    setTotalCommerces(0);
    try {
      const res = await rechercherProspects({
        familles,
        zone,
        ageMin: ageMin ? Number(ageMin) : undefined,
        ancienneteMin: ancienneteMin ? Number(ancienneteMin) : undefined,
        enDifficulteUniquement,
        scoreMin,
      });
      setLeads(res.prospects);
      setTronque(res.tronque);
      setTotalCommerces(res.total_commerces);
      if (res.prospects.length === 0) toast.info("Aucun lead pour ces critères");
      else toast.success(`${res.prospects.length} lead${res.prospects.length > 1 ? "s" : ""} trouvé${res.prospects.length > 1 ? "s" : ""} sur ${res.total_commerces} commerces analysés`);
    } catch (e: any) {
      toast.error("Erreur lors de la recherche", { description: e?.message ?? "API indisponible" });
    } finally {
      setLoading(false);
    }
  }

  async function enregistrerProspect(p: Prospect) {
    if (!p.siren) {
      toast.error("SIREN manquant — impossible d'enregistrer");
      return;
    }
    const row = { ...toProspectRow(p), user_id: user?.id };
    const { error } = await supabase.from("prospects").upsert(row, { onConflict: "siren" });
    if (error) {
      toast.error("Erreur d'enregistrement", { description: error.message });
      return;
    }
    toast.success("Lead enregistré");
    loadMesLeads();
  }

  async function ecarterProspect(p: Prospect) {
    if (!p.siren) return;
    const row = { ...toProspectRow(p), statut: "ecarte", user_id: user?.id };
    const { error } = await supabase.from("prospects").upsert(row, { onConflict: "siren" });
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    toast.success("Lead écarté");
    loadMesLeads();
  }

  async function convertirEnContact(p: Prospect) {
    const contactPayload = {
      societe: p.denomination,
      siret: null,
      siren: p.siren,
      nom: p.denomination ?? p.dirigeant_nom ?? "Prospect",
      nom_dirigeant: p.dirigeant_nom,
      code_naf: p.naf,
      commune: p.commune,
      code_postal: p.code_postal,
      adresse: p.adresse,
      type_contact: "Prospect Vendeur",
      roles: ["vendeur"],
      user_id: user?.id,
    };
    const { data: contactCree, error: errC } = await supabase
      .from("contacts")
      .insert(contactPayload)
      .select("id")
      .single();
    if (errC) {
      toast.error("Erreur création contact", { description: errC.message });
      return;
    }
    if (p.siren) {
      const row = {
        ...toProspectRow(p),
        statut: "converti",
        contact_id: contactCree.id,
        user_id: user?.id,
      };
      await supabase.from("prospects").upsert(row, { onConflict: "siren" });
    }
    toast.success("Contact créé");
    loadMesLeads();
    navigate(`/contacts/${contactCree.id}`);
  }

  async function updateStatutLead(id: string, statut: string) {
    const { error } = await supabase.from("prospects").update({ statut }).eq("id", id);
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    loadMesLeads();
  }

  async function updateNotesLead(id: string, notes: string) {
    const { error } = await supabase.from("prospects").update({ notes }).eq("id", id);
    if (error) toast.error("Erreur", { description: error.message });
  }

  const familesActives = useMemo(() => new Set(familles), [familles]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Radar className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Prospection</h1>
        </div>

        <Tabs defaultValue="recherche">
          <TabsList>
            <TabsTrigger value="recherche">Rechercher</TabsTrigger>
            <TabsTrigger value="mes-leads">Mes leads</TabsTrigger>
          </TabsList>

          {/* ============ ONGLET RECHERCHE ============ */}
          <TabsContent value="recherche" className="space-y-4">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4">
              <div>
                <Label className="text-sm">Activités ciblées</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {FAMILLES.map((f) => (
                    <label
                      key={f}
                      className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                        familesActives.has(f)
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-slate-600 bg-slate-700/40 text-slate-200"
                      }`}
                    >
                      <Checkbox
                        checked={familesActives.has(f)}
                        onCheckedChange={() => toggleFamille(f)}
                        className="h-3.5 w-3.5"
                      />
                      {METIER_LABEL[f]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Code postal*</Label>
                  <Input value={codePostal} onChange={(e) => setCodePostal(e.target.value)} placeholder="75001" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Âge dirigeant min</Label>
                  <Input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="60" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ancienneté min (ans)</Label>
                  <Input type="number" value={ancienneteMin} onChange={(e) => setAncienneteMin(e.target.value)} placeholder="10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Score min : {scoreMin}</Label>
                  <Slider value={[scoreMin]} onValueChange={(v) => setScoreMin(v[0])} min={0} max={100} step={5} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={enDifficulteUniquement}
                      onCheckedChange={(v) => setEnDifficulteUniquement(!!v)}
                    />
                    En difficulté uniquement
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={lancerRecherche} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                  Rechercher
                </Button>
              </div>
            </div>

            {/* Résultats */}
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="text-left p-2">Dénomination</th>
                    <th className="text-left p-2">Activité</th>
                    <th className="text-left p-2">Adresse</th>
                    <th className="text-left p-2">Âge</th>
                    <th className="text-left p-2">État</th>
                    <th className="text-left p-2">Ancien.</th>
                    <th className="text-left p-2">Score</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        Aucun résultat. Lance une recherche.
                      </td>
                    </tr>
                  )}
                  {leads.map((p, i) => (
                    <tr key={(p.siren ?? "x") + i} className="border-t border-slate-700 hover:bg-slate-800/40">
                      <td className="p-2">
                        <div className="font-medium text-slate-100">{p.denomination ?? "—"}</div>
                        {p.mandataire && (
                          <div className="text-xs text-yellow-300 mt-0.5">Mandataire : {p.mandataire}</div>
                        )}
                        {p.domiciliation_probable && (
                          <div className="text-xs text-orange-300 mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Adresse de domiciliation probable — vérifier
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-slate-300">{p.famille_label}</td>
                      <td className="p-2 text-slate-300 text-xs">
                        {p.adresse ?? "—"}
                        {p.commune && <div className="text-slate-400">{p.code_postal} {p.commune}</div>}
                      </td>
                      <td className="p-2">{p.dirigeant_age ?? "—"}</td>
                      <td className="p-2">{badgeEtat(p.etat)}</td>
                      <td className="p-2">{p.anciennete_annees ?? "—"} ans</td>
                      <td className="p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{badgeScore(p.score)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            âge +{p.score_detail.age}, difficulté +{p.score_detail.difficulte}, ancienneté +{p.score_detail.anciennete}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => enregistrerProspect(p)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => convertirEnContact(p)}>
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => ecarterProspect(p)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ============ ONGLET MES LEADS ============ */}
          <TabsContent value="mes-leads" className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Statut</Label>
                <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="nouveau">Nouveau</SelectItem>
                    <SelectItem value="a_contacter">À contacter</SelectItem>
                    <SelectItem value="ecarte">Écarté</SelectItem>
                    <SelectItem value="converti">Converti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Famille</Label>
                <Select value={filtreFamille} onValueChange={setFiltreFamille}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {FAMILLES.map((f) => (
                      <SelectItem key={f} value={f}>{METIER_LABEL[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="text-left p-2">Dénomination</th>
                    <th className="text-left p-2">Activité</th>
                    <th className="text-left p-2">Commune</th>
                    <th className="text-left p-2">État</th>
                    <th className="text-left p-2">Score</th>
                    <th className="text-left p-2">Statut</th>
                    <th className="text-left p-2 w-64">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {mesLeads.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">Aucun lead enregistré</td></tr>
                  )}
                  {mesLeads.map((l) => (
                    <tr key={l.id} className="border-t border-slate-700 hover:bg-slate-800/40">
                      <td className="p-2">
                        <div className="font-medium text-slate-100">{l.denomination ?? "—"}</div>
                        <div className="text-xs text-slate-400">SIREN {l.siren}</div>
                      </td>
                      <td className="p-2 text-slate-300">
                        {METIER_LABEL[l.famille_metier as FamilleMetier] ?? l.famille_metier}
                      </td>
                      <td className="p-2 text-slate-300 text-xs">{l.code_postal} {l.commune}</td>
                      <td className="p-2">{badgeEtat(l.etat as EtatDifficulte)}</td>
                      <td className="p-2">{badgeScore(l.score ?? 0)}</td>
                      <td className="p-2">
                        <Select value={l.statut ?? "nouveau"} onValueChange={(v) => updateStatutLead(l.id, v)}>
                          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nouveau">Nouveau</SelectItem>
                            <SelectItem value="a_contacter">À contacter</SelectItem>
                            <SelectItem value="ecarte">Écarté</SelectItem>
                            <SelectItem value="converti">Converti</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Textarea
                          defaultValue={l.notes ?? ""}
                          onBlur={(e) => updateNotesLead(l.id, e.target.value)}
                          rows={2}
                          className="text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

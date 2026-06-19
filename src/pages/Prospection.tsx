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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Radar,
  Search as SearchIcon,
  Save,
  UserPlus,
  X,
  Loader2,
  AlertTriangle,
  FolderPlus,
  Folder,
  Trash2,
  Pencil,
  Info,
  ExternalLink,
  SaveAll,
  Calculator,
} from "lucide-react";
import { METIER_LABEL, type FamilleMetier } from "@/lib/metier";
import {
  rechercherProspects,
  toProspectRow,
  type Prospect,
  type EtatDifficulte,
  type Zone,
} from "@/lib/prospection";
import { chercherParSiret, type InfoEntreprise } from "@/lib/rechercheEntreprise";

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

interface Dossier {
  id: string;
  nom: string;
  description: string | null;
  created_at: string;
}

const NO_DOSSIER = "__none__";
const NEW_DOSSIER = "__new__";

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

function formatDateFr(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("fr-FR");
}

export default function Prospection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- Dossiers ---
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [dossierActif, setDossierActif] = useState<string | null>(null);
  const [dossierCible, setDossierCible] = useState<string>(NO_DOSSIER); // pour enregistrement
  const [openCreateDossier, setOpenCreateDossier] = useState(false);
  const [newDossierNom, setNewDossierNom] = useState("");
  const [newDossierDesc, setNewDossierDesc] = useState("");
  const [renameDossier, setRenameDossier] = useState<Dossier | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteDossier, setDeleteDossier] = useState<Dossier | null>(null);

  // --- Filtres recherche ---
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
  const [filtreDossier, setFiltreDossier] = useState<string>("all");
  const [leadToDelete, setLeadToDelete] = useState<any | null>(null);

  // --- Détail lead ---
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLead, setDetailLead] = useState<Prospect | any | null>(null);
  const [detailInfo, setDetailInfo] = useState<InfoEntreprise | null>(null);

  useEffect(() => {
    loadDossiers();
  }, []);

  useEffect(() => {
    loadMesLeads();
  }, [filtreStatut, filtreFamille, filtreDossier]);

  async function loadDossiers() {
    const { data, error } = await supabase
      .from("dossiers_prospection")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Impossible de charger les dossiers", { description: error.message });
      return;
    }
    setDossiers(data ?? []);
  }

  async function loadMesLeads() {
    let q = supabase.from("prospects").select("*").order("score", { ascending: false });
    if (filtreStatut !== "all") q = q.eq("statut", filtreStatut);
    if (filtreFamille !== "all") q = q.eq("famille_metier", filtreFamille);
    if (filtreDossier === "none") q = q.is("dossier_id", null);
    else if (filtreDossier !== "all") q = q.eq("dossier_id", filtreDossier);
    const { data, error } = await q;
    if (error) {
      toast.error("Impossible de charger les leads", { description: error.message });
      return;
    }
    setMesLeads(data ?? []);
  }

  async function creerDossier() {
    const nom = newDossierNom.trim();
    if (!nom) {
      toast.error("Nom requis");
      return;
    }
    const { data, error } = await supabase
      .from("dossiers_prospection")
      .insert({ nom, description: newDossierDesc.trim() || null })
      .select("*")
      .single();
    if (error) {
      toast.error("Erreur création dossier", { description: error.message });
      return;
    }
    toast.success("Dossier créé");
    setDossiers((prev) => [data as Dossier, ...prev]);
    setDossierActif((data as Dossier).id);
    setDossierCible((data as Dossier).id);
    setNewDossierNom("");
    setNewDossierDesc("");
    setOpenCreateDossier(false);
  }

  async function renommerDossierConfirm() {
    if (!renameDossier) return;
    const nom = renameValue.trim();
    if (!nom) {
      toast.error("Nom requis");
      return;
    }
    const { error } = await supabase
      .from("dossiers_prospection")
      .update({ nom })
      .eq("id", renameDossier.id);
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    toast.success("Dossier renommé");
    setRenameDossier(null);
    loadDossiers();
  }

  async function supprimerDossierConfirm() {
    if (!deleteDossier) return;
    const { error } = await supabase
      .from("dossiers_prospection")
      .delete()
      .eq("id", deleteDossier.id);
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    toast.success("Dossier supprimé (les leads sont conservés)");
    if (dossierActif === deleteDossier.id) setDossierActif(null);
    if (dossierCible === deleteDossier.id) setDossierCible(NO_DOSSIER);
    setDeleteDossier(null);
    loadDossiers();
    loadMesLeads();
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
      else
        toast.success(
          `${res.prospects.length} lead${res.prospects.length > 1 ? "s" : ""} trouvé${
            res.prospects.length > 1 ? "s" : ""
          } sur ${res.total_commerces} commerces analysés`
        );
    } catch (e: any) {
      toast.error("Erreur lors de la recherche", { description: e?.message ?? "API indisponible" });
    } finally {
      setLoading(false);
    }
  }

  function resoudreDossierCible(): string | null {
    if (dossierCible === NO_DOSSIER) return null;
    if (dossierCible === NEW_DOSSIER) return null;
    return dossierCible;
  }

  async function enregistrerProspect(p: Prospect) {
    if (!p.siren) {
      toast.error("SIREN manquant — impossible d'enregistrer");
      return;
    }
    if (dossierCible === NEW_DOSSIER) {
      setOpenCreateDossier(true);
      toast.info("Crée d'abord le dossier de destination");
      return;
    }
    const dossier_id = resoudreDossierCible();
    const row = { ...toProspectRow(p), dossier_id };
    const { error } = await supabase.from("prospects").upsert(row, { onConflict: "siren" });
    if (error) {
      toast.error("Erreur d'enregistrement", { description: error.message });
      return;
    }
    toast.success("Lead enregistré");
    loadMesLeads();
  }

  async function enregistrerTout() {
    if (leads.length === 0) return;
    if (dossierCible === NEW_DOSSIER) {
      setOpenCreateDossier(true);
      toast.info("Crée d'abord le dossier de destination");
      return;
    }
    const dossier_id = resoudreDossierCible();
    const rows = leads
      .filter((p) => p.siren)
      .map((p) => ({ ...toProspectRow(p), dossier_id }));
    if (rows.length === 0) {
      toast.error("Aucun lead avec SIREN");
      return;
    }
    const { error } = await supabase.from("prospects").upsert(rows, { onConflict: "siren" });
    if (error) {
      toast.error("Erreur d'enregistrement", { description: error.message });
      return;
    }
    toast.success(`${rows.length} lead${rows.length > 1 ? "s" : ""} enregistré${rows.length > 1 ? "s" : ""}`);
    loadMesLeads();
  }

  async function ecarterProspect(p: Prospect) {
    if (!p.siren) return;
    const dossier_id = resoudreDossierCible();
    const row = { ...toProspectRow(p), statut: "ecarte", dossier_id };
    const { error } = await supabase.from("prospects").upsert(row, { onConflict: "siren" });
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    toast.success("Lead écarté");
    loadMesLeads();
  }

  async function convertirEnContact(p: Prospect | any) {
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
      // Si on a un objet Prospect (avec score_detail) on upsert, sinon on update juste
      if ("score_detail" in p) {
        const row = {
          ...toProspectRow(p as Prospect),
          statut: "converti",
          contact_id: contactCree.id,
        };
        await supabase.from("prospects").upsert(row, { onConflict: "siren" });
      } else {
        await supabase
          .from("prospects")
          .update({ statut: "converti", contact_id: contactCree.id })
          .eq("id", p.id);
      }
    }
    toast.success("Contact créé");
    setDetailOpen(false);
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

  async function deplacerLead(id: string, dossier_id: string | null) {
    const { error } = await supabase.from("prospects").update({ dossier_id }).eq("id", id);
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    toast.success("Lead déplacé");
    loadMesLeads();
  }

  async function supprimerLeadConfirm() {
    if (!leadToDelete) return;
    const { error } = await supabase.from("prospects").delete().eq("id", leadToDelete.id);
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    toast.success("Lead supprimé");
    setLeadToDelete(null);
    loadMesLeads();
  }

  async function ouvrirDetail(lead: Prospect | any) {
    setDetailLead(lead);
    setDetailInfo(null);
    setDetailOpen(true);
    if (!lead.siren) return;
    setDetailLoading(true);
    try {
      const info = await chercherParSiret(lead.siren);
      setDetailInfo(info);
    } catch (e: any) {
      toast.error("Erreur récupération infos", { description: e?.message });
    } finally {
      setDetailLoading(false);
    }
  }

  const familesActives = useMemo(() => new Set(familles), [familles]);
  const dossierMap = useMemo(() => {
    const m = new Map<string, Dossier>();
    dossiers.forEach((d) => m.set(d.id, d));
    return m;
  }, [dossiers]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Radar className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Prospection</h1>
          </div>

          {/* Sélecteur dossier global */}
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-slate-400" />
            <Select
              value={dossierActif ?? "all"}
              onValueChange={(v) => setDossierActif(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-64 h-9">
                <SelectValue placeholder="Tous les dossiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les dossiers</SelectItem>
                {dossiers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setOpenCreateDossier(true)}>
              <FolderPlus className="h-4 w-4 mr-1" /> Nouveau
            </Button>
            {dossierActif && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const d = dossierMap.get(dossierActif);
                    if (d) {
                      setRenameDossier(d);
                      setRenameValue(d.nom);
                    }
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const d = dossierMap.get(dossierActif);
                    if (d) setDeleteDossier(d);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </>
            )}
          </div>
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

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Niveau zone</Label>
                  <Select value={niveauZone} onValueChange={(v: any) => setNiveauZone(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cp">Code postal</SelectItem>
                      <SelectItem value="commune">Commune (INSEE)</SelectItem>
                      <SelectItem value="departement">Département</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {niveauZone === "cp" ? "Code postal*" : niveauZone === "commune" ? "Code INSEE*" : "Département*"}
                  </Label>
                  <Input
                    value={zoneTexte}
                    onChange={(e) => setZoneTexte(e.target.value)}
                    placeholder={niveauZone === "cp" ? "75001" : niveauZone === "commune" ? "92073" : "92"}
                  />
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

              {tronque && (
                <div className="flex items-center gap-2 rounded-md bg-orange-900/30 border border-orange-700/50 px-3 py-2 text-sm text-orange-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Zone large, {totalCommerces} commerces analysés — seuls les 300 premiers ont été parcourus. Affinez la zone ou l'activité pour un résultat complet.
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={lancerRecherche} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                  Rechercher
                </Button>
              </div>
            </div>

            {/* Barre dossier de destination + tout enregistrer */}
            {leads.length > 0 && (
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Dossier de destination</Label>
                  <Select
                    value={dossierCible}
                    onValueChange={(v) => {
                      if (v === NEW_DOSSIER) {
                        setOpenCreateDossier(true);
                      } else {
                        setDossierCible(v);
                      }
                    }}
                  >
                    <SelectTrigger className="w-72 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_DOSSIER}>— Sans dossier —</SelectItem>
                      {dossiers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                      ))}
                      <SelectItem value={NEW_DOSSIER}>+ Nouveau dossier…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={enregistrerTout} variant="default">
                  <SaveAll className="h-4 w-4 mr-1" />
                  Tout enregistrer dans le dossier ({leads.length})
                </Button>
              </div>
            )}

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
                    <tr
                      key={(p.siren ?? "x") + i}
                      className="border-t border-slate-700 hover:bg-slate-800/40 cursor-pointer"
                      onClick={() => ouvrirDetail(p)}
                    >
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
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => ouvrirDetail(p)} title="Détails">
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => enregistrerProspect(p)} title="Enregistrer">
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => convertirEnContact(p)} title="Convertir en contact">
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => ecarterProspect(p)} title="Écarter">
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
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Dossier</Label>
                <Select value={filtreDossier} onValueChange={setFiltreDossier}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="none">— Sans dossier —</SelectItem>
                    {dossiers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <th className="text-left p-2">Dossier</th>
                    <th className="text-left p-2">Statut</th>
                    <th className="text-left p-2 w-56">Notes</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mesLeads.length === 0 && (
                    <tr><td colSpan={9} className="p-6 text-center text-slate-400">Aucun lead enregistré</td></tr>
                  )}
                  {mesLeads.map((l) => (
                    <tr key={l.id} className="border-t border-slate-700 hover:bg-slate-800/40">
                      <td className="p-2 cursor-pointer" onClick={() => ouvrirDetail(l)}>
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
                        <Select
                          value={l.dossier_id ?? NO_DOSSIER}
                          onValueChange={(v) => deplacerLead(l.id, v === NO_DOSSIER ? null : v)}
                        >
                          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_DOSSIER}>— Sans dossier —</SelectItem>
                            {dossiers.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
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
                      <td className="p-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => ouvrirDetail(l)} title="Détails">
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setLeadToDelete(l)} title="Supprimer">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* ===== Dialog création dossier ===== */}
        <Dialog open={openCreateDossier} onOpenChange={setOpenCreateDossier}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau dossier</DialogTitle>
              <DialogDescription>
                Regroupe tes leads par zone, secteur ou campagne.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nom*</Label>
                <Input
                  value={newDossierNom}
                  onChange={(e) => setNewDossierNom(e.target.value)}
                  placeholder="17e arrondissement"
                />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={newDossierDesc}
                  onChange={(e) => setNewDossierDesc(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenCreateDossier(false)}>Annuler</Button>
              <Button onClick={creerDossier}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== Dialog renommer dossier ===== */}
        <Dialog open={!!renameDossier} onOpenChange={(o) => !o && setRenameDossier(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renommer le dossier</DialogTitle>
            </DialogHeader>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameDossier(null)}>Annuler</Button>
              <Button onClick={renommerDossierConfirm}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== Alert suppression dossier ===== */}
        <AlertDialog open={!!deleteDossier} onOpenChange={(o) => !o && setDeleteDossier(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce dossier ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le dossier « {deleteDossier?.nom} » sera supprimé. Les leads qu'il contient
                seront conservés mais détachés (sans dossier).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={supprimerDossierConfirm}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ===== Alert suppression lead ===== */}
        <AlertDialog open={!!leadToDelete} onOpenChange={(o) => !o && setLeadToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce lead ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {leadToDelete?.denomination ?? leadToDelete?.siren} » sera définitivement supprimé.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={supprimerLeadConfirm}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ===== Dialog détail lead ===== */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {detailLead?.denomination ?? "Détail du lead"}
              </DialogTitle>
              <DialogDescription>
                Données publiques (Annuaire des Entreprises + BODACC). Téléphone et e-mail ne
                sont pas dans l'open data — à compléter manuellement.
              </DialogDescription>
            </DialogHeader>

            {detailLoading && (
              <div className="flex items-center gap-2 text-slate-400 py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </div>
            )}

            {detailLead && !detailLoading && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Dénomination" value={detailInfo?.denomination ?? detailLead.denomination} />
                <DetailRow label="SIREN" value={detailInfo?.siren ?? detailLead.siren} />
                <DetailRow label="SIRET (siège)" value={detailInfo?.siret} />
                <DetailRow label="N° TVA" value={detailInfo?.num_tva} />
                <DetailRow
                  label="Forme juridique"
                  value={detailInfo?.forme_juridique ? `${detailInfo.forme_juridique}${detailInfo.forme_code ? ` (${detailInfo.forme_code})` : ""}` : null}
                />
                <DetailRow
                  label="Code NAF"
                  value={detailInfo?.naf ? `${detailInfo.naf}${detailInfo.naf_libelle ? ` — ${detailInfo.naf_libelle}` : ""}` : detailLead.naf}
                />
                <DetailRow label="Date de création" value={formatDateFr(detailInfo?.date_creation)} />
                <DetailRow
                  label="Dirigeant"
                  value={
                    detailInfo?.dirigeant ??
                    [detailLead.dirigeant_nom, detailLead.dirigeant_age ? `(${detailLead.dirigeant_age} ans)` : null]
                      .filter(Boolean)
                      .join(" ")
                  }
                />
                <DetailRow
                  label="Adresse siège"
                  value={
                    [
                      detailInfo?.adresse ?? detailLead.adresse,
                      `${detailInfo?.code_postal ?? detailLead.code_postal ?? ""} ${detailInfo?.commune ?? detailLead.commune ?? ""}`.trim(),
                    ]
                      .filter(Boolean)
                      .join(" — ")
                  }
                />
                <DetailRow
                  label="État"
                  value={detailLead.etat ? ETAT_LABEL[detailLead.etat as EtatDifficulte] : null}
                />
                {detailLead.mandataire && (
                  <DetailRow label="Mandataire judiciaire" value={detailLead.mandataire} />
                )}
                {detailLead.bodacc_id && (
                  <div className="col-span-2">
                    <a
                      href={`https://bodacc.fr/annonce/detail-annonce/${detailLead.bodacc_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm inline-flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Voir l'annonce BODACC
                    </a>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>Fermer</Button>
              {detailLead && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const p = new URLSearchParams();
                    if (detailLead.famille_metier) p.set("famille", detailLead.famille_metier);
                    if (detailLead.code_postal) p.set("codePostal", detailLead.code_postal);
                    if (detailLead.denomination) p.set("enseigne", detailLead.denomination);
                    const adr = [detailLead.adresse, detailLead.code_postal, detailLead.commune].filter(Boolean).join(" ");
                    if (adr) p.set("adresse", adr);
                    navigate(`/estimation?${p.toString()}`);
                  }}
                >
                  <Calculator className="h-4 w-4 mr-1" /> Estimer le fonds
                </Button>
              )}
              {detailLead && (
                <Button onClick={() => convertirEnContact(detailLead)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Convertir en contact
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-100">{value && value.trim() ? value : "—"}</div>
    </div>
  );
}

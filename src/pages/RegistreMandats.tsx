// src/pages/RegistreMandats.tsx
// REGISTRE LÉGAL des mandats (table registre_mandats).
// Exigences :
//  - voir TOUS les mandats, en ordre DÉCROISSANT par N° (du plus récent au plus ancien) ;
//  - la numérotation doit être CONTINUE : tout N° manquant apparaît quand même,
//    avec un bouton « Saisir » pour le renseigner (registre sans trou) ;
//  - le registre commence au N° de départ de l'agence (DEBUT_REGISTRE) ; les N° hors
//    séquence (ex. le N°30) restent affichés en bas pour ne rien perdre.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, FilePen, Send, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";
import { retirerMandatsExpires, nettyLabel, getIssueBadgeClass } from "@/lib/mandatStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import type { RegistreMandat } from "@/types/database";

// 1er numéro de mandat de l'agence (le registre démarre ici).
const DEBUT_REGISTRE = 222;
const TYPES_MANDAT = ["Simple", "Exclusif", "Semi-exclusif", "Délégation"];
const OBSERVATIONS = [
  "Mandat saisi",
  "Arrivé à terme",
  "Réalisé par l'agence",
  "Réalisé en inter-agences",
  "Réalisé par un confrère",
  "Réalisé entre particuliers",
  "Annulé",
  "Non signé",
];

function numeroInt(numero: string | null): number {
  const n = parseInt(String(numero ?? "").replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? -1 : n;
}

type DisplayRow = { numero: number; row: RegistreMandat | null };

export default function RegistreMandats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [params] = useSearchParams();
  const focusN = params.get("focus") ? parseInt(params.get("focus")!, 10) : null;
  const [all, setAll] = useState<RegistreMandat[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [saisie, setSaisie] = useState<number | null>(null);
  const [nbAValider, setNbAValider] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    load();
    loadCount();
  }, []);
  useEffect(() => {
    if (user?.id) loadDrafts();
    // eslint-disable-next-line
  }, [user?.id, isAdmin]);
  useEffect(() => {
    retirerMandatsExpires();
  }, []);
  useEffect(() => {
    setPage(0);
  }, [search]);

  async function load() {
    const { data } = await supabase.from("registre_mandats").select("*").limit(5000);
    const rows = ((data as RegistreMandat[]) ?? []).filter(
      (r) => !r.statut_validation || r.statut_validation === "valide"
    );
    setAll(rows);
  }
  async function loadCount() {
    const { data } = await supabase.from("registre_mandats").select("id").eq("statut_validation", "a_valider").limit(500);
    setNbAValider(((data as any[]) ?? []).length);
  }
  async function loadDrafts() {
    let q = supabase.from("registre_mandats").select("*").in("statut_validation", ["brouillon", "refuse"]).order("created_at", { ascending: false });
    if (!isAdmin && user?.id) q = q.eq("cree_par", user.id);
    const { data } = await q.limit(200);
    setDrafts(((data as any[]) ?? []));
  }

  async function soumettre(id: string) {
    const { error } = await supabase.from("registre_mandats").update({
      statut_validation: "a_valider",
      motif_refus: null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mandat soumis pour validation.");
    loadDrafts();
    loadCount();
  }

  // Ouvre la fiche du bien correspondant à une référence (depuis le registre).
  async function ouvrirBien(refBien: string, numero: number) {
    const { data } = await supabase.from("mandats").select("id").eq("reference", refBien).limit(1);
    const bien = (data as any[])?.[0];
    if (!bien) {
      toast.error(`Aucun bien avec la référence ${refBien}`);
      return;
    }
    navigate(`/biens/${bien.id}?fromMandat=${numero}`);
  }

  // Map N° -> mandat
  const byNum = useMemo(() => {
    const m = new Map<number, RegistreMandat>();
    for (const r of all) {
      const n = numeroInt(r.numero);
      if (n >= 0) m.set(n, r);
    }
    return m;
  }, [all]);

  // Séquence continue décroissante + entrées hors séquence en bas
  const displayAll = useMemo<DisplayRow[]>(() => {
    const presentNums = [...byNum.keys()];
    const maxN = presentNums.length ? Math.max(...presentNums, DEBUT_REGISTRE) : DEBUT_REGISTRE;
    const seq: DisplayRow[] = [];
    for (let n = maxN; n >= DEBUT_REGISTRE; n--) seq.push({ numero: n, row: byNum.get(n) ?? null });
    const below = presentNums
      .filter((n) => n < DEBUT_REGISTRE)
      .sort((a, b) => b - a)
      .map((n) => ({ numero: n, row: byNum.get(n)! }));
    return [...seq, ...below];
  }, [byNum]);

  // Retour depuis une fiche : se placer sur la page contenant le N° ciblé.
  useEffect(() => {
    if (focusN == null) return;
    const idx = displayAll.findIndex((d) => d.numero === focusN);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE));
  }, [focusN, displayAll]);

  // Recherche : ne garde que les mandats réels correspondants (les "manquants" sont masqués).
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return displayAll;
    return displayAll.filter(
      ({ row }) =>
        row &&
        [row.numero, row.mandant_nom, row.reference_bien, row.objet, row.negociateur].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(t),
        ),
    );
  }, [displayAll, search]);

  const total = filtered.length;
  const nbReels = useMemo(() => all.length, [all]);
  const nbManquants = useMemo(() => displayAll.filter((d) => !d.row).length, [displayAll]);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Registre des mandats</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">
            {nbReels} mandat(s) · {nbManquants} N° manquant(s)
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate("/mandats/a-valider")}>
            À valider
            {nbAValider > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-300 border-amber-500/40">{nbAValider}</Badge>
            )}
          </Button>
          <Button size="sm" onClick={() => navigate("/mandats/nouveau")}>
            <Plus className="mr-1 h-4 w-4" /> Nouveau mandat
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="N° mandat, mandant, référence du bien, objet, négociateur..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {drafts.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FilePen className="h-4 w-4 text-amber-400" />
              {isAdmin ? "Brouillons & mandats refusés" : "Mes brouillons & refus"}
              <Badge variant="outline" className="ml-1">{drafts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-border/40 last:border-0 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={d.statut_validation === "refuse" ? "destructive" : "outline"}>
                      {d.statut_validation === "refuse" ? "Refusé" : "Brouillon"}
                    </Badge>
                    <span className="font-medium">{d.nature_mandat ?? "—"} · {d.forme_mandat ?? "—"}</span>
                    <span className="text-muted-foreground">{d.mandant_nom ?? "Mandant —"}</span>
                    {d.reference_bien && <span className="text-xs text-muted-foreground">· Réf. {d.reference_bien}</span>}
                  </div>
                  {d.statut_validation === "refuse" && d.motif_refus && (
                    <p className="text-xs text-destructive mt-1">Motif : {d.motif_refus}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/mandats/${d.id}/edit`)}>
                    <FilePen className="mr-1 h-3.5 w-3.5" /> Continuer
                  </Button>
                  <Button size="sm" onClick={() => soumettre(d.id)}>
                    <Send className="mr-1 h-3.5 w-3.5" /> Soumettre
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}



      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3 w-20">N°</th>
              <th className="p-3">Objet / Type de mandat</th>
              <th className="p-3">Mandant</th>
              <th className="p-3 w-28">Bien</th>
              <th className="p-3">Mandat (début → fin)</th>
              <th className="p-3">État</th>
              <th className="p-3">Négociateur</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ numero, row }) => {
              if (!row) {
                // Numéro manquant : ligne à saisir (continuité du registre)
                return (
                  <tr
                    key={`m-${numero}`}
                    className={`border-t border-border/50 bg-amber-500/5 ${focusN === numero ? "ring-2 ring-primary/60" : ""}`}
                  >
                    <td className="p-3">
                      <span className="text-base font-bold text-muted-foreground">{numero}</span>
                    </td>
                    <td className="p-3 text-muted-foreground italic" colSpan={4}>
                      Numéro manquant — à renseigner
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        Manquant
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" onClick={() => setSaisie(numero)}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Saisir
                      </Button>
                    </td>
                  </tr>
                );
              }
              const m = row;
              return (
                <tr
                  key={m.id}
                  className={`border-t border-border/50 hover:bg-secondary/30 ${focusN === numero ? "ring-2 ring-primary/60 bg-primary/5" : ""}`}
                >
                  <td className="p-3">
                    <span className="text-base font-bold text-primary">{m.numero ?? "—"}</span>
                  </td>
                  <td className="p-3">
                    {m.objet ?? "—"}
                    {m.type_mandat ? (
                      <span className="block text-xs text-muted-foreground">{m.type_mandat}</span>
                    ) : null}
                  </td>
                  <td className="p-3">{m.mandant_nom ?? "—"}</td>
                  <td className="p-3">
                    {m.reference_bien ? (
                      <button
                        type="button"
                        onClick={() => ouvrirBien(m.reference_bien!, numero)}
                        className="rounded-md bg-primary/15 px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors"
                        title={`Voir la fiche du bien ${m.reference_bien}`}
                      >
                        {m.reference_bien}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    {m.date_debut && m.date_fin
                      ? `${formatDate(m.date_debut)} → ${formatDate(m.date_fin)}`
                      : (m.dates_mandat ?? (m.date_debut ? formatDate(m.date_debut) : "—"))}
                  </td>
                  <td className="p-3">
                    {m.observations ? (
                      <Badge className={getIssueBadgeClass(m.observations)}>{nettyLabel(m.observations)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span>{m.negociateur ?? "—"}</span>
                      {m.numero && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => { e.stopPropagation(); navigate(`/mandats/${m.id}/avenant`); }}
                          title="Créer un avenant à ce mandat"
                        >
                          <FilePlus2 className="mr-1 h-3.5 w-3.5" /> Avenant
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {total === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Aucun mandat trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} ligne(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span className="flex items-center px-2">
              Page {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      {saisie !== null && (
        <SaisieMandat
          numero={saisie}
          onClose={() => setSaisie(null)}
          onSaved={() => {
            setSaisie(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// --- Modal de saisie d'un mandat manquant -------------------------------
function SaisieMandat({ numero, onClose, onSaved }: { numero: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ objet: "Mandat de vente", type_mandat: "Simple" });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    const payload: Record<string, any> = { numero: String(numero) };
    for (const k of [
      "date_debut",
      "date_fin",
      "mandant_nom",
      "objet",
      "type_mandat",
      "reference_bien",
      "observations",
      "negociateur",
    ]) {
      if (f[k] !== undefined && f[k] !== "") payload[k] = f[k];
    }
    const { error } = await supabase.from("registre_mandats").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success(`Mandat N° ${numero} enregistré.`);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Saisir le mandat N° {numero}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Date de début">
            <Input type="date" value={f.date_debut ?? ""} onChange={(e) => set("date_debut", e.target.value)} />
          </Field>
          <Field label="Date de fin">
            <Input type="date" value={f.date_fin ?? ""} onChange={(e) => set("date_fin", e.target.value)} />
          </Field>
          <Field label="Mandant">
            <Input value={f.mandant_nom ?? ""} onChange={(e) => set("mandant_nom", e.target.value)} />
          </Field>
          <Field label="Référence du bien">
            <Input value={f.reference_bien ?? ""} onChange={(e) => set("reference_bien", e.target.value)} />
          </Field>
          <Field label="Objet">
            <Input value={f.objet ?? ""} onChange={(e) => set("objet", e.target.value)} />
          </Field>
          <Field label="Type de mandat">
            <Select value={f.type_mandat ?? ""} onValueChange={(v) => set("type_mandat", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {TYPES_MANDAT.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="État (observation)">
            <Select value={f.observations ?? ""} onValueChange={(v) => set("observations", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {OBSERVATIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Négociateur">
            <Input value={f.negociateur ?? ""} onChange={(e) => set("negociateur", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

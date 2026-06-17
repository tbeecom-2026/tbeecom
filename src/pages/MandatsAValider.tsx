import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, FileDown, ShieldCheck } from "lucide-react";
import { formatDate, formatEuros } from "@/lib/formatters";
import { getAgence } from "@/lib/agence";
import { generateMandatV2, openMandat } from "@/lib/generateMandat";

const DEBUT_REGISTRE = 222;

interface Row {
  id: string;
  numero: string | null;
  statut_validation: string | null;
  nature_mandat: string | null;
  forme_mandat: string | null;
  mandant_nom: string | null;
  reference_bien: string | null;
  designation_bien: string | null;
  prix: number | null;
  prix_net_vendeur: number | null;
  loyer: number | null;
  honoraires_montant: number | null;
  honoraires_charge: string | null;
  duree_mois: number | null;
  date_signature: string | null;
  preavis_jours: number | null;
  observations: string | null;
  motif_refus: string | null;
  cree_par: string | null;
  valide_par: string | null;
  valide_le: string | null;
  negociateur: string | null;
  adresse_bien: string | null;
  activite_bien: string | null;
  surfaces_bien: string | null;
  criteres_recherche: string | null;
  prix_max_recherche: number | null;
  created_at: string | null;
  avenant_de: string | null;
  avenant_numero: number | null;
  parent_numero?: string | null;
}

export default function MandatsAValider() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, loading: loadingAdmin } = useIsAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [refusOpen, setRefusOpen] = useState<Row | null>(null);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    let q = supabase.from("registre_mandats").select("*").eq("statut_validation", "a_valider").order("created_at", { ascending: false });
    if (!isAdmin && user?.id) q = q.eq("cree_par", user.id);
    const { data, error } = await q;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    const rs = ((data as Row[]) ?? []);
    // récupère le numéro des mandats parents pour les avenants
    const parentIds = Array.from(new Set(rs.map((r) => r.avenant_de).filter(Boolean) as string[]));
    let parentMap = new Map<string, string | null>();
    if (parentIds.length) {
      const { data: pd } = await supabase.from("registre_mandats").select("id, numero").in("id", parentIds);
      for (const p of ((pd as any[]) ?? [])) parentMap.set(p.id, p.numero ?? null);
    }
    setRows(rs.map((r) => ({ ...r, parent_numero: r.avenant_de ? parentMap.get(r.avenant_de) ?? null : null })));
  }
  useEffect(() => { if (!loadingAdmin) load(); /* eslint-disable-next-line */ }, [loadingAdmin, isAdmin, user?.id]);

  async function valider(row: Row) {
    if (!isAdmin || !user?.id) return;
    setBusy(true);
    let updatePayload: Record<string, any> = {
      statut_validation: "valide",
      valide_par: user.id,
      valide_le: new Date().toISOString(),
      motif_refus: null,
    };
    let messageDesc = "";
    if (row.avenant_de) {
      // Avenant : pas de n° de registre, mais n° d'avenant séquentiel pour ce parent
      const { data: existing } = await supabase
        .from("registre_mandats")
        .select("avenant_numero")
        .eq("avenant_de", row.avenant_de)
        .eq("statut_validation", "valide")
        .limit(500);
      const maxA = ((existing as any[]) ?? []).reduce((m, r) => {
        const n = Number(r.avenant_numero);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const nextA = maxA + 1;
      updatePayload.avenant_numero = nextA;
      messageDesc = `Avenant n° ${nextA} validé.`;
    } else {
      const { data: allNums } = await supabase.from("registre_mandats").select("numero").not("numero", "is", null).limit(5000);
      const maxN = ((allNums as any[]) ?? []).reduce((m, r) => {
        const n = parseInt(String(r.numero ?? "").replace(/\D/g, ""), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, DEBUT_REGISTRE - 1);
      const nextN = String(maxN + 1);
      updatePayload.numero = nextN;
      messageDesc = `N° ${nextN} attribué.`;
    }
    const { error } = await supabase.from("registre_mandats").update(updatePayload).eq("id", row.id);
    setBusy(false);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    toast({ title: "Mandat validé", description: messageDesc });
    load();
  }

  async function refuser() {
    if (!isAdmin || !refusOpen || !user?.id) return;
    setBusy(true);
    const { error } = await supabase.from("registre_mandats").update({
      statut_validation: "refuse",
      valide_par: user.id,
      valide_le: new Date().toISOString(),
      motif_refus: motif || "Refusé",
    }).eq("id", refusOpen.id);
    setBusy(false);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    toast({ title: "Mandat refusé" });
    setRefusOpen(null); setMotif("");
    load();
  }

  async function genererPDF(row: Row) {
    const agence = await getAgence();
    const html = await generateMandatV2(row as any, agence);
    openMandat(html);
  }

  const count = rows.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/mandats")}><ArrowLeft className="mr-1 h-4 w-4" /> Retour au registre</Button>
        <h1 className="text-2xl font-bold ml-2">Mandats à valider</h1>
        <Badge variant="outline" className="ml-2">{count}</Badge>
        {isAdmin && <Badge className="ml-1 bg-primary/20 text-primary border-primary/30"><ShieldCheck className="h-3 w-3 mr-1" /> Admin</Badge>}
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">Vous voyez uniquement vos propres demandes en attente. Seul un administrateur peut valider ou refuser.</p>
      )}

      {rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Aucun mandat en attente.</CardContent></Card>
      ) : rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{r.nature_mandat ?? "—"}</Badge>
              <Badge variant="outline">{r.forme_mandat ?? r.nature_mandat ?? "—"}</Badge>
              <span>{r.mandant_nom ?? "—"}</span>
              {r.reference_bien && <span className="text-xs text-muted-foreground">· Réf. {r.reference_bien}</span>}
              <Badge className="ml-auto bg-amber-500/20 text-amber-300 border-amber-500/40">À valider</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Info label="Désignation" value={r.designation_bien} />
              <Info label="Adresse" value={r.adresse_bien} />
              <Info label="Activité" value={r.activite_bien} />
              <Info label="Surfaces" value={r.surfaces_bien} />
              <Info label="Prix" value={r.prix != null ? formatEuros(r.prix) : null} />
              <Info label="Prix net" value={r.prix_net_vendeur != null ? formatEuros(r.prix_net_vendeur) : null} />
              <Info label="Loyer" value={r.loyer != null ? formatEuros(r.loyer) : null} />
              <Info label="Honoraires" value={r.honoraires_montant != null ? `${formatEuros(r.honoraires_montant)} (${r.honoraires_charge ?? "—"})` : null} />
              <Info label="Durée" value={r.duree_mois ? `${r.duree_mois} mois` : null} />
              <Info label="Signature" value={r.date_signature ? formatDate(r.date_signature) : null} />
              <Info label="Préavis" value={r.preavis_jours ? `${r.preavis_jours} j` : null} />
              <Info label="Négociateur" value={r.negociateur} />
              {r.criteres_recherche && <Info label="Critères" value={r.criteres_recherche} />}
              {r.prix_max_recherche != null && <Info label="Prix max" value={formatEuros(r.prix_max_recherche)} />}
            </div>
            {r.observations && <p className="text-xs text-muted-foreground italic">« {r.observations} »</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              {isAdmin ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setRefusOpen(r); setMotif(""); }} disabled={busy}>
                    <X className="mr-1 h-4 w-4" /> Refuser
                  </Button>
                  <Button size="sm" onClick={() => valider(r)} disabled={busy}>
                    <Check className="mr-1 h-4 w-4" /> Valider &amp; numéroter
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground italic">En attente de validation par un administrateur.</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Section des mandats récemment validés (admin) avec génération PDF */}
      {isAdmin && <DerniersValides onPDF={genererPDF} />}

      <Dialog open={!!refusOpen} onOpenChange={(o) => { if (!o) { setRefusOpen(null); setMotif(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser le mandat</DialogTitle></DialogHeader>
          <Textarea placeholder="Motif du refus (visible par le négociateur)…" value={motif} onChange={(e) => setMotif(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefusOpen(null)}>Annuler</Button>
            <Button variant="destructive" onClick={refuser} disabled={busy}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{String(value)}</div>
    </div>
  );
}

function DerniersValides({ onPDF }: { onPDF: (r: Row) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("registre_mandats").select("*").eq("statut_validation", "valide").order("valide_le", { ascending: false }).limit(10)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Derniers mandats validés — générer le PDF</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 py-2">
            <div>
              <span className="font-bold text-primary mr-2">N° {r.numero ?? "—"}</span>
              <span>{r.nature_mandat} — {r.forme_mandat}</span>
              <span className="text-muted-foreground"> · {r.mandant_nom ?? "—"}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => onPDF(r)}><FileDown className="mr-1 h-4 w-4" /> PDF</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Search } from "lucide-react";
import { calcHonoraires, type BaremeTranche } from "@/lib/honoraires";
import { formatEuros } from "@/lib/formatters";

const NATURES = [
  "Fonds de commerce",
  "Droit au bail",
  "Murs commerciaux",
  "Local / immobilier d'entreprise",
  "Cession de titres",
  "Recherche",
  "Location",
];
const FORMES = ["Simple", "Exclusif", "Semi-exclusif"];
const CHARGE = ["Acquéreur", "Vendeur"];

type ContactLite = { id: string; nom: string | null; prenom: string | null; societe: string | null; email: string | null; telephone: string | null; adresse: string | null; code_postal: string | null; commune: string | null };
type BienLite = { id: string; reference: string | null; titre: string | null; adresse: string | null; code_postal: string | null; commune: string | null; nature_activite: string | null; surface_commerciale: number | null; surface_totale: number | null; proprietaire_email?: string | null; proprietaire_nom?: string | null };

function escapeOr(s: string) {
  // PostgREST .or() : éviter virgules/parenthèses/guillemets qui cassent la syntaxe
  return s.replace(/[,()"']/g, " ").trim();
}
function buildSurfaces(b: BienLite) {
  const parts: string[] = [];
  if (b.surface_commerciale) parts.push(`${b.surface_commerciale} m² commerciale`);
  if (b.surface_totale) parts.push(`${b.surface_totale} m² totale`);
  return parts.join(" / ");
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export default function NouveauMandat() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // -------- état formulaire
  const [nature, setNature] = useState<string>("Fonds de commerce");
  const [forme, setForme] = useState<string>("Simple");

  // mandant
  const [mandantQ, setMandantQ] = useState("");
  const [mandantList, setMandantList] = useState<ContactLite[]>([]);
  const [mandant, setMandant] = useState<ContactLite | null>(null);
  const [newContactMode, setNewContactMode] = useState(false);

  // bien
  const [bienQ, setBienQ] = useState("");
  const [bienList, setBienList] = useState<BienLite[]>([]);
  const [bien, setBien] = useState<BienLite | null>(null);
  const [designation, setDesignation] = useState("");
  const [adresseBien, setAdresseBien] = useState("");
  const [activiteBien, setActiviteBien] = useState("");
  const [surfacesBien, setSurfacesBien] = useState("");

  // biens liés au mandant sélectionné
  const [biensDuMandant, setBiensDuMandant] = useState<BienLite[]>([]);
  const [loadingBiensMandant, setLoadingBiensMandant] = useState(false);

  // applique un bien au formulaire (pré-remplit les champs libres)
  function applyBien(b: BienLite) {
    setBien(b);
    setDesignation((d) => d || b.titre || "");
    setAdresseBien((a) => a || [b.adresse, b.code_postal, b.commune].filter(Boolean).join(", "));
    setActiviteBien((a) => a || b.nature_activite || "");
    setSurfacesBien((s) => s || buildSurfaces(b));
  }

  // recherche
  const [criteres, setCriteres] = useState("");
  const [prixMaxRecherche, setPrixMaxRecherche] = useState<string>("");

  // financier
  const [prix, setPrix] = useState<string>("");
  const [prixNet, setPrixNet] = useState<string>("");
  const [loyer, setLoyer] = useState<string>("");
  const [honoraires, setHonoraires] = useState<string>("");
  const [honorairesAuto, setHonorairesAuto] = useState(true);
  const [honorairesCharge, setHonorairesCharge] = useState("Acquéreur");

  // durée/dates
  const [dureeMois, setDureeMois] = useState<string>("3");
  const [dateSignature, setDateSignature] = useState<string>(new Date().toISOString().slice(0, 10));
  const [preavis, setPreavis] = useState<string>("15");
  const [observations, setObservations] = useState("");

  const [bareme, setBareme] = useState<BaremeTranche[]>([]);
  const [saving, setSaving] = useState(false);

  // -------- chargement barème
  useEffect(() => {
    supabase.from("bareme_honoraires").select("*").eq("type_trans", "fdc").order("ordre").then(({ data }) => {
      setBareme((data as BaremeTranche[]) ?? []);
    });
  }, []);

  // -------- recherche contacts
  useEffect(() => {
    const q = mandantQ.trim();
    if (q.length < 2 || mandant) {
      setMandantList([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, nom, prenom, societe, email, telephone, adresse, code_postal, commune")
        .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,societe.ilike.%${q}%`)
        .limit(8);
      setMandantList((data as ContactLite[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [mandantQ, mandant]);

  // -------- recherche biens
  useEffect(() => {
    const q = bienQ.trim();
    if (q.length < 2 || bien) {
      setBienList([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("mandats")
        .select("id, reference, titre, adresse, code_postal, commune, nature_activite, surface_commerciale, surface_totale, proprietaire_email, proprietaire_nom")
        .or(`reference.ilike.%${q}%,titre.ilike.%${q}%`)
        .limit(8);
      setBienList((data as BienLite[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [bienQ, bien]);

  // -------- mandant -> biens du mandant (auto)
  useEffect(() => {
    if (!mandant) { setBiensDuMandant([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingBiensMandant(true);
      const cols = "id, reference, titre, adresse, code_postal, commune, nature_activite, surface_commerciale, surface_totale, proprietaire_email, proprietaire_nom";
      const email = mandant.email?.trim();
      let rows: BienLite[] = [];
      if (email) {
        const { data } = await supabase.from("mandats").select(cols).ilike("proprietaire_email", email).limit(20);
        rows = (data as BienLite[]) ?? [];
      }
      if (rows.length === 0) {
        const fullName = [mandant.prenom, mandant.nom].filter(Boolean).join(" ").trim();
        const candidates = [fullName, mandant.nom, mandant.societe].filter((s): s is string => !!s && s.length >= 2);
        const seen = new Set<string>();
        for (const c of candidates) {
          const { data } = await supabase.from("mandats").select(cols).ilike("proprietaire_nom", `%${escapeOr(c)}%`).limit(20);
          for (const r of ((data as BienLite[]) ?? [])) {
            if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
          }
          if (rows.length >= 20) break;
        }
      }
      if (cancelled) return;
      setBiensDuMandant(rows);
      // auto pré-sélection si un seul bien et aucun bien encore choisi
      if (!bien && rows.length === 1) applyBien(rows[0]);
      setLoadingBiensMandant(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mandant?.id]);

  // -------- bien -> mandant (auto, sens inverse)
  useEffect(() => {
    if (!bien || mandant) return;
    let cancelled = false;
    (async () => {
      const email = bien.proprietaire_email?.trim();
      let rows: ContactLite[] = [];
      if (email) {
        const { data } = await supabase
          .from("contacts")
          .select("id, nom, prenom, societe, email, telephone, adresse, code_postal, commune")
          .ilike("email", email)
          .limit(5);
        rows = (data as ContactLite[]) ?? [];
      }
      if (rows.length === 0 && bien.proprietaire_nom) {
        const q = escapeOr(bien.proprietaire_nom);
        if (q.length >= 2) {
          const { data } = await supabase
            .from("contacts")
            .select("id, nom, prenom, societe, email, telephone, adresse, code_postal, commune")
            .or(`nom.ilike.%${q}%,societe.ilike.%${q}%`)
            .limit(5);
          rows = (data as ContactLite[]) ?? [];
        }
      }
      if (cancelled) return;
      if (rows.length === 1) setMandant(rows[0]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bien?.id]);

  // -------- honoraires auto
  const prixCalc = useMemo(() => {
    const n = parseFloat(prix);
    return Number.isFinite(n) ? n : 0;
  }, [prix]);

  useEffect(() => {
    if (!honorairesAuto || nature === "Location" || nature === "Recherche") return;
    const c = calcHonoraires(prixCalc, bareme);
    if (c) setHonoraires(String(c.montant));
  }, [prixCalc, bareme, honorairesAuto, nature]);

  const isExclusif = forme === "Exclusif" || forme === "Semi-exclusif";
  const isRecherche = nature === "Recherche";
  const isLocation = nature === "Location";
  const isMurs = nature === "Murs commerciaux" || nature === "Local / immobilier d'entreprise";

  async function save() {
    if (!user?.id) {
      toast({ title: "Erreur", description: "Vous devez être connecté.", variant: "destructive" });
      return;
    }
    if (!mandant && !newContactMode) {
      toast({ title: "Mandant requis", description: "Sélectionnez un contact ou créez-en un.", variant: "destructive" });
      return;
    }
    setSaving(true);

    let mandantId = mandant?.id ?? null;
    let mandantNom = mandant ? [mandant.prenom, mandant.nom].filter(Boolean).join(" ").trim() || mandant.societe : null;

    if (newContactMode && !mandantId) {
      // créer un contact rapide
      const newC: any = {
        nom: mandantQ.trim() || null,
        user_id: user.id,
      };
      const { data, error } = await supabase.from("contacts").insert(newC).select("id, nom").limit(1);
      if (error) {
        setSaving(false);
        toast({ title: "Erreur création contact", description: error.message, variant: "destructive" });
        return;
      }
      const created = (data as any[])?.[0];
      mandantId = created?.id ?? null;
      mandantNom = created?.nom ?? mandantQ.trim();
    }

    const negociateur = (user as any).name || user.email || "—";

    const payload: Record<string, any> = {
      numero: null,
      statut_validation: "a_valider",
      cree_par: user.id,
      negociateur,
      nature_mandat: nature,
      forme_mandat: forme,
      type_mandat: forme,
      objet: `${nature} — ${forme}`,
      mandant_id: mandantId,
      mandant_nom: mandantNom,
      bien_id: bien?.id ?? null,
      reference_bien: bien?.reference ?? null,
      designation_bien: designation || bien?.titre || null,
      adresse_bien: adresseBien || bien?.adresse || null,
      activite_bien: activiteBien || bien?.nature_activite || null,
      surfaces_bien: surfacesBien || null,
      criteres_recherche: isRecherche ? criteres : null,
      prix_max_recherche: isRecherche && prixMaxRecherche ? Number(prixMaxRecherche) : null,
      prix: prix ? Number(prix) : null,
      prix_net_vendeur: prixNet ? Number(prixNet) : null,
      loyer: loyer ? Number(loyer) : null,
      honoraires_montant: honoraires ? Number(honoraires) : null,
      honoraires_charge: honorairesCharge,
      duree_mois: dureeMois ? Number(dureeMois) : null,
      date_signature: dateSignature || null,
      date_debut: dateSignature || null,
      preavis_jours: isExclusif && preavis ? Number(preavis) : null,
      observations: observations || null,
    };

    const { error } = await supabase.from("registre_mandats").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mandat envoyé pour validation", description: "Un administrateur attribuera le n° de registre." });
    navigate("/mandats/a-valider");
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/mandats")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour au registre
        </Button>
        <h1 className="text-2xl font-bold ml-2">Nouveau mandat</h1>
        <Badge variant="outline" className="ml-2">Envoi pour validation</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Type de mandat</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nature">
            <Select value={nature} onValueChange={setNature}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NATURES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Forme">
            <Select value={forme} onValueChange={setForme}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Mandant</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {mandant ? (
            <div className="flex items-start justify-between rounded-md border border-border bg-secondary/30 p-3">
              <div className="text-sm">
                <div className="font-medium">{[mandant.prenom, mandant.nom].filter(Boolean).join(" ")} {mandant.societe ? `— ${mandant.societe}` : ""}</div>
                <div className="text-xs text-muted-foreground">{mandant.email ?? "—"} · {mandant.telephone ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{[mandant.adresse, mandant.code_postal, mandant.commune].filter(Boolean).join(", ") || "—"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setMandant(null); setMandantQ(""); }}>Changer</Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un contact (nom, prénom, société)…"
                  value={mandantQ}
                  onChange={(e) => { setMandantQ(e.target.value); setNewContactMode(false); }}
                />
              </div>
              {mandantList.length > 0 && (
                <div className="rounded-md border border-border divide-y divide-border/50 max-h-56 overflow-auto">
                  {mandantList.map((c) => (
                    <button key={c.id} type="button" onClick={() => setMandant(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/40">
                      <div className="font-medium">{[c.prenom, c.nom].filter(Boolean).join(" ")} {c.societe ? `— ${c.societe}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{c.email ?? "—"} · {c.telephone ?? "—"}</div>
                    </button>
                  ))}
                </div>
              )}
              {mandantQ.length >= 2 && mandantList.length === 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  Aucun contact trouvé.
                  <Button variant="outline" size="sm" onClick={() => setNewContactMode(true)}>
                    Créer « {mandantQ} » comme nouveau contact
                  </Button>
                </div>
              )}
              {newContactMode && (
                <p className="text-xs text-amber-400">
                  Un nouveau contact sera créé avec le nom « {mandantQ} » à l'enregistrement.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {!isRecherche && (
        <Card>
          <CardHeader><CardTitle className="text-base">Bien concerné</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {bien ? (
              <div className="flex items-start justify-between rounded-md border border-border bg-secondary/30 p-3">
                <div className="text-sm">
                  <div className="font-medium">{bien.reference ?? "—"} — {bien.titre ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{[bien.adresse, bien.code_postal, bien.commune].filter(Boolean).join(", ") || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {bien.nature_activite ?? "—"}{buildSurfaces(bien) ? ` · ${buildSurfaces(bien)}` : ""}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setBien(null); setBienQ(""); }}>Changer</Button>
              </div>
            ) : (
              <>
                {mandant && (loadingBiensMandant || biensDuMandant.length > 0) && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                    <div className="px-1 py-1 text-xs font-medium text-muted-foreground">
                      Biens de ce mandant {loadingBiensMandant ? "(recherche…)" : `(${biensDuMandant.length})`}
                    </div>
                    {biensDuMandant.length > 0 && (
                      <div className="divide-y divide-border/40 max-h-56 overflow-auto">
                        {biensDuMandant.map((b) => (
                          <button key={b.id} type="button" onClick={() => applyBien(b)}
                            className="w-full text-left px-2 py-2 text-sm hover:bg-secondary/40 rounded-sm">
                            <div className="font-medium">{b.reference ?? "—"} — {b.titre ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{[b.adresse, b.code_postal, b.commune].filter(Boolean).join(", ") || "—"}</div>
                            <div className="text-xs text-muted-foreground">{b.nature_activite ?? "—"}{buildSurfaces(b) ? ` · ${buildSurfaces(b)}` : ""}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Rechercher un bien (référence, titre)…"
                    value={bienQ} onChange={(e) => setBienQ(e.target.value)} />
                </div>
                {bienList.length > 0 && (
                  <div className="rounded-md border border-border divide-y divide-border/50 max-h-56 overflow-auto">
                    {bienList.map((b) => (
                      <button key={b.id} type="button" onClick={() => setBien(b)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/40">
                        <div className="font-medium">{b.reference ?? "—"} — {b.titre ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{[b.adresse, b.code_postal, b.commune].filter(Boolean).join(", ") || "—"}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/50">
              <p className="md:col-span-2 text-xs text-muted-foreground">Ou saisie libre / complément :</p>
              <Field label="Désignation"><Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="ex. Restaurant 60 couverts" /></Field>
              <Field label="Adresse du bien"><Input value={adresseBien} onChange={(e) => setAdresseBien(e.target.value)} /></Field>
              <Field label="Activité"><Input value={activiteBien} onChange={(e) => setActiviteBien(e.target.value)} /></Field>
              <Field label="Surfaces" hint="ex. 80 m² salle / 25 m² réserve"><Input value={surfacesBien} onChange={(e) => setSurfacesBien(e.target.value)} /></Field>
            </div>
          </CardContent>
        </Card>
      )}

      {isRecherche && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recherche acquéreur</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Critères de recherche">
              <Textarea rows={3} value={criteres} onChange={(e) => setCriteres(e.target.value)} placeholder="Type d'activité, secteur, surfaces…" />
            </Field>
            <Field label="Prix maximum (€)">
              <Input type="number" value={prixMaxRecherche} onChange={(e) => setPrixMaxRecherche(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Prix &amp; honoraires</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {!isLocation && (
            <>
              <Field label="Prix de présentation (€)"><Input type="number" value={prix} onChange={(e) => setPrix(e.target.value)} /></Field>
              <Field label={isMurs ? "Prix net vendeur (€)" : "Prix net vendeur / cédant (€)"}>
                <Input type="number" value={prixNet} onChange={(e) => setPrixNet(e.target.value)} />
              </Field>
            </>
          )}
          {isLocation && (
            <Field label="Loyer mensuel HC (€)"><Input type="number" value={loyer} onChange={(e) => setLoyer(e.target.value)} /></Field>
          )}
          <Field label="Honoraires HT (€)" hint={honorairesAuto ? `Pré-calculé via le barème (${formatEuros(Number(honoraires) || 0)})` : "Saisie manuelle"}>
            <div className="flex gap-2">
              <Input type="number" value={honoraires} onChange={(e) => { setHonoraires(e.target.value); setHonorairesAuto(false); }} />
              <Button type="button" variant="outline" size="sm" onClick={() => setHonorairesAuto(true)}>Auto</Button>
            </div>
          </Field>
          <Field label="Honoraires à la charge de">
            <Select value={honorairesCharge} onValueChange={setHonorairesCharge}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHARGE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Durée &amp; signature</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Durée (mois)"><Input type="number" value={dureeMois} onChange={(e) => setDureeMois(e.target.value)} /></Field>
          <Field label="Date de signature"><Input type="date" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} /></Field>
          {isExclusif && (
            <Field label="Préavis (jours)" hint="Mandat exclusif/semi-exclusif"><Input type="number" value={preavis} onChange={(e) => setPreavis(e.target.value)} /></Field>
          )}
          <div className="md:col-span-3">
            <Field label="Observations"><Textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/mandats")}>Annuler</Button>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Envoi…" : "Envoyer pour validation"}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Phone, Mail, MapPin, ExternalLink, User, Lock, FileText, Upload, Trash2 } from "lucide-react";
import { formatDate, formatEuros, getStatutBadge, getActiviteBadge, STATUTS_MANDAT, TYPES_MANDAT, TYPES_COMMERCE } from "@/lib/formatters";
import { calcHonoraires, pctEffectif, type BaremeTranche } from "@/lib/honoraires";
import type { Mandat, Activite, Contact, MandatVendeur } from "@/types/database";

const emptyMandat: Partial<Mandat> = {
  type_mandat: "simple", statut: "sur_le_marche", confidentiel: false,
  type_commerce: "Restaurant/bar", titre: "", commune: "",
  droit_au_bail: false, conforme_erp: false, conforme_pmr: false,
  extraction: false, murs_a_vendre: false, cles: false,
};

// ✅ Field défini ICI (hors du composant) pour éviter la re-création à chaque rendu
const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default function MandatDetail() {
  const { id } = useParams();
  const isNew = id === "nouveau";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [mandat, setMandat] = useState<Partial<Mandat>>(emptyMandat);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [vendeurs, setVendeurs] = useState<(MandatVendeur & { contact: Contact })[]>([]);
  const [bareme, setBareme] = useState<BaremeTranche[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBareme();
    if (!isNew && id) loadMandat(id);
  }, [id]);

  async function loadBareme() {
    const { data } = await supabase.from("bareme_honoraires").select("*").eq("type_trans", "fdc").order("ordre");
    setBareme((data as BaremeTranche[]) ?? []);
  }

  async function loadMandat(mandatId: string) {
    const { data } = await supabase.from("mandats").select("*").eq("id", mandatId).single();
    if (data) setMandat(data as Mandat);
    const { data: acts } = await supabase.from("activites").select("*").eq("mandat_id", mandatId).order("created_at", { ascending: false });
    setActivites((acts as Activite[]) ?? []);
    const { data: vends } = await supabase.from("mandat_vendeurs").select("*, contact:contacts(*)").eq("mandat_id", mandatId);
    setVendeurs((vends as any) ?? []);
  }

  function update(field: string, value: any) {
    setMandat((prev) => ({ ...prev, [field]: value }));
  }

  // Calcul honoraires depuis le barème TBEECOM (auto si le barème est chargé)
  const honResult = mandat.prix_demande && bareme.length
    ? calcHonoraires(mandat.prix_demande, bareme)
    : null;
  // Fallback : calcul manuel si % saisi à la main
  const honorairesCalc = honResult?.montant
    ?? (mandat.prix_demande && mandat.honoraires_pct
      ? Math.round(mandat.prix_demande * mandat.honoraires_pct / 100)
      : null);
  const honorairesPct = honResult?.pct
    ?? (honorairesCalc && mandat.prix_demande
      ? pctEffectif(honorairesCalc, mandat.prix_demande)
      : mandat.honoraires_pct ?? null);

  async function handleSave() {
    setSaving(true);
    const payload = { ...mandat, honoraires_montant: honorairesCalc, user_id: user?.id };

    if (isNew) {
      const ref = `FDC-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase.from("mandats").insert({ ...payload, reference: ref }).select().single();
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Mandat créé", description: `Référence : ${ref}` });
        navigate(`/mandats/${data.id}`, { replace: true });
      }
    } else {
      const { error } = await supabase.from("mandats").update(payload).eq("id", id);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Mandat mis à jour" });
      }
    }
    setSaving(false);
  }

  async function addActivite(type: string) {
    const desc = prompt("Description de l'activité :");
    if (!desc) return;
    const { error } = await supabase.from("activites").insert({
      type, description: desc, mandat_id: id, user_id: user?.id,
    });
    if (!error && id) {
      toast({ title: "Activité ajoutée" });
      loadMandat(id);
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/mandats")}><ArrowLeft className="mr-1 h-4 w-4" />Retour</Button>
        <h1 className="text-xl font-bold flex-1">
          {isNew ? "Nouveau mandat" : (
            <span>
              Mandat <span className="text-primary text-2xl">N°{mandat.numero_registre ?? "—"}</span>
              {mandat.commune && <span className="text-muted-foreground text-base font-normal ml-2">— {mandat.commune}</span>}
            </span>
          )}
        </h1>
        <Button onClick={handleSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "..." : "Enregistrer"}</Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-secondary">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
          <TabsTrigger value="bail">Bail</TabsTrigger>
          <TabsTrigger value="suivi">Suivi</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* N° Mandat : champ principal, obligatoire */}
              <Field label="N° Mandat ★">
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Ex: 720"
                    value={mandat.numero_registre ?? ""}
                    onChange={(e) => update("numero_registre", parseInt(e.target.value) || null)}
                    className={`text-lg font-bold text-primary border-primary ${!isNew ? "pr-8 bg-secondary/50 cursor-not-allowed opacity-80" : ""}`}
                    readOnly={!isNew}
                    title={!isNew ? "Le numéro de mandat ne peut pas être modifié" : undefined}
                  />
                  {!isNew && (
                    <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </Field>
              <Field label="Type de mandat">
                <Select value={mandat.type_mandat} onValueChange={(v) => update("type_mandat", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES_MANDAT.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Statut">
                <Select value={mandat.statut} onValueChange={(v) => update("statut", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUTS_MANDAT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Confidentiel">
                <Switch checked={mandat.confidentiel ?? false} onCheckedChange={(v) => update("confidentiel", v)} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Type de commerce">
                <Select value={mandat.type_commerce} onValueChange={(v) => update("type_commerce", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES_COMMERCE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Sous-type"><Input value={mandat.sous_type ?? ""} onChange={(e) => update("sous_type", e.target.value)} /></Field>
              <Field label="Titre" className="md:col-span-2"><Input value={mandat.titre ?? ""} onChange={(e) => update("titre", e.target.value)} /></Field>
              <Field label="Description" className="md:col-span-2"><Textarea value={mandat.description ?? ""} onChange={(e) => update("description", e.target.value)} rows={3} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Adresse" className="md:col-span-2"><Input value={mandat.adresse ?? ""} onChange={(e) => update("adresse", e.target.value)} /></Field>
              <Field label="Code postal"><Input value={mandat.code_postal ?? ""} onChange={(e) => update("code_postal", e.target.value)} /></Field>
              <Field label="Commune"><Input value={mandat.commune ?? ""} onChange={(e) => update("commune", e.target.value)} /></Field>
              <Field label="Secteur"><Input value={mandat.secteur ?? ""} onChange={(e) => update("secteur", e.target.value)} /></Field>
            </CardContent>
          </Card>

          {/* ── Carte Vendeur(s) ───────────────────────────────────────────── */}
          {!isNew && (
            <Card className="border-amber-700/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-primary" />
                  Vendeur(s)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vendeurs.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucun vendeur lié à ce mandat</p>
                ) : (
                  <div className="space-y-3">
                    {vendeurs.map((v) => {
                      const c = v.contact;
                      if (!c) return null;
                      return (
                        <div key={v.id} className="bg-secondary/50 rounded-lg p-3 flex flex-col gap-2">
                          {/* Nom + lien fiche */}
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => navigate(`/contacts/${c.id}`)}
                              className="text-left hover:opacity-80 transition-opacity cursor-pointer"
                            >
                              <span className="font-semibold text-sm hover:underline text-primary">
                                {c.prenom && `${c.prenom} `}{c.nom}
                              </span>
                              {c.societe && (
                                <span className="ml-2 text-xs text-muted-foreground hover:underline">— {c.societe}</span>
                              )}
                            </button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => navigate(`/contacts/${c.id}`)}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Fiche contact
                            </Button>
                          </div>
                          {/* Coordonnées */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            {c.telephone && (
                              <a
                                href={`tel:${c.telephone}`}
                                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                                {c.telephone}
                              </a>
                            )}
                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors truncate"
                              >
                                <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">{c.email}</span>
                              </a>
                            )}
                            {(c.adresse || c.commune) && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">
                                  {c.adresse && `${c.adresse}, `}{c.code_postal && `${c.code_postal} `}{c.commune}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Notes du contact si présentes */}
                          {c.notes && (
                            <p className="text-xs text-muted-foreground border-t border-border/40 pt-2 mt-1 italic">
                              {c.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="finances" className="mt-4 space-y-4">
          {/* Bloc honoraires automatique */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide flex items-center justify-between">
                <span>Honoraires — Barème TBEECOM</span>
                {honResult && (
                  <span className="text-xs text-primary font-normal normal-case">
                    Calculé automatiquement d'après le barème
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Prix demandé (€)">
                <Input
                  type="number"
                  value={mandat.prix_demande ?? ""}
                  onChange={(e) => update("prix_demande", Number(e.target.value) || null)}
                  className="font-semibold"
                  placeholder="Ex: 150000"
                />
              </Field>
              <Field label="Honoraires HT (calculé auto)">
                <div className={`flex h-10 items-center rounded-md border px-3 text-sm font-semibold ${honorairesCalc ? "text-primary border-primary/50 bg-primary/5" : "border-border text-muted-foreground"}`}>
                  {honorairesCalc ? formatEuros(honorairesCalc) : "Saisir le prix de vente"}
                </div>
              </Field>
              <Field label="Taux effectif">
                <div className="flex h-10 items-center rounded-md border border-border px-3 text-sm text-muted-foreground">
                  {honorairesPct != null ? `${honorairesPct} % HT` : honResult?.pct === null ? "Forfait" : "—"}
                </div>
              </Field>
              <Field label="Honoraires charge (A / V)">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={mandat.honoraires_charge ?? "acquereur"}
                  onChange={(e) => update("honoraires_charge", e.target.value)}
                >
                  <option value="acquereur">À la charge de l'acquéreur</option>
                  <option value="vendeur">À la charge du vendeur</option>
                  <option value="partage">Partagés (50/50)</option>
                </select>
              </Field>
              <Field label="Prix net vendeur (€)">
                <Input
                  type="number"
                  value={mandat.prix_net_vendeur ?? ""}
                  onChange={(e) => update("prix_net_vendeur", Number(e.target.value) || null)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="CA annuel HT (€)"><Input type="number" value={mandat.ca_annuel ?? ""} onChange={(e) => update("ca_annuel", Number(e.target.value) || null)} /></Field>
              <Field label="EBE (€)"><Input type="number" value={mandat.ebe ?? ""} onChange={(e) => update("ebe", Number(e.target.value) || null)} /></Field>
              <Field label="Résultat net (€)"><Input type="number" value={mandat.resultat_net ?? ""} onChange={(e) => update("resultat_net", Number(e.target.value) || null)} /></Field>
              <Field label="Effectif salariés"><Input type="number" value={mandat.effectif ?? ""} onChange={(e) => update("effectif", Number(e.target.value) || null)} /></Field>
              <Field label="Date du bilan"><Input type="date" value={mandat.date_bilan ?? ""} onChange={(e) => update("date_bilan", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bail" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Loyer mensuel HT (€)"><Input type="number" value={mandat.loyer_mensuel ?? ""} onChange={(e) => update("loyer_mensuel", Number(e.target.value) || null)} /></Field>
              <Field label="Charges mensuelles (€)"><Input type="number" value={mandat.charges_mensuelles ?? ""} onChange={(e) => update("charges_mensuelles", Number(e.target.value) || null)} /></Field>
              <Field label="Date début bail"><Input type="date" value={mandat.date_debut_bail ?? ""} onChange={(e) => update("date_debut_bail", e.target.value)} /></Field>
              <Field label="Date fin bail"><Input type="date" value={mandat.date_fin_bail ?? ""} onChange={(e) => update("date_fin_bail", e.target.value)} /></Field>
              <Field label="Durée (ans)"><Input type="number" value={mandat.duree_bail ?? ""} onChange={(e) => update("duree_bail", Number(e.target.value) || null)} /></Field>
              <Field label="Date renouvellement"><Input type="date" value={mandat.date_renouvellement ?? ""} onChange={(e) => update("date_renouvellement", e.target.value)} /></Field>
              <Field label="Clause de destination" className="md:col-span-3"><Input value={mandat.clause_destination ?? ""} onChange={(e) => update("clause_destination", e.target.value)} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Droit au bail"><Switch checked={mandat.droit_au_bail ?? false} onCheckedChange={(v) => update("droit_au_bail", v)} /></Field>
              {mandat.droit_au_bail && <Field label="Montant droit au bail (€)"><Input type="number" value={mandat.montant_droit_bail ?? ""} onChange={(e) => update("montant_droit_bail", Number(e.target.value) || null)} /></Field>}
              <Field label="Surface commerciale (m²)"><Input type="number" value={mandat.surface_commerciale ?? ""} onChange={(e) => update("surface_commerciale", Number(e.target.value) || null)} /></Field>
              <Field label="Surface réserves (m²)"><Input type="number" value={mandat.surface_reserves ?? ""} onChange={(e) => update("surface_reserves", Number(e.target.value) || null)} /></Field>
              <Field label="Surface cuisine (m²)"><Input type="number" value={mandat.surface_cuisine ?? ""} onChange={(e) => update("surface_cuisine", Number(e.target.value) || null)} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-6">
              <Field label="Conforme ERP"><Switch checked={mandat.conforme_erp ?? false} onCheckedChange={(v) => update("conforme_erp", v)} /></Field>
              <Field label="Conforme PMR"><Switch checked={mandat.conforme_pmr ?? false} onCheckedChange={(v) => update("conforme_pmr", v)} /></Field>
              <Field label="Extraction"><Switch checked={mandat.extraction ?? false} onCheckedChange={(v) => update("extraction", v)} /></Field>
              <Field label="Murs à vendre"><Switch checked={mandat.murs_a_vendre ?? false} onCheckedChange={(v) => update("murs_a_vendre", v)} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suivi" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Date sur le marché"><Input type="date" value={mandat.date_sur_le_marche ?? ""} onChange={(e) => update("date_sur_le_marche", e.target.value)} /></Field>
              <Field label="Date sous compromis"><Input type="date" value={mandat.date_sous_compromis ?? ""} onChange={(e) => update("date_sous_compromis", e.target.value)} /></Field>
              <Field label="Date vendu"><Input type="date" value={mandat.date_vendu ?? ""} onChange={(e) => update("date_vendu", e.target.value)} /></Field>
              <Field label="Date retiré"><Input type="date" value={mandat.date_retire ?? ""} onChange={(e) => update("date_retire", e.target.value)} /></Field>
              <Field label="Clés"><Switch checked={mandat.cles ?? false} onCheckedChange={(v) => update("cles", v)} /></Field>
              <Field label="Notes internes" className="md:col-span-3"><Textarea value={mandat.notes_internes ?? ""} onChange={(e) => update("notes_internes", e.target.value)} rows={3} /></Field>
            </CardContent>
          </Card>

          {/* Section Documents */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#C9A84C]" />Documents</CardTitle>
              {!isNew && (
                <label className="cursor-pointer">
                  <input type="file" accept="application/pdf" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !mandat.reference) return;
                    const path = `${mandat.reference}/${Date.now()}_${file.name}`;
                    const { error } = await supabase.storage.from('mandats-docs').upload(path, file, { upsert: true });
                    if (error) { toast({ title: "Erreur upload", description: error.message, variant: "destructive" }); return; }
                    const { data: { publicUrl } } = supabase.storage.from('mandats-docs').getPublicUrl(path);
                    const newDoc = { type: "document", label: file.name.replace('.pdf',''), url: publicUrl, date: new Date().toISOString().split('T')[0] };
                    const docs = [...((mandat as any).documents || []), newDoc];
                    update("documents", docs);
                    update("document_url", publicUrl);
                    toast({ title: "PDF uploadé", description: file.name });
                  }} />
                  <Button variant="outline" size="sm" className="pointer-events-none" asChild>
                    <span><Upload className="h-3 w-3 mr-1" />Ajouter un PDF</span>
                  </Button>
                </label>
              )}
            </CardHeader>
            <CardContent>
              {((mandat as any).documents?.length > 0) ? (
                <div className="space-y-2">
                  {((mandat as any).documents as any[]).map((doc: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#C9A84C] shrink-0" />
                        <div>
                          <div className="font-medium">{doc.label}</div>
                          <div className="text-xs text-muted-foreground">{doc.date}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 text-xs"><ExternalLink className="h-3 w-3 mr-1" />Ouvrir</Button>
                        </a>
                        <a href={doc.url} download>
                          <Button variant="outline" size="sm" className="h-7 text-xs border-[#C9A84C] text-[#C9A84C]">Télécharger</Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun document. Uploadez le mandat signé (PDF).</p>
              )}
            </CardContent>
          </Card>

          {!isNew && (
            <>
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Journal d'activité</CardTitle>
                  <div className="flex gap-1">
                    {["appel", "email", "visite", "relance", "note", "rdv"].map((t) => (
                      <Button key={t} variant="outline" size="sm" onClick={() => addActivite(t)} className="text-xs capitalize">{t}</Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  {activites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune activité</p>
                  ) : (
                    <div className="space-y-2">
                      {activites.map((a) => {
                        const badge = getActiviteBadge(a.type);
                        return (
                          <div key={a.id} className="flex items-start gap-3 text-sm border-b border-border/50 pb-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.created_at)}</span>
                            <Badge className={`${badge.color} text-xs`}>{badge.label}</Badge>
                            <span>{a.description}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

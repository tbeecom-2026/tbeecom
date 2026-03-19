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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus } from "lucide-react";
import { formatEuros, TYPES_COMMERCE } from "@/lib/formatters";
import type { Recherche, Contact, Rapprochement, Mandat } from "@/types/database";

export default function AcquereurDetail() {
  const { id } = useParams();
  const isNew = id === "nouveau";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [contact, setContact] = useState<Partial<Contact>>({ nom: "", prenom: "", roles: ["acquereur"] });
  const [recherche, setRecherche] = useState<Partial<Recherche>>({
    statut: "actif", types_commerce: [], villes: [], departements: [],
    financement_bancaire: false, conforme_erp: null, conforme_pmr: null,
    extraction: null, murs_souhaites: null,
  });
  const [rapprochements, setRapprochements] = useState<(Rapprochement & { mandat: Mandat })[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isNew && id) loadData(id); }, [id]);

  async function loadData(rechId: string) {
    const { data: rech } = await supabase.from("recherches").select("*, contact:contacts(*)").eq("id", rechId).single();
    if (rech) {
      setRecherche(rech as Recherche);
      setContact((rech as any).contact ?? {});
    }
    const { data: rapps } = await supabase.from("rapprochements").select("*, mandat:mandats(*)").eq("recherche_id", rechId);
    setRapprochements((rapps as any) ?? []);
  }

  function updateContact(field: string, value: any) { setContact((p) => ({ ...p, [field]: value })); }
  function updateRecherche(field: string, value: any) { setRecherche((p) => ({ ...p, [field]: value })); }

  function toggleTypeCommerce(type: string) {
    const current = recherche.types_commerce ?? [];
    updateRecherche("types_commerce", current.includes(type) ? current.filter((t) => t !== type) : [...current, type]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let contactId = (recherche as Recherche).contact_id;
      if (isNew) {
        const { data: c, error: ce } = await supabase.from("contacts").insert({ ...contact, user_id: user?.id }).select().single();
        if (ce) throw ce;
        contactId = c.id;
        const { data: r, error: re } = await supabase.from("recherches").insert({ ...recherche, contact_id: contactId, user_id: user?.id }).select().single();
        if (re) throw re;
        toast({ title: "Acquéreur créé" });
        navigate(`/acquereurs/${r.id}`, { replace: true });
      } else {
        await supabase.from("contacts").update(contact).eq("id", contactId);
        const { contact: _, ...rechData } = recherche as any;
        await supabase.from("recherches").update(rechData).eq("id", id);
        toast({ title: "Acquéreur mis à jour" });
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function proposerMandat() {
    const ref = prompt("Référence du mandat à proposer :");
    if (!ref) return;
    const { data: mandat } = await supabase.from("mandats").select("id").eq("reference", ref).single();
    if (!mandat) { toast({ title: "Mandat non trouvé", variant: "destructive" }); return; }
    const { error } = await supabase.from("rapprochements").insert({ recherche_id: id, mandat_id: mandat.id, statut: "propose" });
    if (!error) { toast({ title: "Mandat proposé" }); if (id) loadData(id); }
  }

  const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
    <div className={`space-y-1.5 ${className}`}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/acquereurs")}><ArrowLeft className="mr-1 h-4 w-4" />Retour</Button>
        <h1 className="text-xl font-bold flex-1">{isNew ? "Nouvel acquéreur" : `${contact.nom} ${contact.prenom ?? ""}`}</h1>
        <Button onClick={handleSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "..." : "Enregistrer"}</Button>
      </div>

      <Tabs defaultValue="profil">
        <TabsList className="bg-secondary">
          <TabsTrigger value="profil">Profil & Recherche</TabsTrigger>
          {!isNew && <TabsTrigger value="rapprochements">Rapprochements</TabsTrigger>}
        </TabsList>

        <TabsContent value="profil" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nom"><Input value={contact.nom ?? ""} onChange={(e) => updateContact("nom", e.target.value)} /></Field>
              <Field label="Prénom"><Input value={contact.prenom ?? ""} onChange={(e) => updateContact("prenom", e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={contact.email ?? ""} onChange={(e) => updateContact("email", e.target.value)} /></Field>
              <Field label="Téléphone"><Input value={contact.telephone ?? ""} onChange={(e) => updateContact("telephone", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Critères de recherche</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Budget min (€)"><Input type="number" value={recherche.budget_min ?? ""} onChange={(e) => updateRecherche("budget_min", Number(e.target.value) || null)} /></Field>
              <Field label="Budget max (€)"><Input type="number" value={recherche.budget_max ?? ""} onChange={(e) => updateRecherche("budget_max", Number(e.target.value) || null)} /></Field>
              <Field label="Apport (€)"><Input type="number" value={recherche.apport ?? ""} onChange={(e) => updateRecherche("apport", Number(e.target.value) || null)} /></Field>
              <Field label="Droit au bail max (€)"><Input type="number" value={recherche.droit_bail_max ?? ""} onChange={(e) => updateRecherche("droit_bail_max", Number(e.target.value) || null)} /></Field>
              <Field label="Financement bancaire"><Switch checked={recherche.financement_bancaire ?? false} onCheckedChange={(v) => updateRecherche("financement_bancaire", v)} /></Field>
              <Field label="Statut">
                <Select value={recherche.statut} onValueChange={(v) => updateRecherche("statut", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="en_pause">En pause</SelectItem>
                    <SelectItem value="archive">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Types de commerce recherchés</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {TYPES_COMMERCE.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={recherche.types_commerce?.includes(t)} onCheckedChange={() => toggleTypeCommerce(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Zone géographique</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Villes (séparées par des virgules)"><Input value={recherche.villes?.join(", ") ?? ""} onChange={(e) => updateRecherche("villes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field>
              <Field label="Départements"><Input value={recherche.departements?.join(", ") ?? ""} onChange={(e) => updateRecherche("departements", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field>
              <Field label="Rayon (km)"><Input type="number" value={recherche.rayon_km ?? ""} onChange={(e) => updateRecherche("rayon_km", Number(e.target.value) || null)} /></Field>
              <Field label="Surface min (m²)"><Input type="number" value={recherche.surface_min ?? ""} onChange={(e) => updateRecherche("surface_min", Number(e.target.value) || null)} /></Field>
              <Field label="Surface max (m²)"><Input type="number" value={recherche.surface_max ?? ""} onChange={(e) => updateRecherche("surface_max", Number(e.target.value) || null)} /></Field>
              <Field label="Activités libres"><Input value={recherche.activites_libres ?? ""} onChange={(e) => updateRecherche("activites_libres", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        {!isNew && (
          <TabsContent value="rapprochements" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Mandats proposés</CardTitle>
                <Button onClick={proposerMandat} size="sm"><Plus className="mr-1 h-4 w-4" />Proposer un mandat</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="pb-2 pr-4">Référence</th>
                        <th className="pb-2 pr-4">Type commerce</th>
                        <th className="pb-2 pr-4">Commune</th>
                        <th className="pb-2 pr-4">Prix</th>
                        <th className="pb-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapprochements.map((r) => (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-2 pr-4 text-primary">{r.mandat?.reference}</td>
                          <td className="py-2 pr-4">{r.mandat?.type_commerce}</td>
                          <td className="py-2 pr-4">{r.mandat?.commune}</td>
                          <td className="py-2 pr-4">{formatEuros(r.mandat?.prix_demande)}</td>
                          <td className="py-2"><Badge variant="outline">{r.statut}</Badge></td>
                        </tr>
                      ))}
                      {rapprochements.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Aucun rapprochement</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

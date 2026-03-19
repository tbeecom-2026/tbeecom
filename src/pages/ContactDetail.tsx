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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Phone, Mail, MapPin, Building2,
  FileText, ChevronDown, ExternalLink, User, Briefcase,
  Search, Loader2, Globe, Euro, Calendar, Hash, Target, Plus
} from "lucide-react";
import { formatDate, formatEuros, getActiviteBadge, getStatutBadge, ROLES_CONTACT, TYPES_COMMERCE } from "@/lib/formatters";
import { generateMandatSimple, generateMandatExclusif, generateAvenant, openMandat } from "@/lib/generateMandat";
import { lookupSiret, sireneToContact } from "@/lib/sirene";
import type { Contact, Mandat, MandatVendeur, Activite, Recherche, Rapprochement } from "@/types/database";

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

type MandatLie = MandatVendeur & { mandat: Mandat };
type RappWithMandat = Rapprochement & { mandat: Mandat };

export default function ContactDetail() {
  const { id } = useParams();
  const isNew = id === "nouveau";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [contact, setContact] = useState<Partial<Contact>>({ nom: "", roles: [] });
  const [mandatsLies, setMandatsLies] = useState<MandatLie[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [recherche, setRecherche] = useState<Partial<Recherche>>({
    statut: "actif", types_commerce: [], villes: [], departements: [],
    financement_bancaire: false,
  });
  const [rapprochements, setRapprochements] = useState<RappWithMandat[]>([]);
  const [saving, setSaving] = useState(false);
  const [siretInput, setSiretInput] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isNew && id) loadContact(id);
  }, [id]);

  async function loadContact(contactId: string) {
    const { data } = await supabase.from("contacts").select("*").eq("id", contactId).single();
    if (data) {
      setContact(data as Contact);
      setSiretInput((data as Contact).siret ?? "");
    }

    const { data: mv } = await supabase
      .from("mandat_vendeurs").select("*, mandat:mandats(*)").eq("contact_id", contactId);
    setMandatsLies((mv as any) ?? []);

    const { data: acts } = await supabase
      .from("activites").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
    setActivites((acts as Activite[]) ?? []);

    // Recherche acquéreur (1 par contact)
    const { data: rech } = await supabase
      .from("recherches").select("*").eq("contact_id", contactId).maybeSingle();
    if (rech) setRecherche(rech as Recherche);

    // Rapprochements si recherche existe
    if (rech) {
      const { data: rapps } = await supabase
        .from("rapprochements").select("*, mandat:mandats(*)").eq("recherche_id", rech.id);
      setRapprochements((rapps as any) ?? []);
    }
  }

  function update(field: string, value: any) {
    setContact((prev) => ({ ...prev, [field]: value }));
  }
  function updateRech(field: string, value: any) {
    setRecherche((prev) => ({ ...prev, [field]: value }));
  }
  function toggleRole(role: string) {
    const roles = contact.roles ?? [];
    update("roles", roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]);
  }
  function toggleTypeCommerce(type: string) {
    const current = recherche.types_commerce ?? [];
    updateRech("types_commerce", current.includes(type) ? current.filter((t) => t !== type) : [...current, type]);
  }

  async function handleSiretSearch() {
    if (!siretInput) return;
    setSearching(true);
    try {
      const result = await lookupSiret(siretInput);
      const mapped = sireneToContact(result);
      setContact((prev) => ({
        ...prev, ...mapped,
        nom: prev.nom || (result.nom_dirigeant?.split(" ").slice(-1)[0] ?? prev.nom ?? ""),
        prenom: prev.prenom || (result.prenom_dirigeant ?? prev.prenom ?? null),
      }));
      setSiretInput(result.siret);
      toast({ title: `✓ ${result.societe} trouvée`, description: `${result.libelle_forme_juridique ?? ""} — ${result.commune ?? ""}` });
    } catch (e: any) {
      toast({ title: "Introuvable", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const payload = { ...contact, siret: siretInput || contact.siret || null };
    try {
      let contactId = contact.id;
      if (isNew) {
        const { data, error } = await supabase.from("contacts").insert({ ...payload, user_id: user?.id }).select().single();
        if (error) throw error;
        contactId = data.id;
        toast({ title: "Contact créé" });
        navigate(`/contacts/${data.id}`, { replace: true });
      } else {
        const { error } = await supabase.from("contacts").update(payload).eq("id", id);
        if (error) throw error;
        toast({ title: "Contact mis à jour" });
      }

      // Sauvegarder la recherche si acquéreur
      if (contact.roles?.includes("acquereur") && contactId) {
        const rechPayload = { ...recherche, contact_id: contactId, user_id: user?.id };
        const { contact: _, ...clean } = rechPayload as any;
        if ((recherche as Recherche).id) {
          await supabase.from("recherches").update(clean).eq("id", (recherche as Recherche).id);
        } else if (!isNew) {
          const { data: newRech } = await supabase.from("recherches").insert(clean).select().single();
          if (newRech) setRecherche(newRech as Recherche);
        }
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function proposerMandat() {
    const ref = prompt("N° de registre ou référence du mandat :");
    if (!ref) return;
    const { data: mandat } = await supabase.from("mandats")
      .select("id").or(`reference.eq.${ref},numero_registre.eq.${ref}`).single();
    if (!mandat) { toast({ title: "Mandat non trouvé", variant: "destructive" }); return; }
    const rechId = (recherche as Recherche).id;
    if (!rechId) { toast({ title: "Créez d'abord la fiche recherche", variant: "destructive" }); return; }
    const { error } = await supabase.from("rapprochements").insert({ recherche_id: rechId, mandat_id: mandat.id, statut: "propose" });
    if (!error) { toast({ title: "Mandat proposé" }); if (id) loadContact(id); }
  }

  const isVendeur = contact.roles?.includes("vendeur");
  const isAcquereur = contact.roles?.includes("acquereur");
  const ROLES_AVEC_MANDAT = ["vendeur", "acquereur", "bailleur", "investisseur"];
  const peutGenerer = !isNew && contact.roles?.some((r) => ROLES_AVEC_MANDAT.includes(r));
  const mandatVide: Partial<Mandat> = {};
  const vendeurPourGen = [{ id: "", mandat_id: "", contact_id: contact.id ?? "", contact: contact as Contact }];

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="mr-1 h-4 w-4" />Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {isNew ? "Nouveau contact" : (
              <span>
                {contact.prenom && `${contact.prenom} `}
                <span className="text-primary">{contact.nom || "—"}</span>
                {contact.societe && <span className="text-muted-foreground text-base font-normal ml-2">— {contact.societe}</span>}
              </span>
            )}
          </h1>
          {!isNew && contact.roles && contact.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {contact.roles.map((r) => {
                const role = ROLES_CONTACT.find((rc) => rc.value === r);
                return <Badge key={r} className={`text-xs ${role?.color ?? "bg-slate-500 text-white"}`}>{role?.label ?? r}</Badge>;
              })}
            </div>
          )}
        </div>
        {peutGenerer && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                <FileText className="mr-2 h-4 w-4" />Générer un document<ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem className="cursor-pointer" onClick={() => openMandat(generateMandatSimple(mandatVide as Mandat, vendeurPourGen))}>
                <FileText className="mr-2 h-4 w-4 text-primary" />Contrat de mission simple
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => openMandat(generateMandatExclusif(mandatVide as Mandat, vendeurPourGen))}>
                <FileText className="mr-2 h-4 w-4 text-amber-500" />Mandat exclusif
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => openMandat(generateAvenant(mandatVide as Mandat, vendeurPourGen))}>
                <FileText className="mr-2 h-4 w-4 text-blue-400" />Avenant au mandat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? "..." : "Enregistrer"}
        </Button>
      </div>

      <Tabs defaultValue="coordonnees">
        <TabsList className="bg-secondary flex-wrap h-auto gap-1">
          <TabsTrigger value="coordonnees"><User className="mr-1.5 h-3.5 w-3.5" />Coordonnées</TabsTrigger>
          <TabsTrigger value="juridique"><Building2 className="mr-1.5 h-3.5 w-3.5" />Société</TabsTrigger>
          {isAcquereur && (
            <TabsTrigger value="recherche"><Target className="mr-1.5 h-3.5 w-3.5" />Recherche</TabsTrigger>
          )}
          {isAcquereur && !isNew && (
            <TabsTrigger value="rapprochements">
              Rapprochements
              {rapprochements.length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">{rapprochements.length}</span>
              )}
            </TabsTrigger>
          )}
          {isVendeur && (
            <TabsTrigger value="mandats">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />Mandats liés
              {mandatsLies.length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">{mandatsLies.length}</span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="activites">Activités</TabsTrigger>
        </TabsList>

        {/* ── Coordonnées ───────────────────────────────────────────── */}
        <TabsContent value="coordonnees" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                <User className="h-4 w-4" />Identité
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Nom *">
                <Input value={contact.nom ?? ""} onChange={(e) => update("nom", e.target.value)} className="font-semibold" />
              </Field>
              <Field label="Prénom">
                <Input value={contact.prenom ?? ""} onChange={(e) => update("prenom", e.target.value)} />
              </Field>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Rôles</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {ROLES_CONTACT.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={contact.roles?.includes(r.value) ?? false} onCheckedChange={() => toggleRole(r.value)} />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                <Phone className="h-4 w-4" />Contact direct
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Email">
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" className="pl-9" value={contact.email ?? ""} onChange={(e) => update("email", e.target.value)} />
                </div>
              </Field>
              <Field label="Téléphone mobile">
                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={contact.telephone ?? ""} onChange={(e) => update("telephone", e.target.value)} />
                </div>
              </Field>
              <Field label="Téléphone fixe">
                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={contact.telephone_fixe ?? ""} onChange={(e) => update("telephone_fixe", e.target.value)} />
                </div>
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                <MapPin className="h-4 w-4" />Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Adresse" className="md:col-span-2">
                <Input value={contact.adresse ?? ""} onChange={(e) => update("adresse", e.target.value)} />
              </Field>
              <Field label="Code postal">
                <Input value={contact.code_postal ?? ""} onChange={(e) => update("code_postal", e.target.value)} />
              </Field>
              <Field label="Commune">
                <Input value={contact.commune ?? ""} onChange={(e) => update("commune", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Field label="Notes internes">
                <Textarea value={contact.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={3} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Société ───────────────────────────────────────────────── */}
        <TabsContent value="juridique" className="mt-4 space-y-4">
          <Card className="border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />Recherche automatique par SIRET
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input value={siretInput} onChange={(e) => setSiretInput(e.target.value.replace(/\s/g, ""))}
                  placeholder="14 chiffres — ex: 93332359400012" maxLength={14}
                  className="font-mono text-base tracking-wider flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSiretSearch()} />
                <Button onClick={handleSiretSearch} disabled={searching || siretInput.length !== 14} className="shrink-0">
                  {searching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recherche...</> : <><Search className="mr-2 h-4 w-4" />Rechercher</>}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Remplit automatiquement raison sociale, adresse, forme juridique, dirigeant, capital, NAF, TVA depuis la base INSEE/SIRENE.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                <Building2 className="h-4 w-4" />Identification
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Raison sociale" className="md:col-span-2">
                <Input value={contact.societe ?? ""} onChange={(e) => update("societe", e.target.value)} className="font-semibold" />
              </Field>
              <Field label="SIRET">
                <Input value={siretInput} onChange={(e) => setSiretInput(e.target.value)} maxLength={14} className="font-mono" />
              </Field>
              <Field label="SIREN">
                <div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9 font-mono" value={contact.siren ?? ""} onChange={(e) => update("siren", e.target.value)} />
                </div>
              </Field>
              <Field label="N° TVA">
                <Input value={contact.tva_intracommunautaire ?? ""} onChange={(e) => update("tva_intracommunautaire", e.target.value)} className="font-mono" />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                <Euro className="h-4 w-4" />Informations légales
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Forme juridique (code)">
                <Input value={contact.forme_juridique ?? ""} onChange={(e) => update("forme_juridique", e.target.value)} />
              </Field>
              <Field label="Libellé forme juridique" className="md:col-span-2">
                <Input value={contact.libelle_forme_juridique ?? ""} onChange={(e) => update("libelle_forme_juridique", e.target.value)} placeholder="SARL, SAS, EURL..." />
              </Field>
              <Field label="Capital social (€)">
                <Input type="number" value={contact.capital_social ?? ""} onChange={(e) => update("capital_social", Number(e.target.value) || null)} />
              </Field>
              <Field label="Code NAF">
                <Input value={contact.code_naf ?? ""} onChange={(e) => update("code_naf", e.target.value)} className="font-mono" />
              </Field>
              <Field label="Libellé activité (NAF)">
                <Input value={contact.libelle_naf ?? ""} onChange={(e) => update("libelle_naf", e.target.value)} />
              </Field>
              <Field label="Date de création">
                <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="date" className="pl-9" value={contact.date_creation_societe ?? ""} onChange={(e) => update("date_creation_societe", e.target.value)} />
                </div>
              </Field>
              <Field label="Dirigeant">
                <Input value={contact.nom_dirigeant ?? ""} onChange={(e) => update("nom_dirigeant", e.target.value)} />
              </Field>
              <Field label="Site web">
                <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={contact.site_web ?? ""} onChange={(e) => update("site_web", e.target.value)} placeholder="https://..." />
                </div>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Recherche (acquéreurs) ─────────────────────────────────── */}
        {isAcquereur && (
          <TabsContent value="recherche" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Critères financiers</span>
                  <Select value={recherche.statut ?? "actif"} onValueChange={(v) => updateRech("statut", v)}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="en_pause">En pause</SelectItem>
                      <SelectItem value="archive">Archivé</SelectItem>
                    </SelectContent>
                  </Select>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Budget min (€)">
                  <Input type="number" value={recherche.budget_min ?? ""} onChange={(e) => updateRech("budget_min", Number(e.target.value) || null)} />
                </Field>
                <Field label="Budget max (€)">
                  <Input type="number" value={recherche.budget_max ?? ""} onChange={(e) => updateRech("budget_max", Number(e.target.value) || null)} />
                </Field>
                <Field label="Apport (€)">
                  <Input type="number" value={recherche.apport ?? ""} onChange={(e) => updateRech("apport", Number(e.target.value) || null)} />
                </Field>
                <Field label="Droit au bail max (€)">
                  <Input type="number" value={recherche.droit_bail_max ?? ""} onChange={(e) => updateRech("droit_bail_max", Number(e.target.value) || null)} />
                </Field>
                <Field label="Financement bancaire">
                  <div className="flex items-center h-10">
                    <Switch checked={recherche.financement_bancaire ?? false} onCheckedChange={(v) => updateRech("financement_bancaire", v)} />
                  </div>
                </Field>
                <Field label="Activités libres">
                  <Input value={recherche.activites_libres ?? ""} onChange={(e) => updateRech("activites_libres", e.target.value)} placeholder="Autre type d'activité..." />
                </Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Types de commerce recherchés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {TYPES_COMMERCE.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={recherche.types_commerce?.includes(t) ?? false} onCheckedChange={() => toggleTypeCommerce(t)} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Zone géographique & surface</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Villes (virgule séparées)">
                  <Input value={recherche.villes?.join(", ") ?? ""}
                    onChange={(e) => updateRech("villes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
                </Field>
                <Field label="Départements">
                  <Input value={recherche.departements?.join(", ") ?? ""}
                    onChange={(e) => updateRech("departements", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
                </Field>
                <Field label="Rayon (km)">
                  <Input type="number" value={recherche.rayon_km ?? ""} onChange={(e) => updateRech("rayon_km", Number(e.target.value) || null)} />
                </Field>
                <Field label="Surface min (m²)">
                  <Input type="number" value={recherche.surface_min ?? ""} onChange={(e) => updateRech("surface_min", Number(e.target.value) || null)} />
                </Field>
                <Field label="Surface max (m²)">
                  <Input type="number" value={recherche.surface_max ?? ""} onChange={(e) => updateRech("surface_max", Number(e.target.value) || null)} />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Rapprochements (acquéreurs) ───────────────────────────── */}
        {isAcquereur && !isNew && (
          <TabsContent value="rapprochements" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Mandats proposés à cet acquéreur</CardTitle>
                <Button onClick={proposerMandat} size="sm">
                  <Plus className="mr-1 h-4 w-4" />Proposer un mandat
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="pb-2 pr-4">N° / Réf.</th>
                        <th className="pb-2 pr-4">Type commerce</th>
                        <th className="pb-2 pr-4">Commune</th>
                        <th className="pb-2 pr-4">Prix</th>
                        <th className="pb-2 pr-4">Statut</th>
                        <th className="pb-2">Lien</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapprochements.map((r) => {
                        const badge = getStatutBadge(r.mandat?.statut);
                        return (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="py-2 pr-4 font-mono text-primary font-semibold">
                              {r.mandat?.numero_registre ? `N°${r.mandat.numero_registre}` : r.mandat?.reference}
                            </td>
                            <td className="py-2 pr-4">{r.mandat?.type_commerce ?? "—"}</td>
                            <td className="py-2 pr-4">{r.mandat?.commune ?? "—"}</td>
                            <td className="py-2 pr-4">{r.mandat?.prix_demande ? formatEuros(r.mandat.prix_demande) : "—"}</td>
                            <td className="py-2 pr-4"><Badge className={`text-xs ${badge.color}`}>{badge.label}</Badge></td>
                            <td className="py-2">
                              <Button variant="ghost" size="sm" className="h-7 text-xs"
                                onClick={() => navigate(`/mandats/${r.mandat_id}`)}>
                                <ExternalLink className="h-3 w-3 mr-1" />Fiche
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {rapprochements.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun rapprochement — cliquez "Proposer un mandat"</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Mandats liés (vendeurs) ───────────────────────────────── */}
        {isVendeur && (
          <TabsContent value="mandats" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Mandats de cession liés à ce vendeur</CardTitle></CardHeader>
              <CardContent>
                {mandatsLies.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">Aucun mandat lié</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-2 pr-4">N°</th><th className="pb-2 pr-4">Activité</th>
                          <th className="pb-2 pr-4">Commune</th><th className="pb-2 pr-4">Prix</th>
                          <th className="pb-2 pr-4">Statut</th><th className="pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mandatsLies.map(({ mandat: m }) => {
                          const badge = getStatutBadge(m.statut);
                          return (
                            <tr key={m.id} className="border-b border-border/30 hover:bg-secondary/20">
                              <td className="py-3 pr-4 font-mono text-primary font-semibold">
                                {m.numero_registre ? `N°${m.numero_registre}` : m.reference}
                              </td>
                              <td className="py-3 pr-4">{m.type_commerce ?? "—"}</td>
                              <td className="py-3 pr-4">{m.commune ?? "—"}</td>
                              <td className="py-3 pr-4">{m.prix_demande ? formatEuros(m.prix_demande) : "—"}</td>
                              <td className="py-3 pr-4"><Badge className={`text-xs ${badge.color}`}>{badge.label}</Badge></td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                                    onClick={() => navigate(`/mandats/${m.id}`)}>
                                    <ExternalLink className="h-3 w-3 mr-1" />Fiche
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-7 text-xs border-primary/50 text-primary hover:bg-primary/10">
                                        <FileText className="h-3 w-3 mr-1" />Générer<ChevronDown className="h-3 w-3 ml-1" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                      <DropdownMenuItem className="cursor-pointer"
                                        onClick={() => openMandat(generateMandatSimple(m, [{ id: "", mandat_id: m.id, contact_id: contact.id ?? "", contact: contact as Contact }]))}>
                                        <FileText className="mr-2 h-4 w-4 text-primary" />Contrat de mission simple
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="cursor-pointer"
                                        onClick={() => openMandat(generateMandatExclusif(m, [{ id: "", mandat_id: m.id, contact_id: contact.id ?? "", contact: contact as Contact }]))}>
                                        <FileText className="mr-2 h-4 w-4 text-amber-500" />Mandat exclusif
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="cursor-pointer"
                                        onClick={() => openMandat(generateAvenant(m, [{ id: "", mandat_id: m.id, contact_id: contact.id ?? "", contact: contact as Contact }]))}>
                                        <FileText className="mr-2 h-4 w-4 text-blue-400" />Avenant au mandat
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Activités ─────────────────────────────────────────────── */}
        <TabsContent value="activites" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Journal d'activité</CardTitle></CardHeader>
            <CardContent>
              {activites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune activité</p>
              ) : (
                <div className="space-y-2">
                  {activites.map((a) => {
                    const badge = getActiviteBadge(a.type);
                    return (
                      <div key={a.id} className="flex items-start gap-3 text-sm border-b border-border/40 pb-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">{formatDate(a.created_at)}</span>
                        <Badge className={`text-xs ${badge.color} shrink-0`}>{badge.label}</Badge>
                        <span className="flex-1">{a.description}</span>
                        {a.mandat_id && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs p-0" onClick={() => navigate(`/mandats/${a.mandat_id}`)}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

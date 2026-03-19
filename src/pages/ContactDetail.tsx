import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Phone, Mail, MapPin, Building2,
  FileText, ChevronDown, ExternalLink, User, Briefcase
} from "lucide-react";
import { formatDate, formatEuros, getActiviteBadge, getStatutBadge, ROLES_CONTACT } from "@/lib/formatters";
import { generateMandatSimple, generateMandatExclusif, generateAvenant, openMandat } from "@/lib/generateMandat";
import type { Contact, Mandat, MandatVendeur, Activite } from "@/types/database";

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

type MandatLie = MandatVendeur & { mandat: Mandat };

export default function ContactDetail() {
  const { id } = useParams();
  const isNew = id === "nouveau";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [contact, setContact] = useState<Partial<Contact>>({ nom: "", roles: [] });
  const [mandatsLies, setMandatsLies] = useState<MandatLie[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && id) loadContact(id);
  }, [id]);

  async function loadContact(contactId: string) {
    const { data } = await supabase.from("contacts").select("*").eq("id", contactId).single();
    if (data) setContact(data as Contact);

    // Mandats liés (si vendeur)
    const { data: mv } = await supabase
      .from("mandat_vendeurs")
      .select("*, mandat:mandats(*)")
      .eq("contact_id", contactId);
    setMandatsLies((mv as any) ?? []);

    // Activités liées à ce contact
    const { data: acts } = await supabase
      .from("activites")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    setActivites((acts as Activite[]) ?? []);
  }

  function update(field: string, value: any) {
    setContact((prev) => ({ ...prev, [field]: value }));
  }

  function toggleRole(role: string) {
    const roles = contact.roles ?? [];
    update("roles", roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]);
  }

  async function handleSave() {
    setSaving(true);
    if (isNew) {
      const { data, error } = await supabase
        .from("contacts")
        .insert({ ...contact, user_id: user?.id })
        .select()
        .single();
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Contact créé" });
        navigate(`/contacts/${data.id}`, { replace: true });
      }
    } else {
      const { error } = await supabase.from("contacts").update(contact).eq("id", id);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Contact mis à jour" });
      }
    }
    setSaving(false);
  }

  const isVendeur = contact.roles?.includes("vendeur");
  // Rôles pour lesquels on affiche le bouton "Générer un document"
  const ROLES_AVEC_MANDAT = ["vendeur", "acquereur", "bailleur", "investisseur"];
  const peutGenerer = !isNew && contact.roles?.some((r) => ROLES_AVEC_MANDAT.includes(r));

  // Mandat vide avec seulement les infos connues pour générer un template vierge
  const mandatVide: Partial<Mandat> = {};
  const vendeurPourGen = [{ id: "", mandat_id: "", contact_id: contact.id ?? "", contact: contact as Contact }];

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── En-tête ───────────────────────────────────────────────────────── */}
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
                {contact.societe && (
                  <span className="text-muted-foreground text-base font-normal ml-2">— {contact.societe}</span>
                )}
              </span>
            )}
          </h1>
          {!isNew && contact.roles && contact.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {contact.roles.map((r) => {
                const role = ROLES_CONTACT.find((rc) => rc.value === r);
                return (
                  <Badge key={r} className={`text-xs ${role?.color ?? "bg-slate-500 text-white"}`}>
                    {role?.label ?? r}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bouton Générer — visible pour vendeur / acquéreur / bailleur / investisseur ── */}
        {peutGenerer && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                <FileText className="mr-2 h-4 w-4" />
                Générer un document
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => openMandat(generateMandatSimple(mandatVide as Mandat, vendeurPourGen))}
              >
                <FileText className="mr-2 h-4 w-4 text-primary" />
                Contrat de mission simple
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => openMandat(generateMandatExclusif(mandatVide as Mandat, vendeurPourGen))}
              >
                <FileText className="mr-2 h-4 w-4 text-amber-500" />
                Mandat exclusif
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => openMandat(generateAvenant(mandatVide as Mandat, vendeurPourGen))}
              >
                <FileText className="mr-2 h-4 w-4 text-blue-400" />
                Avenant au mandat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? "..." : "Enregistrer"}
        </Button>
      </div>

      <Tabs defaultValue="coordonnees">
        <TabsList className="bg-secondary">
          <TabsTrigger value="coordonnees">
            <User className="mr-1.5 h-3.5 w-3.5" />Coordonnées
          </TabsTrigger>
          {isVendeur && (
            <TabsTrigger value="mandats">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />
              Mandats liés
              {mandatsLies.length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
                  {mandatsLies.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="activites">Activités</TabsTrigger>
        </TabsList>

        {/* ── Onglet Coordonnées ─────────────────────────────────────────── */}
        <TabsContent value="coordonnees" className="mt-4 space-y-4">

          {/* Identité */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium uppercase tracking-wide">
                <User className="h-4 w-4" />Identité
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Nom *">
                <Input
                  value={contact.nom ?? ""}
                  onChange={(e) => update("nom", e.target.value)}
                  placeholder="Nom de famille"
                  className="font-semibold"
                />
              </Field>
              <Field label="Prénom">
                <Input value={contact.prenom ?? ""} onChange={(e) => update("prenom", e.target.value)} />
              </Field>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Rôles</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {ROLES_CONTACT.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={contact.roles?.includes(r.value) ?? false}
                        onCheckedChange={() => toggleRole(r.value)}
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact & Société */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium uppercase tracking-wide">
                <Building2 className="h-4 w-4" />Société & Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Société" className="md:col-span-2">
                <Input value={contact.societe ?? ""} onChange={(e) => update("societe", e.target.value)} placeholder="Raison sociale" />
              </Field>
              <Field label="Email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    className="pl-9"
                    value={contact.email ?? ""}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="email@exemple.fr"
                  />
                </div>
              </Field>
              <Field label="Téléphone">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={contact.telephone ?? ""}
                    onChange={(e) => update("telephone", e.target.value)}
                    placeholder="06 xx xx xx xx"
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium uppercase tracking-wide">
                <MapPin className="h-4 w-4" />Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Adresse" className="md:col-span-2">
                <Input value={contact.adresse ?? ""} onChange={(e) => update("adresse", e.target.value)} placeholder="Numéro et rue" />
              </Field>
              <Field label="Code postal">
                <Input value={contact.code_postal ?? ""} onChange={(e) => update("code_postal", e.target.value)} placeholder="75001" />
              </Field>
              <Field label="Commune">
                <Input value={contact.commune ?? ""} onChange={(e) => update("commune", e.target.value)} placeholder="Ville" />
              </Field>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="pt-6">
              <Field label="Notes internes">
                <Textarea
                  value={contact.notes ?? ""}
                  onChange={(e) => update("notes", e.target.value)}
                  rows={4}
                  placeholder="Remarques, informations complémentaires..."
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet Mandats liés (vendeurs uniquement) ─────────────────── */}
        {isVendeur && (
          <TabsContent value="mandats" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mandats de cession liés à ce vendeur</CardTitle>
              </CardHeader>
              <CardContent>
                {mandatsLies.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">
                    Aucun mandat lié à ce contact
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-2 pr-4">N° / Réf.</th>
                          <th className="pb-2 pr-4">Activité</th>
                          <th className="pb-2 pr-4">Commune</th>
                          <th className="pb-2 pr-4">Prix demandé</th>
                          <th className="pb-2 pr-4">Statut</th>
                          <th className="pb-2">Actions</th>
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
                              <td className="py-3 pr-4">
                                {m.prix_demande ? formatEuros(m.prix_demande) : "—"}
                              </td>
                              <td className="py-3 pr-4">
                                <Badge className={`text-xs ${badge.color}`}>{badge.label}</Badge>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  {/* Lien vers la fiche mandat */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-primary"
                                    onClick={() => navigate(`/mandats/${m.id}`)}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Fiche
                                  </Button>

                                  {/* Bouton Générer le mandat */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs border-primary/50 text-primary hover:bg-primary/10"
                                      >
                                        <FileText className="h-3 w-3 mr-1" />
                                        Générer
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() =>
                                          openMandat(
                                            generateMandatSimple(m, [{ id: "", mandat_id: m.id, contact_id: contact.id ?? "", contact: contact as Contact }])
                                          )
                                        }
                                      >
                                        <FileText className="mr-2 h-4 w-4 text-primary" />
                                        Contrat de mission simple
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() =>
                                          openMandat(
                                            generateMandatExclusif(m, [{ id: "", mandat_id: m.id, contact_id: contact.id ?? "", contact: contact as Contact }])
                                          )
                                        }
                                      >
                                        <FileText className="mr-2 h-4 w-4 text-amber-500" />
                                        Mandat exclusif
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() =>
                                          openMandat(
                                            generateAvenant(m, [{ id: "", mandat_id: m.id, contact_id: contact.id ?? "", contact: contact as Contact }])
                                          )
                                        }
                                      >
                                        <FileText className="mr-2 h-4 w-4 text-blue-400" />
                                        Avenant au mandat
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

        {/* ── Onglet Activités ──────────────────────────────────────────── */}
        <TabsContent value="activites" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Journal d'activité</CardTitle>
            </CardHeader>
            <CardContent>
              {activites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune activité enregistrée</p>
              ) : (
                <div className="space-y-2">
                  {activites.map((a) => {
                    const badge = getActiviteBadge(a.type);
                    return (
                      <div key={a.id} className="flex items-start gap-3 text-sm border-b border-border/40 pb-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                          {formatDate(a.created_at)}
                        </span>
                        <Badge className={`text-xs ${badge.color} shrink-0`}>{badge.label}</Badge>
                        <span className="flex-1">{a.description}</span>
                        {a.mandat_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-primary p-0"
                            onClick={() => navigate(`/mandats/${a.mandat_id}`)}
                          >
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

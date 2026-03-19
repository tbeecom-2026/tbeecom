import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
import { ROLES_CONTACT } from "@/lib/formatters";
import type { Contact } from "@/types/database";

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [filtreRole, setFiltreRole] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState<Partial<Contact>>({ nom: "", roles: [] });
  const PAGE_SIZE = 20;

  useEffect(() => { load(); }, [search, filtreRole, page]);

  async function load() {
    let query = supabase.from("contacts").select("*", { count: "exact" });
    if (search) query = query.or(`nom.ilike.%${search}%,societe.ilike.%${search}%,email.ilike.%${search}%`);
    if (filtreRole !== "all") query = query.contains("roles", [filtreRole]);
    const { data, count } = await query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setContacts((data as Contact[]) ?? []);
    setTotal(count ?? 0);
  }

  async function createContact() {
    const { error } = await supabase.from("contacts").insert({ ...newContact, user_id: user?.id });
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contact créé" });
    setDialogOpen(false);
    setNewContact({ nom: "", roles: [] });
    load();
  }

  function toggleRole(role: string) {
    const roles = newContact.roles ?? [];
    setNewContact({ ...newContact, roles: roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role] });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nouveau contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Nom*</Label><Input value={newContact.nom ?? ""} onChange={(e) => setNewContact({ ...newContact, nom: e.target.value })} /></div>
                <div className="space-y-1"><Label>Prénom</Label><Input value={newContact.prenom ?? ""} onChange={(e) => setNewContact({ ...newContact, prenom: e.target.value })} /></div>
                <div className="space-y-1"><Label>Société</Label><Input value={newContact.societe ?? ""} onChange={(e) => setNewContact({ ...newContact, societe: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input value={newContact.email ?? ""} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Téléphone</Label><Input value={newContact.telephone ?? ""} onChange={(e) => setNewContact({ ...newContact, telephone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Commune</Label><Input value={newContact.commune ?? ""} onChange={(e) => setNewContact({ ...newContact, commune: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Rôles</Label>
                <div className="flex flex-wrap gap-3">
                  {ROLES_CONTACT.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={newContact.roles?.includes(r.value)} onCheckedChange={() => toggleRole(r.value)} />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={createContact} className="w-full" disabled={!newContact.nom}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={filtreRole} onValueChange={(v) => { setFiltreRole(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Rôle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ROLES_CONTACT.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Nom</th>
              <th className="p-3">Société</th>
              <th className="p-3">Rôles</th>
              <th className="p-3">Email</th>
              <th className="p-3">Téléphone</th>
              <th className="p-3">Commune</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-t border-border/50 hover:bg-secondary/30">
                <td className="p-3 font-medium">{c.nom} {c.prenom}</td>
                <td className="p-3">{c.societe ?? "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {c.roles?.map((r) => {
                      const role = ROLES_CONTACT.find((rc) => rc.value === r);
                      return <Badge key={r} className={`text-xs ${role?.color ?? "bg-slate-500 text-white"}`}>{role?.label ?? r}</Badge>;
                    })}
                  </div>
                </td>
                <td className="p-3">{c.email ?? "—"}</td>
                <td className="p-3">{c.telephone ?? "—"}</td>
                <td className="p-3">{c.commune ?? "—"}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun contact</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} résultat(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button>
            <span className="flex items-center px-2">Page {page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { client } from "@/lib/neonClient";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle2,
  LogOut,
  Monitor,
  Loader2,
} from "lucide-react";

const auth = (client as any).auth;

interface AdminUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  banned?: boolean;
  createdAt?: string;
}

interface AdminSession {
  id?: string;
  token?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDuree(a?: string, b?: string) {
  if (!a || !b) return "—";
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function parseUA(ua?: string): string {
  if (!ua) return "—";
  const s = ua.toLowerCase();
  let browser = "Navigateur";
  if (s.includes("edg/")) browser = "Edge";
  else if (s.includes("chrome/") && !s.includes("edg/")) browser = "Chrome";
  else if (s.includes("safari/") && !s.includes("chrome/")) browser = "Safari";
  else if (s.includes("firefox/")) browser = "Firefox";
  let os = "";
  if (s.includes("windows")) os = "Windows";
  else if (s.includes("mac os")) os = "macOS";
  else if (s.includes("iphone") || s.includes("ipad")) os = "iOS";
  else if (s.includes("android")) os = "Android";
  else if (s.includes("linux")) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}

export default function UtilisateursAdmin() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwById, setPwById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sessionsUser, setSessionsUser] = useState<AdminUser | null>(null);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await auth.admin.listUsers({
        query: { limit: 50, sortBy: "createdAt", sortDirection: "desc" },
      });
      const list: AdminUser[] = res?.data?.users ?? res?.users ?? res?.data ?? [];
      setUsers(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Impossible de charger les utilisateurs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    const password = newPassword;
    if (!email || !name || !password) {
      toast({ title: "Champs requis", description: "Nom, email et mot de passe sont obligatoires.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await auth.admin.createUser({ email, password, name, role: "user" });
      if (res?.error) throw new Error(res.error.message ?? "Erreur");
      // ajout à la liste blanche
      await supabase
        .from("acces_autorises")
        .upsert({ email, nom: name }, { onConflict: "email", ignoreDuplicates: true });
      toast({ title: "Compte créé", description: email });
      setNewName(""); setNewEmail(""); setNewPassword("");
      load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Création impossible", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function resetPassword(u: AdminUser) {
    const newPassword = pwById[u.id]?.trim();
    if (!newPassword) {
      toast({ title: "Mot de passe vide", variant: "destructive" });
      return;
    }
    setBusyId(u.id);
    try {
      const res = await auth.admin.setUserPassword({ userId: u.id, newPassword });
      if (res?.error) throw new Error(res.error.message);
      toast({ title: "Mot de passe réinitialisé", description: u.email });
      setPwById((p) => ({ ...p, [u.id]: "" }));
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRole(u: AdminUser) {
    setBusyId(u.id);
    try {
      const next = u.role === "admin" ? "user" : "admin";
      const res = await auth.admin.setRole({ userId: u.id, role: next });
      if (res?.error) throw new Error(res.error.message);
      toast({ title: `Rôle modifié`, description: `${u.email} → ${next}` });
      load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBan(u: AdminUser) {
    setBusyId(u.id);
    try {
      const res = u.banned
        ? await auth.admin.unbanUser({ userId: u.id })
        : await auth.admin.banUser({ userId: u.id });
      if (res?.error) throw new Error(res.error.message);
      toast({ title: u.banned ? "Réactivé" : "Désactivé", description: u.email });
      load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function revokeSessions(u: AdminUser) {
    setBusyId(u.id);
    try {
      const res = await auth.admin.revokeUserSessions({ userId: u.id });
      if (res?.error) throw new Error(res.error.message);
      toast({ title: "Sessions révoquées", description: u.email });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function openSessions(u: AdminUser) {
    setSessionsUser(u);
    setSessions([]);
    setLoadingSessions(true);
    try {
      const res = await auth.admin.listUserSessions({ userId: u.id });
      const list: AdminSession[] = res?.data?.sessions ?? res?.sessions ?? res?.data ?? [];
      setSessions(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    } finally {
      setLoadingSessions(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Créer un compte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Nom</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom complet" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@exemple.com" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mot de passe</label>
              <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button onClick={createUser} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Créer le compte
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Le compte est créé immédiatement (sans email de confirmation) et ajouté à la liste blanche.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Utilisateurs ({users.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Rafraîchir
          </Button>
        </CardHeader>
        <CardContent>
          {users.length === 0 && !loading && (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              Aucun utilisateur.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {users.map((u) => {
              const initials = (u.name ?? u.email ?? "?")
                .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
              return (
                <div
                  key={u.id}
                  className="rounded-lg border border-border bg-card/40 hover:bg-card/60 transition-colors p-4 flex flex-col gap-3"
                >
                  {/* Header : identité + badges */}
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold truncate">{u.name ?? "—"}</div>
                        <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-[10px]">
                          {u.role ?? "user"}
                        </Badge>
                        {u.banned
                          ? <Badge variant="destructive" className="text-[10px]">désactivé</Badge>
                          : <Badge variant="outline" className="text-[10px] border-green-700/50 text-green-400">actif</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                        Créé le {fmtDate(u.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Reset mot de passe */}
                  <div className="flex gap-2">
                    <Input
                      className="h-9 text-xs"
                      placeholder="Nouveau mot de passe"
                      value={pwById[u.id] ?? ""}
                      onChange={(e) => setPwById((p) => ({ ...p, [u.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === u.id}
                      onClick={() => resetPassword(u)}
                      className="shrink-0"
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1" /> Réinitialiser
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => openSessions(u)}>
                      <Monitor className="h-3.5 w-3.5 mr-1" /> Connexions
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={busyId === u.id}
                      onClick={() => toggleRole(u)}
                    >
                      {u.role === "admin"
                        ? <><ShieldOff className="h-3.5 w-3.5 mr-1" /> Retirer admin</>
                        : <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Promouvoir admin</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={busyId === u.id}
                      onClick={() => toggleBan(u)}
                    >
                      {u.banned
                        ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-400" /> Réactiver</>
                        : <><Ban className="h-3.5 w-3.5 mr-1 text-destructive" /> Désactiver</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 ml-auto"
                      disabled={busyId === u.id}
                      onClick={() => revokeSessions(u)}
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1" /> Déconnecter
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!sessionsUser} onOpenChange={(o) => !o && setSessionsUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Connexions — {sessionsUser?.email}</DialogTitle>
          </DialogHeader>
          {loadingSessions ? (
            <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Chargement…</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Aucune session active.</div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/30 text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Connexion</th>
                    <th className="text-left p-2">Dernière activité</th>
                    <th className="text-left p-2">Durée ≈</th>
                    <th className="text-left p-2">IP</th>
                    <th className="text-left p-2">Navigateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sessions.map((s, i) => (
                    <tr key={s.id ?? s.token ?? i}>
                      <td className="p-2">{fmtDate(s.createdAt)}</td>
                      <td className="p-2">{fmtDate(s.updatedAt)}</td>
                      <td className="p-2">{fmtDuree(s.createdAt, s.updatedAt)}</td>
                      <td className="p-2 font-mono">{s.ipAddress ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{parseUA(s.userAgent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

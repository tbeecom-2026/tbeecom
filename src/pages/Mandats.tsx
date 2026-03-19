import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { formatEuros, getStatutBadge, STATUTS_MANDAT, TYPES_COMMERCE } from "@/lib/formatters";
import type { Mandat } from "@/types/database";

export default function Mandats() {
  const navigate = useNavigate();
  const [mandats, setMandats] = useState<Mandat[]>([]);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("all");
  const [filtreType, setFiltreType] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => { loadMandats(); }, [search, filtreStatut, filtreType, page]);

  async function loadMandats() {
    let query = supabase.from("mandats").select("*", { count: "exact" });
    if (filtreStatut !== "all") query = query.eq("statut", filtreStatut);
    if (filtreType !== "all") query = query.eq("type_commerce", filtreType);
    if (search) query = query.or(`reference.ilike.%${search}%,commune.ilike.%${search}%`);
    const { data, count } = await query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setMandats((data as Mandat[]) ?? []);
    setTotal(count ?? 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mandats</h1>
        <Button onClick={() => navigate("/mandats/nouveau")}><Plus className="mr-2 h-4 w-4" />Nouveau mandat</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher référence, commune..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={filtreStatut} onValueChange={(v) => { setFiltreStatut(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_MANDAT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreType} onValueChange={(v) => { setFiltreType(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Type commerce" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TYPES_COMMERCE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Référence</th>
              <th className="p-3">Type commerce</th>
              <th className="p-3">Commune</th>
              <th className="p-3">Prix demandé</th>
              <th className="p-3">CA annuel</th>
              <th className="p-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {mandats.map((m) => {
              const badge = getStatutBadge(m.statut);
              return (
                <tr key={m.id} className="border-t border-border/50 hover:bg-secondary/30 cursor-pointer" onClick={() => navigate(`/mandats/${m.id}`)}>
                  <td className="p-3 font-medium text-primary">{m.reference}</td>
                  <td className="p-3">{m.type_commerce}</td>
                  <td className="p-3">{m.commune}</td>
                  <td className="p-3">{formatEuros(m.prix_demande)}</td>
                  <td className="p-3">{formatEuros(m.ca_annuel)}</td>
                  <td className="p-3"><Badge className={badge.color}>{badge.label}</Badge></td>
                </tr>
              );
            })}
            {mandats.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun mandat trouvé</td></tr>
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

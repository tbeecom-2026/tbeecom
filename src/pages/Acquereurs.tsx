import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { formatEuros, formatDate, TYPES_COMMERCE } from "@/lib/formatters";
import type { Recherche } from "@/types/database";

export default function Acquereurs() {
  const navigate = useNavigate();
  const [recherches, setRecherches] = useState<Recherche[]>([]);
  const [filtreStatut, setFiltreStatut] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => { load(); }, [filtreStatut, search, page]);

  async function load() {
    let query = supabase.from("recherches").select("*, contact:contacts(*)", { count: "exact" });
    if (filtreStatut !== "all") query = query.eq("statut", filtreStatut);
    if (search) query = query.or(`contact.nom.ilike.%${search}%,contact.prenom.ilike.%${search}%`, { referencedTable: "contacts" });
    const { data, count } = await query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setRecherches((data as Recherche[]) ?? []);
    setTotal(count ?? 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Acquéreurs</h1>
        <Button onClick={() => navigate("/acquereurs/nouveau")}><Plus className="mr-2 h-4 w-4" />Nouvel acquéreur</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={filtreStatut} onValueChange={(v) => { setFiltreStatut(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="actif">Actif</SelectItem>
            <SelectItem value="en_pause">En pause</SelectItem>
            <SelectItem value="archive">Archivé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Nom</th>
              <th className="p-3">Prénom</th>
              <th className="p-3">Téléphone</th>
              <th className="p-3">Budget max</th>
              <th className="p-3">Types recherchés</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Date création</th>
            </tr>
          </thead>
          <tbody>
            {recherches.map((r) => (
              <tr key={r.id} className="border-t border-border/50 hover:bg-secondary/30 cursor-pointer" onClick={() => navigate(`/acquereurs/${r.id}`)}>
                <td className="p-3 font-medium">{r.contact?.nom ?? "—"}</td>
                <td className="p-3">{r.contact?.prenom ?? "—"}</td>
                <td className="p-3">{r.contact?.telephone ?? "—"}</td>
                <td className="p-3">{formatEuros(r.budget_max)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {r.types_commerce?.slice(0, 2).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    {(r.types_commerce?.length ?? 0) > 2 && <Badge variant="outline" className="text-xs">+{(r.types_commerce?.length ?? 0) - 2}</Badge>}
                  </div>
                </td>
                <td className="p-3">
                  <Badge className={r.statut === "actif" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                    {r.statut}
                  </Badge>
                </td>
                <td className="p-3">{formatDate(r.created_at)}</td>
              </tr>
            ))}
            {recherches.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun acquéreur trouvé</td></tr>
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

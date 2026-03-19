import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, getActiviteBadge, TYPES_ACTIVITE } from "@/lib/formatters";
import type { Activite } from "@/types/database";

export default function Activites() {
  const [activites, setActivites] = useState<Activite[]>([]);
  const [filtreType, setFiltreType] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => { load(); }, [filtreType, page]);

  async function load() {
    let query = supabase.from("activites").select("*, mandat:mandats(id, reference), contact:contacts(id, nom, prenom)", { count: "exact" });
    if (filtreType !== "all") query = query.eq("type", filtreType);
    const { data, count } = await query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setActivites((data as any[]) ?? []);
    setTotal(count ?? 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal d'activité</h1>
      </div>

      <div className="flex gap-3">
        <Select value={filtreType} onValueChange={(v) => { setFiltreType(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TYPES_ACTIVITE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {activites.map((a) => {
          const badge = getActiviteBadge(a.type);
          return (
            <div key={a.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">{formatDateTime(a.created_at)}</span>
              <Badge className={`${badge.color} text-xs`}>{badge.label}</Badge>
              <p className="flex-1 text-sm">{a.description}</p>
              <div className="flex gap-2 text-xs">
                {(a as any).mandat && (
                  <Link to={`/mandats/${(a as any).mandat.id}`} className="text-primary hover:underline">
                    {(a as any).mandat.reference}
                  </Link>
                )}
                {(a as any).contact && (
                  <span className="text-muted-foreground">
                    {(a as any).contact.nom} {(a as any).contact.prenom}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {activites.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Aucune activité</div>
        )}
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

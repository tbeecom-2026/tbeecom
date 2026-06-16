// src/pages/RegistreMandats.tsx
// Onglet "Mandats" = le REGISTRE des contrats de mandat (table registre_mandats).
// 1 ligne = 1 mandat (N°, type/objet, mandant, bien concerné, dates début→fin, négociateur).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { RegistreMandat } from "@/types/database";

export default function RegistreMandats() {
  const [mandats, setMandats] = useState<RegistreMandat[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => { load(); }, [search, page]);

  async function load() {
    let query = supabase.from("registre_mandats").select("*", { count: "exact" });
    if (search) {
      const t = search.trim();
      query = query.or(
        `numero.ilike.%${t}%,mandant_nom.ilike.%${t}%,reference_bien.ilike.%${t}%,objet.ilike.%${t}%,negociateur.ilike.%${t}%`
      );
    }
    const { data, count } = await query
      .order("date_debut", { ascending: false, nullsFirst: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setMandats((data as RegistreMandat[]) ?? []);
    setTotal(count ?? 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registre des mandats</h1>
        <span className="text-sm text-muted-foreground">{total} mandat(s)</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="N° mandat, mandant, référence du bien, objet, négociateur..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3 w-20">N°</th>
              <th className="p-3">Objet / Type de mandat</th>
              <th className="p-3">Mandant</th>
              <th className="p-3 w-28">Bien</th>
              <th className="p-3">Mandat (début → fin)</th>
              <th className="p-3">Négociateur</th>
            </tr>
          </thead>
          <tbody>
            {mandats.map((m) => (
              <tr key={m.id} className="border-t border-border/50 hover:bg-secondary/30">
                <td className="p-3">
                  <span className="text-base font-bold text-primary">{m.numero ?? "—"}</span>
                </td>
                <td className="p-3">
                  {m.objet ?? "—"}
                  {m.type_mandat ? <span className="block text-xs text-muted-foreground">{m.type_mandat}</span> : null}
                </td>
                <td className="p-3">{m.mandant_nom ?? "—"}</td>
                <td className="p-3">
                  {m.reference_bien ? <Badge variant="outline">{m.reference_bien}</Badge> : "—"}
                </td>
                <td className="p-3">
                  {m.date_debut && m.date_fin
                    ? `${formatDate(m.date_debut)} → ${formatDate(m.date_fin)}`
                    : m.dates_mandat ?? (m.date_debut ? formatDate(m.date_debut) : "—")}
                </td>
                <td className="p-3">{m.negociateur ?? "—"}</td>
              </tr>
            ))}
            {mandats.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun mandat trouvé</td>
              </tr>
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

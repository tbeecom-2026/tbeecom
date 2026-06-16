// src/pages/RegistreMandats.tsx
// REGISTRE LÉGAL des mandats (table registre_mandats).
// Exigences : voir TOUS les mandats (aucun masqué, aucun dédoublonnage), dans
// l'ORDRE DU N° DE MANDAT (croissant, continu) — registre juridiquement fidèle.
// 1 ligne = 1 mandat (N°, type/objet, mandant, bien, dates début→fin, négociateur).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { retirerMandatsExpires, nettyLabel, getIssueBadgeClass } from "@/lib/mandatStatus";
import type { RegistreMandat } from "@/types/database";

// N° de mandat -> entier pour un tri numérique fiable ("99" doit venir avant "471").
function numeroInt(numero: string | null): number {
  const n = parseInt(String(numero ?? "").replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n; // sans n° = en fin
}

export default function RegistreMandats() {
  const [all, setAll] = useState<RegistreMandat[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    retirerMandatsExpires();
  }, []);
  useEffect(() => {
    setPage(0);
  }, [search]);

  async function load() {
    // On récupère TOUT le registre (471 lignes), puis on trie par N° côté client.
    const { data } = await supabase.from("registre_mandats").select("*").limit(5000);
    const rows = (data as RegistreMandat[]) ?? [];
    rows.sort((a, b) => numeroInt(a.numero) - numeroInt(b.numero)); // N° croissant (ordre légal)
    setAll(rows);
  }

  // Filtre de recherche (sans casser l'ordre global)
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return all;
    return all.filter((m) =>
      [m.numero, m.mandant_nom, m.reference_bien, m.objet, m.negociateur].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(t),
      ),
    );
  }, [all, search]);

  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registre des mandats</h1>
        <span className="text-sm text-muted-foreground">{total} mandat(s) — triés par N°</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="N° mandat, mandant, référence du bien, objet, négociateur..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
              <th className="p-3">État</th>
              <th className="p-3">Négociateur</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((m) => {
              return (
                <tr key={m.id} className="border-t border-border/50 hover:bg-secondary/30">
                  <td className="p-3">
                    <span className="text-base font-bold text-primary">{m.numero ?? "—"}</span>
                  </td>
                  <td className="p-3">
                    {m.objet ?? "—"}
                    {m.type_mandat ? (
                      <span className="block text-xs text-muted-foreground">{m.type_mandat}</span>
                    ) : null}
                  </td>
                  <td className="p-3">{m.mandant_nom ?? "—"}</td>
                  <td className="p-3">
                    {m.reference_bien ? <Badge variant="outline">{m.reference_bien}</Badge> : "—"}
                  </td>
                  <td className="p-3">
                    {m.date_debut && m.date_fin
                      ? `${formatDate(m.date_debut)} → ${formatDate(m.date_fin)}`
                      : (m.dates_mandat ?? (m.date_debut ? formatDate(m.date_debut) : "—"))}
                  </td>
                  <td className="p-3">
                    {m.observations ? (
                      <Badge className={getIssueBadgeClass(m.observations)}>{nettyLabel(m.observations)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">{m.negociateur ?? "—"}</td>
                </tr>
              );
            })}
            {total === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Aucun mandat trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} résultat(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span className="flex items-center px-2">
              Page {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

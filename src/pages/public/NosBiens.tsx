import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BienCard from "@/components/public/BienCard";
import { distinctValues, listPublicBiens, type PublicBien } from "@/lib/publicBiens";
import { departementLabel } from "@/lib/departements";
import BarometreCessions from "@/components/public/BarometreCessions";

const PAGE_SIZE = 12;

export default function NosBiens() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<PublicBien[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [departements, setDepartements] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);

  const q = params.get("q") ?? "";
  const categorie = params.get("categorie") ?? "all";
  const type = params.get("type") ?? "all";
  const departement = params.get("departement") ?? "all";
  const prixMax = params.get("prixMax") ?? "";
  const surfaceMin = params.get("surfaceMin") ?? "";
  const page = Number(params.get("page") ?? "0");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    });
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    Promise.all([distinctValues("categorie"), distinctValues("departement"), distinctValues("type_commerce")]).then(
      ([c, d, t]) => {
        setCategories(c);
        setDepartements(d);
        setTypes(t);
      },
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    listPublicBiens({
      search: q || undefined,
      categorie,
      type,
      departement,
      prixMax: prixMax ? Number(prixMax) : undefined,
      surfaceMin: surfaceMin ? Number(surfaceMin) : undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [q, categorie, type, departement, prixMax, surfaceMin, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="font-display text-3xl sm:text-4xl">Nos biens à céder</h1>
          <p className="mt-2 text-primary-foreground/80 max-w-2xl">
            Parcourez nos opportunités. Affinez par catégorie, ville, budget ou surface.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              update({ q: (fd.get("q") as string) || null });
            }}
            className="mt-6 flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Ville, activité, type, mots-clés…"
                className="h-12 pl-10 bg-background text-foreground"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 bg-accent text-accent-foreground hover:bg-accent/90">
              Rechercher
            </Button>
          </form>

          {/* Filtres TOUJOURS visibles (plus de bouton à cliquer) */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={categorie} onValueChange={(v) => update({ categorie: v })}>
              <SelectTrigger className="h-11 bg-background text-foreground">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => update({ type: v })}>
              <SelectTrigger className="h-11 bg-background text-foreground">
                <SelectValue placeholder="Type de commerce" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {types.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departement} onValueChange={(v) => update({ departement: v })}>
              <SelectTrigger className="h-11 bg-background text-foreground">
                <SelectValue placeholder="Département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous départements</SelectItem>
                {departements.map((c) => (
                  <SelectItem key={c} value={c}>
                    {departementLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Budget max (€)"
              defaultValue={prixMax}
              className="h-11 bg-background text-foreground"
              onBlur={(e) => update({ prixMax: e.target.value || null })}
            />
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Surface min (m²)"
              defaultValue={surfaceMin}
              className="h-11 bg-background text-foreground"
              onBlur={(e) => update({ surfaceMin: e.target.value || null })}
            />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr,420px]">
          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                {loading ? "Chargement…" : `${total} bien${total > 1 ? "s" : ""} trouvé${total > 1 ? "s" : ""}`}
              </p>
            </div>

            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-muted" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
                Aucun bien ne correspond à vos critères. Essayez d'élargir votre recherche.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {items.map((b) => (
                  <BienCard key={b.id} b={b} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <Button variant="outline" disabled={page <= 0} onClick={() => update({ page: String(page - 1) })}>
                  Précédent
                </Button>
                <span className="px-4 py-2 text-sm text-muted-foreground">
                  Page {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Suivant
                </Button>
              </div>
            )}
          </div>

          <aside>
            <div className="lg:sticky lg:top-24 space-y-2">
              <div>
                <h3 className="font-display text-lg text-primary">Baromètre des cessions</h3>
                <p className="text-xs text-muted-foreground">
                  Où se vendent les commerces en France — 12 derniers mois. Cliquez sur un département. (Source : BODACC)
                </p>
              </div>
              <BarometreCessions height={460} />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

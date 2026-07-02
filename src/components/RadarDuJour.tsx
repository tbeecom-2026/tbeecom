// Radar du jour — Île-de-France
// Affiche en direct les signaux BODACC IDF (difficultés, cessions, immatriculations).
// Aucun stockage : un appel à radarDuJour() au chargement (ou changement de fenêtre/familles),
// puis répartition par onglet. Le bouton « Ajouter en lead » (difficultés + cessions)
// upserte dans la table `prospects` (source: "radar"), sans bloquer l'UI en cas d'échec.
// Filtre Département : appliqué CÔTÉ CLIENT sur les items déjà chargés (pas de rechargement réseau).

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Plus, Radar as RadarIcon } from "lucide-react";
import { toast } from "sonner";
import { radarDuJour, RADAR_TYPE_LABEL, type RadarItem, type RadarType } from "@/lib/radar";
import { METIER_LABEL, type FamilleMetier } from "@/lib/metier";
import { supabase } from "@/lib/supabaseClient";
import { formatEuros } from "@/lib/formatters";

const FAMILLES: FamilleMetier[] = [
  "restauration_assise",
  "bar_cafe_tabac",
  "restauration_rapide",
  "boulangerie_patisserie",
  "garage_carrosserie",
  "fleuriste",
  "coiffure_esthetique",
  "autre",
];

const DEPARTEMENTS: { code: string; label: string }[] = [
  { code: "tous", label: "Toute l'IDF" },
  { code: "75", label: "75 · Paris" },
  { code: "92", label: "92 · Hauts-de-Seine" },
  { code: "78", label: "78 · Yvelines" },
  { code: "93", label: "93 · Seine-Saint-Denis" },
  { code: "94", label: "94 · Val-de-Marne" },
  { code: "91", label: "91 · Essonne" },
  { code: "95", label: "95 · Val-d'Oise" },
  { code: "77", label: "77 · Seine-et-Marne" },
];

const ETATS: { code: string; label: string }[] = [
  { code: "tous", label: "Redressement + liquidation" },
  { code: "redressement", label: "Redressement seul" },
  { code: "liquidation", label: "Liquidation seule" },
];

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("fr-FR");
}

function villeCp(it: RadarItem): string {
  return [it.ville, it.code_postal ? `(${it.code_postal})` : ""].filter(Boolean).join(" ") || "—";
}

function badgeEtat(etat: string | null) {
  if (etat === "redressement")
    return <Badge className="bg-orange-500 text-white hover:bg-orange-500">Redressement</Badge>;
  if (etat === "liquidation") return <Badge className="bg-red-600 text-white hover:bg-red-600">Liquidation</Badge>;
  return <span className="text-muted-foreground">—</span>;
}

async function ajouterEnLead(it: RadarItem) {
  if (!it.siren) {
    toast.error("SIREN manquant — impossible d'ajouter en lead");
    return;
  }
  const row = {
    siren: it.siren,
    denomination: it.denomination,
    naf: null,
    famille_metier: it.famille,
    adresse: it.adresse,
    code_postal: it.code_postal,
    commune: it.ville,
    etat: it.etat ?? "sain",
    bodacc_id: it.bodacc_id,
    bodacc_date: it.date,
    mandataire: it.mandataire,
    score: null,
    statut: "nouveau",
    source: "radar",
  };
  const { error } = await supabase.from("prospects").upsert(row, { onConflict: "siren" });
  if (error) {
    toast.error("Échec de l'ajout en lead", { description: error.message });
    return;
  }
  toast.success(`Ajouté en lead : ${it.denomination ?? it.siren}`);
}

export default function RadarDuJour() {
  const [jours, setJours] = useState<1 | 7>(1);
  const [departement, setDepartement] = useState<string>("tous");
  const [etatFiltre, setEtatFiltre] = useState<string>("tous");
  const [familles, setFamilles] = useState<FamilleMetier[]>([]);
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setErreur(null);
    radarDuJour({
      jours,
      famillesCible: familles.length ? familles : undefined,
    })
      .then((res) => {
        if (annule) return;
        setItems(res);
      })
      .catch((e) => {
        if (annule) return;
        setErreur(e?.message ?? "BODACC indisponible");
        setItems([]);
      })
      .finally(() => {
        if (!annule) setLoading(false);
      });
    return () => {
      annule = true;
    };
  }, [jours, familles]);

  // Filtre Département côté client (instantané, pas de rechargement)
  const itemsVisibles = useMemo(() => {
    if (departement === "tous") return items;
    return items.filter((it) => it.departement === departement || (it.code_postal ?? "").startsWith(departement));
  }, [items, departement]);

  const parType = useMemo(() => {
    const g: Record<RadarType, RadarItem[]> = { difficulte: [], cession: [], immatriculation: [] };
    for (const it of itemsVisibles) g[it.type].push(it);
    // Filtre État (redressement / liquidation) : ne concerne que les difficultés
    if (etatFiltre !== "tous") g.difficulte = g.difficulte.filter((it) => it.etat === etatFiltre);
    return g;
  }, [itemsVisibles, etatFiltre]);

  function toggleFamille(f: FamilleMetier) {
    setFamilles((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <RadarIcon className="h-5 w-5 text-primary" />
          Radar du jour — Île-de-France
        </CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={etatFiltre}
            onChange={(e) => setEtatFiltre(e.target.value)}
            className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
            title="Filtrer par état de procédure (onglet Difficultés)"
          >
            {ETATS.map((et) => (
              <option key={et.code} value={et.code}>
                {et.label}
              </option>
            ))}
          </select>
          <select
            value={departement}
            onChange={(e) => setDepartement(e.target.value)}
            className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
            title="Filtrer par département"
          >
            {DEPARTEMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
          <Button size="sm" variant={jours === 1 ? "default" : "outline"} onClick={() => setJours(1)}>
            Hier
          </Button>
          <Button size="sm" variant={jours === 7 ? "default" : "outline"} onClick={() => setJours(7)}>
            7 jours
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {FAMILLES.map((f) => {
            const on = familles.includes(f);
            return (
              <button
                key={f}
                onClick={() => toggleFamille(f)}
                className={`text-xs px-2 py-1 rounded border transition ${
                  on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {METIER_LABEL[f]}
              </button>
            );
          })}
          {familles.length > 0 && (
            <button
              onClick={() => setFamilles([])}
              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary"
            >
              Effacer
            </button>
          )}
        </div>

        {erreur && (
          <div className="text-sm text-muted-foreground border border-border rounded p-3">
            BODACC momentanément indisponible — {erreur}
          </div>
        )}

        <Tabs defaultValue="difficulte">
          <TabsList>
            <TabsTrigger value="difficulte">
              Nouvelles difficultés
              <Badge variant="secondary" className="ml-2">
                {parType.difficulte.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="cession">
              Cessions de fonds
              <Badge variant="secondary" className="ml-2">
                {parType.cession.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="immatriculation">
              Immatriculations
              <Badge variant="secondary" className="ml-2">
                {parType.immatriculation.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="space-y-2 mt-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              <TabsContent value="difficulte">
                <RadarTable items={parType.difficulte} type="difficulte" />
              </TabsContent>
              <TabsContent value="cession">
                <RadarTable items={parType.cession} type="cession" />
              </TabsContent>
              <TabsContent value="immatriculation">
                <RadarTable items={parType.immatriculation} type="immatriculation" />
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RadarTable({ items, type }: { items: RadarItem[]; type: RadarType }) {
  if (items.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Rien de neuf sur cette fenêtre.</div>;
  }
  const showLead = type === "difficulte" || type === "cession";
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-3">Dénomination</th>
            <th className="pb-2 pr-3">Activité</th>
            <th className="pb-2 pr-3">Ville (CP)</th>
            {type === "difficulte" && <th className="pb-2 pr-3">État</th>}
            {type === "difficulte" && <th className="pb-2 pr-3">Mandataire</th>}
            {type === "cession" && <th className="pb-2 pr-3">Prix</th>}
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3">BODACC</th>
            {showLead && <th className="pb-2"></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={(it.bodacc_id ?? "") + i} className="border-b border-border/50 hover:bg-secondary/50">
              <td className="py-2 pr-3 font-medium">{it.denomination ?? "—"}</td>
              <td className="py-2 pr-3">
                <Badge variant="outline" className="font-normal">
                  {it.famille_label}
                </Badge>
              </td>
              <td className="py-2 pr-3">{villeCp(it)}</td>
              {type === "difficulte" && <td className="py-2 pr-3">{badgeEtat(it.etat)}</td>}
              {type === "difficulte" && (
                <td className="py-2 pr-3 text-xs max-w-xs truncate" title={it.mandataire ?? ""}>
                  {it.mandataire ?? "—"}
                </td>
              )}
              {type === "cession" && <td className="py-2 pr-3">{it.prix != null ? formatEuros(it.prix) : "—"}</td>}
              <td className="py-2 pr-3">{fmtDate(it.date)}</td>
              <td className="py-2 pr-3">
                {it.url ? (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Voir <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                )}
              </td>
              {showLead && (
                <td className="py-2">
                  <Button size="sm" variant="outline" onClick={() => ajouterEnLead(it)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Lead
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Évite un warning "type_label inutilisé" si jamais on l'importait : volontairement non utilisé.
void RADAR_TYPE_LABEL;

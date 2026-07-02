// src/pages/NouveauBien.tsx
// Formulaire d'ajout de bien a QUESTIONNAIRE DYNAMIQUE par metier.
// - Etape 1 : type de bien (categorie)
// - Si "Fonds de commerce en vente" -> on choisit la nature (famille_metier)
// - Champs communs (colonnes de la table mandats) + champs specifiques au metier
//   (stockes dans la colonne JSONB "attributs").
// Pilote entierement par la config : src/config/questionnaires_metiers.json
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import config from "@/config/questionnaires_metiers.json";
import { calcHonoraires, type BaremeTranche } from "@/lib/honoraires";

type Field = {
  key: string;
  label: string;
  type: "number" | "text" | "textarea" | "boolean" | "select" | "multiselect" | "date";
  unite?: string;
  options?: any;
  required?: boolean;
  aide?: string;
  affiche_si?: string;
  colonne?: string;
  stockage?: string;
};

const cfg: any = config;

function normOptions(field: Field): { value: string; label: string }[] {
  const opts = field.options ?? [];
  return opts.map((o: any) =>
    typeof o === "string" ? { value: o, label: o } : { value: o.valeur, label: o.label }
  );
}

export default function NouveauBien() {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, any>>({ statut: "Prospection" });
  const [saving, setSaving] = useState(false);
  const [bareme, setBareme] = useState<BaremeTranche[]>([]);
  const [honorairesAuto, setHonorairesAuto] = useState(true);

  useEffect(() => {
    supabase
      .from("bareme_honoraires")
      .select("*")
      .eq("type_trans", "fdc")
      .order("ordre")
      .then(({ data }) => setBareme((data as BaremeTranche[]) ?? []));
  }, []);

  const categorie = values["categorie"];
  const famille = values["famille_metier"];
  const isFdc = categorie === cfg.type_bien.declenche_questionnaire_metier_si;
  const metierDef: any = isFdc && famille ? cfg.metiers[famille] : null;
  const communBlocs: any[] = cfg.champs_communs.blocs;

  function setVal(key: string, v: any) {
    setValues((prev) => {
      const next: Record<string, any> = { ...prev, [key]: v };
      // Calcul auto des honoraires depuis le prix net vendeur (barème FDC)
      if (key === "prix_net_vendeur" && honorairesAuto && bareme.length) {
        const net = typeof v === "number" ? v : Number(v);
        const h = net ? calcHonoraires(net, bareme) : null;
        if (h) {
          next["honoraires_montant"] = h.montant;
          next["prix_demande"] = net + h.montant; // FAI = net vendeur + honoraires
        }
      }
      // Saisie manuelle des honoraires -> on réajuste le prix FAI
      if (key === "honoraires_montant") {
        const net = Number(prev["prix_net_vendeur"]);
        if (net && typeof v === "number") next["prix_demande"] = net + v;
      }
      return next;
    });
    // Dès que l'utilisateur touche les honoraires, on coupe le calcul auto
    if (key === "honoraires_montant") setHonorairesAuto(false);
  }

  // Affichage conditionnel : "cle = valeur"
  function visible(field: Field): boolean {
    if (!field.affiche_si) return true;
    const [k, raw] = field.affiche_si.split("=").map((s) => s.trim());
    const expected = raw === "true" ? true : raw === "false" ? false : raw;
    return values[k] === expected;
  }

  function collectActiveFields(): Field[] {
    const list: Field[] = [cfg.type_bien];
    if (isFdc) list.push(cfg.famille_metier);
    for (const b of communBlocs) for (const f of b.champs) if (visible(f)) list.push(f);
    if (metierDef) for (const f of metierDef.champs) if (visible(f)) list.push(f);
    return list;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const active = collectActiveFields();

    // Validation des champs requis (on ignore les booleens : false est une reponse valable)
    for (const f of active) {
      if (f.required && f.type !== "boolean") {
        const v = values[f.key];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
          toast.error(`Champ requis : ${f.label}`);
          return;
        }
      }
    }

    // Construction de la ligne : colonnes connues + reste dans attributs (JSONB)
    const row: Record<string, any> = {};
    const attributs: Record<string, any> = {};
    if (isFdc && famille) attributs["famille_metier"] = famille;

    for (const f of active) {
      if (f.key === "famille_metier") continue;
      const v = values[f.key];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      const col = f.colonne ?? (f.key === "categorie" ? "categorie" : null);
      if (col && f.stockage !== "attributs") row[col] = v;
      else attributs[f.key] = v;
    }
    if (Object.keys(attributs).length) row["attributs"] = attributs;

    setSaving(true);
    const { data, error } = await supabase.from("mandats").insert(row).select("id").single();
    setSaving(false);

    if (error) {
      toast.error("Erreur lors de l'enregistrement : " + error.message);
      return;
    }
    toast.success("Bien créé.");
    navigate(`/biens/${(data as any).id}`);
  }

  function renderField(field: Field) {
    if (!visible(field)) return null;
    const val = values[field.key];
    const id = `f_${field.key}`;
    const wide = field.type === "textarea" || field.type === "multiselect";

    // Booleen : la case et le libelle sur la meme ligne
    if (field.type === "boolean") {
      return (
        <div key={field.key} className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) => setVal(field.key, e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {field.label}
          </label>
          {field.aide ? <p className="text-xs text-muted-foreground">{field.aide}</p> : null}
        </div>
      );
    }

    let input: JSX.Element;
    switch (field.type) {
      case "textarea":
        input = (
          <textarea
            id={id}
            value={val ?? ""}
            rows={3}
            onChange={(e) => setVal(field.key, e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        );
        break;
      case "number":
        input = (
          <Input
            id={id}
            type="number"
            value={val ?? ""}
            onChange={(e) => setVal(field.key, e.target.value === "" ? "" : Number(e.target.value))}
          />
        );
        break;
      case "date":
        input = <Input id={id} type="date" value={val ?? ""} onChange={(e) => setVal(field.key, e.target.value)} />;
        break;
      case "select": {
        const opts = normOptions(field);
        input = (
          <Select value={val ?? ""} onValueChange={(v) => setVal(field.key, v)}>
            <SelectTrigger id={id}><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
              {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        );
        break;
      }
      case "multiselect": {
        const opts = normOptions(field);
        const arr: string[] = Array.isArray(val) ? val : [];
        input = (
          <div className="flex flex-wrap gap-3 pt-1">
            {opts.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={arr.includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value);
                    setVal(field.key, next);
                  }}
                  className="h-4 w-4 rounded border-input"
                />
                {o.label}
              </label>
            ))}
          </div>
        );
        break;
      }
      default:
        input = <Input id={id} value={val ?? ""} onChange={(e) => setVal(field.key, e.target.value)} />;
    }

    return (
      <div key={field.key} className={wide ? "space-y-1 md:col-span-2" : "space-y-1"}>
        <label htmlFor={id} className="block text-sm font-medium">
          {field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
          {field.unite ? <span className="text-muted-foreground font-normal"> ({field.unite})</span> : null}
        </label>
        {input}
        {field.aide ? <p className="text-xs text-muted-foreground">{field.aide}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" onClick={() => navigate("/biens")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Nouveau bien</h1>
        </div>
        <Button type="submit" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      {/* Etape 1 : type de bien + nature si fonds de commerce */}
      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold text-lg">Type de bien</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField(cfg.type_bien)}
          {isFdc ? renderField(cfg.famille_metier) : null}
        </div>
      </section>

      {/* Champs communs */}
      {communBlocs.map((bloc: any) => (
        <section key={bloc.titre} className="rounded-lg border border-border p-4 space-y-4">
          <h2 className="font-semibold text-lg">{bloc.titre}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bloc.champs.map((f: Field) => renderField(f))}
          </div>
        </section>
      ))}

      {/* Champs specifiques au metier */}
      {metierDef ? (
        <section className="rounded-lg border border-primary/40 p-4 space-y-4">
          <h2 className="font-semibold text-lg">
            {metierDef.label} <span className="text-muted-foreground font-normal">— questions du métier</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metierDef.champs.map((f: Field) => renderField(f))}
          </div>

          {metierDef.licences?.length ? (
            <div className="rounded-md bg-secondary/40 p-3 text-sm">
              <p className="font-medium mb-1">À vérifier (licences / réglementation)</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                {metierDef.licences.map((l: string, i: number) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          ) : null}

          {metierDef.valorisation ? (
            <div className="rounded-md bg-secondary/40 p-3 text-sm">
              <p className="font-medium mb-1">Repères de valorisation (indicatifs)</p>
              <p className="text-muted-foreground">
                % du CA : {metierDef.valorisation.pct_ca} · Multiple EBE : {metierDef.valorisation.multiple_ebe}
              </p>
              {metierDef.valorisation.notes ? (
                <p className="text-muted-foreground mt-1">{metierDef.valorisation.notes}</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Enregistrement..." : "Enregistrer le bien"}
        </Button>
      </div>
    </form>
  );
}

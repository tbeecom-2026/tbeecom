// src/lib/publicBiens.ts
// Accès PUBLIC aux biens : lit UNIQUEMENT la vue sécurisée `biens_publics`
// (jamais la table `mandats`). La vue ne contient que des biens "sur le marché",
// des colonnes sûres, sans adresse exacte, enseigne masquée si confidentiel.
// La vraie barrière est côté Neon (RLS) : voir securite_rls_neon.sql.
import { supabase } from "./supabaseClient";

// Colonnes exposées par la vue biens_publics (PAS d'adresse, PAS d'attributs).
export const PUBLIC_FIELDS = [
  "id",
  "reference",
  "categorie",
  "type_commerce",
  "sous_type",
  "nature_activite",
  "titre",
  "description",
  "commune",
  "code_postal",
  "secteur",
  "surface_commerciale",
  "surface_totale",
  "surface_reserves",
  "surface_cuisine",
  "nb_couverts_salle",
  "nb_couverts_terrasse",
  "lineaire_vitrine",
  "conforme_erp",
  "conforme_pmr",
  "extraction",
  "murs_a_vendre",
  "prix_demande",
  "photo_principale",
  "photos",
  "enseigne",
  "confidentiel",
  "created_at",
].join(",");

export interface PublicBien {
  id: string;
  reference: string;
  categorie: string | null;
  type_commerce: string | null;
  sous_type: string | null;
  nature_activite: string | null;
  titre: string | null;
  description: string | null;
  commune: string | null;
  code_postal: string | null;
  secteur: string | null;
  surface_commerciale: number | null;
  surface_totale: number | null;
  surface_reserves: number | null;
  surface_cuisine: number | null;
  nb_couverts_salle: number | null;
  nb_couverts_terrasse: number | null;
  lineaire_vitrine: number | null;
  conforme_erp: boolean | null;
  conforme_pmr: boolean | null;
  extraction: boolean | null;
  murs_a_vendre: boolean | null;
  prix_demande: number | null;
  photo_principale: string | null;
  photos: string[] | null;
  enseigne: string | null;
  confidentiel: boolean | null;
  created_at: string;
}

/** Défense en profondeur côté client (la vue masque déjà l'enseigne si confidentiel). */
export function sanitize(b: PublicBien): PublicBien {
  if (b.confidentiel) return { ...b, enseigne: null };
  return b;
}

export async function listPublicBiens(opts: {
  search?: string;
  categorie?: string;
  type?: string;
  commune?: string;
  prixMax?: number;
  surfaceMin?: number;
  page?: number;
  pageSize?: number;
}) {
  const { search, categorie, type, commune, prixMax, surfaceMin, page = 0, pageSize = 12 } = opts;
  let q = supabase.from("biens_publics").select(PUBLIC_FIELDS, { count: "exact" });
  if (categorie && categorie !== "all") q = q.eq("categorie", categorie);
  if (type && type !== "all") q = q.eq("type_commerce", type);
  if (commune && commune !== "all") q = q.eq("commune", commune);
  if (prixMax) q = q.lte("prix_demande", prixMax);
  if (surfaceMin) q = q.gte("surface_commerciale", surfaceMin);
  if (search) {
    const t = search.trim().replace(/[,()*]/g, " ");
    // NB : dans .or(), le joker PostgREST/Neon est '*' (pas '%').
    q = q.or(
      `titre.ilike.*${t}*,commune.ilike.*${t}*,type_commerce.ilike.*${t}*,nature_activite.ilike.*${t}*,description.ilike.*${t}*`,
    );
  }
  const { data, count, error } = await q
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { items: ((data ?? []) as unknown as PublicBien[]).map(sanitize), total: count ?? 0 };
}

export async function getPublicBien(reference: string) {
  const { data, error } = await supabase
    .from("biens_publics")
    .select(PUBLIC_FIELDS)
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw error;
  return data ? sanitize(data as unknown as PublicBien) : null;
}

export async function distinctValues(field: "categorie" | "commune" | "type_commerce") {
  const { data } = await supabase.from("biens_publics").select(field).not(field, "is", null).limit(2000);
  const set = new Set<string>();
  (data ?? []).forEach((r: any) => r[field] && set.add(r[field]));
  return Array.from(set).sort();
}

export function localisationLabel(b: PublicBien) {
  if (b.confidentiel) return b.commune ? `${b.commune} (secteur)` : "Localisation confidentielle";
  return [b.commune, b.code_postal].filter(Boolean).join(" · ");
}

export function titreLabel(b: PublicBien) {
  if (b.titre) return b.titre;
  return [b.nature_activite || b.type_commerce || b.categorie, b.commune].filter(Boolean).join(" — ");
}

import { supabase } from "@/lib/supabaseClient";

export interface AgenceParametres {
  id?: string;
  raison_sociale: string | null;
  nom_commercial: string | null;
  forme_juridique: string | null;
  capital: number | null;
  siege: string | null;
  rcs: string | null;
  siret: string | null;
  ape: string | null;
  tva: string | null;
  carte_t_numero: string | null;
  carte_t_cci: string | null;
  rcp_assureur: string | null;
  rcp_contrat: string | null;
  rcp_courtier: string | null;
  rcp_couverture: string | null;
  garantie_financiere: string | null;
  sans_maniement_fonds: boolean | null;
  gerant_nom: string | null;
}

export const EMPTY_AGENCE: AgenceParametres = {
  raison_sociale: null, nom_commercial: null, forme_juridique: null, capital: null,
  siege: null, rcs: null, siret: null, ape: null, tva: null,
  carte_t_numero: null, carte_t_cci: null,
  rcp_assureur: null, rcp_contrat: null, rcp_courtier: null, rcp_couverture: null,
  garantie_financiere: null, sans_maniement_fonds: false, gerant_nom: null,
};

/** Lit l'unique ligne agence_parametres (ou null). */
export async function getAgence(): Promise<AgenceParametres | null> {
  const { data, error } = await supabase.from("agence_parametres").select("*").limit(1);
  if (error) {
    console.warn("[getAgence]", error.message);
    return null;
  }
  return ((data as any[])?.[0] as AgenceParametres) ?? null;
}

/** Crée ou met à jour la ligne unique. */
export async function upsertAgence(payload: AgenceParametres): Promise<{ error: any }> {
  const current = await getAgence();
  if (current?.id) {
    const { error } = await supabase.from("agence_parametres").update(payload).eq("id", current.id);
    return { error };
  }
  const { error } = await supabase.from("agence_parametres").insert(payload);
  return { error };
}

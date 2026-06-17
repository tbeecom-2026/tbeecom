import { supabase } from "./supabaseClient";

export type LeadType = "contact" | "vendre" | "acheter" | "annonce";

export interface LeadInput {
  type: LeadType;
  nom?: string;
  prenom?: string;
  email: string;
  telephone?: string;
  message?: string;
  reference_bien?: string;
  payload?: Record<string, any>;
  rgpd_consent: boolean;
  source?: string;
}

export async function submitLead(input: LeadInput) {
  if (!input.rgpd_consent) throw new Error("Consentement RGPD requis");
  if (!input.email || !/^\S+@\S+\.\S+$/.test(input.email)) throw new Error("Email invalide");
  const { error } = await supabase.from("leads").insert({
    ...input,
    source: input.source ?? (typeof window !== "undefined" ? window.location.pathname : null),
  });
  if (error) throw error;
}

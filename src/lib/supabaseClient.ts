// Compat shim : l'app a été migrée de Supabase vers Neon.
// Toutes les pages continuent à importer `supabase` depuis ce module,
// mais c'est en réalité le client Neon (Data API PostgREST + Neon Auth).
// La surface .from().select()/.insert()/.update()/.delete()/.eq()/.order()/…
// est identique (PostgREST).
//
// TODO (cleanup) : renommer progressivement les imports vers `@/lib/neonClient`
// puis supprimer ce fichier.
export { client as supabase } from './neonClient';
export const isSupabaseConfigured = true;

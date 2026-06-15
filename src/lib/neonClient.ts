import { createClient } from '@neondatabase/neon-js';

const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string;
const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string;

if (!dataApiUrl || !authUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    '[neonClient] VITE_NEON_DATA_API_URL ou VITE_NEON_AUTH_URL manquant — vérifie ton .env'
  );
}

/**
 * Client Neon (Data API PostgREST + Neon Auth / Better Auth).
 * Le JWT Neon Auth est injecté automatiquement dans les requêtes Data API.
 */
export const client = createClient({
  auth: { url: authUrl },
  dataApi: { url: dataApiUrl },
});

export type NeonClient = typeof client;

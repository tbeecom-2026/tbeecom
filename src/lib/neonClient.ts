import { createClient } from '@neondatabase/neon-js';
export const client = createClient({
  auth:    { url: import.meta.env.VITE_NEON_AUTH_URL },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
});

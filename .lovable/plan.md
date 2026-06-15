
# Plan de migration Supabase → Neon

Objectif : remplacer Supabase (mort, NXDOMAIN) par Neon Data API + Neon Auth, sans toucher au comportement métier. Storage reporté. Aucune migration de données.

## 1. Dépendances & variables d'env

- `npm install @neondatabase/neon-js`
- Garder `@supabase/supabase-js` temporairement dans `package.json` le temps de basculer tous les imports, puis le retirer en dernière étape.
- Créer `.env` (non commité) et `.env.example` :
  - `VITE_NEON_DATA_API_URL=https://ep-nameless-poetry-as17tawx.apirest.c-4.eu-central-1.aws.neon.tech/neondb/rest/v1`
  - `VITE_NEON_AUTH_URL=https://ep-nameless-poetry-as17tawx.neonauth.c-4.eu-central-1.aws.neon.tech/neondb/auth`
- Ajouter `VITE_NEON_*` dans `src/vite-env.d.ts` (typage `ImportMetaEnv`).

## 2. Nouveau client (`src/lib/neonClient.ts`)

```ts
import { createClient } from '@neondatabase/neon-js';
export const client = createClient({
  auth:    { url: import.meta.env.VITE_NEON_AUTH_URL },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
});
```

Stratégie de bascule **sans toucher chaque page** :
- Réécrire `src/lib/supabaseClient.ts` pour ré-exporter `client` sous l'alias `supabase` :
  ```ts
  export { client as supabase } from './neonClient';
  export const isSupabaseConfigured = true;
  ```
- Cela fonctionne car neon-js expose la même surface `.from().select()/.insert()/.update()/.delete()/.eq()/.order()/.limit()/.gte()/.ilike()/.range()/.single()` que supabase-js (PostgREST). Toutes les pages (`Dashboard`, `Mandats`, `MandatDetail`, `Contacts`, `ContactDetail`, `Acquereurs`, `AcquereurDetail`, `Activites`, `Parametres`, `PdfImportDialog`) continuent à fonctionner sans modification.
- Une fois validé en runtime, renommer dans un second temps les imports vers `@/lib/neonClient` (cosmétique, hors scope critique).

## 3. AuthContext (`src/contexts/AuthContext.tsx`)

Remplacer les imports et appels Supabase :

| Avant (supabase-js) | Après (neon-js) |
| --- | --- |
| `import { Session, User } from "@supabase/supabase-js"` | types issus de `@neondatabase/neon-js` |
| `supabase.auth.onAuthStateChange(cb)` | `client.auth.onSessionChange(cb)` (listener neon-js) |
| `supabase.auth.getSession()` | `client.auth.getSession()` |
| `supabase.auth.signInWithPassword({email,password})` | `client.auth.signIn.email({email,password})` |
| `supabase.auth.signOut()` | `client.auth.signOut()` |

Le JWT Neon Auth est attaché automatiquement aux requêtes Data API par le client → aucune modification dans les pages.

`src/pages/Login.tsx` : aucune modification (utilise `useAuth().signIn`).

## 4. Storage — REPORTÉ

Retirer les appels Storage, garder le nom de fichier en base, laisser un TODO.

- `src/pages/MandatDetail.tsx` (~l.569) : retirer `supabase.storage.from('mandats-docs').upload(...)` + `getPublicUrl`. Stocker uniquement `file.name` dans le champ existant. Commentaire :
  ```ts
  // TODO: rebrancher le stockage fichiers (R2/Neon/hybride)
  ```
- `src/components/PdfImportDialog.tsx` (~l.393 et ~l.406) : idem.
- Aucun autre changement UI ; les boutons d'upload restent visibles (le parsing PDF côté client continue).

## 5. Schéma SQL Neon (`supabase/neon_schema.sql`, à exécuter manuellement)

Génération d'un fichier unique consolidé (issu de `schema.sql` + `migration_v2.sql` + `migration_contacts_v2.sql` + `migration_bareme.sql`) adapté Neon :

- `auth.uid()` → `auth.user_id()` partout dans les policies.
- Colonnes `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL` → `user_id TEXT NOT NULL DEFAULT auth.user_id()` (drop de la FK vers `auth.users` inexistante côté Neon).
- Suppression du trigger `on_auth_user_created` et de la fonction `handle_new_user`.
- Table `profiles` : **option retenue = peupler à la 1re connexion** côté app (upsert simple dans `AuthProvider` après `getSession` si user présent). Justification : plus simple, pas de dépendance au schéma `neon_auth`, schéma `profiles` actuel conservé tel quel (avec `id TEXT` au lieu d'`uuid`/FK).
- Rôles : remplacer toute mention `anon`/`authenticated` Supabase par les rôles Neon `anonymous`/`authenticated`.
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;` pour chaque table.
- `ENABLE ROW LEVEL SECURITY` + policies existantes `USING (true) WITH CHECK (true)` conservées (équipe TBEECOM).
- Retrait de **tout** SQL lié au schéma `storage` (aucun n'existe actuellement, à confirmer en relisant les 3 migrations).

Tables couvertes : `profiles`, `contacts`, `mandats`, `recherches`, `mandat_vendeurs`, `rapprochements`, `activites`, `bareme_honoraires` + index existants.

Le fichier est livré prêt à coller dans le SQL Editor Neon — **pas exécuté par l'agent**.

## 6. Nettoyage final (après validation runtime)

- `npm uninstall @supabase/supabase-js`
- Renommer (optionnel) `src/lib/supabaseClient.ts` → suppression, et migrer les imports restants vers `@/lib/neonClient`.
- Archiver `supabase/*.sql` dans `supabase/_legacy/` pour référence.

## Détails techniques

- **Surface PostgREST identique** : neon-js implémente la même chaîne fluent que supabase-js. Si une méthode diverge à l'usage (ex. `.maybeSingle()`, signatures de filtres), correction ponctuelle au cas par cas — risque faible vu les appels listés à l'audit.
- **Types `Session`/`User`** : exportés par neon-js ; si absents, on définit des types locaux dans `src/types/auth.ts`.
- **JWT** : injection automatique via le client neon-js (header `Authorization: Bearer <jwt>`), aucune logique manuelle à ajouter.
- **`isSupabaseConfigured`** : conservé `true` pour ne pas casser les checks éventuels ; sera supprimé à l'étape 6.

## Hors scope (confirmé)

- Migration des données existantes.
- Upload/stockage fichiers (TODO).
- Realtime, RPC, Edge Functions (aucun usage détecté).
- Refonte UI Login (option `@neondatabase/auth-ui` non retenue).

## Livrables

1. `src/lib/neonClient.ts` (nouveau)
2. `src/lib/supabaseClient.ts` (réécrit en ré-export)
3. `src/contexts/AuthContext.tsx` (migré vers `client.auth.*`)
4. `src/components/PdfImportDialog.tsx` + `src/pages/MandatDetail.tsx` (Storage retiré + TODO)
5. `src/vite-env.d.ts` (types env Neon)
6. `.env.example` + `.env` (variables Neon)
7. `package.json` (ajout `@neondatabase/neon-js`)
8. `supabase/neon_schema.sql` (SQL prêt à coller, **non exécuté**)

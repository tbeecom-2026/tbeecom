## Objectif

Ajouter dans le CRM (espace connecté) la création de mandats, un workflow de validation à deux rôles (admin/négociateur), la génération PDF par nature et un onglet « Mon agence » dans Paramètres. Aucune modification de l'auth, du public ou de la base : les colonnes/tables nécessaires seront créées par le SQL fourni.

## Hypothèses sur les colonnes SQL (à valider avec le SQL fourni)

- `profiles.is_admin boolean`
- `registre_mandats` (ajouts) : `statut_validation text`, `cree_par uuid`, `valide_par uuid`, `valide_le timestamptz`, `motif_refus text`, `nature_mandat text`, `forme_mandat text`, `bien_id uuid`, `mandant_id uuid`, `prix numeric`, `prix_net_vendeur numeric`, `loyer numeric`, `honoraires_montant numeric`, `honoraires_charge text`, `duree_mois int`, `date_signature date`, `preavis_jours int`, `designation_bien text`, `adresse_bien text`, `activite_bien text`, `surfaces_bien text`, `criteres_recherche text`, `prix_max_recherche numeric`
- `agence_parametres` (1 ligne) : `id`, `raison_sociale`, `nom_commercial`, `forme_juridique`, `capital`, `siege`, `rcs`, `siret`, `ape`, `tva`, `carte_t_numero`, `carte_t_cci`, `rcp_assureur`, `rcp_contrat`, `rcp_courtier`, `rcp_couverture`, `garantie_financiere`, `sans_maniement_fonds boolean`, `gerant_nom`

Si certains noms diffèrent, c'est un simple renommage côté UI.

## Fichiers créés

- `src/hooks/useIsAdmin.ts` — lit `profiles.is_admin` pour l'utilisateur courant.
- `src/lib/agence.ts` — `getAgence()` : renvoie l'unique ligne `agence_parametres`. `upsertAgence(payload)`.
- `src/pages/NouveauMandat.tsx` — formulaire de création (route `/mandats/nouveau`).
- `src/pages/MandatsAValider.tsx` — liste des `statut_validation = 'a_valider'` avec actions Valider/Refuser (admin) ou lecture seule (route `/mandats/a-valider`).
- `src/components/AgenceForm.tsx` — formulaire « Mon agence » (admin uniquement).

## Fichiers modifiés

- `src/App.tsx` — routes `/mandats/nouveau`, `/mandats/a-valider`.
- `src/pages/RegistreMandats.tsx` — boutons « Nouveau mandat » + « À valider (N) » avec compteur, badge `statut_validation` sur les lignes en attente.
- `src/pages/Parametres.tsx` — wrap en `Tabs` : « Barème honoraires » (existant) + « Mon agence » (nouveau, admin).
- `src/lib/generateMandat.ts` — ajout d'un générateur générique `generateMandatV2(draft, agence)` qui couvre les 7 natures × 3 formes : fonds de commerce, droit au bail, murs commerciaux, local pro, cession de titres, recherche, location. Mandataire injecté depuis `agence_parametres` (carte T, RCP, RCS, etc. — plus aucune mention figée codée en dur). Conserve l'exclusivité en caractères très apparents, la résiliation après 3 mois (préavis 15 j), la clause pénale ≤ honoraires, n° de registre, RGPD. Les fonctions existantes `generateMandatSimple` / `generateMandatExclusif` / `generateAvenant` restent en place et appellent désormais `agence` quand fournie.
- `src/types/database.ts` — types `Profile` étendu (`is_admin`), `AgenceParametres`, `RegistreMandat` étendu.

## Workflow de validation

1. Négociateur ouvre `/mandats/nouveau`, remplit le formulaire (autocomplétion contacts/biens, calcul honoraires depuis `bareme_honoraires`).
2. Enregistrement → INSERT dans `registre_mandats` : `numero = NULL`, `statut_validation = 'a_valider'`, `cree_par = user.id`, `negociateur = user.name|email`.
3. Page `/mandats/a-valider` :
   - Non-admin : voit uniquement ses propres demandes en attente, lecture seule.
   - Admin : voit toutes les demandes. Boutons :
     - **Valider** → calcule `max(numero::int)+1` (≥ `DEBUT_REGISTRE`), met à jour `numero`, `statut_validation='valide'`, `valide_par`, `valide_le=now()`. Bouton « Générer le PDF » disponible après validation.
     - **Refuser** → ouvre dialog motif, met à jour `statut_validation='refuse'`, `motif_refus`.
4. Compteur dans `RegistreMandats` : nombre de demandes `a_valider` visibles par l'utilisateur, affiché sur le bouton « À valider ».

## Génération PDF

- Lecture de `agence_parametres` au moment du clic « Générer le PDF ».
- `generateMandatV2` choisit le bon template selon `nature_mandat` × `forme_mandat`. En-tête : `nom_commercial`, RCS, SIRET, TVA, carte T (n° + CCI), RC Pro, capital, siège — tout depuis `agence_parametres`. Les clauses spécifiques (exclusivité, location, recherche, etc.) sont conditionnelles.
- Si `sans_maniement_fonds = true`, mention « ne pouvant ni recevoir ni détenir d'autres fonds que ceux représentatifs de sa rémunération » ; sinon, mention de la garantie financière (`garantie_financiere`).

## Hors-scope

Les politiques RLS pour ces tables sont du ressort du SQL fourni. Aucune table créée ici.

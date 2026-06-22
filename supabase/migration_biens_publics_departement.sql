-- Confidentialité : les biens publics ne sont plus localisables.
-- La vue n'expose QUE le département (calculé depuis le code postal),
-- plus aucune commune / code postal / secteur.
DROP VIEW IF EXISTS public.biens_publics;
CREATE VIEW public.biens_publics AS
 SELECT id, reference, categorie, type_commerce, sous_type, nature_activite, titre, description,
        CASE
          WHEN code_postal ~ '^(97|98)[0-9]' THEN left(code_postal,3)
          WHEN code_postal ~ '^[0-9]{2}'     THEN left(code_postal,2)
          ELSE NULL
        END AS departement,
        surface_commerciale, surface_totale, surface_reserves, surface_cuisine,
        nb_couverts_salle, nb_couverts_terrasse, lineaire_vitrine, conforme_erp, conforme_pmr,
        extraction, murs_a_vendre, prix_demande, photo_principale, photos,
        CASE WHEN confidentiel THEN NULL::text ELSE enseigne END AS enseigne,
        confidentiel, created_at
   FROM mandats
  WHERE statut = 'sur_le_marche'::text AND publie_web = true
    AND mandat_date_fin IS NOT NULL AND mandat_date_fin >= current_date
    AND (categorie = ANY (ARRAY['Fonds de commerce en vente'::text,'Fonds de commerce en location'::text,'Droit au Bail en vente'::text,'Immobilier Pro en vente'::text,'Immobilier Pro en location'::text,'Entreprise en vente'::text]));
GRANT SELECT ON public.biens_publics TO anonymous, authenticated;

-- Site public : n'exposer QUE les biens dont le mandat est EN COURS.
-- Aligné sur le badge "En cours" de l'onglet Mandats (registre) :
-- mandat validé, non vendu/annulé, non expiré (date de fin >= aujourd'hui).
-- Vérifié : la condition mandat_date_fin >= current_date donne exactement
-- le même ensemble que la logique etatMandat du registre_mandats.

CREATE OR REPLACE VIEW public.biens_publics AS
 SELECT id, reference, categorie, type_commerce, sous_type, nature_activite, titre, description,
        commune, code_postal, secteur, surface_commerciale, surface_totale, surface_reserves,
        surface_cuisine, nb_couverts_salle, nb_couverts_terrasse, lineaire_vitrine, conforme_erp,
        conforme_pmr, extraction, murs_a_vendre, prix_demande, photo_principale, photos,
        CASE WHEN confidentiel THEN NULL::text ELSE enseigne END AS enseigne,
        confidentiel, created_at
   FROM mandats
  WHERE statut = 'sur_le_marche'::text
    AND publie_web = true
    AND mandat_date_fin IS NOT NULL
    AND mandat_date_fin >= current_date        -- <- mandat EN COURS uniquement
    AND (categorie = ANY (ARRAY['Fonds de commerce en vente'::text,'Fonds de commerce en location'::text,'Droit au Bail en vente'::text,'Immobilier Pro en vente'::text,'Immobilier Pro en location'::text,'Entreprise en vente'::text]));

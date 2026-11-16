-- Correctifs de la contre-vérification de la finition 2a, T6 — la purge des affiches et l'effacement d'une affiche
-- remplacée n'effacent jamais un fichier encore cité. Rapport d'audit docs/audit-finition-2a.md, T6 : le remplacement et
-- la purge ne lisaient que events.image_url et events.gallery_urls ; un fichier de events/<partenaire>/ cité par une
-- salle, un produit, le logo ou la couverture du profil était effacé.
--
-- storage_public_citations : toutes les adresses du compartiment public-images citées par une colonne de la base, en un
-- seul tableau jsonb (une ligne : aucune limite du nombre de lignes de l'API), lu par lib/events/poster-storage.ts
-- (referencedPaths). Colonnes qui citent le stockage (recherche dans tout le schéma, contrôlée par
-- tests/parcours/f2acv-stockage-cite.test.ts) :
--   events.image_url (affiche), events.gallery_urls (galerie), public_event_state.image_url (copie publique de l'affiche),
--   halls.images, products.images, partners.logo_url, partners.cover_url, partners.id_card_url et
--   partners.business_doc_url (pièces d'avant le lot 1C), users.avatar_url (photo du compte, compartiment avatars).
--   partner_documents.object_path cite le compartiment privé des pièces (partner_documents), jamais public-images : sans
--   effet sur les affiches, non lue ici.
-- Ces champs refusent désormais une adresse du dossier events/ (salles, produits, profil : contrôle de l'application,
-- lib/images/image-address.ts) ; une adresse déjà enregistrée reste protégée par cette lecture.
-- Aucune donnée n'est modifiée. Sans BEGIN ni COMMIT (transaction de la CLI), rejouable : CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.storage_public_citations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(DISTINCT x.v ORDER BY x.v), '[]'::jsonb)
      FROM (
            SELECT e.image_url AS v FROM public.events e
            UNION ALL SELECT g FROM public.events e, unnest(e.gallery_urls) AS g
            UNION ALL SELECT s.image_url FROM public.public_event_state s
            UNION ALL SELECT i FROM public.halls h, unnest(h.images) AS i
            UNION ALL SELECT i FROM public.products pr, unnest(pr.images) AS i
            UNION ALL SELECT pa.logo_url FROM public.partners pa
            UNION ALL SELECT pa.cover_url FROM public.partners pa
            UNION ALL SELECT pa.id_card_url FROM public.partners pa
            UNION ALL SELECT pa.business_doc_url FROM public.partners pa
            UNION ALL SELECT u.avatar_url FROM public.users u
           ) x
     WHERE x.v IS NOT NULL AND x.v LIKE '%public-images%'
$$;
REVOKE ALL ON FUNCTION public.storage_public_citations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_public_citations() TO service_role;
COMMENT ON FUNCTION public.storage_public_citations() IS
    'Correctifs de la contre-vérification de la finition 2a (T6) : adresses du compartiment public-images citées par la base '
    '(affiches, galeries, copie publique, salles, produits, logo, couverture, pièces anciennes, photo du compte). Serveur seulement.';

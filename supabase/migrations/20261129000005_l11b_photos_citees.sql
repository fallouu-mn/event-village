-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 05 : photos des établissements citées pour la purge du stockage
-- ============================================================================
-- Run complet 541 (f2acv-stockage-cite) : venues.photos (migration 01) n'était pas lue par storage_public_citations ;
-- une purge des images non citées aurait pu effacer les photos d'un établissement.
--  1. storage_public_citations : recopie de 20261116000008_f2acv_stockage_cite.sql:19-40 ; changement : photos des
--     établissements (venues.photos) comptées comme citées.
-- Droits gardés (REVOKE et GRANT idempotents). Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- Recopie de 20261116000008_f2acv_stockage_cite.sql:19-40 ; changement : venues.photos.
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
            -- Lot 11b : photos des établissements (dossier venues/<partenaire>/)
            UNION ALL SELECT i FROM public.venues ve, unnest(ve.photos) AS i
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

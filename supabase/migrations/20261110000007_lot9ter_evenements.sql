-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : événements (contrat 3.1 n° 07, 3.4 F17 à F20, 3.6 B.2.3, 5.B 9t.9 et 9t.12)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS puis CREATE,
-- ON CONFLICT DO NOTHING, privilèges réappliqués. DDL avant toute fonction.
-- Tâches fusionnées, dans l'ordre de leurs commits (section 10) :
--  9t.9 (consigne 0.8, R93, fix(9t.9)) — verrous d'écran servis par le serveur :
--   2. event_edit_locks(p_event uuid) (nouvelle, F17) : photo des verrous de modification d'un événement, mêmes
--      expressions qu'event_update (20261109000009_lot9bis_messages.sql:605-618) et mêmes aides « il y a des ventes »
--      (event_has_sales, ticket_category_has_sales, 20261102000004_lot5_edition.sql:189-209 : un billet de tout
--      statut ou une réservation ACTIVE). Lecture sans verrou : le serveur reste juge à l'enregistrement.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (2) F17 event_edit_locks (nouvelle, 9t.9) : lue par GET /api/partner/events/[id] (clé edit_locks).
--     has_sales            : event_has_sales (règle d'event_update, LOCKED_AFTER_SALES) ;
--     engaged              : vendus + en cours de paiement, toutes catégories ;
--     active_quota         : somme des quotas des catégories actives (CAPACITY_BELOW_QUOTAS) ;
--     capacity_floor       : plancher de la jauge (avec ventes : max(engaged, active_quota) ; sinon active_quota) ;
--     capacity_removable   : la jauge peut être retirée (aucune vente) ;
--     categories[]         : { id, has_sales } par catégorie (ticket_category_has_sales), triées par identifiant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_edit_locks(p_event uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH s AS (
        SELECT public.event_has_sales(p_event) AS has_sales,
               COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int AS engaged,
               COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int AS active_quota
          FROM public.ticket_categories c WHERE c.event_id = p_event)
    SELECT jsonb_build_object(
        'has_sales', s.has_sales,
        'engaged', s.engaged,
        'active_quota', s.active_quota,
        'capacity_floor', CASE WHEN s.has_sales THEN GREATEST(s.engaged, s.active_quota) ELSE s.active_quota END,
        'capacity_removable', NOT s.has_sales,
        'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'has_sales', public.ticket_category_has_sales(c.id)) ORDER BY c.id)
                                  FROM public.ticket_categories c WHERE c.event_id = p_event), '[]'::jsonb))
      FROM s
$$;
COMMENT ON FUNCTION public.event_edit_locks(uuid) IS
    'Lot 9 ter (R93, F17) : verrous de modification d''un événement pour l''écran, mêmes règles qu''event_update ; photo sans verrou.';


-- ----------------------------------------------------------------------------
-- (9) Privilèges : service_role seul.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_edit_locks(uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

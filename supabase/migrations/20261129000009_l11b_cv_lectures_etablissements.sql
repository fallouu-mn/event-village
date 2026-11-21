-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 09 : établissements lus par la REST seulement quand ils sont publics (T6)
-- ============================================================================
-- Contre-vérification du lot 11b (docs/audit-lot11b.md, T6) : une partenaire lisait par la REST ses établissements NON
-- publics (en attente, refusés, suspendus), leurs zones, tables et horaires (« OR is_partner_owner(partner_id) »).
-- Aucun écran ne lit ces tables par le navigateur : l'espace de l'établissement passe par les routes serveur (rôle de
-- service). Règle demandée : aucune lecture REST nouvelle pour l'établissement.
--  1. venues_read, restaurant_zones_read, restaurant_tables_read : reprises de
--     20261126000004_l10b_cv_correctifs.sql:43-65 sans « OR public.is_partner_owner(partner_id) » (public, ou
--     administration) ; venue_opening_hours_read (20261123000102_l11a_etablissements.sql:259-261) : mêmes conditions
--     écrites en clair (établissement public, ou administration) au lieu de suivre la règle de venues ;
--  2. colonnes de venues lisibles par anon et authenticated réduites à celles d'une fiche publique : plus de
--     validated_by (identifiant d'un administrateur), validated_at, validation_reason, submitted_at, created_at,
--     updated_at. partner_id, is_active et validation_status restent lisibles : les règles des zones et des tables les
--     lisent dans leurs sous-requêtes (droits de l'appelant), et une ligne visible est toujours active et validée.
-- Aucun BEGIN ni COMMIT ; rejouable (DROP POLICY IF EXISTS puis CREATE, REVOKE puis GRANT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Règles de lecture : public ou administration
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "venues_read" ON public.venues;
CREATE POLICY "venues_read" ON public.venues
    FOR SELECT USING (
        (is_active = TRUE AND validation_status = 'VALIDEE' AND public.partner_listed(partner_id))
        OR public.is_admin());

DROP POLICY IF EXISTS "restaurant_zones_read" ON public.restaurant_zones;
CREATE POLICY "restaurant_zones_read" ON public.restaurant_zones
    FOR SELECT USING (
        (is_active = TRUE AND venue_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = restaurant_zones.venue_id AND v.is_active AND v.validation_status = 'VALIDEE'
                                                     AND public.partner_listed(v.partner_id)))
        OR public.is_admin());

DROP POLICY IF EXISTS "restaurant_tables_read" ON public.restaurant_tables;
CREATE POLICY "restaurant_tables_read" ON public.restaurant_tables
    FOR SELECT USING (
        (is_active = TRUE AND venue_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = restaurant_tables.venue_id AND v.is_active AND v.validation_status = 'VALIDEE'
                                                     AND public.partner_listed(v.partner_id)))
        OR public.is_admin());

DROP POLICY IF EXISTS "venue_opening_hours_read" ON public.venue_opening_hours;
CREATE POLICY "venue_opening_hours_read" ON public.venue_opening_hours
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_opening_hours.venue_id AND v.is_active AND v.validation_status = 'VALIDEE'
                                                AND public.partner_listed(v.partner_id))
        OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. Colonnes de venues lisibles par la REST : celles d'une fiche publique
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.venues FROM anon, authenticated;
GRANT SELECT (id, partner_id, kind, name, description, address, city, latitude, longitude, photos, slot_minutes,
              deposit_per_person, confirmation_mode, floor_plan_enabled, is_active, validation_status)
    ON public.venues TO anon, authenticated;
GRANT ALL ON public.venues TO service_role;

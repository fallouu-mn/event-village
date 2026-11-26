-- ============================================================================
-- Lot Carte B3 — contrôles « avant » et « après » la migration 20261210000001_cb3_lieux_publics.sql (LECTURE SEULE)
-- ============================================================================
-- À lancer sur event-village-dev avant puis après `db push`. Aucune écriture : SELECT seulement.
-- Avant (attendu) : derniere_migration = 20261201000007 (11c-a) ; migration_du_lot = 0 ; listed_venue = 0 ;
--   public_partners.public_name = 0 et public_partners.company_name = 1 ; anon_select_halls = true (colonnes) ;
--   event_transition_publication = 0 ; hall_search_raison_sociale = 1 ; venue_search_raison_sociale = 1 ;
--   scanned_raison_sociale = 1.
-- Après (attendu) : derniere_migration = 20261210000001 ; migration_du_lot = 1 ; listed_venue = 1 (STABLE, SECURITY
--   DEFINER, search_path fixé, exécutable par anon et authenticated) ; public_partners.public_name = 1 et
--   public_partners.company_name = 0 ; anon_select_halls = false ; anon_select_venues = false ;
--   authenticated_select_venues_id = true, authenticated_select_venues_name = false ; event_transition_publication = 1 ;
--   hall_search_raison_sociale = 0 ; venue_search_raison_sociale = 0 ; scanned_raison_sociale = 0 ;
--   regles_listed_venue = 4 (zones, tables, horaires, zones de livraison).
-- ============================================================================
SELECT 'derniere_migration' AS controle, max(version)::text AS valeur FROM supabase_migrations.schema_migrations
UNION ALL
SELECT 'migration_du_lot', count(*)::text FROM supabase_migrations.schema_migrations WHERE version = '20261210000001'
UNION ALL
SELECT 'listed_venue', count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'listed_venue'
UNION ALL
SELECT 'listed_venue_forme', COALESCE((SELECT format('volatilite=%s definer=%s config=%s anon=%s auth=%s', p.provolatile, p.prosecdef,
        array_to_string(p.proconfig, ' '), has_function_privilege('anon', p.oid, 'EXECUTE'), has_function_privilege('authenticated', p.oid, 'EXECUTE'))
        FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'listed_venue'), 'absente')
UNION ALL
SELECT 'public_partners.public_name', count(*)::text FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'public_partners' AND column_name = 'public_name'
UNION ALL
SELECT 'public_partners.company_name', count(*)::text FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'public_partners' AND column_name = 'company_name'
UNION ALL
SELECT 'anon_select_halls', (has_table_privilege('anon', 'public.halls', 'SELECT')
        OR has_any_column_privilege('anon', 'public.halls', 'SELECT'))::text
UNION ALL
SELECT 'anon_select_venues', (has_table_privilege('anon', 'public.venues', 'SELECT')
        OR has_any_column_privilege('anon', 'public.venues', 'SELECT'))::text
UNION ALL
SELECT 'authenticated_select_venues_id', has_column_privilege('authenticated', 'public.venues', 'id', 'SELECT')::text
UNION ALL
SELECT 'authenticated_select_venues_name', has_column_privilege('authenticated', 'public.venues', 'name', 'SELECT')::text
UNION ALL
SELECT 'event_transition_publication', (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname = 'event_transition' AND prosrc LIKE '%avant de publier%')::text
UNION ALL
SELECT 'hall_search_raison_sociale', (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname = 'hall_search' AND prosrc LIKE '%pa.company_name%')::text
UNION ALL
SELECT 'venue_search_raison_sociale', (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname = 'venue_search' AND prosrc LIKE '%pa.company_name%')::text
UNION ALL
SELECT 'scanned_raison_sociale', (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname = 'notif_tickets_scanned' AND prosrc LIKE '%pa.company_name%')::text
UNION ALL
SELECT 'regles_listed_venue', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
        AND policyname IN ('restaurant_zones_read', 'restaurant_tables_read', 'venue_opening_hours_read', 'order_delivery_zones_read')
        AND qual LIKE '%listed_venue%')::text;

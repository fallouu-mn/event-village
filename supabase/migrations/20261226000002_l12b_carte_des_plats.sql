-- ============================================================================
-- EVENT VILLAGE — LOT 12b, migration 02 : carte des plats publique d'un établissement, lecture REST des produits
-- ============================================================================
-- Relevé de l'existant (docs/lot12-etat-des-lieux.md § 2.3, revérifié dans le code le 26/11) :
--  - GET /api/restaurants/[id]/menu lisait les produits d'une PARTENAIRE (aucun établissement, aucun supplément, aucune
--    portion, aucune zone, aucun horaire) et remplaçait l'image absente par une photo d'un site extérieur ;
--  - la règle REST products_read (0003_rls.sql:237-238, jamais redéfinie) laisse lire, avec la clé anon, tout produit
--    DISPONIBLE, même d'une partenaire suspendue ou d'un établissement non validé, retiré ou sans établissement ;
--    product_options_read et product_daily_portions_read (20261130000002_l12a_catalogue.sql:425-430) suivent la règle
--    de lecture du produit.
--  1. order_venue_menu(établissement) : fonction NOUVELLE, réservée au rôle de service (route publique du serveur) ;
--     rien si le service est fermé, l'établissement inactif, non validé, fermé à la commande ou d'une partenaire non
--     VALIDE. Rend : l'établissement (nom, sorte, ville, adresse, description, photos), la vente (modes, acompte proposé
--     en pourcentage, paiement à la remise, préparation, frais de service), les horaires de la semaine, les fenêtres où
--     une heure peut être choisie (7 jours, horaires moins les fermetures, après la préparation), « tout de suite »
--     possible ou non, les zones de livraison (frais, minimum), les tables pour une commande sur place, les catégories et
--     les produits (photo de la fiche ou rien, prix, suppléments actifs, disponibilité, plat du jour et portions
--     restantes, réglementé ou en vérification : affiché avec son prix, jamais commandable). Aucun champ interne : ni
--     stock exact, ni décision de l'administration, ni mots trouvés par la vérification.
--     Produits retirés par le lot 12c (products.archived_at, zones order_delivery_zones.archived_at) et produits « à
--     vérifier » (products.review_state) : colonnes lues directement (migration renommée après celles du 12c,
--     20261224000001-005, où elles sont créées) ; « non commandable » suit product_regulated (lecture seule).
--  2. Deux aides des règles de lecture (SECURITY DEFINER, search_path fixé, un booléen ; modèle : listed_venue de
--     20261210000001_cb3_lieux_publics.sql:53-64), exécutables par anon, authenticated et service_role, retirées à PUBLIC,
--     ajoutées à la liste blanche des aides (supabase/hotfix/2026-10-31-lot1a/03-verification.sql,
--     tests/schema/fonctions-privileges.test.ts) :
--       product_public(produit) : DISPONIBLE, d'un établissement listé (listed_venue), non retiré (archived_at vide) ;
--       product_owner_or_admin(produit) : la partenaire propriétaire du produit ou l'administration.
--     Contre-vérification du lot 12b (T1) : une règle ne lit jamais la ligne entière du produit (le 12c ne rend à anon
--     et authenticated que certaines colonnes de products, 20261224000005:571-582 ; une sous-requête de règle est
--     vérifiée avec les droits de l'appelant) ;
--  3. products_read : product_public, plus la partenaire propriétaire et l'administration (règle d'origine
--     0003_rls.sql:237-238) ; product_options_read (supplément actif pour le public) et product_daily_portions_read :
--     mêmes conditions par les deux aides, sans sous-requête sur products.
--  4. Correctifs après contre-vérification (idée 9) : la carte rend la fin de la fermeture exceptionnelle en cours
--     (ordering.closed_until, « AAAA-MM-JJTHH:MI », heure de Dakar ; NULL sans fermeture), pour l'annoncer.
-- Rejouable : CREATE OR REPLACE, DROP POLICY IF EXISTS puis CREATE, REVOKE et GRANT idempotents. Aucun BEGIN ni COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Carte des plats publique
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_venue_menu(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v          record;
    v_now      timestamp := date_trunc('minute', public.hall_dakar_now());
    v_today    date := public.hall_dakar_now()::date;
    v_prep     integer;
    v_windows  jsonb;
    v_asap     boolean;
    v_closed_until timestamp;
    v_hours    jsonb;
    v_products jsonb;
    v_cats     jsonb;
    v_zones    jsonb;
    v_spots    jsonb;
BEGIN
    IF p_venue_id IS NULL OR NOT public.fin_setting_bool('features.orders_enabled') THEN
        RETURN NULL;
    END IF;
    SELECT ve.* INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = p_venue_id AND ve.is_active AND ve.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE' AND ve.orders_open;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    v_prep := COALESCE(v.order_prep_minutes, public.fin_setting_num('orders.prep_minutes_default')::int);

    -- Horaires de la semaine (jour ISO, ouverture, fermeture « HH:MI », 24:00 possible)
    SELECT COALESCE(jsonb_agg(jsonb_build_array(h.weekday, to_char(h.opens_at, 'HH24:MI'),
                                                CASE WHEN h.closes_at = time '00:00' THEN '24:00' ELSE to_char(h.closes_at, 'HH24:MI') END)
                              ORDER BY h.weekday, h.opens_at), '[]'::jsonb)
      INTO v_hours
      FROM public.venue_opening_hours h WHERE h.venue_id = v.id;

    -- Fenêtres où une heure peut être choisie : horaires des 7 jours, moins les fermetures, de maintenant + préparation
    -- à 7 jours (même borne que order_quote_compute ; la base refait tous les contrôles au devis)
    SELECT COALESCE(jsonb_agg(jsonb_build_array(to_char(lower(r), 'YYYY-MM-DD"T"HH24:MI'), to_char(upper(r), 'YYYY-MM-DD"T"HH24:MI'))
                              ORDER BY lower(r)), '[]'::jsonb)
      INTO v_windows
      FROM unnest((
            (SELECT range_agg(public.venue_range(g.day::date, h.opens_at, h.closes_at))
               FROM generate_series((v_today - 1)::timestamp, (v_today + 7)::timestamp, interval '1 day') AS g(day)
               JOIN public.venue_opening_hours h ON h.venue_id = v.id AND h.weekday = EXTRACT(ISODOW FROM g.day))
            - COALESCE((SELECT range_agg(c.period) FROM public.venue_closures c
                         WHERE c.venue_id = v.id AND c.cancelled_at IS NULL AND c.ends_at > v_now), '{}'::tsmultirange))
           * tsmultirange(tsrange(v_now + make_interval(mins => v_prep), v_now + interval '7 days', '[)'))) AS r;

    -- « Tout de suite » : ouvert pendant toute la préparation (règle de order_quote_compute) et aucune fermeture
    v_asap := public.venue_open_covers(v.id, tsrange(v_now, v_now + make_interval(mins => v_prep + 1), '[)'))
              AND NOT public.venue_closed_during(v.id, tsrange(v_now, v_now + make_interval(mins => v_prep + 1), '[)'));

    -- Fermeture exceptionnelle en cours (correctifs après contre-vérification, idée 9) : jusqu'à quand, fermetures qui se
    -- suivent réunies ; la carte l'annonce et propose le premier créneau (première fenêtre ci-dessus)
    SELECT upper(r) INTO v_closed_until
      FROM unnest(COALESCE((SELECT range_agg(c.period) FROM public.venue_closures c
                             WHERE c.venue_id = v.id AND c.cancelled_at IS NULL AND c.ends_at > v_now), '{}'::tsmultirange)) AS r
     WHERE r @> v_now
     LIMIT 1;

    -- Produits de l'établissement (retirés exclus) : disponibilité calculée, jamais le stock exact
    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.daily DESC, x.cat_order, x.cat_name, x.name, x.id), '[]'::jsonb)
      INTO v_products
      FROM (
        SELECT pr.id, pr.name, pr.is_daily_special AS daily,
               COALESCE(cat.sort_order, 2147483647) AS cat_order, COALESCE(cat.name, '') AS cat_name,
               jsonb_build_object(
                   'id', pr.id,
                   'name', pr.name,
                   'description', NULLIF(btrim(COALESCE(pr.description, '')), ''),
                   'price', pr.price,
                   'image', CASE WHEN cardinality(pr.images) > 0 AND NULLIF(btrim(pr.images[1]), '') IS NOT NULL THEN pr.images[1] END,
                   'category_id', cat.id,
                   'availability', CASE
                       WHEN pr.status::text <> 'DISPONIBLE' THEN pr.status::text
                       WHEN pr.is_stock_managed AND pr.stock_quantity IS NOT NULL AND pr.stock_quantity <= 0 THEN 'EPUISE'
                       WHEN pr.is_daily_special AND COALESCE(dp.portions - dp.sold, 0) <= 0 THEN 'EPUISE'
                       ELSE 'DISPONIBLE' END,
                   'regulated', pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE),
                   'in_review', pr.review_state IS NOT NULL,
                   'orderable', pr.status::text = 'DISPONIBLE' AND pr.price = trunc(pr.price)
                       AND NOT public.product_regulated(pr.id)
                       AND NOT (pr.is_stock_managed AND pr.stock_quantity IS NOT NULL AND pr.stock_quantity <= 0)
                       AND NOT (pr.is_daily_special AND COALESCE(dp.portions - dp.sold, 0) <= 0),
                   'daily', pr.is_daily_special,
                   'portions_left', CASE WHEN pr.is_daily_special THEN GREATEST(COALESCE(dp.portions - dp.sold, 0), 0) END,
                   'portions_total', CASE WHEN pr.is_daily_special THEN COALESCE(dp.portions, 0) END,
                   'options', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.price_delta)
                                                         ORDER BY o.sort_order, o.name, o.id), '[]'::jsonb)
                                 FROM public.product_options o WHERE o.product_id = pr.id AND o.is_active)
               ) AS item
          FROM public.products pr
          LEFT JOIN public.product_categories cat ON cat.id = pr.category_id AND cat.is_active AND cat.partner_id = pr.partner_id
          LEFT JOIN public.product_daily_portions dp ON dp.product_id = pr.id AND dp.day = v_today
         WHERE pr.venue_id = v.id AND pr.partner_id = v.partner_id
           AND pr.archived_at IS NULL
      ) x;

    -- Catégories qui ont au moins un produit dans la carte
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.sort_order, c.name, c.id), '[]'::jsonb)
      INTO v_cats
      FROM public.product_categories c
     WHERE c.is_active AND c.partner_id = v.partner_id
       AND EXISTS (SELECT 1 FROM public.products pr WHERE pr.category_id = c.id AND pr.venue_id = v.id AND pr.archived_at IS NULL);

    -- Zones de livraison actives (non retirées), si la livraison est proposée
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'fee', z.fee, 'min_order', z.min_order)
                              ORDER BY z.sort_order, z.name, z.id), '[]'::jsonb)
      INTO v_zones
      FROM public.order_delivery_zones z
     WHERE z.venue_id = v.id AND z.is_active AND z.archived_at IS NULL AND 'LIVRAISON' = ANY (v.order_modes);

    -- Tables actives, si la commande sur place est proposée (liste ; QR de table plus tard)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.table_number, 'zone', rz.name)
                              ORDER BY rz.name NULLS FIRST, length(t.table_number), t.table_number, t.id), '[]'::jsonb)
      INTO v_spots
      FROM public.restaurant_tables t
      LEFT JOIN public.restaurant_zones rz ON rz.id = t.zone_id
     WHERE t.venue_id = v.id AND t.is_active AND 'SUR_PLACE' = ANY (v.order_modes);

    RETURN jsonb_build_object(
        'venue', jsonb_build_object('id', v.id, 'name', v.name, 'kind', v.kind, 'city', v.city, 'address', v.address,
                                    'description', NULLIF(btrim(COALESCE(v.description, '')), ''), 'photos', to_jsonb(COALESCE(v.photos, ARRAY[]::text[]))),
        'ordering', jsonb_build_object(
            'modes', to_jsonb(v.order_modes),
            'deposit_percent', CASE WHEN v.order_deposit_allowed
                                    THEN COALESCE(v.order_deposit_percent, public.fin_setting_num('orders.deposit_default_percent')::int) END,
            'pay_on_handover', v.order_pay_on_handover,
            'prep_minutes', v_prep,
            'service_fee_rate', public.fin_setting_num('orders.service_fee_rate'),
            'asap_available', v_asap,
            'closed_until', to_char(v_closed_until, 'YYYY-MM-DD"T"HH24:MI'),
            'now', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI'),
            'windows', v_windows),
        'hours', v_hours,
        'zones', v_zones,
        'spots', v_spots,
        'categories', v_cats,
        'products', v_products);
END;
$$;

REVOKE ALL ON FUNCTION public.order_venue_menu(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_venue_menu(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Aides des règles de lecture des produits (booléen seul, droits du propriétaire ; modèle : listed_venue)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_public(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.products pr
                   WHERE pr.id = p_product_id AND pr.status = 'DISPONIBLE' AND pr.venue_id IS NOT NULL
                     AND pr.archived_at IS NULL AND public.listed_venue(pr.venue_id));
$$;
REVOKE ALL ON FUNCTION public.product_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_public(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.product_owner_or_admin(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_admin()
        OR EXISTS (SELECT 1 FROM public.products pr WHERE pr.id = p_product_id AND public.is_partner_owner(pr.partner_id));
$$;
REVOKE ALL ON FUNCTION public.product_owner_or_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_owner_or_admin(uuid) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Lecture REST des produits : établissement listé seulement (plus la propriétaire et l'administration)
-- ----------------------------------------------------------------------------
-- products_read (dernière définition : 0003_rls.sql:237-238) ; changement : un produit n'est public que s'il est
-- DISPONIBLE, d'un établissement listé (actif, validé, partenaire VALIDE) et non retiré (product_public)
DROP POLICY IF EXISTS "products_read" ON public.products;
CREATE POLICY "products_read" ON public.products
    FOR SELECT USING (public.product_public(id) OR public.is_partner_owner(partner_id) OR public.is_admin());

-- product_options_read (dernière définition : 20261130000002_l12a_catalogue.sql:425-427) ; changement : supplément actif
-- d'un produit public, ou propriétaire / administration, sans sous-requête sur products
DROP POLICY IF EXISTS "product_options_read" ON public.product_options;
CREATE POLICY "product_options_read" ON public.product_options
    FOR SELECT USING ((is_active AND public.product_public(product_id)) OR public.product_owner_or_admin(product_id));

-- product_daily_portions_read (dernière définition : 20261130000002_l12a_catalogue.sql:428-430) ; changement : portions
-- d'un produit public, ou propriétaire / administration, sans sous-requête sur products
DROP POLICY IF EXISTS "product_daily_portions_read" ON public.product_daily_portions;
CREATE POLICY "product_daily_portions_read" ON public.product_daily_portions
    FOR SELECT USING (public.product_public(product_id) OR public.product_owner_or_admin(product_id));

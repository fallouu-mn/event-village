-- ============================================================================
-- EVENT VILLAGE — LOT 12c, migration 04 : « Ma journée » de la partenaire (écran des commandes)
-- ============================================================================
-- Aucun montant n'est calculé dans le navigateur (règle du lot) : la base compte, pour les établissements de la
-- partenaire du compte (ou un seul), le jour de Dakar (UTC toute l'année) :
--  - commandes reçues aujourd'hui (transmises : payées ou payables à la remise ; jamais une commande non payée) ;
--  - commandes ouvertes, dont celles à accepter ;
--  - commandes remises aujourd'hui et leur recette (total des articles et de la livraison, payé en ligne ou sur place) ;
--  - plats bientôt épuisés : plat du jour avec 5 portions ou moins aujourd'hui, produit suivi en stock avec 5 unités
--    ou moins (ni archivés, ni à vérifier).
-- Lecture seule, au rôle de service seulement ; la fiche SUSPENDU la lit aussi (lecture seule). Rejouable.
-- ============================================================================

-- p : actor_id, venue_id (facultatif)
CREATE OR REPLACE FUNCTION public.order_partner_day(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_venue   uuid := public.try_uuid(NULLIF(p->>'venue_id', ''));
    v_partner uuid;
    v_today   date := (now() AT TIME ZONE 'Africa/Dakar')::date;
    v_counts  record;
    v_low     jsonb;
    v_specials jsonb;
BEGIN
    SELECT pa.id INTO v_partner FROM public.partners pa WHERE pa.user_id = v_actor ORDER BY pa.created_at LIMIT 1;
    IF v_actor IS NULL OR v_partner IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Réservé aux partenaires.');
    END IF;
    IF NULLIF(p->>'venue_id', '') IS NOT NULL
       AND (v_venue IS NULL OR NOT EXISTS (SELECT 1 FROM public.venues ve WHERE ve.id = v_venue AND ve.partner_id = v_partner)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est pas le vôtre.');
    END IF;
    SELECT count(*) FILTER (WHERE (o.received_at AT TIME ZONE 'Africa/Dakar')::date = v_today) AS received_today,
           count(*) FILTER (WHERE o.closed_at IS NULL) AS open_now,
           count(*) FILTER (WHERE o.order_state = 'RECUE') AS to_accept,
           count(*) FILTER (WHERE o.order_state = 'REMISE' AND (o.handed_over_at AT TIME ZONE 'Africa/Dakar')::date = v_today) AS handed_today,
           COALESCE(sum(o.goods_total) FILTER (WHERE o.order_state = 'REMISE' AND (o.handed_over_at AT TIME ZONE 'Africa/Dakar')::date = v_today), 0) AS revenue_today,
           COALESCE(sum(o.paid_goods) FILTER (WHERE o.order_state = 'REMISE' AND (o.handed_over_at AT TIME ZONE 'Africa/Dakar')::date = v_today), 0) AS paid_online_today,
           COALESCE(sum(o.onsite_amount) FILTER (WHERE o.order_state = 'REMISE' AND (o.handed_over_at AT TIME ZONE 'Africa/Dakar')::date = v_today), 0) AS onsite_today
      INTO v_counts
      FROM public.orders o
     WHERE o.partner_id = v_partner AND o.venue_id IS NOT NULL AND o.received_at IS NOT NULL
       AND (v_venue IS NULL OR o.venue_id = v_venue)
       AND (o.closed_at IS NULL OR o.closed_at >= (v_today::timestamp AT TIME ZONE 'Africa/Dakar') - interval '1 day');
    SELECT COALESCE(jsonb_agg(s.x ORDER BY (s.x->>'left')::int, s.x->>'name'), '[]'::jsonb) INTO v_low
      FROM (
        SELECT jsonb_build_object('product_id', pr.id, 'name', pr.name, 'venue_id', pr.venue_id, 'kind', 'PORTIONS',
                                  'left', GREATEST(dp.portions - dp.sold, 0)) AS x
          FROM public.products pr JOIN public.product_daily_portions dp ON dp.product_id = pr.id AND dp.day = v_today
         WHERE pr.partner_id = v_partner AND pr.is_daily_special AND pr.archived_at IS NULL AND pr.review_state IS NULL
           AND (v_venue IS NULL OR pr.venue_id = v_venue) AND dp.portions > 0 AND dp.portions - dp.sold <= 5
        UNION ALL
        SELECT jsonb_build_object('product_id', pr.id, 'name', pr.name, 'venue_id', pr.venue_id, 'kind', 'STOCK',
                                  'left', GREATEST(pr.stock_quantity, 0))
          FROM public.products pr
         WHERE pr.partner_id = v_partner AND pr.is_stock_managed AND pr.stock_quantity IS NOT NULL AND pr.archived_at IS NULL
           AND pr.review_state IS NULL AND (v_venue IS NULL OR pr.venue_id = v_venue) AND pr.stock_quantity <= 5
           AND pr.status::text IN ('DISPONIBLE', 'EPUISE')
      ) s;
    -- Contre-vérification du lot 12c (point 12) : plats du jour encore en vente aujourd'hui (« Plus de … » en un geste)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', pr.id, 'name', pr.name, 'venue_id', pr.venue_id,
                                                 'portions', dp.portions, 'sold', dp.sold) ORDER BY pr.name, pr.id), '[]'::jsonb)
      INTO v_specials
      FROM public.products pr JOIN public.product_daily_portions dp ON dp.product_id = pr.id AND dp.day = v_today
     WHERE pr.partner_id = v_partner AND pr.is_daily_special AND pr.archived_at IS NULL
       AND (v_venue IS NULL OR pr.venue_id = v_venue) AND dp.portions > dp.sold;
    RETURN jsonb_build_object('ok', true, 'day', v_today,
        'received_today', v_counts.received_today, 'open_now', v_counts.open_now, 'to_accept', v_counts.to_accept,
        'handed_today', v_counts.handed_today, 'revenue_today', v_counts.revenue_today,
        'paid_online_today', v_counts.paid_online_today, 'onsite_today', v_counts.onsite_today, 'low', v_low,
        'specials', v_specials);
END;
$$;

REVOKE ALL ON FUNCTION public.order_partner_day(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_partner_day(jsonb) TO service_role;

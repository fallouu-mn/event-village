-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 06 : fermeture confirmée sur la LISTE de l'aperçu (contre-vérification, T1)
-- ============================================================================
-- Contre-vérification du lot 11b (docs/audit-lot11b.md, T1) : la fermeture se confirmait sur le seul NOMBRE de
-- réservations de l'aperçu ; une réservation annulée et une autre prise entre-temps → la nouvelle, jamais montrée, était
-- annulée (et le montant rendu pouvait différer de l'aperçu).
--  1. venue_closure_fingerprint(liste) : empreinte de la liste touchée (md5 des identifiants triés et des montants
--     rendus) ;
--  2. venue_closure_preview : recopie de 20261129000002_l11b_fermetures_disponibilites.sql:174-206 ; changement :
--     l'aperçu rend aussi l'empreinte (fingerprint) ;
--  3. venue_closure_create : recopie de 20261129000002_l11b_fermetures_disponibilites.sql:211-286 ; changement : la
--     confirmation envoie l'empreinte (expected_hash), recalculée sous le verrou de l'établissement : refus
--     PREVIEW_CHANGED si la liste ou un montant a changé (avec la nouvelle liste). Sans empreinte, seul un aperçu VIDE se
--     confirme (expected_count = 0 : la liste vide n'a qu'une empreinte) ; sinon PREVIEW_REQUIRED.
-- Toutes réservées au rôle de service. Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Empreinte d'une liste de réservations touchées
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_closure_fingerprint(p_touched jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT md5(COALESCE(string_agg((x->>'reservation_id') || ':' || ((x->>'refund_amount')::numeric)::text, ',' ORDER BY x->>'reservation_id'), ''))
      FROM jsonb_array_elements(COALESCE(p_touched, '[]'::jsonb)) AS x;
$$;

-- ----------------------------------------------------------------------------
-- 2. Aperçu : liste, nombre, montant rendu et empreinte
-- ----------------------------------------------------------------------------
-- Recopie de 20261129000002_l11b_fermetures_disponibilites.sql:174-206 ; changement : empreinte rendue avec l'aperçu.
CREATE OR REPLACE FUNCTION public.venue_closure_preview(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_refusal  jsonb;
    v_period   jsonb;
    v_range    tsrange;
    v_touched  jsonb;
BEGIN
    v_refusal := public.venue_owner_refusal(v_actor, v_venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    v_period := public.venue_closure_parse(p);
    IF (v_period->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_period;
    END IF;
    v_range := tsrange((v_period->>'starts_at')::timestamp, (v_period->>'ends_at')::timestamp, '[)');
    IF EXISTS (SELECT 1 FROM public.venue_closures c WHERE c.venue_id = v_venue_id AND c.cancelled_at IS NULL AND c.period && v_range) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_OVERLAP', 'message', 'Une fermeture est déjà prévue sur une partie de cette période.');
    END IF;
    v_touched := public.venue_closure_touched(v_venue_id, v_range);
    RETURN jsonb_build_object('ok', true, 'starts_at', v_period->>'starts_at', 'ends_at', v_period->>'ends_at', 'reason', v_period->>'reason',
                              'reservations', v_touched, 'count', jsonb_array_length(v_touched),
                              'refund_total', COALESCE((SELECT sum((x->>'refund_amount')::numeric) FROM jsonb_array_elements(v_touched) x), 0),
                              -- Contre-vérification du lot 11b (T1) : empreinte de la liste, renvoyée à la confirmation
                              'fingerprint', public.venue_closure_fingerprint(v_touched));
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Confirmation : la liste doit être celle de l'aperçu (empreinte recalculée sous le verrou)
-- ----------------------------------------------------------------------------
-- Recopie de 20261129000002_l11b_fermetures_disponibilites.sql:211-286 ; changement : empreinte exigée et comparée.
-- Fermeture confirmée : sous le verrou de l'établissement, la liste doit être celle de l'aperçu (expected_count), puis
-- chaque réservation touchée est annulée par l'établissement et remboursée en entier (table_close_apply, 100 %),
-- client prévenu (avis d'annulation, motif « Fermeture exceptionnelle : … »)
CREATE OR REPLACE FUNCTION public.venue_closure_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_expected integer;
    -- Contre-vérification du lot 11b (T1) : empreinte de la liste vue à l'aperçu
    v_hash     text := NULLIF(btrim(COALESCE(p->>'expected_hash', '')), '');
    v_refusal  jsonb;
    v_period   jsonb;
    v_range    tsrange;
    v_touched  jsonb;
    v_id       uuid;
    h          record;
    x          jsonb;
    v_res      jsonb;
    v_ids      uuid[] := ARRAY[]::uuid[];
    v_refund   numeric := 0;
    v_count    integer := 0;
BEGIN
    v_refusal := public.venue_owner_refusal(v_actor, v_venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    BEGIN
        v_expected := (p->>'expected_count')::int;
    EXCEPTION WHEN others THEN
        v_expected := NULL;
    END;
    IF v_expected IS NULL OR v_expected < 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PREVIEW_REQUIRED', 'message', 'Affichez d’abord les réservations touchées, puis confirmez.');
    END IF;
    -- Contre-vérification du lot 11b (T1) : sans l'empreinte de l'aperçu, seul un aperçu vide se confirme
    IF v_hash IS NULL AND v_expected > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PREVIEW_REQUIRED', 'message', 'Affichez d’abord les réservations touchées, puis confirmez.');
    END IF;
    v_period := public.venue_closure_parse(p);
    IF (v_period->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_period;
    END IF;
    v_range := tsrange((v_period->>'starts_at')::timestamp, (v_period->>'ends_at')::timestamp, '[)');

    -- Une écriture à la fois par établissement : aucune réservation ne se glisse entre la liste et la fermeture
    PERFORM public.table_venue_lock(v_venue_id);
    FOR h IN SELECT id FROM public.table_reservations
              WHERE venue_id = v_venue_id AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now() LOOP
        PERFORM public.table_expire_hold(h.id);
    END LOOP;
    v_touched := public.venue_closure_touched(v_venue_id, v_range);
    IF jsonb_array_length(v_touched) <> v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PREVIEW_CHANGED',
            'message', format('Les réservations de cette période ont changé (%s au lieu de %s) : vérifiez la liste de nouveau avant de confirmer.',
                              jsonb_array_length(v_touched), v_expected),
            'count', jsonb_array_length(v_touched));
    END IF;
    -- Contre-vérification du lot 11b (T1) : même nombre ne suffit pas, la liste et les montants rendus doivent être ceux
    -- de l'aperçu ; sinon la nouvelle liste est rendue pour être montrée avant une nouvelle confirmation
    IF v_hash IS NOT NULL AND v_hash <> public.venue_closure_fingerprint(v_touched) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PREVIEW_CHANGED',
            'message', 'Les réservations de cette période ont changé depuis l’aperçu : vérifiez la nouvelle liste avant de confirmer.',
            'count', jsonb_array_length(v_touched), 'reservations', v_touched,
            'refund_total', COALESCE((SELECT sum((y->>'refund_amount')::numeric) FROM jsonb_array_elements(v_touched) y), 0),
            'fingerprint', public.venue_closure_fingerprint(v_touched));
    END IF;
    BEGIN
        INSERT INTO public.venue_closures (venue_id, starts_at, ends_at, reason, created_by)
        VALUES (v_venue_id, (v_period->>'starts_at')::timestamp, (v_period->>'ends_at')::timestamp, v_period->>'reason', v_actor)
        RETURNING id INTO v_id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_OVERLAP', 'message', 'Une fermeture est déjà prévue sur une partie de cette période.');
    END;
    FOR x IN SELECT * FROM jsonb_array_elements(v_touched) LOOP
        v_res := public.table_close_apply((x->>'reservation_id')::uuid, 'ANNULEE_ETABLISSEMENT', 'ETABLISSEMENT', v_actor,
                                          'Fermeture exceptionnelle : ' || (v_period->>'reason'), 100);
        v_ids := v_ids || ARRAY(SELECT jsonb_array_elements_text(v_res->'cashout_ids')::uuid);
        v_refund := v_refund + COALESCE((v_res->>'refund_amount')::numeric, 0);
        v_count := v_count + 1;
    END LOOP;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_CLOSURE_CREATED', 'venue_closures', v_id,
            jsonb_build_object('starts_at', v_period->>'starts_at', 'ends_at', v_period->>'ends_at', 'reason', v_period->>'reason'),
            jsonb_build_object('venue_id', v_venue_id, 'cancelled', v_count, 'refund_total', v_refund, 'cashout_ids', to_jsonb(v_ids)));
    RETURN jsonb_build_object('ok', true, 'closure_id', v_id, 'cancelled', v_count, 'refund_total', v_refund, 'cashout_ids', to_jsonb(v_ids),
                              'starts_at', v_period->>'starts_at', 'ends_at', v_period->>'ends_at');
END;
$$;

REVOKE ALL ON FUNCTION public.venue_closure_fingerprint(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_closure_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_closure_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.venue_closure_fingerprint(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_closure_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_closure_create(jsonb) TO service_role;

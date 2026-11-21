-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 08 : plan de salle enregistré en entier ou pas du tout (contre-vérification, T7)
-- ============================================================================
-- Contre-vérification du lot 11b (docs/audit-lot11b.md, T7) : un plan refusé (table d'un autre établissement en 2ᵉ
-- position) gardait la position de la table placée avant ; le refus « placez au moins une table avant de montrer le
-- plan » gardait de même les positions écrites. Un RETURN dans la boucle ne défait pas les UPDATE déjà faits.
--  1. venue_plan_set : recopie de 20261129000001_l11b_etablissements.sql:321-382 ; changement : toutes les tables et
--     zones du plan sont vérifiées AVANT la première écriture, et toutes les écritures (positions, plan montré) se font
--     dans un bloc : tout refus y lève une exception qui annule le bloc entier, puis le refus est rendu. Rien n'est
--     enregistré d'un plan refusé.
-- Réservée au rôle de service. Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT).
-- ============================================================================

-- Recopie de 20261129000001_l11b_etablissements.sql:321-382 ; changement : vérification complète, puis écritures annulées
-- ensemble au moindre refus.
CREATE OR REPLACE FUNCTION public.venue_plan_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_refusal  jsonb;
    t          jsonb;
    z          jsonb;
    v_tables   integer := 0;
    v_zones    integer := 0;
    v_placed   integer;
    -- Contre-vérification du lot 11b (T7) : refus levé dans le bloc des écritures (annulées), rendu après
    v_fail     jsonb;
BEGIN
    v_refusal := public.venue_owner_refusal(v_actor, v_venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    IF jsonb_typeof(COALESCE(p->'tables', '[]'::jsonb)) <> 'array' OR jsonb_typeof(COALESCE(p->'zones', '[]'::jsonb)) <> 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Plan illisible : rechargez la page et réessayez.');
    END IF;
    PERFORM 1 FROM public.venues WHERE id = v_venue_id FOR UPDATE;
    -- Contre-vérification du lot 11b (T7) : chaque table et chaque zone du plan appartiennent à l'établissement, vérifié
    -- avant la première écriture
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p->'tables', '[]'::jsonb)) AS e
                WHERE NOT EXISTS (SELECT 1 FROM public.restaurant_tables rt WHERE rt.id = public.try_uuid(e->>'id') AND rt.venue_id = v_venue_id)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Une table du plan n’appartient pas à cet établissement.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p->'zones', '[]'::jsonb)) AS e
                WHERE NOT EXISTS (SELECT 1 FROM public.restaurant_zones rz WHERE rz.id = public.try_uuid(e->>'id') AND rz.venue_id = v_venue_id)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Une zone du plan n’appartient pas à cet établissement.');
    END IF;
    BEGIN
        FOR t IN SELECT * FROM jsonb_array_elements(COALESCE(p->'tables', '[]'::jsonb)) LOOP
            UPDATE public.restaurant_tables
               SET plan_x = (t->>'x')::numeric, plan_y = (t->>'y')::numeric,
                   plan_shape = COALESCE(NULLIF(t->>'shape', ''), plan_shape),
                   plan_rotation = COALESCE((t->>'rotation')::smallint, plan_rotation), updated_at = now()
             WHERE id = public.try_uuid(t->>'id') AND venue_id = v_venue_id;
            IF NOT FOUND THEN
                v_fail := jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Une table du plan n’appartient pas à cet établissement.');
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'venue_plan_set : plan refusé';
            END IF;
            v_tables := v_tables + 1;
        END LOOP;
        FOR z IN SELECT * FROM jsonb_array_elements(COALESCE(p->'zones', '[]'::jsonb)) LOOP
            UPDATE public.restaurant_zones
               SET plan_x = (z->>'x')::numeric, plan_y = (z->>'y')::numeric, plan_w = (z->>'w')::numeric, plan_h = (z->>'h')::numeric,
                   updated_at = now()
             WHERE id = public.try_uuid(z->>'id') AND venue_id = v_venue_id;
            IF NOT FOUND THEN
                v_fail := jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Une zone du plan n’appartient pas à cet établissement.');
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'venue_plan_set : plan refusé';
            END IF;
            v_zones := v_zones + 1;
        END LOOP;
        SELECT count(*) INTO v_placed FROM public.restaurant_tables WHERE venue_id = v_venue_id AND is_active AND plan_x IS NOT NULL;
        IF COALESCE((p->>'enabled')::boolean, FALSE) AND v_placed = 0 THEN
            v_fail := jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Placez au moins une table sur le plan avant de le montrer aux clients.');
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'venue_plan_set : plan refusé';
        END IF;
        UPDATE public.venues SET floor_plan_enabled = COALESCE((p->>'enabled')::boolean, FALSE), updated_at = now() WHERE id = v_venue_id;
    EXCEPTION
        WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Une position du plan est hors du cadre : replacez la table ou la zone dans le plan.');
        WHEN raise_exception THEN
            -- Refus levé ci-dessus : écritures du bloc annulées, refus rendu ; toute autre exception remonte telle quelle
            IF v_fail IS NULL THEN
                RAISE;
            END IF;
            RETURN v_fail;
    END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_PLAN_SET', 'venues', v_venue_id,
            jsonb_build_object('tables', v_tables, 'zones', v_zones, 'enabled', COALESCE((p->>'enabled')::boolean, FALSE)));
    RETURN jsonb_build_object('ok', true, 'venue_id', v_venue_id, 'tables', v_tables, 'zones', v_zones, 'placed', v_placed,
                              'enabled', COALESCE((p->>'enabled')::boolean, FALSE));
END;
$$;

REVOKE ALL ON FUNCTION public.venue_plan_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.venue_plan_set(jsonb) TO service_role;

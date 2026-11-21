-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 07 : absence après la garde, annulation au montant de l'aperçu (contre-vérification)
-- ============================================================================
-- Contre-vérification du lot 11b (docs/audit-lot11b.md) :
--  1. table_reservation_presence : recopie de 20261129000003_l11b_reservations.sql:295-345 ; changement (T2) :
--     « Client absent » refusé (TOO_EARLY) tant que l'heure + tables.no_show_minutes n'est pas passée : la table est
--     promise « gardée jusqu'à … » par chaque avis ; un client en retard ne perd plus son acompte avant cette heure ;
--  2. table_reservation_cancel : recopie de 20261129000003_l11b_reservations.sql:351-420 ; changement (T3) : le client
--     envoie le montant de l'aperçu (expected_refund) ; s'il a changé (heure de l'annulation gratuite passée entre
--     l'aperçu et la confirmation), refus PREVIEW_CHANGED avec le nouveau montant, l'écran redemande la confirmation.
--     Même calcul que table_cancel_preview (arrondi de chaque paiement encaissé et pas encore rendu).
-- Aucune ligne des définitions recopiées n'est retirée (contrôles ajoutés seulement). Réservées au rôle de service.
-- Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT).
-- ============================================================================

-- Recopie de 20261129000003_l11b_reservations.sql:295-345 ; changement (T2) : absence seulement après la garde.
CREATE OR REPLACE FUNCTION public.table_reservation_presence(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_action text := upper(COALESCE(p->>'action', ''));
    v_now    timestamp := public.hall_dakar_now();
    r        record;
BEGIN
    IF v_action NOT IN ('ARRIVEE', 'ABSENT') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Indiquez si le client est arrivé ou absent.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;
    IF v_actor IS NULL OR v_actor <> r.owner_id
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    -- Lot 11b (F1) : fiche partenaire VALIDE exigée (une fiche suspendue ne marque plus un client arrivé ou absent)
    IF public.table_partner_fiche_refusal(r.partner_id) IS NOT NULL THEN
        RETURN public.table_partner_fiche_refusal(r.partner_id);
    END IF;
    IF r.booking_state <> 'CONFIRMEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CONFIRMED', 'message', 'Seule une réservation confirmée peut être marquée ainsi.');
    END IF;
    IF (v_action = 'ARRIVEE' AND v_now < lower(r.slot) - interval '1 hour') OR (v_action = 'ABSENT' AND v_now < lower(r.slot)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_EARLY', 'message', 'Il est trop tôt : attendez l’heure de la réservation.');
    END IF;
    -- Contre-vérification du lot 11b (T2) : la table est gardée tables.no_show_minutes après l'heure (promesse des avis
    -- « gardée jusqu'à … ») ; « Client absent » seulement ensuite. Un client qui ne viendra pas annule lui-même.
    IF v_action = 'ABSENT' AND v_now < lower(r.slot) + public.fin_setting_num('tables.no_show_minutes') * interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_EARLY',
            'message', format('La table est gardée jusqu’à %s : vous pourrez marquer le client absent à partir de cette heure.',
                              replace(to_char(lower(r.slot) + public.fin_setting_num('tables.no_show_minutes') * interval '1 minute', 'FMHH24" h "MI'), ' h 00', ' h')),
            'held_until', to_char(lower(r.slot) + public.fin_setting_num('tables.no_show_minutes') * interval '1 minute', 'HH24:MI'));
    END IF;
    IF v_now >= upper(r.slot) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_LATE', 'message', 'Le créneau de cette réservation est terminé.');
    END IF;
    IF v_action = 'ABSENT' THEN
        RETURN public.table_close_apply(r.id, 'ABSENT', NULL, v_actor, 'Client absent', 0);
    END IF;
    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations SET booking_state = 'ARRIVEE', arrived_at = now(), updated_at = now() WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'TABLE_GUEST_ARRIVED', 'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state), jsonb_build_object('booking_state', 'ARRIVEE'));
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'booking_state', 'ARRIVEE');
END;
$$;

-- Recopie de 20261129000003_l11b_reservations.sql:351-420 ; changement (T3) : montant de l'aperçu vérifié.
CREATE OR REPLACE FUNCTION public.table_reservation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_origin text := upper(COALESCE(p->>'origin', ''));
    v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    r        record;
    v_pct    numeric;
    v_state  text;
    -- Contre-vérification du lot 11b (T3) : montant rendu annoncé par l'aperçu, et montant rendu maintenant
    v_expect numeric;
    v_refund numeric;
BEGIN
    IF v_origin NOT IN ('CLIENT', 'ETABLISSEMENT', 'EVENT_VILLAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ORIGIN', 'message', 'Annulation refusée.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;

    -- Droits : le client sur la sienne, l'établissement sur celles de ses établissements, Event Village avec le droit
    -- des remboursements (ou la modération des services pour une demande jamais payée)
    IF v_origin = 'CLIENT' AND (v_actor IS NULL OR v_actor <> r.client_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF v_origin = 'ETABLISSEMENT' AND (v_actor IS NULL OR v_actor <> r.owner_id
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    -- Lot 11b (F1) : l'établissement annule seulement avec une fiche partenaire VALIDE
    IF v_origin = 'ETABLISSEMENT' AND public.table_partner_fiche_refusal(r.partner_id) IS NOT NULL THEN
        RETURN public.table_partner_fiche_refusal(r.partner_id);
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND (v_actor IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
        OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                OR public.has_admin_permission(v_actor, 'refunds.manage')
                OR (r.paid_amount = 0 AND r.booking_state IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION')
                    AND public.has_admin_permission(v_actor, 'events.write')))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler cette réservation.');
    END IF;
    IF v_origin IN ('ETABLISSEMENT', 'EVENT_VILLAGE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette réservation est déjà annulée ou terminée.');
    END IF;
    IF v_origin IN ('CLIENT', 'ETABLISSEMENT') AND lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_STARTED', 'message', 'L’heure de la réservation est passée : elle ne peut plus être annulée.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND upper(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ENDED', 'message', 'La réservation est terminée : elle ne peut plus être annulée.');
    END IF;

    -- Contre-vérification de la 11a (T3) : une demande que l'établissement n'a pas encore acceptée est rendue en entier,
    -- quelle que soit l'heure ; la règle des tables.cancel_free_hours ne vaut que pour une réservation confirmée
    v_pct := CASE WHEN v_origin = 'CLIENT' AND r.booking_state <> 'EN_ATTENTE_ACCEPTATION'
                  THEN public.table_client_refund_percent(lower(r.slot), public.hall_dakar_now(), public.fin_setting_num('tables.cancel_free_hours'))
                  ELSE 100 END;
    -- Contre-vérification du lot 11b (T3) : le client a confirmé le montant de l'aperçu ; s'il a changé depuis (heure de
    -- l'annulation gratuite passée entre-temps), rien n'est annulé : le nouveau montant est rendu pour une nouvelle
    -- confirmation. Même calcul que table_cancel_preview et table_refund_payment (arrondi de chaque paiement encaissé).
    IF v_origin = 'CLIENT' AND p ? 'expected_refund' THEN
        IF COALESCE(p->>'expected_refund', '') !~ '^[0-9]{1,12}([.][0-9]{1,2})?$' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant de l’aperçu illisible : affichez de nouveau l’annulation.');
        END IF;
        v_expect := (p->>'expected_refund')::numeric;
        SELECT COALESCE(sum(round(py.amount * v_pct / 100)), 0) INTO v_refund
          FROM public.payments py
         WHERE py.table_reservation_id = r.id AND py.status::text = 'SUCCESS'
           AND NOT EXISTS (SELECT 1 FROM public.refunds f WHERE f.payment_id = py.id AND f.refund_transaction_id = 'REFUND-TABLE-' || py.id::text);
        IF v_refund <> v_expect THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PREVIEW_CHANGED',
                'message', 'Le montant rendu a changé depuis l’affichage : vérifiez le nouveau montant avant de confirmer l’annulation.',
                'refund_amount', v_refund, 'kept_amount', GREATEST(r.paid_amount - r.refunded_amount - v_refund, 0));
        END IF;
    END IF;
    v_state := CASE v_origin WHEN 'CLIENT' THEN 'ANNULEE_CLIENT' WHEN 'ETABLISSEMENT' THEN 'ANNULEE_ETABLISSEMENT' ELSE 'ANNULEE_EV' END;
    RETURN public.table_close_apply(r.id, v_state, v_origin, v_actor, COALESCE(v_reason, 'Annulation par le client'), v_pct)
           || jsonb_build_object('cancel_free_hours', public.fin_setting_num('tables.cancel_free_hours'));
END;
$$;

REVOKE ALL ON FUNCTION public.table_reservation_presence(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reservation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_reservation_presence(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reservation_cancel(jsonb) TO service_role;

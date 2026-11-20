-- ============================================================================
-- EVENT VILLAGE — LOT 10b, migration 07 : T8 — rappels des salles dans le report de nuit de la finition 4
-- ============================================================================
-- Contre-vérification du lot 10b, T8 : un rappel du solde mis en file de jour partait en SMS la nuit si l'envoyeur
-- passait dans la plage (la nuit n'était revérifiée qu'à l'envoi des SMS facultatifs). Consigne : pas de second
-- mécanisme de nuit ; la finition 4 (20261125000001, 20261125000002) reporte à la fin de la nuit le SMS et le push des
-- types non urgents (notification_types.night_policy = 'DEFER', notification_outbox_claim).
--  1. HALL_BALANCE_REMINDER, HALL_EVE_REMINDER et HALL_EARNINGS_AVAILABLE classés DEFER (catalogue : night 'DEFER') ;
--  2. hall_reservations_tick : recopie de 20261126000004_l10b_cv_correctifs.sql:478-588 ; changement : la garde de jour du lot 10b
--     (v_day, second mécanisme) est retirée : les avis sont mis en file à toute heure, l'envoyeur fait le report.
-- Rejouable : UPDATE idempotent, CREATE OR REPLACE (droits conservés).
-- ============================================================================

UPDATE public.notification_types SET night_policy = 'DEFER'
 WHERE type IN ('HALL_BALANCE_REMINDER', 'HALL_EVE_REMINDER', 'HALL_EARNINGS_AVAILABLE') AND night_policy <> 'DEFER';

-- Recopie de 20261126000004_l10b_cv_correctifs.sql:478-588 ; changement : plus de garde de jour.
CREATE OR REPLACE FUNCTION public.hall_reservations_tick()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_holds     integer;
    v_deadline  integer := 0;
    v_reminders integer := 0;
    v_ids       uuid[] := ARRAY[]::uuid[];
    r           record;
    rr          record;
    v_res       jsonb;
    v_pct       numeric;
    v_now_local timestamp := public.hall_dakar_now();
    v_step      text;
    v_eves      integer := 0;
    v_earnings  integer := 0;
    v_owner     uuid;
BEGIN
    UPDATE public.hall_reservations
       SET booking_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, updated_at = now()
     WHERE booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now();
    GET DIAGNOSTICS v_holds = ROW_COUNT;

    FOR r IN
        SELECT hr.id, hr.hall_id FROM public.hall_reservations hr
         WHERE hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at < now()
           -- Un paiement du solde lancé avant l'échéance et encore valable est attendu
           AND NOT EXISTS (SELECT 1 FROM public.payments pp
                            WHERE pp.hall_reservation_id = hr.id AND pp.status::text = 'PENDING'
                              AND pp.created_at <= hr.balance_due_at AND pp.created_at > now() - interval '60 minutes')
         ORDER BY hr.balance_due_at
    LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || r.hall_id::text, 0));
        SELECT * INTO rr FROM public.hall_reservations WHERE id = r.id FOR UPDATE;
        IF rr.booking_state <> 'ACOMPTE_PAYE' OR rr.balance_due_at >= now() THEN
            CONTINUE;
        END IF;
        -- Règle d'annulation appliquée à l'instant de l'échéance (résultat indépendant de l'heure du passage)
        v_pct := public.hall_cancel_percent(rr.cancellation_terms, lower(rr.slot), rr.balance_due_at AT TIME ZONE 'Africa/Dakar');
        v_res := public.hall_cancel_apply(rr.id, 'DELAI', NULL, 'Solde non payé avant l’échéance', v_pct);
        v_ids := v_ids || ARRAY(SELECT jsonb_array_elements_text(v_res->'cashout_ids')::uuid);
        v_deadline := v_deadline + 1;
    END LOOP;

    -- Contre-vérification du lot 10b (T7) : rappel du solde 3 jours puis 1 jour avant son échéance (balance_due_at,
    -- calculée avec halls.balance_due_days), un de chaque ; avec l'échéance par défaut (J-7), J-10 puis J-8 ; (T8) mis
    -- en file à toute heure : la nuit, l'envoyeur reporte le SMS et le push à sa fin (night_policy DEFER, finition 4)
    FOR r IN
        SELECT hr.id, hr.client_id, hr.balance_due_at AS due_at FROM public.hall_reservations hr
         WHERE hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at IS NOT NULL
           AND now() < hr.balance_due_at AND now() >= hr.balance_due_at - interval '3 days'
    LOOP
        v_step := CASE WHEN now() >= r.due_at - interval '1 day' THEN 'J1' ELSE 'J3' END;
        v_reminders := v_reminders + COALESCE(public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_BALANCE_REMINDER', 'key', 'HALL_BALANCE_REMINDER:' || v_step || ':' || r.id::text,
            'user_id', r.client_id,
            'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('step', v_step))), 0);
    END LOOP;

    -- Lot 10b : rappel la veille de la date, au client et à la salle, de jour
    FOR r IN
        SELECT hr.id, hr.client_id, pa.user_id AS owner_id FROM public.hall_reservations hr
          JOIN public.partners pa ON pa.id = hr.partner_id
         WHERE hr.booking_state = 'PAYEE' AND hr.start_date = v_now_local::date + 1
    LOOP
        v_eves := v_eves + COALESCE(public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_EVE_REMINDER', 'key', 'HALL_EVE_REMINDER:' || r.id::text || ':' || r.client_id::text,
            'user_id', r.client_id,
            'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('recipient_role', 'CLIENT'))), 0);
        IF r.owner_id IS NOT NULL THEN
            v_eves := v_eves + COALESCE(public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_EVE_REMINDER', 'key', 'HALL_EVE_REMINDER:' || r.id::text || ':' || r.owner_id::text,
                'user_id', r.owner_id,
                'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('recipient_role', 'PARTNER'))), 0);
        END IF;
    END LOOP;

    -- Lot 10b : recettes d'une réservation devenues disponibles (toutes ses ventes au grand livre le sont, depuis
    -- moins de 3 jours), une fois, de jour
    FOR r IN
        SELECT hr.id, pa.user_id AS owner_id, sum(l.amount) AS earned
          FROM public.hall_reservations hr
          JOIN public.partners pa ON pa.id = hr.partner_id
          JOIN public.payments py ON py.hall_reservation_id = hr.id
          JOIN public.finance_ledger l ON l.payment_id = py.id AND l.account_kind = 'ORGANISATEUR'
         WHERE hr.end_date >= v_now_local::date - 30
         GROUP BY hr.id, pa.user_id
        HAVING sum(l.amount) > 0
           AND max(l.available_at) FILTER (WHERE l.entry_type = 'VENTE') <= now()
           AND max(l.available_at) FILTER (WHERE l.entry_type = 'VENTE') > now() - interval '3 days'
    LOOP
        v_owner := r.owner_id;
        IF v_owner IS NOT NULL THEN
            v_earnings := v_earnings + COALESCE(public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_EARNINGS_AVAILABLE', 'key', 'HALL_EARNINGS_AVAILABLE:' || r.id::text,
                'user_id', v_owner,
                'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('earned', r.earned))), 0);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('expired_holds', v_holds, 'deadline_passed', v_deadline, 'reminders', v_reminders,
                              'eve_reminders', v_eves, 'earnings_available', v_earnings,
                              'cashout_ids', to_jsonb(v_ids));
END;
$$;

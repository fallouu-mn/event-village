-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 04 : avis des tables (lien vers la réservation, nuit, « J'arrive », remboursement)
-- ============================================================================
-- Décisions du client : chaque étape sur les 4 canaux (cloche, push, email, SMS d'un segment au pire cas, avec le lien
-- court de la réservation) ; règle de nuit de la finition 4 : les avis non urgents attendent la fin de la nuit
-- (night_policy DEFER), sauf ceux d'un événement ou d'une réservation qui commence dans moins de 12 heures. Rappel
-- 2 h avant l'heure (avec « J'arrive » et « Annuler » sur la réservation).
--  1. types nouveaux : TABLE_CLIENT_COMING (le client arrive, à l'établissement), TABLE_REFUND_PAID (remboursement
--     versé, au client ; au lieu de l'avis générique) ;
--  2. nuit : DEFER pour la confirmation, la demande envoyée, la nouvelle réservation, « le client arrive » et la décision
--     sur un établissement ; les annulations, refus, demandes à accepter, absences et remboursements restent urgents ;
--  3. table_notif_data : recopie de 20261123000104_l11a_reserver.sql:27-51 ; changement : code court, heure de garde de
--     la table, fin de l'attente du paiement, fin de l'annulation gratuite ;
--  4. notif_event_soon : recopie de 20261125000006_f4_evenement_proche.sql:23-41 ; changement : une réservation de table
--     ou de salle à moins de 12 heures (ou en cours) rend aussi l'avis urgent ;
--  5. notif_cashouts_notify : recopie de 20261126000003_l10b_avis.sql:317-645 ; changement : TABLE_REFUND_PAID pour un
--     paiement de table (au lieu de REFUND_PAID) ;
--  6. réglage tables.reminder_hours : 2 (décision du client), seulement s'il vaut encore 3 (valeur d'origine).
-- Rejouable : ON CONFLICT DO UPDATE, UPDATE idempotents, CREATE OR REPLACE (droits conservés).
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('TABLE_CLIENT_COMING', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('TABLE_REFUND_PAID',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;

UPDATE public.notification_types SET night_policy = 'DEFER'
 WHERE night_policy <> 'DEFER' AND type IN (
    'TABLE_RESERVATION_CONFIRMED', 'TABLE_REQUEST_SENT', 'TABLE_NEW_RESERVATION', 'VENUE_VALIDATION_DECIDED', 'TABLE_REMINDER');

UPDATE public.platform_settings SET value = '{"value": 2}',
       description = 'Tables : rappel au client ce nombre d''heures avant l''heure (avec « J''arrive » et « Annuler »)'
 WHERE key = 'tables.reminder_hours' AND value = '{"value": 3}'::jsonb;

-- ----------------------------------------------------------------------------
-- Données des avis d'une réservation
-- ----------------------------------------------------------------------------
-- Recopie de 20261123000104_l11a_reserver.sql:27-51 ; changement : code court, heure de garde, fin de l'attente, fin de l'annulation gratuite.

CREATE OR REPLACE FUNCTION public.table_notif_data(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_strip_nulls(jsonb_build_object(
        'reservation_id', r.id,
        'venue_id', r.venue_id,
        'venue_name', v.name,
        'date', r.reservation_date,
        'time', to_char(r.reservation_time, 'HH24:MI'),
        'end_time', to_char(upper(r.slot), 'HH24:MI'),
        'guests', r.guest_count,
        'table_number', t.table_number,
        'deposit_amount', r.deposit_amount,
        'total_amount', r.total_amount,
        'paid_amount', r.paid_amount,
        -- Lot 11b : lien court des SMS, heure de garde de la table, fin de l'attente du paiement, fin de l'annulation gratuite
        'short_code', r.short_code,
        'held_until', to_char(lower(r.slot) + public.fin_setting_num('tables.no_show_minutes') * interval '1 minute', 'HH24:MI'),
        'hold_expires_at', CASE WHEN r.booking_state = 'EN_ATTENTE_PAIEMENT' THEN r.hold_expires_at END,
        'cancel_free_until', CASE WHEN r.paid_amount > 0 AND r.booking_state = 'CONFIRMEE'
                                  THEN to_char(lower(r.slot) - public.fin_setting_num('tables.cancel_free_hours') * interval '1 hour', 'YYYY-MM-DD"T"HH24:MI') END,
        'response_due_at', CASE WHEN r.booking_state = 'EN_ATTENTE_ACCEPTATION' THEN r.response_due_at END))
      FROM public.table_reservations r
      JOIN public.venues v ON v.id = r.venue_id
      LEFT JOIN public.restaurant_tables t ON t.id = r.table_id
     WHERE r.id = p_reservation_id;
$$;

-- ----------------------------------------------------------------------------
-- Nuit : réservation proche
-- ----------------------------------------------------------------------------
-- Recopie de 20261125000006_f4_evenement_proche.sql:23-41 ; changement : réservation de table ou de salle à moins de 12 heures.
CREATE OR REPLACE FUNCTION public.notif_event_soon(p_event uuid, p_data jsonb, p_now timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.events e
         WHERE e.id IN (
                   SELECT p_event WHERE p_event IS NOT NULL
                   UNION
                   SELECT public.try_uuid(x->>'event_id')
                     FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_data->'events') = 'array' THEN p_data->'events' ELSE '[]'::jsonb END) AS x)
           AND e.status::text <> 'ANNULE'
           AND public.event_start_at(e.id) <= p_now + interval '12 hours'
           AND p_now < public.event_end_at(e.id))
    -- Lot 11b (règle de nuit de la finition 4) : une réservation de table ou de salle qui commence dans moins de 12 heures,
    -- ou en cours, rend aussi l'avis urgent (créneau en heure de Dakar)
    OR EXISTS (
        SELECT 1 FROM public.table_reservations tr
         WHERE tr.id = public.try_uuid(p_data->>'reservation_id')
           AND (lower(tr.slot) AT TIME ZONE 'Africa/Dakar') <= p_now + interval '12 hours'
           AND p_now < (upper(tr.slot) AT TIME ZONE 'Africa/Dakar'))
    OR EXISTS (
        SELECT 1 FROM public.hall_reservations hr
         WHERE hr.id = public.try_uuid(p_data->>'reservation_id')
           AND (lower(hr.slot) AT TIME ZONE 'Africa/Dakar') <= p_now + interval '12 hours'
           AND p_now < (upper(hr.slot) AT TIME ZONE 'Africa/Dakar'))
$$;

-- ----------------------------------------------------------------------------
-- Remboursement versé d'une table
-- ----------------------------------------------------------------------------
-- Recopie de 20261126000003_l10b_avis.sql:317-645 ; changement : TABLE_REFUND_PAID pour un paiement de table.
CREATE OR REPLACE FUNCTION public.notif_cashouts_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund        boolean := NEW.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND');
    v_status_new    boolean := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;
    v_blocked_new   boolean := NEW.status = 'A_ENVOYER' AND NEW.blocked_reason IS NOT NULL
                               AND (TG_OP = 'INSERT' OR OLD.blocked_reason IS NULL);
    -- Lot 9 bis (B1, B11) : retard de plus de 30 minutes posé par cashouts_flag_delayed
    v_delay_new     boolean := TG_OP = 'UPDATE' AND NEW.delay_flagged_at IS NOT NULL AND OLD.delay_flagged_at IS NULL;
    v_event         uuid;
    v_event_data    jsonb := '{}'::jsonb;
    v_partner_user  uuid;
    v_user          uuid;
    v_phone         text;
    v_account_kind  text;
    v_money         jsonb;
    v_day           text := to_char(timezone('Africa/Dakar', now()), 'YYYY-MM-DD');
    -- Lot 9 quater (C1) : frais de l'opérateur retenus sur le remboursement d'un doublon répété
    v_withheld      numeric;
    -- Lot 9 bis (B11) : un seul avis de retard par versement, mis en file en fin de fonction
    v_refund_delayed     boolean := false;
    v_withdrawal_delayed boolean := false;
    -- Lot 9 bis (R30, H1) : paiement remboursé, lu à la création d'un REFUND
    v_pay_amount    numeric;
    v_pay_operator  text;
    v_duplicate_of  text;
    -- Finition 4 : auteur d'un remboursement de billet ; retrait constaté non versé
    v_refund_as     text;
    v_refund_ctx    text;
    v_refund_by     text;
    v_refund_facial numeric;
    v_not_paid      boolean := NEW.provider_status IS NOT DISTINCT FROM 'NON_VERSE';
    -- Lot 10b : réservation de salle du paiement remboursé (avis « Remboursement versé » propre aux salles)
    v_hall_res      uuid;
    -- Lot 11b : réservation de table remboursée (avis de la table, lien vers la réservation)
    v_table_res     uuid;
BEGIN
    IF NOT (v_status_new OR v_blocked_new OR v_delay_new) THEN
        RETURN NEW;
    END IF;

    -- Bénéficiaire : le compte s'il existe encore ; numéro du compte résolu à l'envoi, sinon le numéro
    -- du versement (9 chiffres) pour le SMS.
    IF NEW.beneficiary_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.beneficiary_user_id) THEN
        v_user := NEW.beneficiary_user_id;
    END IF;
    IF (v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND NULLIF(btrim(COALESCE(u.phone, '')), '') IS NOT NULL))
       AND NEW.phone_number ~ '^[0-9]{9}$' THEN
        v_phone := '+221' || NEW.phone_number;
    END IF;

    -- Événement d'un remboursement : celui du paiement, sinon celui du billet.
    IF v_refund THEN
        SELECT p.event_id INTO v_event FROM public.payments p WHERE p.id = NEW.payment_id;
        IF v_event IS NULL AND NEW.ticket_id IS NOT NULL THEN
            SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = NEW.ticket_id;
        END IF;
        IF v_event IS NOT NULL THEN
            v_event_data := public.notif_pros_event_data(v_event);
            SELECT pa.user_id INTO v_partner_user
              FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
             WHERE e.id = v_event;
        END IF;
    ELSE
        SELECT w.account_kind INTO v_account_kind FROM public.withdrawals w WHERE w.id = NEW.withdrawal_id;
    END IF;

    v_money := jsonb_strip_nulls(jsonb_build_object(
        'cashout_id', NEW.id, 'amount', NEW.amount, 'operator', NEW.operator, 'account_kind', v_account_kind));
    IF v_refund THEN
        SELECT p.hall_reservation_id INTO v_hall_res FROM public.payments p
         WHERE p.id = NEW.payment_id AND p.payment_target::text = 'HALL_RESERVATION';
        SELECT p.table_reservation_id INTO v_table_res FROM public.payments p
         WHERE p.id = NEW.payment_id AND p.payment_target::text = 'TABLE_RESERVATION';
    END IF;

    -- 1. Demande de remboursement d'un billet (création du cashout)
    -- Finition 4 (points 2 et 4) : qui a lancé le remboursement (journal TICKET_REFUND_REQUESTED de ticket_refund_request,
    -- même transaction) : le client (report de plus de 24 h), l'organisatrice, l'administration, ou l'annulation de
    -- l'événement. Lancé par quelqu'un d'autre que le client : SMS et push en plus (le client n'a rien demandé) ; lancé par
    -- le client : l'organisatrice reçoit un avis groupé toutes les 15 minutes, sans nom ni numéro du client.
    IF TG_OP = 'INSERT' AND NEW.kind = 'TICKET_REFUND' THEN
        SELECT a.metadata->>'as', a.metadata->>'context' INTO v_refund_as, v_refund_ctx
          FROM public.audit_logs a
         WHERE a.action = 'TICKET_REFUND_REQUESTED' AND a.object_type = 'tickets' AND a.object_id = NEW.ticket_id
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 1;
        v_refund_by := CASE WHEN v_refund_ctx = 'CANCELLATION' THEN 'CANCELLATION'
                            WHEN v_refund_as = 'ADMIN' THEN 'ADMIN'
                            WHEN v_refund_as = 'OWNER' THEN 'ORGANIZER'
                            ELSE 'CLIENT' END;
        IF v_user IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'REFUND_REQUESTED',
                'key', 'REFUND_REQUESTED:' || NEW.id::text,
                'user_id', v_user,
                'event_id', v_event,
                'data', v_event_data || jsonb_strip_nulls(jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount,
                                                                             'operator', NEW.operator, 'by', v_refund_by)),
                'channels', CASE v_refund_by
                                WHEN 'CANCELLATION' THEN jsonb_build_array('IN_APP', 'EMAIL')
                                WHEN 'CLIENT' THEN jsonb_build_array('IN_APP', 'EMAIL', 'PUSH')
                                ELSE jsonb_build_array('IN_APP', 'SMS', 'EMAIL', 'PUSH') END
            ));
        END IF;
        IF v_refund_by = 'CLIENT' AND v_partner_user IS NOT NULL AND v_event IS NOT NULL THEN
            SELECT COALESCE(NULLIF(r.facial_part, 0), NEW.amount) INTO v_refund_facial FROM public.refunds r WHERE r.id = NEW.refund_id;
            PERFORM public.notif_enqueue_grouped(jsonb_build_object(
                'type', 'PARTNER_REFUND_REQUESTS', 'scope', v_event::text || ':' || v_partner_user::text, 'window_minutes', 15,
                'user_id', v_partner_user, 'event_id', v_event, 'data', v_event_data,
                'add', jsonb_build_object('ticket_count', 1, 'amount', COALESCE(v_refund_facial, NEW.amount))));
        END IF;
    END IF;

    -- 1 bis. Lot 9 bis (R30, H1, B11) : paiement encaissé sans billet possible, ou en double du même panier
    --        (payments.metadata.duplicate_of), remboursé : le client est prévenu à la création, avant tout versement.
    -- Lot 10a : le remboursement d'une réservation de salle est annoncé par l'avis de la salle (annulation, délai
    -- dépassé, paiement arrivé trop tard), pas par le texte des billets
    -- Lot 11a : de même pour le remboursement d'une réservation de table
    IF TG_OP = 'INSERT' AND NEW.kind = 'REFUND' AND (v_user IS NOT NULL OR v_phone IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM public.payments hp WHERE hp.id = NEW.payment_id
                          AND hp.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')) THEN
        SELECT p.amount, p.operator::text, NULLIF(p.metadata->>'duplicate_of', ''),
               NULLIF(p.metadata->>'duplicate_fee_withheld', '')::numeric
          INTO v_pay_amount, v_pay_operator, v_duplicate_of, v_withheld
          FROM public.payments p WHERE p.id = NEW.payment_id;
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'PAYMENT_REFUND_STARTED',
            'key', 'PAYMENT_REFUND_STARTED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'event_id', v_event,
            'data', v_event_data || jsonb_strip_nulls(jsonb_build_object(
                'cashout_id', NEW.id, 'payment_id', NEW.payment_id, 'amount', COALESCE(v_pay_amount, NEW.amount),
                'operator', COALESCE(NEW.operator::text, v_pay_operator), 'duplicate_of', v_duplicate_of,
                'withheld', CASE WHEN COALESCE(v_withheld, 0) > 0 THEN v_withheld END,
                'refund_amount', CASE WHEN COALESCE(v_withheld, 0) > 0 THEN NEW.amount END))
        )));
    END IF;

    -- 2. Remboursement bloqué (motif posé alors qu'il attend l'envoi)
    IF v_refund AND v_blocked_new THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_REFUND_TO_RETRY',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':BLOQUE',
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'BLOQUE',
                                       'blocked_reason', NEW.blocked_reason, 'kind', NEW.kind)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
        IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CANCEL_REFUNDS_BLOCKED',
                'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                'user_id', v_partner_user,
                'event_id', v_event,
                'data', v_event_data
            ));
        END IF;
        -- Lot 9 bis (B11) : le bénéficiaire est prévenu du retard, sauf pour une opération simulée (jamais versée)
        IF NEW.blocked_reason <> 'SIMULATED' THEN
            v_refund_delayed := true;
        END IF;
    END IF;

    -- 2 bis. Lot 9 bis (R10, B5) : retrait bloqué (solde, limites du compte, nom manquant)
    IF NOT v_refund AND v_blocked_new AND NEW.blocked_reason <> 'SIMULATED' THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_CASHOUT_TO_RESUME',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':BLOQUE',
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind,
                                       'cause', 'BLOCKED', 'blocked_reason', NEW.blocked_reason)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
        v_withdrawal_delayed := true;
    END IF;

    -- 2 ter. Lot 9 bis (R1, B1) : versement en retard de plus de 30 minutes, tous types
    IF v_delay_new THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_CASHOUT_TO_RESUME',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':RETARD',
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind, 'cause', 'DELAYED')
        ));
        IF v_refund THEN
            v_refund_delayed := true;
        ELSE
            v_withdrawal_delayed := true;
        END IF;
    END IF;

    -- 3. Statut final ou incertain (mise à jour seulement)
    IF v_status_new AND TG_OP = 'UPDATE' THEN
        IF NEW.status = 'CONFIRME' THEN
            IF v_refund THEN
                IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                    -- Lot 10b : remboursement d'une réservation de salle, avis de la salle ; sinon, avis inchangé
                    IF v_hall_res IS NOT NULL THEN
                        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                            'type', 'HALL_REFUND_PAID',
                            'key', 'HALL_REFUND_PAID:' || NEW.id::text,
                            'user_id', v_user,
                            'phone', v_phone,
                            'data', COALESCE(public.hall_notif_data(v_hall_res), '{}'::jsonb) || v_money
                        )));
                    -- Lot 11b : remboursement d'une réservation de table, avis de la table
                    ELSIF v_table_res IS NOT NULL THEN
                        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                            'type', 'TABLE_REFUND_PAID',
                            'key', 'TABLE_REFUND_PAID:' || NEW.id::text,
                            'user_id', v_user,
                            'phone', v_phone,
                            'data', COALESCE(public.table_notif_data(v_table_res), '{}'::jsonb) || v_money
                        )));
                    ELSE
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'REFUND_PAID',
                        'key', 'REFUND_PAID:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'event_id', v_event,
                        'data', v_event_data || v_money
                    )));
                    END IF;
                END IF;
                IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_event IS NOT NULL AND v_partner_user IS NOT NULL THEN
                    -- Verrou par événement : deux confirmations concurrentes se voient (lecture après le verrou).
                    PERFORM pg_advisory_xact_lock(hashtextextended('notif-cancel-refunds:' || v_event::text, 0));
                    IF NOT EXISTS (
                        SELECT 1 FROM public.cashouts c JOIN public.payments p ON p.id = c.payment_id
                         WHERE p.event_id = v_event AND c.kind = 'EVENT_CANCELLATION_REFUND'
                           AND c.id <> NEW.id AND c.status <> 'CONFIRME'
                    ) THEN
                        PERFORM public.notif_enqueue(jsonb_build_object(
                            'type', 'CANCEL_REFUNDS_DONE',
                            'key', 'CANCEL_REFUNDS_DONE:' || v_event::text,
                            'user_id', v_partner_user,
                            'event_id', v_event,
                            'data', v_event_data
                        ));
                    END IF;
                END IF;
            ELSIF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'WITHDRAWAL_PAID',
                    'key', 'WITHDRAWAL_PAID:' || NEW.id::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'data', v_money
                )));
            END IF;

        ELSIF NEW.status = 'ECHOUE' THEN
            IF v_refund THEN
                PERFORM public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_REFUND_TO_RETRY',
                    'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':ECHOUE',
                    'event_id', v_event,
                    'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'ECHOUE', 'kind', NEW.kind)
                ));
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
                IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'CANCEL_REFUNDS_BLOCKED',
                        'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                        'user_id', v_partner_user,
                        'event_id', v_event,
                        'data', v_event_data
                    ));
                END IF;
                v_refund_delayed := true;
            ELSE
                -- Finition 4 (point 5) : « constaté non versé » (provider_status NON_VERSE) n'est pas un refus de l'opérateur
                IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'WITHDRAWAL_REJECTED',
                        'key', 'WITHDRAWAL_REJECTED:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'data', v_money || jsonb_build_object('not_paid', v_not_paid)
                    )));
                END IF;
                PERFORM public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_WITHDRAWAL_REJECTED',
                    'ref', NEW.id::text,
                    'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'not_paid', v_not_paid)
                ));
            END IF;

        ELSIF NEW.status = 'INCERTAIN' THEN
            IF NOT v_refund AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'WITHDRAWAL_UNCERTAIN',
                    'key', 'WITHDRAWAL_UNCERTAIN:' || NEW.id::text || ':' || NEW.attempt_count::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'data', v_money
                )));
            END IF;
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_CASHOUT_UNCERTAIN',
                'ref', NEW.id::text || ':' || NEW.attempt_count::text,
                'event_id', v_event,
                'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind)
            ));
            INSERT INTO public.admin_signals (kind, ref_id) VALUES ('CASHOUT_UNCERTAIN', NEW.id) ON CONFLICT DO NOTHING;
            IF v_refund THEN
                v_refund_delayed := true;
            END IF;
        END IF;
    END IF;

    -- 4. Lot 9 bis (B11, N1, N2) : avis de retard au bénéficiaire, un seul par versement (clé par versement)
    IF v_refund_delayed AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'REFUND_DELAYED',
            'key', 'REFUND_DELAYED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'event_id', v_event,
            'data', v_event_data || v_money
        )));
    END IF;
    IF v_withdrawal_delayed AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'WITHDRAWAL_DELAYED',
            'key', 'WITHDRAWAL_DELAYED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'data', v_money
        )));
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_event_soon(uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_event_soon(uuid, jsonb, timestamptz) TO service_role;

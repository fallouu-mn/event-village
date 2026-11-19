-- ============================================================================
-- EVENT VILLAGE — LOT 10b, migration 03 : avis du parcours des salles sur les quatre canaux
-- ============================================================================
-- Consigne du lot 10b (points 4 et 5), décision du client : chaque étape sur la cloche, le push, l'email et le SMS
-- (coût des SMS hors critère) ; règles de nuit, plafonds, préférences et GSM-7 gardés. Textes dans
-- lib/notifications/catalog.ts. Aucun type des autres lots n'est touché.
--  1. types d'avis : HALL_RESERVATION_PENDING (réservation demandée, client), HALL_EVE_REMINDER (veille, client et
--     salle), HALL_EARNINGS_AVAILABLE (recettes disponibles, salle), HALL_REFUND_PAID (remboursement versé, client),
--     ADMIN_HALL_SUBMITTED (salle à valider) et ADMIN_HALL_CHANGED (salle validée modifiée : prix, adresse, nom ou
--     photos), ces deux derniers aux administrateurs qui ont halls.validate (cloche, push, email ; le SMS de la salle à
--     valider passe par le SMS groupé ADMIN_REVIEW_SMS, élément HALL_SUBMITTED, reporté à la fin de la nuit) ;
--     SMS ajouté aux types de la salle : HALL_RESERVATION_REQUESTED, HALL_BALANCE_PAID, HALL_RESERVATION_CANCELLED_PRO,
--     HALL_VALIDATION_DECIDED ;
--  2. trg_halls_notify_admins : salle envoyée en validation (création, renvoi) → ADMIN_HALL_SUBMITTED et SMS groupé ;
--     salle validée dont le nom, l'adresse (ou la ville, ou la position), un prix ou les photos changent →
--     ADMIN_HALL_CHANGED (elle reste validée) ;
--  3. hall_reserve : recopie de 20261122000011_l10a_cv_verrou_client.sql:42-127 ; changement : avis
--     HALL_RESERVATION_PENDING au client (montant à payer et heure limite) ;
--  4. hall_reservations_tick : recopie de 20261122000005_l10a_annulation.sql:225-281 ; changements : rappel du solde
--     10 jours puis 8 jours avant la date (au lieu d'un rappel 3 jours avant l'échéance), rappel la veille (client et
--     salle), recettes disponibles (salle) ; ces avis partent hors de la nuit (réglages notif.sms_quiet_start / _end) ;
--  5. notif_cashouts_notify : recopie de 20261123000106_l11a_annulation.sql:497-774 ; changement : le
--     remboursement versé d'une réservation de salle envoie HALL_REFUND_PAID (au lieu de l'avis des billets).
-- Rejouable : ON CONFLICT DO UPDATE, CREATE OR REPLACE (droits d'exécution conservés), DROP TRIGGER IF EXISTS puis CREATE.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('HALL_RESERVATION_PENDING',       'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('HALL_RESERVATION_REQUESTED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL),
    ('HALL_BALANCE_PAID',              'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'ANY',     'BLOCK', FALSE, NULL),
    ('HALL_RESERVATION_CANCELLED_PRO', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'ALLOW', FALSE, NULL),
    ('HALL_VALIDATION_DECIDED',        'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'ALLOW', FALSE, NULL),
    ('HALL_EVE_REMINDER',              'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'ANY',     'BLOCK', FALSE, NULL),
    ('HALL_EARNINGS_AVAILABLE',        'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'ALLOW', FALSE, NULL),
    ('HALL_REFUND_PAID',               'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('ADMIN_HALL_SUBMITTED',           'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'ADMIN',   'BLOCK', FALSE, 'halls.validate'),
    ('ADMIN_HALL_CHANGED',             'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'ADMIN',   'BLOCK', FALSE, 'halls.validate')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

-- ----------------------------------------------------------------------------
-- 2. Administrateurs prévenus : salle à valider, salle validée modifiée
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.halls_notify_admins()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ref     text;
    v_changes text[] := ARRAY[]::text[];
BEGIN
    IF NEW.validation_status = 'EN_ATTENTE_VALIDATION'
       AND (TG_OP = 'INSERT' OR OLD.validation_status <> 'EN_ATTENTE_VALIDATION') THEN
        v_ref := NEW.id::text || ':' || txid_current()::text;
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_HALL_SUBMITTED', 'ref', v_ref,
            'data', jsonb_strip_nulls(jsonb_build_object('hall_id', NEW.id, 'hall_name', NEW.name, 'city', NEW.city,
                                                         'resubmitted', TG_OP = 'UPDATE'))));
        PERFORM public.notif_admin_review_sms(jsonb_build_object('kind', 'HALL_SUBMITTED', 'ref', v_ref));
        RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.validation_status = 'VALIDEE' AND NEW.validation_status = 'VALIDEE' THEN
        IF NEW.name IS DISTINCT FROM OLD.name THEN
            v_changes := v_changes || 'NOM'::text;
        END IF;
        IF NEW.address IS DISTINCT FROM OLD.address OR NEW.city IS DISTINCT FROM OLD.city
           OR NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude THEN
            v_changes := v_changes || 'ADRESSE'::text;
        END IF;
        IF NEW.price_per_day IS DISTINCT FROM OLD.price_per_day OR NEW.price_per_hour IS DISTINCT FROM OLD.price_per_hour
           OR NEW.deposit_mode IS DISTINCT FROM OLD.deposit_mode OR NEW.deposit_value IS DISTINCT FROM OLD.deposit_value THEN
            v_changes := v_changes || 'PRIX'::text;
        END IF;
        IF NEW.images IS DISTINCT FROM OLD.images THEN
            v_changes := v_changes || 'PHOTOS'::text;
        END IF;
        IF cardinality(v_changes) > 0 THEN
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_HALL_CHANGED', 'ref', NEW.id::text || ':' || txid_current()::text,
                'data', jsonb_strip_nulls(jsonb_build_object('hall_id', NEW.id, 'hall_name', NEW.name, 'previous_name',
                                                             CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN OLD.name END,
                                                             'city', NEW.city, 'changes', to_jsonb(v_changes)))));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.halls_notify_admins() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_halls_notify_admins ON public.halls;
CREATE TRIGGER trg_halls_notify_admins
    AFTER INSERT OR UPDATE ON public.halls
    FOR EACH ROW EXECUTE FUNCTION public.halls_notify_admins();

-- ----------------------------------------------------------------------------
-- 3. Réservation demandée : avis au client
-- ----------------------------------------------------------------------------
-- Recopie de 20261122000011_l10a_cv_verrou_client.sql:42-127 ; changement : avis HALL_RESERVATION_PENDING.
CREATE OR REPLACE FUNCTION public.hall_reserve(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client  uuid := public.try_uuid(p->>'client_id');
    v_hall_id uuid := public.try_uuid(p->>'hall_id');
    q         jsonb;
    v_hold    integer := public.fin_setting_num('halls.hold_minutes')::int;
    v_refusal jsonb;
    v_id      uuid;
    v_expires timestamptz;
BEGIN
    IF NOT public.fin_setting_bool('features.halls_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'La réservation de salles n’est pas encore ouverte.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de réserver pour le moment.');
    END IF;
    IF v_hall_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.halls WHERE id = v_hall_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    -- Une réservation à la fois par salle (même verrou que check_hall_availability), puis attentes échues libérées
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || v_hall_id::text, 0));
    UPDATE public.hall_reservations
       SET booking_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, updated_at = now()
     WHERE hall_id = v_hall_id AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now();

    q := public.hall_quote(p);
    IF NOT (q->>'ok')::boolean THEN
        RETURN q;
    END IF;
    IF EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = (q->>'partner_id')::uuid AND pa.user_id = v_client) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OWN_HALL', 'message', 'Vous ne pouvez pas réserver votre propre salle.');
    END IF;
    -- Correctifs de la contre-vérification du lot 10a (T5) : attentes du client comptées sous verrou par client
    v_refusal := public.hall_client_pending_refusal(v_client, NULL);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.hall_reservations
         WHERE hall_id = v_hall_id AND status::text IN ('EN_ATTENTE', 'CONFIRMEE')
           AND slot && public.hall_slot((q->>'start_date')::date, (q->>'end_date')::date,
                                        NULLIF(q->>'start_time', '')::time, NULLIF(q->>'end_time', '')::time)
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Cette salle est déjà réservée pour cette période. Choisissez une autre date.');
    END IF;

    v_expires := now() + make_interval(mins => v_hold);
    BEGIN
        INSERT INTO public.hall_reservations (
            hall_id, client_id, partner_id, start_date, end_date, start_time, end_time,
            booking_state, booking_mode, units, unit_price, price_amount, service_fee_rate, service_fee_amount, commission_rate,
            total_amount, deposit_price, deposit_service_fee, deposit_amount, balance_amount,
            full_payment_required, balance_due_at, moratorium_date, hold_expires_at,
            cancellation_policy, cancellation_terms, payment_status, notes)
        VALUES (
            v_hall_id, v_client, (q->>'partner_id')::uuid, (q->>'start_date')::date, (q->>'end_date')::date,
            NULLIF(q->>'start_time', '')::time, NULLIF(q->>'end_time', '')::time,
            'EN_ATTENTE_PAIEMENT', q->>'mode', (q->>'units')::int, (q->>'unit_price')::numeric, (q->>'price_amount')::numeric,
            (q->>'service_fee_rate')::numeric, (q->>'service_fee_amount')::numeric, (q->>'commission_rate')::numeric,
            (q->>'total_amount')::numeric, (q->>'deposit_price')::numeric, (q->>'deposit_service_fee')::numeric,
            (q->>'deposit_amount')::numeric, (q->>'balance_amount')::numeric,
            (q->>'full_payment_required')::boolean, NULLIF(q->>'balance_due_at', '')::timestamptz,
            (NULLIF(q->>'balance_due_at', '')::timestamptz AT TIME ZONE 'Africa/Dakar')::date, v_expires,
            q->>'cancellation_policy', q->'cancellation_terms', 'PENDING',
            NULLIF(left(btrim(COALESCE(p->>'notes', '')), 500), ''))
        RETURNING id INTO v_id;
    EXCEPTION
        WHEN exclusion_violation OR raise_exception THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Cette salle est déjà réservée pour cette période. Choisissez une autre date.');
    END;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_client, 'CLIENT', 'HALL_RESERVATION_CREATED', 'hall_reservations', v_id,
            jsonb_build_object('booking_state', 'EN_ATTENTE_PAIEMENT', 'total_amount', q->'total_amount', 'deposit_amount', q->'deposit_amount'),
            jsonb_build_object('hall_id', v_hall_id, 'start_date', q->'start_date', 'end_date', q->'end_date',
                               'mode', q->'mode', 'units', q->'units', 'cancellation_policy', q->'cancellation_policy'));

    -- Lot 10b : réservation demandée, le client est prévenu (montant à payer et heure limite de l'attente)
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'HALL_RESERVATION_PENDING', 'key', 'HALL_RESERVATION_PENDING:' || v_id::text,
        'user_id', v_client,
        'data', COALESCE(public.hall_notif_data(v_id), '{}'::jsonb)
                || jsonb_build_object('amount_due', q->'deposit_amount', 'hold_expires_at', v_expires,
                                      'full_payment_required', q->'full_payment_required')));

    RETURN q || jsonb_build_object('reservation_id', v_id, 'booking_state', 'EN_ATTENTE_PAIEMENT', 'hold_expires_at', v_expires);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Tâche planifiée : rappels du solde à J-10 et J-8, veille, recettes disponibles
-- ----------------------------------------------------------------------------
-- Recopie de 20261122000005_l10a_annulation.sql:225-281 ; changements : rappels J-10 et J-8, veille, recettes.
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
    -- Lot 10b : rappels, veille et recettes envoyés hors de la nuit (réglages notif.sms_quiet_start / _end)
    v_day       boolean := NOT public.notif_in_quiet_hours(now(), public.fin_setting_num('notif.sms_quiet_start')::int,
                                                           public.fin_setting_num('notif.sms_quiet_end')::int);
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

    -- Lot 10b : rappel du solde 10 jours puis 8 jours avant la date (l'échéance est à J-7), un de chaque, de jour
    FOR r IN
        SELECT hr.id, hr.client_id, lower(hr.slot) AS start_at FROM public.hall_reservations hr
         WHERE v_day AND hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at IS NOT NULL
           AND now() < hr.balance_due_at AND v_now_local >= lower(hr.slot) - interval '10 days'
    LOOP
        v_step := CASE WHEN v_now_local >= r.start_at - interval '8 days' THEN 'J8' ELSE 'J10' END;
        v_reminders := v_reminders + COALESCE(public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_BALANCE_REMINDER', 'key', 'HALL_BALANCE_REMINDER:' || v_step || ':' || r.id::text,
            'user_id', r.client_id,
            'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('step', v_step))), 0);
    END LOOP;

    -- Lot 10b : rappel la veille de la date, au client et à la salle, de jour
    FOR r IN
        SELECT hr.id, hr.client_id, pa.user_id AS owner_id FROM public.hall_reservations hr
          JOIN public.partners pa ON pa.id = hr.partner_id
         WHERE v_day AND hr.booking_state = 'PAYEE' AND hr.start_date = v_now_local::date + 1
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
         WHERE v_day AND hr.end_date >= v_now_local::date - 30
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

-- ----------------------------------------------------------------------------
-- 5. Remboursement d'une réservation de salle versé : avis de la salle
-- ----------------------------------------------------------------------------
-- Recopie de 20261123000106_l11a_annulation.sql:497-774 ; changement : HALL_REFUND_PAID pour un paiement de salle.
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
    -- Lot 10b : réservation de salle du paiement remboursé (avis « Remboursement versé » propre aux salles)
    v_hall_res      uuid;
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
    END IF;

    -- 1. Demande de remboursement d'un billet (création du cashout)
    IF TG_OP = 'INSERT' AND NEW.kind = 'TICKET_REFUND' AND v_user IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'REFUND_REQUESTED',
            'key', 'REFUND_REQUESTED:' || NEW.id::text,
            'user_id', v_user,
            'event_id', v_event,
            'data', v_event_data || jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
        ));
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
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', CASE WHEN v_hall_res IS NOT NULL THEN 'HALL_REFUND_PAID' ELSE 'REFUND_PAID' END,
                        'key', CASE WHEN v_hall_res IS NOT NULL THEN 'HALL_REFUND_PAID:' ELSE 'REFUND_PAID:' END || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'event_id', v_event,
                        'data', CASE WHEN v_hall_res IS NOT NULL THEN COALESCE(public.hall_notif_data(v_hall_res), '{}'::jsonb) || v_money
                                     ELSE v_event_data || v_money END
                    )));
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
                IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'WITHDRAWAL_REJECTED',
                        'key', 'WITHDRAWAL_REJECTED:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'data', v_money
                    )));
                END IF;
                PERFORM public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_WITHDRAWAL_REJECTED',
                    'ref', NEW.id::text,
                    'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
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

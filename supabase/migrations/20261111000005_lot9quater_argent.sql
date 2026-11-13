-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUATER : argent, stock et caisse (C1, C2, C3, C5, C6, C7)
-- ============================================================================
-- C1 (AUD-20) : au-delà de 2 paiements en double remboursés par compte sur 30 jours, le suivant est remboursé moins les
--   frais SamirPay (payments.aggregator_fee) et signalé aux admins (ADMIN_DUPLICATE_PAYMENT, rang et retenue) ; le client
--   en est prévenu (PAYMENT_REFUND_STARTED : withheld, refund_amount).
-- C2, C3 (AUD-21, AUD-27) : au plus 3 paiements en attente par numéro payeur, tous comptes confondus, sur l'heure
--   (PAYER_PENDING_LIMIT) ; la règle d'un paiement en attente par compte et par événement reste. Le remboursement part
--   déjà vers payments.payer_phone, le numéro auquel SamirPay a demandé et pris le paiement (refund_request, inchangé).
-- C5 (AUD-30) : aucune commission de parrainage quand le numéro payeur de l'achat est celui du parrain ou un numéro payeur
--   qu'il a déjà utilisé (referral_self_payer).
-- C6 (AUD-31, G-24) : la limite des billets gratuits compte les billets gratuits ÉMIS pour le compte, transférés compris
--   (free_tickets_issued_count), et s'applique aussi dans un panier mixte (checkout_create_payment).
-- C7 (AUD-16) : la clôture d'une caisse avec écart n'exige plus le PIN régisseur saisi sur le téléphone du contrôleur ;
--   l'écart attend la validation de l'organisatrice depuis SA session (shift_discrepancy_validate, appelée par
--   POST /api/partner/shifts/[id]/validate-discrepancy, mot de passe récent exigé). Le PIN reste exigé à l'ouverture.
-- Objets :
--   nouvelles : free_tickets_issued_count(uuid, uuid), referral_self_payer(uuid, text),
--               refund_request_withheld(uuid, text, numeric) (copie de refund_request, 20261101000005:194-256, montant
--               diminué de la retenue), shift_discrepancy_validate(jsonb) ;
--   colonnes : controller_shifts.discrepancy_validated_at, discrepancy_validated_by ;
--   recopies (changement indiqué au-dessus de chacune) : payment_confirm (20261106000003:84-254),
--     notif_cashouts_notify (20261109000007:320-587), checkout_create_payment (20261109000007:693-806),
--     free_tickets_claim (20261105000007:205-275), calculate_referral_commissions (20261109000007:813-895),
--     shift_close (20261109000008:792-940), pilotage_compute_cash (20261102000005:303-372 : discrepancy_validated_at par
--     caisse, pour l'onglet Caisse du pilotage), cashout_finalize (20261109000007:987-1062 : doublon remboursé moins
--     la retenue → REFUNDED une fois versé).
-- Aucun BEGIN ni COMMIT ; rejouable. Nouvelles fonctions : SECURITY DEFINER, search_path fixé, service_role seul.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Aides
-- ----------------------------------------------------------------------------
-- Billets gratuits émis pour un compte dans une catégorie : billet dont le premier titulaire (avant tout transfert
-- réclamé) est ce compte, hors billets annulés ou remboursés.
CREATE OR REPLACE FUNCTION public.free_tickets_issued_count(p_user uuid, p_category uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)::int
      FROM public.tickets t
     WHERE t.category_id = p_category
       AND t.status::text NOT IN ('ANNULE', 'REMBOURSE')
       AND COALESCE((SELECT tt.from_user_id FROM public.ticket_transfers tt
                      WHERE tt.ticket_id = t.id AND tt.status::text = 'CLAIMED'
                      ORDER BY tt.created_at ASC LIMIT 1), t.user_id) = p_user;
$$;
REVOKE ALL ON FUNCTION public.free_tickets_issued_count(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.free_tickets_issued_count(uuid, uuid) TO service_role;

-- Le numéro payeur est-il celui du parrain, ou un numéro avec lequel le parrain a déjà payé ? (9 derniers chiffres)
CREATE OR REPLACE FUNCTION public.referral_self_payer(p_sponsor uuid, p_payer text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_sponsor IS NULL OR right(regexp_replace(COALESCE(p_payer, ''), '[^0-9]', '', 'g'), 9) = '' THEN FALSE
        ELSE EXISTS (SELECT 1 FROM public.users u
                      WHERE u.id = p_sponsor
                        AND right(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 9)
                            = right(regexp_replace(p_payer, '[^0-9]', '', 'g'), 9))
          OR EXISTS (SELECT 1 FROM public.payments sp
                      WHERE sp.client_id = p_sponsor
                        AND right(regexp_replace(COALESCE(sp.payer_phone, ''), '[^0-9]', '', 'g'), 9)
                            = right(regexp_replace(p_payer, '[^0-9]', '', 'g'), 9))
    END;
$$;
REVOKE ALL ON FUNCTION public.referral_self_payer(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_self_payer(uuid, text) TO service_role;


-- ----------------------------------------------------------------------------
-- 2. C1 : remboursement d'un doublon répété, frais de l'opérateur retenus
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_request_withheld(p_payment_id uuid, p_reason text, p_withheld numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay record;
    v_user record;
    v_key text := 'REFUND-' || p_payment_id::text;
    v_refund uuid;
    v_cashout uuid;
    v_blocked text;
    v_prev record;
    v_amount numeric;
    v_service numeric;
    v_agg numeric;
    v_bearer text;
    p_kind text := 'REFUND';
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'refund_request : paiement % introuvable', p_payment_id; END IF;
    IF p_kind NOT IN ('REFUND', 'EVENT_CANCELLATION_REFUND') THEN
        RAISE EXCEPTION 'refund_request : nature % inconnue', p_kind;
    END IF;
    SELECT id INTO v_cashout FROM public.cashouts WHERE idempotency_key = v_key;
    IF FOUND THEN RETURN v_cashout; END IF;

    SELECT COALESCE(sum(amount), 0) AS amount, COALESCE(sum(facial_part), 0) AS facial,
           COALESCE(sum(service_part), 0) AS service, COALESCE(sum(aggregator_fee_share), 0) AS agg
      INTO v_prev FROM public.refunds WHERE payment_id = p_payment_id AND settlement = 'PLATEFORME';
    -- Lot 9 quater (C1) : frais de l'opérateur retenus sur le remboursement d'un doublon répété
    v_amount := v_pay.amount - v_prev.amount - GREATEST(COALESCE(p_withheld, 0), 0);
    IF v_amount <= 0 THEN
        RETURN NULL; -- tout est déjà remboursé ou en cours de remboursement
    END IF;
    v_service := LEAST(GREATEST(COALESCE(v_pay.service_fee, 0) - v_prev.service, 0), v_amount);
    v_agg := COALESCE(v_pay.aggregator_fee, 0) - v_prev.agg;
    v_bearer := CASE WHEN p_kind = 'REFUND' THEN 'EVENT_VILLAGE'
                     ELSE public.fin_setting_text('finance.cancellation_aggregator_fee_bearer') END;

    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = v_pay.client_id;
    v_blocked := CASE
        WHEN v_pay.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN v_pay.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;

    INSERT INTO public.refunds (payment_id, refund_transaction_id, amount, reason, status, settlement, kind,
                                facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal)
    VALUES (p_payment_id, v_key, v_amount, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'PLATEFORME', p_kind,
            v_amount - v_service, v_service, v_agg, v_bearer,
            CASE WHEN v_bearer = 'ORGANISATEUR' THEN v_service - v_agg ELSE v_service END)
    RETURNING id INTO v_refund;
    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, beneficiary_user_id, operator, phone_number,
                                 first_name, last_name, amount, blocked_reason)
    VALUES (p_kind, v_key, p_payment_id, v_refund, v_pay.client_id, v_pay.operator, v_pay.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_amount, v_blocked)
    RETURNING id INTO v_cashout;
    UPDATE public.refunds SET cashout_id = v_cashout WHERE id = v_refund;
    UPDATE public.tickets SET status = 'REMBOURSEMENT_EN_COURS' WHERE payment_id = p_payment_id AND status = 'VALIDE';
    PERFORM public.fin_refund_apply(v_refund);
    RETURN v_cashout;
END;
$$;
REVOKE ALL ON FUNCTION public.refund_request_withheld(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_request_withheld(uuid, text, numeric) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. payment_confirm (recopie de 20261106000003_lot8_paiement.sql:84-254)
--    Changement : branche du doublon : rang du doublon sur 30 jours ; au-delà de 2, refund_request_withheld et retenue
--    dans payments.metadata ; alerte aux admins avec rang et retenue ; aggregator_fee lu avec le paiement.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay record;
    v_res record;
    v_cat record;
    v_blocking text;
    v_cashout uuid;
    v_count integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
    v_event uuid;
    v_owner uuid;
    v_payer text;
    v_data jsonb;
    v_seen text;
    v_lock_event uuid;
    v_duplicate uuid;
    -- Lot 9 quater (C1 : AUD-20)
    v_dup_count integer;
    v_withheld numeric;
BEGIN
    -- Lot 8 (8.2 b) : événement d'abord (ordre unique, contrat 2.3)
    SELECT p.status::text, COALESCE(p.event_id,
             (SELECT c.event_id FROM public.stock_reservations r
                JOIN public.ticket_categories c ON c.id = r.category_id
               WHERE r.payment_id = p.id LIMIT 1))
      INTO v_seen, v_lock_event
      FROM public.payments p WHERE p.id = p_payment_id AND p.payment_target::text = 'TICKET';
    IF v_lock_event IS NOT NULL AND v_seen NOT IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING') THEN
        PERFORM 1 FROM public.events WHERE id = v_lock_event FOR NO KEY UPDATE;
    END IF;

    SELECT id, status::text AS status, client_id, payment_target::text AS payment_target,
           amount, service_fee, facial_amount, payer_phone, aggregator_fee
      INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'NOT_FOUND');
    END IF;
    IF v_pay.status = 'SUCCESS' THEN
        SELECT count(*) INTO v_count FROM public.tickets WHERE payment_id = p_payment_id;
        RETURN jsonb_build_object('result', 'ALREADY_CONFIRMED', 'ticket_count', v_count);
    END IF;
    IF v_pay.status IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('result', 'REFUND_IN_PROGRESS', 'status', v_pay.status);
    END IF;
    IF v_pay.payment_target <> 'TICKET' THEN
        RETURN jsonb_build_object('result', 'NOT_TICKET');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stock_reservations WHERE payment_id = p_payment_id) THEN
        RETURN jsonb_build_object('result', 'NO_ITEMS');
    END IF;

    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT category_id FROM public.stock_reservations WHERE payment_id = p_payment_id)
     ORDER BY id FOR UPDATE;

    -- Le panier peut-il être honoré en entier ? (événement en vente, réservation active, ou stock libre si elle a échu)
    FOR v_res IN
        SELECT r.*, c.total_quantity, c.sold_quantity, c.held_quantity, c.name, e.status::text AS event_status
          FROM public.stock_reservations r
          JOIN public.ticket_categories c ON c.id = r.category_id
          JOIN public.events e ON e.id = c.event_id
         WHERE r.payment_id = p_payment_id
         ORDER BY r.category_id
    LOOP
        IF v_res.event_status = 'ANNULE' THEN
            v_blocking := format('événement annulé (%s)', v_res.name);
        ELSIF v_res.event_status = 'SUSPENDU' THEN
            v_blocking := format('événement suspendu (%s)', v_res.name);
        ELSIF v_res.event_status = 'TERMINE' THEN
            v_blocking := format('événement terminé (%s)', v_res.name);
        ELSIF v_res.status = 'ACTIVE' THEN
            CONTINUE;
        ELSIF v_res.status = 'CONVERTED' THEN
            v_blocking := format('réservation déjà convertie (%s)', v_res.name);
        ELSIF v_res.total_quantity - v_res.sold_quantity - v_res.held_quantity < v_res.quantity THEN
            v_blocking := format('plus de place « %s » après échéance de la réservation', v_res.name);
        END IF;
        EXIT WHEN v_blocking IS NOT NULL;
    END LOOP;

    -- Lot 8 (8.2 a) : second paiement réussi d'un même panier, sous le verrou de l'événement
    IF v_blocking IS NULL THEN
        v_duplicate := public.payment_duplicate_of(p_payment_id);
        IF v_duplicate IS NOT NULL THEN
            v_blocking := format('paiement en double du panier déjà réglé (%s)', v_duplicate);
        END IF;
    END IF;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.stock_reservations SET status = 'RELEASED', closed_at = now(), close_reason = 'REFUND'
         WHERE payment_id = p_payment_id AND status = 'ACTIVE';
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source,
               metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
                          || CASE WHEN v_duplicate IS NULL THEN '{}'::jsonb
                                  ELSE jsonb_build_object('duplicate_of', v_duplicate) END
         WHERE id = p_payment_id;
        IF v_duplicate IS NULL THEN
            v_cashout := public.refund_request(p_payment_id, 'Panier impossible à honorer : ' || v_blocking, 'REFUND');
            RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
        END IF;
        -- Lot 9 quater (C1 : AUD-20) : au-delà de 2 paiements en double remboursés à ce compte sur 30 jours, le suivant est
        -- remboursé moins les frais SamirPay du paiement (payments.aggregator_fee) et signalé aux admins ; les deux
        -- premiers restent remboursés en entier, frais à la charge d'Event Village (décision du lot 8, L31).
        SELECT count(*) INTO v_dup_count
          FROM public.payments d
         WHERE d.client_id = v_pay.client_id AND d.id <> p_payment_id
           AND d.metadata ? 'duplicate_of'
           AND d.status::text IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL')
           AND COALESCE(d.paid_at, d.created_at) > now() - interval '30 days';
        v_withheld := 0;
        IF v_dup_count >= 2 THEN
            v_withheld := LEAST(GREATEST(COALESCE(v_pay.aggregator_fee, 0), 0), v_pay.amount);
            UPDATE public.payments
               SET metadata = metadata || jsonb_build_object('duplicate_fee_withheld', v_withheld, 'duplicate_rank', v_dup_count + 1)
             WHERE id = p_payment_id;
            v_cashout := public.refund_request_withheld(p_payment_id, 'Paiement en double du même panier (frais de l''opérateur retenus)', v_withheld);
        ELSE
            v_cashout := public.refund_request(p_payment_id, 'Paiement en double du même panier', 'REFUND');
        END IF;
        PERFORM public.notif_enqueue_admins(jsonb_build_object('type', 'ADMIN_DUPLICATE_PAYMENT', 'ref', p_payment_id, 'event_id', v_lock_event,
            'data', jsonb_build_object('payment_id', p_payment_id, 'duplicate_of', v_duplicate, 'amount', v_pay.amount,
                                       'duplicate_rank', v_dup_count + 1, 'withheld', v_withheld)));
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout, 'duplicate_of', v_duplicate);
    END IF;

    -- Conversion et émission (montants lus sur les réservations, jamais recalculés)
    FOR v_res IN SELECT * FROM public.stock_reservations WHERE payment_id = p_payment_id ORDER BY category_id LOOP
        -- held d'abord (trigger), puis sold : la contrainte sold + held <= total reste respectée
        UPDATE public.stock_reservations SET status = 'CONVERTED', closed_at = now(), close_reason = 'CONFIRMED' WHERE id = v_res.id;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_res.quantity WHERE id = v_res.category_id;
        SELECT event_id INTO v_cat FROM public.ticket_categories WHERE id = v_res.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, service_fee, qr_code, status)
            SELECT v_cat.event_id, v_res.category_id, v_pay.client_id, p_payment_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   v_res.unit_price,
                   v_res.unit_service_fee,
                   'EV-QR-' || replace(gen_random_uuid()::text, '-', ''),
                   'VALIDE'
              FROM generate_series(1, v_res.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
        v_event := v_cat.event_id;
    END LOOP;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
           confirmed_source = p_source, ticket_id = v_ticket_ids[1]
     WHERE id = p_payment_id;

    -- Lot 6 (J1.1) : confirmation d'achat et nouvelle commande, dans la transaction de la confirmation
    IF v_event IS NOT NULL THEN
        v_payer := CASE WHEN v_pay.payer_phone ~ '^[0-9]{9}$' THEN '+221' || v_pay.payer_phone END;
        v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb);
        IF v_pay.client_id IS NOT NULL OR v_payer IS NOT NULL THEN
            -- Lot 7 (7.9, D87) : catégories, quantités et 10 premiers numéros figés à l'émission
            -- (ticket_count vient de notif_ticket_lines : même valeur que la longueur de v_ticket_ids).
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'PURCHASE_CONFIRMED', 'key', 'PURCHASE_CONFIRMED:' || p_payment_id::text,
                'user_id', v_pay.client_id, 'phone', v_payer, 'event_id', v_event,
                'data', v_data || public.notif_ticket_lines(v_ticket_ids) || jsonb_build_object(
                    'payment_id', p_payment_id,
                    'service_fee', COALESCE(v_pay.service_fee, 0),
                    'total', v_pay.amount)));
        END IF;
        SELECT pa.user_id INTO v_owner
          FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
         WHERE e.id = v_event;
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'NEW_ORDER', 'key', 'NEW_ORDER:' || p_payment_id::text,
                'user_id', v_owner, 'event_id', v_event,
                'data', v_data || jsonb_build_object(
                    'payment_id', p_payment_id,
                    'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0),
                    'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0)))));
        END IF;
    END IF;

    RETURN jsonb_build_object('result', 'CONFIRMED', 'ticket_ids', to_jsonb(v_ticket_ids), 'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0));
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. notif_cashouts_notify (recopie de 20261109000007_lot9bis_versements.sql:320-587)
--    Changement : l'avis PAYMENT_REFUND_STARTED porte la retenue (withheld) et le montant remboursé (refund_amount)
--    d'un doublon répété.
-- ----------------------------------------------------------------------------
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
    IF TG_OP = 'INSERT' AND NEW.kind = 'REFUND' AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
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
                        'type', 'REFUND_PAID',
                        'key', 'REFUND_PAID:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'event_id', v_event,
                        'data', v_event_data || v_money
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


-- ----------------------------------------------------------------------------
-- 5. checkout_create_payment (recopie de 20261109000007_lot9bis_versements.sql:693-806)
--    Changement : C2 (3 paiements en attente au plus par numéro payeur et par heure) et C6 (limite des billets gratuits
--    dans un panier mixte), après la règle d'un paiement en attente par compte et par événement.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_create_payment(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_items jsonb := p->'items';
    v_problems jsonb;
    v_existing uuid;
    v_pending uuid;
    v_payment_id uuid;
    v_expires timestamptz := now() + make_interval(mins => GREATEST(1, COALESCE((p->>'hold_minutes')::int, 15)));
    v_item record;
    v_price numeric;
    v_breakdown jsonb;
    -- Lot 9 quater (C2, C6)
    v_payer_pending integer;
    v_free record;
BEGIN
    -- 1. Verrou des catégories du panier, par identifiant croissant
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(v_items) e)
     ORDER BY id FOR UPDATE;

    -- 2. Réservations échues de ces catégories : rendues avant le contrôle
    UPDATE public.stock_reservations
       SET status = 'EXPIRED', closed_at = now(), close_reason = 'EXPIRED'
     WHERE status = 'ACTIVE' AND expires_at <= now()
       AND category_id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(v_items) e);

    -- 3. Double soumission (même clé d'idempotence fournie par le client)
    IF p->>'client_idempotency_key' IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.payments
         WHERE client_id = (p->>'client_id')::uuid AND client_idempotency_key = p->>'client_idempotency_key';
        IF FOUND THEN
            RETURN jsonb_build_object('ok', false, 'duplicate', true, 'payment_id', v_existing);
        END IF;
    END IF;

    -- 3 bis. Lot 7 (D4) : un paiement de billets PENDING du même compte pour le même événement
    --        interdit d'en créer un second (autre clé, autre onglet, autre opérateur). Verrou consultatif
    --        du couple (compte, événement) : deux demandes simultanées sont sérialisées, la seconde voit le
    --        paiement validé par la première. Lot 9 bis (R47, B10) : la garde vaut jusqu'à ce que ce paiement
    --        soit confirmé, annulé, échoué ou expiré, même après l'échéance de sa réservation.
    PERFORM pg_advisory_xact_lock(hashtext('checkout:' || (p->>'client_id') || ':' || (p->>'event_id')));
    SELECT id INTO v_pending FROM public.payments
     WHERE client_id = (p->>'client_id')::uuid AND event_id = (p->>'event_id')::uuid
       AND payment_target::text = 'TICKET' AND status::text = 'PENDING'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_PENDING', 'payment_id', v_pending,
            'message', 'Un paiement est déjà en attente pour cet événement.');
    END IF;

    -- 3 ter. Lot 9 quater (C2 : AUD-21, C3 : AUD-27) : au plus 3 paiements en attente par numéro payeur, tous comptes
    --        confondus, sur l'heure (verrou consultatif du numéro : deux demandes simultanées se suivent).
    IF NULLIF(p->>'payer_phone', '') IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('checkout-payer:' || (p->>'payer_phone')));
        SELECT count(*) INTO v_payer_pending FROM public.payments
         WHERE payer_phone = p->>'payer_phone' AND status::text = 'PENDING' AND created_at > now() - interval '1 hour';
        IF v_payer_pending >= 3 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYER_PENDING_LIMIT',
                'message', 'Un paiement est déjà en attente pour ce numéro. Terminez-le ou attendez quelques minutes.');
        END IF;
    END IF;

    -- 3 quater. Lot 9 quater (C6 : AUD-31, G-24) : dans un panier mixte aussi, les billets gratuits émis pour le compte
    --           (transférés compris) plus ceux demandés ne dépassent pas le maximum par commande de la catégorie.
    FOR v_free IN
        SELECT c.id, c.name, c.max_per_order, (e->>'quantity')::int AS quantity
          FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid
         WHERE c.price = 0
    LOOP
        IF public.free_tickets_issued_count((p->>'client_id')::uuid, v_free.id) + v_free.quantity > v_free.max_per_order THEN
            RETURN jsonb_build_object('ok', false, 'problems', jsonb_build_array(jsonb_build_object(
                'category_id', v_free.id, 'code', 'FREE_LIMIT_REACHED',
                'message', format('Limite de %s billet(s) gratuit(s) « %s » par compte atteinte.', v_free.max_per_order, v_free.name))));
        END IF;
    END LOOP;

    -- 4. Contrôles partagés, sous verrou
    v_problems := public.ticket_sale_problems((p->>'event_id')::uuid, v_items);
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'problems', v_problems);
    END IF;
    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'unit_price')::numeric AS unit_price FROM jsonb_array_elements(v_items) e LOOP
        SELECT price INTO v_price FROM public.ticket_categories WHERE id = v_item.category_id;
        IF v_price IS DISTINCT FROM v_item.unit_price THEN
            RETURN jsonb_build_object('ok', false, 'problems', jsonb_build_array(jsonb_build_object('category_id', v_item.category_id, 'code', 'PRICE_CHANGED', 'message', 'Le prix a changé : rechargez la page.')));
        END IF;
    END LOOP;

    -- 5. Montants : moteur financier unique (aucun montant du corps n'est utilisé)
    IF NULLIF(p->>'operator', '') IS NULL THEN
        RAISE EXCEPTION 'checkout_create_payment : opérateur obligatoire pour un paiement';
    END IF;
    v_breakdown := public.finance_compute('TICKET',
        (SELECT jsonb_agg(jsonb_build_object('category_id', e->>'category_id', 'unit_price', c.price, 'quantity', (e->>'quantity')::int) ORDER BY ord)
           FROM jsonb_array_elements(v_items) WITH ORDINALITY AS t(e, ord)
           JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid),
        p->>'operator');

    -- 6. Paiement PENDING, taux et délai de disponibilité recopiés
    INSERT INTO public.payments (
        transaction_id, external_order_id, client_id, partner_id, event_id, payment_target, amount, currency,
        is_platform_payment, aggregator, facial_amount, aggregator_fee, service_fee, gross_event_village_revenue,
        net_event_village_revenue, partner_payout_amount, service_fee_rate, aggregator_fee_rate,
        payout_delay_hours, payout_hold_enabled, status, idempotency_key, held_expires_at,
        operator, payer_phone, callback_token_hash, client_idempotency_key, metadata
    ) VALUES (
        p->>'transaction_id', p->>'external_order_id', (p->>'client_id')::uuid, NULLIF(p->>'partner_id', '')::uuid,
        (p->>'event_id')::uuid, 'TICKET',
        (v_breakdown->>'total_amount')::numeric, 'XOF', TRUE, 'SAMIRPAY',
        (v_breakdown->>'facial_amount')::numeric, (v_breakdown->>'aggregator_fee')::numeric,
        (v_breakdown->>'service_fee')::numeric, (v_breakdown->>'gross_event_village_revenue')::numeric,
        (v_breakdown->>'net_event_village_revenue')::numeric, (v_breakdown->>'partner_payout_amount')::numeric,
        (v_breakdown->>'service_fee_rate')::numeric, (v_breakdown->>'aggregator_fee_rate')::numeric,
        public.fin_setting_num('finance.payout_delay_hours')::int, public.fin_setting_bool('finance.payout_hold_enabled'),
        'PENDING', 'IDEMP-' || (p->>'external_order_id'), v_expires,
        NULLIF(p->>'operator', ''), NULLIF(p->>'payer_phone', ''), p->>'callback_token_hash', p->>'client_idempotency_key',
        COALESCE(p->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (client_id, client_idempotency_key) WHERE client_idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_payment_id;
    IF v_payment_id IS NULL THEN
        SELECT id INTO v_existing FROM public.payments
         WHERE client_id = (p->>'client_id')::uuid AND client_idempotency_key = p->>'client_idempotency_key';
        RETURN jsonb_build_object('ok', false, 'duplicate', true, 'payment_id', v_existing);
    END IF;

    -- 7. Réservations de tout le panier, frais de service unitaires compris (le trigger
    --    incrémente held_quantity ; la contrainte sold + held <= total protège en dernier ressort)
    INSERT INTO public.stock_reservations (payment_id, category_id, quantity, unit_price, unit_service_fee, expires_at)
    SELECT v_payment_id, (l->>'category_id')::uuid, (l->>'quantity')::int, (l->>'unit_price')::numeric,
           (l->>'unit_service_fee')::numeric, v_expires
      FROM jsonb_array_elements(v_breakdown->'lines') l;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'expires_at', v_expires,
                              'amount', (v_breakdown->>'total_amount')::numeric, 'breakdown', v_breakdown);
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. free_tickets_claim (recopie de 20261105000007_lot7_confirmation.sql:205-275)
--    Changement : billets déjà comptés = billets gratuits émis pour le compte, transférés compris.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.free_tickets_claim(p_user_id uuid, p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_problems jsonb;
    v_item record;
    v_cat record;
    v_already integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
    v_first uuid;
BEGIN
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(p_items) e)
     ORDER BY id FOR UPDATE;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT id, price, max_per_order, name INTO v_cat FROM public.ticket_categories WHERE id = v_item.category_id;
        IF FOUND AND v_cat.price <> 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_FREE', 'message', format('La catégorie « %s » est payante.', v_cat.name));
        END IF;
    END LOOP;

    v_problems := public.ticket_sale_problems(p_event_id, p_items);
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems);
    END IF;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT c.id, c.event_id, c.max_per_order, c.name INTO v_cat FROM public.ticket_categories c WHERE c.id = v_item.category_id;
        -- Lot 9 quater (C6 : AUD-31, G-24) : billets gratuits ÉMIS pour le compte, transférés compris
        v_already := public.free_tickets_issued_count(p_user_id, v_item.category_id);
        IF v_already + v_item.quantity > v_cat.max_per_order THEN
            RAISE EXCEPTION USING ERRCODE = 'EV409', MESSAGE = format('Limite de %s billet(s) gratuit(s) « %s » par compte atteinte.', v_cat.max_per_order, v_cat.name);
        END IF;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel)
            SELECT v_cat.event_id, v_item.category_id, p_user_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'FREE'
              FROM generate_series(1, v_item.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
    END LOOP;

    -- Lot 6 (J1.2) : confirmation des billets gratuits, dans la même transaction
    -- Plus petit identifiant (ordre de l'uuid = ordre binaire de sa forme texte, indépendant de la collation)
    SELECT x INTO v_first FROM unnest(v_ticket_ids) AS x ORDER BY x LIMIT 1;
    IF v_first IS NOT NULL AND p_user_id IS NOT NULL THEN
        -- Lot 7 (7.9, D87) : catégories, quantités et 10 premiers numéros figés à l'émission
        -- (ticket_count vient de notif_ticket_lines : même valeur que cardinality(v_ticket_ids)).
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'FREE_TICKETS_CONFIRMED', 'key', 'FREE_TICKETS_CONFIRMED:' || v_first::text,
            'user_id', p_user_id, 'actor_id', p_user_id, 'event_id', p_event_id,
            'data', COALESCE(public.notif_event_data(p_event_id), '{}'::jsonb)
                    || public.notif_ticket_lines(v_ticket_ids)
                    || jsonb_build_object('ticket_id', v_first)));
    END IF;

    RETURN jsonb_build_object('ok', true, 'ticket_ids', to_jsonb(v_ticket_ids));
EXCEPTION WHEN SQLSTATE 'EV409' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FREE_LIMIT_REACHED', 'message', SQLERRM);
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. calculate_referral_commissions (recopie de 20261109000007_lot9bis_versements.sql:813-895)
--    Changement : commission nulle (rien n'est écrit) quand referral_self_payer est vrai pour le parrain concerné.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_referral_commissions(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment record;
    v_rel_n1 record;
    v_rel_n2 record;
    v_available timestamptz;
    v_amount numeric;
    v_id uuid;
    v_calc numeric;
    v_budget numeric;
BEGIN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'calculate_referral_commissions : paiement % introuvable', p_payment_id;
    END IF;
    IF v_payment.status <> 'SUCCESS' OR NOT v_payment.is_platform_payment THEN
        RETURN;
    END IF;
    IF v_payment.net_event_village_revenue IS NULL OR v_payment.net_event_village_revenue <= 0 THEN
        RETURN;
    END IF;
    SELECT * INTO v_rel_n1 FROM public.referral_relationships
     WHERE referred_id = v_payment.client_id AND is_active = TRUE AND expires_at >= now();
    IF NOT FOUND THEN
        RETURN;
    END IF;
    -- Lot 9 bis (R106, B12) : commission d'un billet disponible après la fin de l'événement + délai réglé, jamais
    -- avant la confirmation + délai ; abonnement et paiement sans événement : règle inchangée.
    IF v_payment.payment_target::text = 'TICKET' AND v_payment.event_id IS NOT NULL THEN
        v_available := GREATEST(now(), public.fin_event_end(v_payment.event_id))
                       + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int);
    ELSE
        v_available := now() + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int);
    END IF;

    v_calc := public.fin_round_2(v_payment.net_event_village_revenue * v_rel_n1.rate_n1_at_creation / 100);
    v_amount := LEAST(v_calc, v_payment.net_event_village_revenue);
    -- Lot 9 quater (C5 : AUD-30) : aucune commission si le numéro payeur est celui du parrain ou un numéro qu'il a déjà
    -- utilisé pour payer (auto-parrainage par un second compte)
    IF public.referral_self_payer(v_rel_n1.sponsor_id, v_payment.payer_phone) THEN
        v_amount := 0;
    END IF;
    v_budget := v_payment.net_event_village_revenue - v_amount;
    IF v_amount > 0 THEN
        INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                 commission_rate, amount, status, idempotency_key, available_at, kind, uncapped_amount)
        VALUES (v_rel_n1.sponsor_id, v_payment.client_id, 'N1', v_rel_n1.referral_type, v_payment.id, v_payment.net_event_village_revenue,
                v_rel_n1.rate_n1_at_creation, v_amount, 'PENDING', 'COMM_N1_' || v_payment.id || '_' || v_rel_n1.sponsor_id, v_available, 'COMMISSION',
                CASE WHEN v_calc > v_amount THEN v_calc END)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            PERFORM public.fin_ledger_credit(v_rel_n1.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_amount, v_available,
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id, 'event_id', v_payment.event_id),
                                             'COMM-' || v_id::text, 'Commission de parrainage N1');
        END IF;
    END IF;

    SELECT * INTO v_rel_n2 FROM public.referral_relationships
     WHERE referred_id = v_rel_n1.sponsor_id AND is_active = TRUE AND expires_at >= now();
    IF NOT FOUND THEN
        RETURN;
    END IF;
    v_id := NULL;
    v_calc := public.fin_round_2(v_payment.net_event_village_revenue * v_rel_n1.rate_n2_at_creation / 100);
    v_amount := LEAST(v_calc, v_budget);
    IF public.referral_self_payer(v_rel_n2.sponsor_id, v_payment.payer_phone) THEN
        v_amount := 0;
    END IF;
    IF v_amount > 0 THEN
        INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                 commission_rate, amount, status, idempotency_key, available_at, kind, uncapped_amount)
        VALUES (v_rel_n2.sponsor_id, v_payment.client_id, 'N2', v_rel_n1.referral_type, v_payment.id, v_payment.net_event_village_revenue,
                v_rel_n1.rate_n2_at_creation, v_amount, 'PENDING', 'COMM_N2_' || v_payment.id || '_' || v_rel_n2.sponsor_id, v_available, 'COMMISSION',
                CASE WHEN v_calc > v_amount THEN v_calc END)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            PERFORM public.fin_ledger_credit(v_rel_n2.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_amount, v_available,
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id, 'event_id', v_payment.event_id),
                                             'COMM-' || v_id::text, 'Commission de parrainage N2');
        END IF;
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. C7 : écart de caisse validé par l'organisatrice
-- ----------------------------------------------------------------------------
ALTER TABLE public.controller_shifts ADD COLUMN IF NOT EXISTS discrepancy_validated_at timestamptz;
ALTER TABLE public.controller_shifts ADD COLUMN IF NOT EXISTS discrepancy_validated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.controller_shifts.discrepancy_validated_at IS
    'Lot 9 quater (C7, AUD-16) : validation de l''écart de clôture par l''organisatrice depuis sa session (mot de passe récent) ; NULL et écart non nul = en attente.';

-- shift_close (recopie de 20261109000008_lot9bis_cycle.sql:792-940)
-- Changement : plus de PIN régisseur à la clôture avec écart (justification toujours exigée) ; réponse + discrepancy_pending.
CREATE OR REPLACE FUNCTION public.shift_close(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift uuid := public.try_uuid(p->>'shift_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_just text := NULLIF(btrim(COALESCE(p->>'justification', '')), '');
    v_pin_salt text := NULLIF(p->>'pin_salt', '');
    v_pin_hash text := NULLIF(p->>'pin_hash', '');
    sh record;
    pin record;
    v_role text;
    v_declared numeric;
    v_disc numeric;
    v_cosigned boolean := FALSE;
    v_partner_user uuid;
    v_event_title text;
    v_ctrl_name text;
    v_event_data jsonb;
    v_alert_queued boolean := FALSE;
    v_created integer := 0;
BEGIN
    IF v_shift IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de clôture incomplète.');
    END IF;
    SELECT * INTO sh FROM public.controller_shifts WHERE id = v_shift FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status = 'ACTIF') THEN
        v_role := CASE
            WHEN sh.controller_id = v_actor THEN 'CAISSE'
            WHEN EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = sh.partner_id AND pa.user_id = v_actor) THEN 'PARTENAIRE'
            -- Lot 9 bis (R17, B49) : un admin ferme la caisse d'un autre avec events.write (SUPERADMIN toujours)
            WHEN public.admin_can(v_actor, 'events.write') THEN 'ADMIN'
        END;
        IF v_role IS NULL AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.write',
                                      'message', 'Action non autorisée : votre compte n’a pas la permission « Gérer les événements ».');
        END IF;
    END IF;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF sh.status <> 'OUVERT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_OPEN', 'status', sh.status,
                                  'message', 'Cette session de caisse est déjà clôturée.');
    END IF;
    IF jsonb_typeof(p->'declared_cash_total') IS DISTINCT FROM 'number' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;
    v_declared := (p->>'declared_cash_total')::numeric;
    IF v_declared < 0 OR v_declared <> trunc(v_declared) OR v_declared > 9999999999 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;

    v_disc := v_declared - sh.expected_cash_total;   -- total attendu relu sous verrou
    IF v_disc <> 0 THEN
        IF v_just IS NULL OR char_length(v_just) < 10 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'JUSTIFICATION_REQUIRED', 'expected', sh.expected_cash_total,
                                      'declared', v_declared, 'discrepancy', v_disc,
                                      'message', 'Un écart de caisse doit être justifié (10 caractères au moins).');
        END IF;
        IF char_length(v_just) > 1000 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_JUSTIFICATION', 'message', 'La justification est limitée à 1 000 caractères.');
        END IF;
        -- Lot 9 quater (C7 : AUD-16) : plus de co-signature par le PIN régisseur saisi sur le téléphone du contrôleur ;
        -- la caisse se ferme, l'écart attend la validation de l'organisatrice depuis SA session
        -- (shift_discrepancy_validate, mot de passe récent). Le PIN régisseur reste exigé à l'ouverture d'une caisse.
        v_cosigned := FALSE;
    END IF;

    UPDATE public.controller_shifts
       SET status = 'CLOTURE',
           declared_cash_total = v_declared,
           discrepancy_amount = v_disc,
           discrepancy_justification = CASE WHEN v_disc <> 0 THEN v_just END,
           closed_at = now(),
           closed_by = v_actor,
           closing_confirmed_by_pin = v_cosigned,
           updated_at = now()
     WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'SHIFT_CLOSED', 'controller_shifts', sh.id,
            jsonb_build_object('event_id', sh.event_id, 'expected', sh.expected_cash_total, 'declared', v_declared,
                               'discrepancy', v_disc, 'pin_cosigned', v_cosigned, 'closed_by_role', v_role));

    SELECT title INTO v_event_title FROM public.events WHERE id = sh.event_id;
    SELECT NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') INTO v_ctrl_name
      FROM public.users WHERE id = sh.controller_id;
    v_event_data := public.notif_pros_event_data(sh.event_id);

    -- Lot 6 (J2.1) : alerte d'écart au partenaire propriétaire, mise en file dans cette transaction.
    IF v_disc <> 0 THEN
        SELECT user_id INTO v_partner_user FROM public.partners WHERE id = sh.partner_id;
        IF v_partner_user IS NOT NULL THEN
            v_created := public.notif_enqueue(jsonb_build_object(
                'type', 'SHIFT_DISCREPANCY',
                'key', 'SHIFT_DISCREPANCY:' || sh.id::text,
                'user_id', v_partner_user,
                'event_id', sh.event_id,
                'shift_id', sh.id,
                'data', v_event_data || jsonb_build_object(
                    'shift_id', sh.id,
                    'controller_name', COALESCE(v_ctrl_name, 'votre contrôleur'),
                    'difference', v_disc,
                    'declared', v_declared,
                    'expected', sh.expected_cash_total,
                    'justification', v_just)
            ));
            v_alert_queued := v_created > 0;
        END IF;
    END IF;

    -- Lot 6 (J2.1) : caisse fermée par le partenaire ou un admin → avis au contrôleur de la caisse.
    IF v_role IN ('PARTENAIRE', 'ADMIN') THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'SHIFT_CLOSED_BY_OTHER',
            'key', 'SHIFT_CLOSED_BY_OTHER:' || sh.id::text,
            'user_id', sh.controller_id,
            'event_id', sh.event_id,
            'shift_id', sh.id,
            'data', v_event_data || jsonb_build_object(
                'shift_id', sh.id,
                'closed_by', CASE WHEN v_role = 'PARTENAIRE' THEN 'PARTNER' ELSE 'ADMIN' END,
                'declared', v_declared)
        ));
    END IF;

    RETURN jsonb_build_object('ok', true, 'shift_id', sh.id, 'event_id', sh.event_id, 'partner_id', sh.partner_id,
                              'expected', sh.expected_cash_total, 'declared', v_declared, 'discrepancy', v_disc,
                              'pin_cosigned', v_cosigned, 'closed_by', v_actor, 'closed_by_role', v_role,
                              'discrepancy_pending', v_disc <> 0,
                              'alert_queued', v_alert_queued, 'event_title', v_event_title, 'controller_name', v_ctrl_name,
                              'justification', CASE WHEN v_disc <> 0 THEN v_just END);
END;
$$;

-- p = { shift_id, actor_id } → { ok, shift_id, discrepancy, validated_at } ; seule l'organisatrice propriétaire de la
-- caisse (compte ACTIF) valide ; caisse non clôturée → SHIFT_NOT_CLOSED ; sans écart → NO_DISCREPANCY ; déjà validée →
-- ALREADY_VALIDATED. Journal SHIFT_DISCREPANCY_VALIDATED dans la transaction.
CREATE OR REPLACE FUNCTION public.shift_discrepancy_validate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift uuid := public.try_uuid(p->>'shift_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    sh record;
BEGIN
    IF v_shift IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Caisse ou compte manquant.');
    END IF;
    SELECT s.id, s.status::text AS status, s.partner_id, s.discrepancy_amount, s.discrepancy_validated_at, s.event_id
      INTO sh FROM public.controller_shifts s WHERE s.id = v_shift FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.partners pa JOIN public.users u ON u.id = pa.user_id
                                 WHERE pa.id = sh.partner_id AND pa.user_id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Caisse introuvable.');
    END IF;
    IF sh.status <> 'CLOTURE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_CLOSED', 'message', 'La caisse n''est pas encore fermée.');
    END IF;
    IF COALESCE(sh.discrepancy_amount, 0) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_DISCREPANCY', 'message', 'Cette caisse n''a pas d''écart à valider.');
    END IF;
    IF sh.discrepancy_validated_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_VALIDATED', 'message', 'L''écart de cette caisse est déjà validé.');
    END IF;
    UPDATE public.controller_shifts
       SET discrepancy_validated_at = now(), discrepancy_validated_by = v_actor, updated_at = now()
     WHERE id = v_shift;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'SHIFT_DISCREPANCY_VALIDATED', 'controller_shifts', v_shift,
            jsonb_build_object('event_id', sh.event_id, 'discrepancy', sh.discrepancy_amount));
    RETURN jsonb_build_object('ok', true, 'shift_id', v_shift, 'discrepancy', sh.discrepancy_amount, 'validated_at', now());
END;
$$;
REVOKE ALL ON FUNCTION public.shift_discrepancy_validate(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shift_discrepancy_validate(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- Recopie : pilotage_compute_cash (20261102000005_lot5_pilotage.sql:303-372). Seul changement : chaque caisse porte
-- discrepancy_validated_at (C7 : AUD-16), lu par l'onglet Caisse du pilotage pour proposer « Valider l'écart » sans
-- relire l'ancienne route des caisses. Signature, droits (service_role seul) et autres champs inchangés.
-- ----------------------------------------------------------------------------
-- pilotage_compute_cash(event_id) → { shifts[], by_controller[], totals } (contrat U) ; espèces d'une
-- caisse = Σ des paiements hors plateforme SUCCESS rattachés (égal à expected_cash_total, invariant (h)).
CREATE OR REPLACE FUNCTION public.pilotage_compute_cash(p_event uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH sh AS (
        SELECT s.id, s.controller_id, s.status::text AS status, s.opened_at, s.closed_at,
               s.opening_float_amount, s.expected_cash_total, s.declared_cash_total, s.discrepancy_amount,
               s.discrepancy_justification, s.closing_confirmed_by_pin, s.discrepancy_validated_at,
               public.pilotage_display_name(u.first_name, u.last_name) AS controller_name,
               COALESCE(p.collected, 0) AS collected,
               COALESCE(p.scan_n, 0) AS scan_n, COALESCE(p.scan_amount, 0) AS scan_amount,
               COALESCE(p.counter_n, 0) AS counter_n, COALESCE(p.counter_amount, 0) AS counter_amount
          FROM public.controller_shifts s
          LEFT JOIN public.users u ON u.id = s.controller_id
          LEFT JOIN LATERAL (
              SELECT sum(pay.amount) AS collected,
                     count(*) FILTER (WHERE pay.metadata->>'source' = 'COUNTER_SALE') AS counter_n,
                     COALESCE(sum(pay.amount) FILTER (WHERE pay.metadata->>'source' = 'COUNTER_SALE'), 0) AS counter_amount,
                     count(*) FILTER (WHERE pay.metadata->>'source' IS DISTINCT FROM 'COUNTER_SALE') AS scan_n,
                     COALESCE(sum(pay.amount) FILTER (WHERE pay.metadata->>'source' IS DISTINCT FROM 'COUNTER_SALE'), 0) AS scan_amount
                FROM public.payments pay
               WHERE pay.shift_id = s.id AND NOT pay.is_platform_payment AND pay.status::text = 'SUCCESS'
          ) p ON TRUE
         WHERE s.event_id = p_event
    )
    SELECT jsonb_build_object(
        'shifts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', sh.id,
                       'controller_id', sh.controller_id,
                       'controller_name', sh.controller_name,
                       'status', sh.status,
                       'opened_at', sh.opened_at,
                       'closed_at', sh.closed_at,
                       'opening_float', sh.opening_float_amount,
                       'cash_collected', sh.collected,
                       'expected', sh.expected_cash_total,
                       'declared', CASE WHEN sh.status = 'OUVERT' THEN NULL ELSE sh.declared_cash_total END,
                       'difference', CASE WHEN sh.status = 'OUVERT' THEN NULL ELSE sh.discrepancy_amount END,
                       'justification', sh.discrepancy_justification,
                       'pin_cosigned', COALESCE(sh.closing_confirmed_by_pin, false),
                       'discrepancy_validated_at', sh.discrepancy_validated_at,
                       'scan_count', sh.scan_n,
                       'scan_amount', sh.scan_amount,
                       'counter_count', sh.counter_n,
                       'counter_amount', sh.counter_amount)
                   ORDER BY sh.opened_at, sh.id)
              FROM sh), '[]'::jsonb),
        'by_controller', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'controller_id', x.controller_id,
                       'name', x.name,
                       'cash_collected', x.collected,
                       'shifts', x.n,
                       'open_shifts', x.open_n)
                   ORDER BY x.collected DESC, x.controller_id)
              FROM (SELECT controller_id, max(controller_name) AS name, sum(collected) AS collected, count(*) AS n,
                           count(*) FILTER (WHERE status = 'OUVERT') AS open_n
                      FROM sh GROUP BY controller_id) x), '[]'::jsonb),
        'totals', jsonb_build_object(
            'cash_collected', COALESCE((SELECT sum(collected) FROM sh), 0),
            'open', (SELECT count(*) FROM sh WHERE status = 'OUVERT'),
            'closed', (SELECT count(*) FROM sh WHERE status <> 'OUVERT'),
            'difference', COALESCE((SELECT sum(discrepancy_amount) FROM sh WHERE status <> 'OUVERT'), 0)))
$$;

REVOKE ALL ON FUNCTION public.pilotage_compute_cash(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pilotage_compute_cash(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- Recopie : cashout_finalize (20261109000007_lot9bis_versements.sql:987-1062). Seul changement (C1) : un
-- paiement en double remboursé moins la retenue des frais de l'opérateur (metadata.duplicate_fee_withheld) passe
-- REFUNDED une fois le remboursement versé : il est soldé (remboursement + retenue = montant) et n'a aucun billet.
-- Sans cela il restait PARTIAL sans billet (invariant (a) du lot 2). Droits inchangés (CREATE OR REPLACE).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashout_finalize(p_cashout_id uuid, p_outcome text, p_detail text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c record;
    r record;
    w record;
    v_payment_status text;
    v_client uuid;
    v_tickets uuid[] := ARRAY[]::uuid[];
    v_partner uuid;
BEGIN
    IF p_outcome NOT IN ('CONFIRME', 'ECHOUE') THEN
        RAISE EXCEPTION 'cashout_finalize : issue % inconnue', p_outcome;
    END IF;
    SELECT * INTO c FROM public.cashouts WHERE id = p_cashout_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'cashout_finalize : envoi % introuvable', p_cashout_id; END IF;

    IF c.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND') THEN
        SELECT * INTO r FROM public.refunds WHERE id = c.refund_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'cashout_finalize : remboursement de l''envoi % introuvable', p_cashout_id; END IF;
        SELECT client_id INTO v_client FROM public.payments WHERE id = r.payment_id;
        IF p_outcome = 'CONFIRME' AND r.status <> 'PROCESSED' THEN
            UPDATE public.refunds SET status = 'PROCESSED', external_refund_id = p_detail, updated_at = now() WHERE id = r.id;
            UPDATE public.payments
               SET refunded_amount = refunded_amount + r.amount,
                   status = CASE WHEN refunded_amount + r.amount
                                      + COALESCE((metadata->>'duplicate_fee_withheld')::numeric, 0) >= amount
                                 THEN 'REFUNDED'::payment_status_enum
                                 ELSE 'PARTIAL'::payment_status_enum END,
                   updated_at = now()
             WHERE id = r.payment_id
            RETURNING status::text INTO v_payment_status;
            IF c.kind = 'TICKET_REFUND' THEN
                WITH u AS (UPDATE public.tickets SET status = 'REMBOURSE' WHERE id = r.ticket_id AND status = 'REMBOURSEMENT_EN_COURS' RETURNING id)
                SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_tickets FROM u;
            ELSE
                WITH u AS (UPDATE public.tickets SET status = 'REMBOURSE' WHERE payment_id = r.payment_id AND status = 'REMBOURSEMENT_EN_COURS' RETURNING id)
                SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_tickets FROM u;
            END IF;
        ELSIF p_outcome = 'ECHOUE' THEN
            UPDATE public.refunds SET status = 'FAILED', updated_at = now() WHERE id = r.id AND status = 'PENDING';
        END IF;
        -- Lot 9 bis (H7, X3, X4, A6) : frais réels d'un remboursement confirmé imputés à la partenaire qui a annulé
        -- (cashout_fee_apply, M05 : filtre la nature et l'auteur de l'annulation, idempotente par source_key). Appelée
        -- à chaque CONFIRME, même déjà PROCESSED : un appel manqué est rattrapé sans doublon. Grand livre en dernier
        -- (tableau 3.3). samirpay_* ne sont pas écrits ici (TypeScript, avant cet appel).
        IF p_outcome = 'CONFIRME' THEN
            PERFORM public.cashout_fee_apply(p_cashout_id);
        END IF;
        RETURN jsonb_build_object('kind', c.kind, 'outcome', p_outcome, 'refund_id', r.id, 'payment_id', r.payment_id,
                                  'client_id', v_client, 'amount', r.amount, 'payment_status', v_payment_status,
                                  'ticket_ids', to_jsonb(v_tickets));
    END IF;

    -- Retrait
    SELECT * INTO w FROM public.withdrawals WHERE id = c.withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'cashout_finalize : retrait de l''envoi % introuvable', p_cashout_id; END IF;
    IF p_outcome = 'CONFIRME' THEN
        UPDATE public.withdrawals SET status = 'PAID', external_reference = p_detail, processed_at = now(), updated_at = now()
         WHERE id = w.id AND status IN ('PENDING', 'PROCESSING');
    ELSIF w.status IN ('PENDING', 'PROCESSING') THEN
        UPDATE public.withdrawals SET status = 'REJECTED', rejection_reason = p_detail, processed_at = now(), updated_at = now()
         WHERE id = w.id;
        SELECT id INTO v_partner FROM public.partners WHERE user_id = w.user_id AND w.account_kind = 'ORGANISATEUR' LIMIT 1;
        PERFORM public.fin_ledger_credit(w.user_id, w.account_kind, v_partner, 'RETRAIT_ANNULE', w.gross_amount, now(),
                                         jsonb_build_object('withdrawal_id', w.id), 'RETRAIT-ANN-' || w.id::text,
                                         'Retrait refusé par l''opérateur : montant rendu au solde');
        PERFORM public.fin_referral_unallocate(w.id);
    END IF;
    RETURN jsonb_build_object('kind', c.kind, 'outcome', p_outcome, 'withdrawal_id', w.id, 'user_id', w.user_id,
                              'account_kind', w.account_kind, 'gross_amount', w.gross_amount, 'net_amount', w.net_amount);
END;
$$;

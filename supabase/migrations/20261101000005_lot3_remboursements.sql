-- ============================================================================
-- EVENT VILLAGE — LOT 3 : remboursements réels, unitaires et partiels (3.4, 3.7)
-- ============================================================================
-- ticket_refund_request : remboursement d'un billet par le module de cashout (clé
--   REFUND-TKT-<ticketId>), montant = part du paiement correspondant au billet (prix + frais de
--   service du billet) ; billet REMBOURSEMENT_EN_COURS jusqu'au versement confirmé. Billet espèces :
--   aucun cashout, remboursement « à rembourser par l'organisateur ». Billet gratuit : annulé.
-- refund_request (lot 2) : rembourse désormais le RESTE du paiement (annulation, panier non honorable).
-- fin_refund_apply : effets comptables à la demande (débit organisateur au grand livre, part du revenu
--   net EV annulée, régularisation des commissions). Porteur des frais d'agrégateur perdus : réglage
--   finance.cancellation_aggregator_fee_bearer (recopié sur le remboursement), Event Village pour un
--   panier non honorable.
-- cashout_finalize : effets d'un envoi confirmé ou refusé (remboursement versé : billets REMBOURSE,
--   paiement PARTIAL puis REFUNDED ; retrait payé ou refusé avec solde rendu).
-- Ordre de verrouillage : paiement, billet, catégorie, compte du grand livre.
-- ============================================================================

-- ── Colonnes ────────────────────────────────────────────────────────────────
ALTER TABLE public.refunds ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.tickets(id) ON DELETE RESTRICT;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS settlement TEXT NOT NULL DEFAULT 'PLATEFORME' CHECK (settlement IN ('PLATEFORME', 'ORGANISATEUR'));
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS facial_part NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS service_part NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS aggregator_fee_share NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS aggregator_fee_bearer TEXT CHECK (aggregator_fee_bearer IS NULL OR aggregator_fee_bearer IN ('EVENT_VILLAGE', 'ORGANISATEUR'));
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS net_revenue_reversal NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS cashout_id UUID REFERENCES public.cashouts(id) ON DELETE SET NULL;
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_target_present;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_target_present CHECK (payment_id IS NOT NULL OR ticket_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_ticket ON public.refunds (ticket_id);
COMMENT ON COLUMN public.refunds.settlement IS
    'Lot 3 : PLATEFORME (versé par le module de cashout) ou ORGANISATEUR (billet payé en espèces : à rembourser par l''organisateur, aucun cashout)';

ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL;
ALTER TABLE public.cashouts DROP CONSTRAINT IF EXISTS cashouts_kind_check;
ALTER TABLE public.cashouts ADD CONSTRAINT cashouts_kind_check
    CHECK (kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND', 'WITHDRAWAL'));

-- ── Effets comptables d'un remboursement plateforme (à la demande) ──────────
CREATE OR REPLACE FUNCTION public.fin_refund_apply(p_refund_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
    p record;
    v_sale record;
    v_debit numeric;
    v_prev numeric;
    v_res jsonb := '{}'::jsonb;
BEGIN
    SELECT * INTO r FROM public.refunds WHERE id = p_refund_id;
    IF NOT FOUND OR r.payment_id IS NULL OR r.settlement <> 'PLATEFORME' THEN
        RETURN v_res;
    END IF;
    SELECT * INTO p FROM public.payments WHERE id = r.payment_id;
    UPDATE public.payments SET refunded_net_revenue = refunded_net_revenue + r.net_revenue_reversal, updated_at = now()
     WHERE id = p.id;

    -- Débit organisateur, seulement si la vente lui avait été créditée
    SELECT * INTO v_sale FROM public.finance_ledger WHERE source_key = 'VENTE-' || p.id::text;
    IF FOUND THEN
        v_debit := r.facial_part + CASE WHEN r.aggregator_fee_bearer = 'ORGANISATEUR' THEN r.aggregator_fee_share ELSE 0 END;
        v_res := public.fin_ledger_debit(
            v_sale.owner_id, 'ORGANISATEUR', v_sale.partner_id, 'REMBOURSEMENT', v_debit,
            GREATEST(now(), v_sale.available_at),
            jsonb_build_object('payment_id', p.id, 'ticket_id', r.ticket_id, 'refund_id', r.id, 'event_id', p.event_id),
            'REMB-' || r.id::text,
            format('Remboursement %s (%s)', r.refund_transaction_id, COALESCE(r.kind, 'REFUND')));
    END IF;

    -- Commissions de parrainage du paiement : annulées, recalculées ou régularisées
    SELECT COALESCE(sum(amount), 0) INTO v_prev FROM public.refunds
     WHERE payment_id = p.id AND settlement = 'PLATEFORME' AND id <> r.id;
    PERFORM public.fin_referral_on_refund(p.id, r.id, v_prev, v_prev + r.amount);
    RETURN v_res;
END;
$$;

-- ── Remboursement d'un billet ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ticket_refund_request(p_ticket_id uuid, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text := 'REFUND-TKT-' || p_ticket_id::text;
    v_payment_id uuid;
    p record;
    t record;
    v_ref record;
    v_user record;
    v_blocked text;
    v_refund uuid;
    v_cashout uuid;
    v_share numeric;
    v_prev_amount numeric;
    v_prev_agg numeric;
    v_agg_share numeric;
    v_bearer text;
    v_apply jsonb;
    v_platform boolean;
BEGIN
    SELECT payment_id INTO v_payment_id FROM public.tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO p FROM public.payments WHERE id = v_payment_id FOR UPDATE;
    END IF;
    SELECT * INTO t FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    SELECT * INTO v_ref FROM public.refunds WHERE refund_transaction_id = v_key;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', true, 'already', true,
            'mode', CASE WHEN v_ref.settlement = 'ORGANISATEUR' THEN 'ORGANISATEUR' ELSE 'CASHOUT' END,
            'refund_id', v_ref.id, 'cashout_id', v_ref.cashout_id, 'amount', v_ref.amount);
    END IF;
    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_REFUNDABLE', 'status', t.status::text,
                                  'message', format('Billet %s : remboursement impossible.', t.status));
    END IF;
    PERFORM 1 FROM public.ticket_categories WHERE id = t.category_id FOR UPDATE;

    -- Billet gratuit ou invitation : annulé, rien à rembourser
    IF COALESCE(t.price, 0) = 0 THEN
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'AUCUN', 'amount', 0);
    END IF;

    -- Billet payé hors plateforme (espèces) : à rembourser par l'organisateur, aucun cashout
    IF v_payment_id IS NOT NULL THEN
        v_platform := p.is_platform_payment;
    END IF;
    IF NOT COALESCE(v_platform, FALSE) THEN
        INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by, kind, facial_part)
        VALUES (v_payment_id, t.id, v_key, t.price, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'ORGANISATEUR', p_actor, 'TICKET_REFUND', t.price)
        RETURNING id INTO v_refund;
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'ORGANISATEUR', 'refund_id', v_refund, 'amount', t.price);
    END IF;

    IF p.status::text NOT IN ('SUCCESS', 'PARTIAL') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_NOT_REFUNDABLE', 'status', p.status::text,
                                  'message', 'Le paiement de ce billet ne peut pas être remboursé.');
    END IF;

    -- Part du paiement correspondant au billet, jamais au-delà du reste à rembourser
    SELECT COALESCE(sum(amount), 0), COALESCE(sum(aggregator_fee_share), 0) INTO v_prev_amount, v_prev_agg
      FROM public.refunds WHERE payment_id = p.id AND settlement = 'PLATEFORME';
    v_share := LEAST(t.price + t.service_fee, p.amount - v_prev_amount);
    IF v_share <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REFUNDED', 'message', 'Ce paiement est déjà entièrement remboursé.');
    END IF;
    v_agg_share := CASE WHEN v_prev_amount + v_share >= p.amount THEN p.aggregator_fee - v_prev_agg
                        ELSE public.fin_round_2(p.aggregator_fee * v_share / p.amount) END;
    v_bearer := public.fin_setting_text('finance.cancellation_aggregator_fee_bearer');

    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = p.client_id;
    v_blocked := CASE
        WHEN p.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN p.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;

    INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by,
                                kind, facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal)
    VALUES (p.id, t.id, v_key, v_share, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'PLATEFORME', p_actor,
            'TICKET_REFUND', t.price, t.service_fee, v_agg_share, v_bearer,
            CASE WHEN v_bearer = 'ORGANISATEUR' THEN t.service_fee - v_agg_share ELSE t.service_fee END)
    RETURNING id INTO v_refund;
    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, ticket_id, beneficiary_user_id, operator, phone_number,
                                 first_name, last_name, amount, blocked_reason)
    VALUES ('TICKET_REFUND', v_key, p.id, v_refund, t.id, p.client_id, p.operator, p.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_share, v_blocked)
    RETURNING id INTO v_cashout;
    UPDATE public.refunds SET cashout_id = v_cashout WHERE id = v_refund;
    UPDATE public.tickets SET status = 'REMBOURSEMENT_EN_COURS' WHERE id = t.id;
    UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
    v_apply := public.fin_refund_apply(v_refund);
    RETURN jsonb_build_object('ok', true, 'mode', 'CASHOUT', 'refund_id', v_refund, 'cashout_id', v_cashout,
                              'amount', v_share, 'blocked_reason', v_blocked, 'debt', COALESCE(v_apply->'debt', '0'::jsonb));
END;
$$;

-- ── Remboursement du reste d'un paiement (annulation, panier non honorable) ─
CREATE OR REPLACE FUNCTION public.refund_request(p_payment_id uuid, p_reason text, p_kind text DEFAULT 'REFUND')
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
    v_amount := v_pay.amount - v_prev.amount;
    IF v_amount <= 0 THEN
        RETURN NULL; -- tout est déjà remboursé ou en cours de remboursement
    END IF;
    v_service := COALESCE(v_pay.service_fee, 0) - v_prev.service;
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

-- ── Effets d'un envoi confirmé ou refusé ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cashout_finalize(p_cashout_id uuid, p_outcome text, p_detail text)
RETURNS jsonb
LANGUAGE plpgsql
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
                   status = CASE WHEN refunded_amount + r.amount >= amount THEN 'REFUNDED'::payment_status_enum
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

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_refund_apply(uuid)',
        'public.ticket_refund_request(uuid, uuid, text)',
        'public.refund_request(uuid, text, text)',
        'public.cashout_finalize(uuid, text, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

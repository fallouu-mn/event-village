-- ============================================================================
-- EVENT VILLAGE — LOT 3 : grand livre des comptes organisateur et parrainage (3.6)
-- ============================================================================
-- finance_ledger : une écriture signée par mouvement, avec sa date de disponibilité et une clé
-- unique (source_key) qui rend chaque écriture idempotente. Deux comptes par utilisateur :
-- ORGANISATEUR (ventes en ligne de ses événements) et PARRAINAGE (commissions).
--  - VENTE : à la confirmation d'un paiement plateforme (trigger), + reversement organisateur,
--    disponible à la fin de l'événement + délai (réglages recopiés sur le paiement).
--    Espèces (is_platform_payment = false) et invitations : aucune écriture.
--  - Débits (remboursement, régularisation…) : jamais au-delà du solde ; le reste devient une
--    créance (finance_debts) avec alerte aux SUPERADMIN, compensée sur les crédits suivants.
--  - Solde disponible = Σ écritures échues ; en attente = Σ écritures futures.
-- Verrou consultatif par (compte, type de compte) pour toute écriture qui dépend du solde.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.finance_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    account_kind TEXT NOT NULL CHECK (account_kind IN ('ORGANISATEUR', 'PARRAINAGE')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    remaining NUMERIC(14,2) NOT NULL CHECK (remaining >= 0),
    reason TEXT NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT,
    refund_id UUID REFERENCES public.refunds(id) ON DELETE RESTRICT,
    commission_id UUID REFERENCES public.referral_commissions(id) ON DELETE RESTRICT,
    source_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ,
    CONSTRAINT finance_debts_remaining_le_amount CHECK (remaining <= amount)
);
CREATE INDEX IF NOT EXISTS idx_finance_debts_open ON public.finance_debts (owner_id, account_kind) WHERE remaining > 0;

CREATE TABLE IF NOT EXISTS public.finance_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    account_kind TEXT NOT NULL CHECK (account_kind IN ('ORGANISATEUR', 'PARRAINAGE')),
    partner_id UUID REFERENCES public.partners(id) ON DELETE RESTRICT,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('VENTE', 'REMBOURSEMENT', 'RETRAIT', 'RETRAIT_ANNULE', 'COMMISSION',
                                                    'COMMISSION_ANNULEE', 'REGULARISATION', 'COMPENSATION_CREANCE')),
    amount NUMERIC(14,2) NOT NULL,
    available_at TIMESTAMPTZ NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT,
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE RESTRICT,
    refund_id UUID REFERENCES public.refunds(id) ON DELETE RESTRICT,
    withdrawal_id UUID REFERENCES public.withdrawals(id) ON DELETE RESTRICT,
    commission_id UUID REFERENCES public.referral_commissions(id) ON DELETE RESTRICT,
    debt_id UUID REFERENCES public.finance_debts(id) ON DELETE RESTRICT,
    event_id UUID REFERENCES public.events(id) ON DELETE RESTRICT,
    source_key TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT finance_ledger_sign CHECK (
        (entry_type IN ('VENTE', 'RETRAIT_ANNULE', 'COMMISSION') AND amount > 0)
        OR (entry_type NOT IN ('VENTE', 'RETRAIT_ANNULE', 'COMMISSION') AND amount < 0))
);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_account ON public.finance_ledger (owner_id, account_kind, available_at);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_payment ON public.finance_ledger (payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_event ON public.finance_ledger (event_id);

ALTER TABLE public.finance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_debts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.finance_debts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.finance_ledger TO service_role;
GRANT ALL ON TABLE public.finance_debts TO service_role;
COMMENT ON TABLE public.finance_ledger IS
    'Lot 3 : grand livre des comptes ORGANISATEUR et PARRAINAGE (écritures signées, disponibilité datée, clé unique). Service_role uniquement.';

-- ── Outils ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_account_lock(p_owner uuid, p_kind text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || p_kind, 0)) $$;

-- Alerte aux SUPERADMIN (journal + notification), même forme que lib/admin/alerts.ts
CREATE OR REPLACE FUNCTION public.fin_alert_superadmins(p_action text, p_title text, p_content text, p_object_type text, p_object_id uuid, p_metadata jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (user_role, action, object_type, object_id, metadata)
    VALUES ('SYSTEM', p_action, p_object_type, p_object_id, COALESCE(p_metadata, '{}'::jsonb));
    INSERT INTO public.notifications (user_id, type, title, content, channel, status, sent_at, metadata)
    SELECT r.user_id, 'FINANCE_ALERT', p_title, p_content, 'PUSH', 'SENT', now(), COALESCE(p_metadata, '{}'::jsonb)
      FROM public.user_roles r WHERE r.role = 'SUPERADMIN';
END;
$$;

-- Fin d'un événement : date et heure de fin, à défaut la date de début à 23:59 (Africa/Dakar)
CREATE OR REPLACE FUNCTION public.fin_event_end(p_event_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ((COALESCE(e.end_date, e.start_date) + COALESCE(CASE WHEN e.end_date IS NOT NULL THEN e.end_time END, time '23:59'))
            AT TIME ZONE 'Africa/Dakar')
      FROM public.events e WHERE e.id = p_event_id
$$;

-- Disponibilité des fonds d'un paiement (réglages recopiés sur le paiement à sa création)
CREATE OR REPLACE FUNCTION public.fin_payout_available_at(p_payment_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    p record;
    v_hold boolean;
    v_delay integer;
    v_end timestamptz;
BEGIN
    SELECT id, payment_target::text AS payment_target, event_id, paid_at, payout_hold_enabled, payout_delay_hours
      INTO p FROM public.payments WHERE id = p_payment_id;
    v_hold := COALESCE(p.payout_hold_enabled, public.fin_setting_bool('finance.payout_hold_enabled'));
    v_delay := COALESCE(p.payout_delay_hours, public.fin_setting_num('finance.payout_delay_hours')::int);
    IF NOT v_hold THEN
        RETURN COALESCE(p.paid_at, now());
    END IF;
    IF p.payment_target = 'TICKET' AND p.event_id IS NOT NULL THEN
        v_end := public.fin_event_end(p.event_id);
    END IF;
    RETURN COALESCE(v_end, p.paid_at, now()) + make_interval(hours => v_delay);
END;
$$;

-- Crédit idempotent (la compensation des créances est faite par trigger)
CREATE OR REPLACE FUNCTION public.fin_ledger_credit(
    p_owner uuid, p_kind text, p_partner uuid, p_type text, p_amount numeric, p_available_at timestamptz,
    p_refs jsonb, p_source_key text, p_description text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN NULL;
    END IF;
    INSERT INTO public.finance_ledger (owner_id, account_kind, partner_id, entry_type, amount, available_at,
                                       payment_id, ticket_id, refund_id, withdrawal_id, commission_id, event_id,
                                       source_key, description)
    VALUES (p_owner, p_kind, p_partner, p_type, p_amount, p_available_at,
            (p_refs->>'payment_id')::uuid, (p_refs->>'ticket_id')::uuid, (p_refs->>'refund_id')::uuid,
            (p_refs->>'withdrawal_id')::uuid, (p_refs->>'commission_id')::uuid, (p_refs->>'event_id')::uuid,
            p_source_key, p_description)
    ON CONFLICT (source_key) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.finance_ledger WHERE source_key = p_source_key;
    END IF;
    RETURN v_id;
END;
$$;

-- Débit idempotent, jamais au-delà du solde total : le reste devient une créance (alerte)
CREATE OR REPLACE FUNCTION public.fin_ledger_debit(
    p_owner uuid, p_kind text, p_partner uuid, p_type text, p_amount numeric, p_available_at timestamptz,
    p_refs jsonb, p_source_key text, p_description text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id uuid;
    v_existing_amount numeric;
    v_total numeric;
    v_debit numeric;
    v_rest numeric;
    v_entry uuid;
    v_debt uuid;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('debited', 0, 'debt', 0);
    END IF;
    PERFORM public.fin_account_lock(p_owner, p_kind);
    SELECT id, amount INTO v_existing_id, v_existing_amount FROM public.finance_ledger WHERE source_key = p_source_key;
    IF v_existing_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.finance_debts WHERE source_key = p_source_key || '-CREANCE') THEN
        RETURN jsonb_build_object('already', true, 'entry_id', v_existing_id, 'debited', COALESCE(-v_existing_amount, 0));
    END IF;
    SELECT COALESCE(sum(amount), 0) INTO v_total FROM public.finance_ledger WHERE owner_id = p_owner AND account_kind = p_kind;
    v_debit := LEAST(p_amount, GREATEST(v_total, 0));
    v_rest := p_amount - v_debit;
    IF v_debit > 0 THEN
        INSERT INTO public.finance_ledger (owner_id, account_kind, partner_id, entry_type, amount, available_at,
                                           payment_id, ticket_id, refund_id, withdrawal_id, commission_id, event_id,
                                           source_key, description)
        VALUES (p_owner, p_kind, p_partner, p_type, -v_debit, p_available_at,
                (p_refs->>'payment_id')::uuid, (p_refs->>'ticket_id')::uuid, (p_refs->>'refund_id')::uuid,
                (p_refs->>'withdrawal_id')::uuid, (p_refs->>'commission_id')::uuid, (p_refs->>'event_id')::uuid,
                p_source_key, p_description)
        RETURNING id INTO v_entry;
    END IF;
    IF v_rest > 0 THEN
        INSERT INTO public.finance_debts (owner_id, account_kind, amount, remaining, reason, payment_id, refund_id, commission_id, source_key)
        VALUES (p_owner, p_kind, v_rest, v_rest, COALESCE(p_description, p_type), (p_refs->>'payment_id')::uuid,
                (p_refs->>'refund_id')::uuid, (p_refs->>'commission_id')::uuid, p_source_key || '-CREANCE')
        RETURNING id INTO v_debt;
        PERFORM public.fin_alert_superadmins(
            'FINANCE_DEBT_CREATED',
            'Créance sur un compte',
            format('Débit %s de %s F sur le compte %s : solde insuffisant, créance de %s F à compenser sur les gains futurs.', p_type, p_amount, p_kind, v_rest),
            'finance_debts', v_debt,
            jsonb_build_object('owner_id', p_owner, 'account_kind', p_kind, 'entry_type', p_type, 'amount', p_amount, 'debt', v_rest, 'source_key', p_source_key) || COALESCE(p_refs, '{}'::jsonb));
    END IF;
    RETURN jsonb_build_object('entry_id', v_entry, 'debited', v_debit, 'debt', v_rest, 'debt_id', v_debt);
END;
$$;

-- Compensation : tout crédit rembourse d'abord les créances ouvertes du compte
CREATE OR REPLACE FUNCTION public.fin_ledger_compensate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_left numeric := NEW.amount;
    v_debt record;
    v_take numeric;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.finance_debts WHERE owner_id = NEW.owner_id AND account_kind = NEW.account_kind AND remaining > 0) THEN
        RETURN NULL;
    END IF;
    PERFORM public.fin_account_lock(NEW.owner_id, NEW.account_kind);
    FOR v_debt IN
        SELECT * FROM public.finance_debts
         WHERE owner_id = NEW.owner_id AND account_kind = NEW.account_kind AND remaining > 0
         ORDER BY created_at, id FOR UPDATE
    LOOP
        EXIT WHEN v_left <= 0;
        v_take := LEAST(v_left, v_debt.remaining);
        INSERT INTO public.finance_ledger (owner_id, account_kind, partner_id, entry_type, amount, available_at, debt_id, event_id, source_key, description)
        VALUES (NEW.owner_id, NEW.account_kind, NEW.partner_id, 'COMPENSATION_CREANCE', -v_take, NEW.available_at, v_debt.id, NEW.event_id,
                'COMP-' || NEW.id::text || '-' || v_debt.id::text, 'Compensation de créance : ' || v_debt.reason);
        UPDATE public.finance_debts
           SET remaining = remaining - v_take,
               settled_at = CASE WHEN remaining - v_take = 0 THEN now() ELSE NULL END
         WHERE id = v_debt.id;
        v_left := v_left - v_take;
    END LOOP;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_ledger_compensate ON public.finance_ledger;
CREATE TRIGGER trg_finance_ledger_compensate
    AFTER INSERT ON public.finance_ledger
    FOR EACH ROW WHEN (NEW.amount > 0)
    EXECUTE FUNCTION public.fin_ledger_compensate();

-- ── VENTE : crédit organisateur à la confirmation d'un paiement plateforme ──
CREATE OR REPLACE FUNCTION public.fin_payment_sale_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
BEGIN
    IF NEW.status <> 'SUCCESS' THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'SUCCESS' THEN
            RETURN NULL;
        END IF;
    END IF;
    IF NOT NEW.is_platform_payment OR NEW.payment_target = 'SUBSCRIPTION' OR NEW.partner_id IS NULL
       OR COALESCE(NEW.partner_payout_amount, 0) <= 0 THEN
        RETURN NULL;
    END IF;
    SELECT user_id INTO v_owner FROM public.partners WHERE id = NEW.partner_id;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'fin_payment_sale_credit : partenaire % introuvable', NEW.partner_id;
    END IF;
    PERFORM public.fin_ledger_credit(
        v_owner, 'ORGANISATEUR', NEW.partner_id, 'VENTE', NEW.partner_payout_amount,
        public.fin_payout_available_at(NEW.id),
        jsonb_build_object('payment_id', NEW.id, 'event_id', NEW.event_id),
        'VENTE-' || NEW.id::text,
        format('Vente en ligne %s (%s)', NEW.transaction_id, NEW.payment_target));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_sale_credit ON public.payments;
CREATE TRIGGER trg_payments_sale_credit
    AFTER INSERT OR UPDATE OF status ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fin_payment_sale_credit();

-- ── Solde d'un compte ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_account_balance(p_owner uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available numeric;
    v_pending numeric;
    v_next timestamptz;
    v_in_progress numeric;
    v_debt numeric;
BEGIN
    IF p_kind NOT IN ('ORGANISATEUR', 'PARRAINAGE') THEN
        RAISE EXCEPTION 'finance_account_balance : compte % inconnu', p_kind;
    END IF;
    SELECT COALESCE(sum(amount) FILTER (WHERE available_at <= now()), 0),
           COALESCE(sum(amount) FILTER (WHERE available_at > now()), 0),
           min(available_at) FILTER (WHERE available_at > now() AND amount > 0)
      INTO v_available, v_pending, v_next
      FROM public.finance_ledger WHERE owner_id = p_owner AND account_kind = p_kind;
    SELECT COALESCE(sum(net_amount), 0) INTO v_in_progress
      FROM public.withdrawals WHERE user_id = p_owner AND account_kind = p_kind AND status IN ('PENDING', 'PROCESSING');
    SELECT COALESCE(sum(remaining), 0) INTO v_debt
      FROM public.finance_debts WHERE owner_id = p_owner AND account_kind = p_kind;
    RETURN jsonb_build_object(
        'account_kind', p_kind,
        'available', v_available,
        'pending', v_pending,
        'next_available_at', v_next,
        'in_progress', v_in_progress,
        'debt', v_debt,
        'withdrawable', public.fin_round_down(GREATEST(v_available, 0)));
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_account_lock(uuid, text)',
        'public.fin_alert_superadmins(text, text, text, text, uuid, jsonb)',
        'public.fin_event_end(uuid)',
        'public.fin_payout_available_at(uuid)',
        'public.fin_ledger_credit(uuid, text, uuid, text, numeric, timestamptz, jsonb, text, text)',
        'public.fin_ledger_debit(uuid, text, uuid, text, numeric, timestamptz, jsonb, text, text)',
        'public.fin_ledger_compensate()',
        'public.fin_payment_sale_credit()',
        'public.finance_account_balance(uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

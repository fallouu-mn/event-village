-- ============================================================================
-- EVENT VILLAGE — Finition 3a (argent de l'administration), points 2 et 3 : les trois chiffres (E-06, E-38), le détail
-- de chacun et la liste paginée des paiements (E-30), en une seule source de calcul
-- ============================================================================
-- Fonctions (SECURITY DEFINER, search_path = public, STABLE ; service_role seul ; lues par les routes
-- /api/admin/finance/*, /api/admin/metrics et l'accueil de l'administration) :
--   finance_admin_earned(p_from, p_to)   « Gagné par Event Village » sur une période [p_from, p_to[ (bornes NULL : sans
--                                         limite), composante par composante ;
--   finance_admin_summary(p_from, p_to)  « gagné » de la période + chiffres à l'instant : dû aux partenaires, dû aux
--                                         parrains, créances, remboursements à verser, réserve de prudence ;
--   finance_admin_payments(p)            paiements encaissés de la période, filtre de statut, pages ;
--   finance_admin_debts(p)               créances ouvertes (qui, combien, pourquoi), pages ;
--   finance_admin_refunds_to_pay(p)      remboursements pas encore versés (demandés, en cours, incertains, échoués), pages ;
--   finance_admin_owed(p)                dû par compte (partenaires ou parrains), pages.
--
-- « Gagné par Event Village » (période ; une date par nature d'opération) =
--     Σ paiements plateforme encaissés (SUCCESS, PARTIAL, REFUNDED, REFUND_PENDING ; date COALESCE(paid_at, created_at))
--         de (net_event_village_revenue − refunded_net_revenue + retenue d'un paiement en double)
--         [net = frais de service − frais d'encaissement SamirPay estimés au taux des réglages : SamirPay ne les fournit
--          pas ; refunded_net_revenue = part annulée par les remboursements demandés : les frais de service entiers si
--          Event Village garde les frais d'agrégateur, les frais moins cette part sinon (fin_refund_apply)]
--   − Σ commissions de parrainage de ces paiements (annulées exclues, régularisations négatives comprises)
--   − Σ reste des créances PARRAINAGE ouvertes sur ces paiements (commission reprise mais pas encore récupérée)
--   + Σ frais de retrait des retraits versés (date du versement : processed_at)
--   − Σ frais réels SamirPay des versements confirmés (date de confirmation : confirmed_at)
--   + Σ frais repris aux partenaires sur ces versements (écriture CASHOUT_FEE au grand livre, ou part déjà récupérée de
--     la créance CASHOUT_FEE…-CREANCE ; cashout_fee_apply, 20261110000005)
-- Aucun montant n'est compté deux fois : chaque composante lit une seule table ou une seule clé ; les commissions et les
-- créances sont lues par paiement (sous-requêtes agrégées, aucune jointure qui multiplierait les paiements).
--
-- Chiffres à l'instant :
--   dû aux partenaires = Σ grand livre ORGANISATEUR (le solde d'un compte n'est jamais négatif : un débit au-delà devient
--                        une créance, fin_ledger_debit) + Σ net des retraits PENDING ou PROCESSING ;
--   dû aux parrains    = même calcul pour PARRAINAGE ;
--   créances           = Σ reste des créances ouvertes (bloc à part, jamais soustrait) ;
--   remboursements à verser = Σ versements de remboursement non confirmés (A_ENVOYER, ENVOYE, INCERTAIN, ECHOUE) ;
--   réserve de prudence = encaissements des 3 derniers jours (finance.safety_reserve_mode = AUTO_3_DAYS) ou montant
--                        fixe (FIXED, finance.safety_reserve_amount).
-- « Retirable par Event Village » = max(0, solde SamirPay − dû aux partenaires − dû aux parrains − remboursements à
-- verser − réserve) est calculé par le serveur (lib/finance/admin-summary.ts), qui seul lit le solde SamirPay.
--
-- Index de lecture (dates de chaque nature). Aucune donnée modifiée. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_platform_encashed_at
    ON public.payments ((COALESCE(paid_at, created_at))) WHERE is_platform_payment;
CREATE INDEX IF NOT EXISTS idx_cashouts_confirmed_at ON public.cashouts (confirmed_at) WHERE status = 'CONFIRME';
CREATE INDEX IF NOT EXISTS idx_cashouts_refunds_open ON public.cashouts (created_at)
    WHERE kind <> 'WITHDRAWAL' AND status <> 'CONFIRME';
CREATE INDEX IF NOT EXISTS idx_withdrawals_paid_processed_at ON public.withdrawals (processed_at) WHERE status = 'PAID';
CREATE INDEX IF NOT EXISTS idx_finance_debts_open_created ON public.finance_debts (created_at) WHERE remaining > 0;


-- ----------------------------------------------------------------------------
-- 1. finance_admin_earned : « Gagné par Event Village » sur [p_from, p_to[
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_admin_earned(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay record;
    v_comm numeric;
    v_comm_unrecovered numeric;
    v_wfees numeric;
    v_wcount integer;
    v_cfees numeric;
    v_ccount integer;
    v_rebilled numeric;
    v_service_net numeric;
BEGIN
    IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to <= p_from THEN
        RAISE EXCEPTION 'finance_admin_earned : période vide ou inversée (% → %)', p_from, p_to USING ERRCODE = '22023';
    END IF;

    -- Paiements plateforme encaissés de la période, et ce qui revient à Event Village sur chacun
    SELECT count(*)::integer AS n,
           COALESCE(sum(p.amount), 0) AS volume,
           COALESCE(sum(COALESCE(p.service_fee, 0)), 0) AS service_fees,
           COALESCE(sum(COALESCE(p.aggregator_fee, 0)), 0) AS aggregator_fees,
           COALESCE(sum(COALESCE(p.net_event_village_revenue, 0)), 0) AS net_revenue,
           COALESCE(sum(COALESCE(p.refunded_net_revenue, 0)), 0) AS refunded_net,
           COALESCE(sum(COALESCE(NULLIF(p.metadata->>'duplicate_fee_withheld', '')::numeric, 0)), 0) AS withheld,
           COALESCE(sum((SELECT COALESCE(sum(rc.amount), 0) FROM public.referral_commissions rc
                          WHERE rc.payment_id = p.id AND rc.status::text <> 'CANCELLED')), 0) AS commissions,
           COALESCE(sum((SELECT COALESCE(sum(d.remaining), 0) FROM public.finance_debts d
                          WHERE d.payment_id = p.id AND d.account_kind = 'PARRAINAGE' AND d.remaining > 0)), 0) AS comm_unrecovered
      INTO v_pay
      FROM public.payments p
     WHERE p.is_platform_payment
       AND p.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING')
       AND (p_from IS NULL OR COALESCE(p.paid_at, p.created_at) >= p_from)
       AND (p_to IS NULL OR COALESCE(p.paid_at, p.created_at) < p_to);
    v_comm := v_pay.commissions;
    v_comm_unrecovered := v_pay.comm_unrecovered;
    v_service_net := v_pay.net_revenue - v_pay.refunded_net + v_pay.withheld;

    -- Frais de retrait des retraits versés de la période
    SELECT count(*)::integer, COALESCE(sum(w.fee_amount), 0) INTO v_wcount, v_wfees
      FROM public.withdrawals w
     WHERE w.status::text = 'PAID'
       AND (p_from IS NULL OR COALESCE(w.processed_at, w.updated_at) >= p_from)
       AND (p_to IS NULL OR COALESCE(w.processed_at, w.updated_at) < p_to);

    -- Frais réels SamirPay des versements confirmés de la période, et part reprise aux partenaires
    SELECT count(*)::integer, COALESCE(sum(c.samirpay_fees), 0) INTO v_ccount, v_cfees
      FROM public.cashouts c
     WHERE c.status = 'CONFIRME' AND c.samirpay_fees IS NOT NULL
       AND (p_from IS NULL OR COALESCE(c.confirmed_at, c.updated_at) >= p_from)
       AND (p_to IS NULL OR COALESCE(c.confirmed_at, c.updated_at) < p_to);
    SELECT COALESCE(sum(
               COALESCE((SELECT -sum(l.amount) FROM public.finance_ledger l
                          WHERE l.source_key = 'CASHOUT_FEE-' || c.id::text AND l.entry_type = 'REGULARISATION'), 0)
             + COALESCE((SELECT sum(d.amount - d.remaining) FROM public.finance_debts d
                          WHERE d.source_key = 'CASHOUT_FEE-' || c.id::text || '-CREANCE'), 0)), 0)
      INTO v_rebilled
      FROM public.cashouts c
     WHERE c.status = 'CONFIRME'
       AND (p_from IS NULL OR COALESCE(c.confirmed_at, c.updated_at) >= p_from)
       AND (p_to IS NULL OR COALESCE(c.confirmed_at, c.updated_at) < p_to);

    RETURN jsonb_build_object(
        'from', p_from, 'to', p_to,
        'total', v_service_net + v_wfees - v_cfees - v_comm - v_comm_unrecovered + v_rebilled,
        'payments', v_pay.n,
        'volume', v_pay.volume,
        'service_fees', v_pay.service_fees,
        'aggregator_fees', v_pay.aggregator_fees,
        'net_revenue', v_pay.net_revenue,
        'refunded_net', v_pay.refunded_net,
        'duplicate_withheld', v_pay.withheld,
        'service_net', v_service_net,
        'commissions', v_comm,
        'commissions_unrecovered', v_comm_unrecovered,
        'withdrawal_fees', v_wfees,
        'withdrawals_paid', v_wcount,
        'samirpay_fees', v_cfees,
        'cashouts_with_fees', v_ccount,
        'rebilled', v_rebilled);
END;
$$;

COMMENT ON FUNCTION public.finance_admin_earned(timestamptz, timestamptz) IS
    'Finition 3a (E-06, E-30) : « Gagné par Event Village » sur [p_from, p_to[ (NULL : sans borne) — frais de service nets des remboursements et des frais d''encaissement estimés, + frais de retrait versés, − frais réels SamirPay des versements confirmés, − commissions de parrainage (et part reprise non récupérée), + frais repris aux partenaires. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_admin_earned(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_admin_earned(timestamptz, timestamptz) TO service_role;


-- ----------------------------------------------------------------------------
-- 2. finance_admin_summary : « gagné » de la période + chiffres à l'instant
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_admin_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_earned jsonb := public.finance_admin_earned(p_from, p_to);
    v_acc record;
    v_owed jsonb := '{}'::jsonb;
    v_kind text;
    v_w record;
    v_debts record;
    v_refunds record;
    v_mode text;
    v_fixed numeric;
    v_auto numeric;
BEGIN
    FOREACH v_kind IN ARRAY ARRAY['ORGANISATEUR', 'PARRAINAGE'] LOOP
        WITH acc AS (
            SELECT l.owner_id,
                   sum(l.amount) AS total,
                   COALESCE(sum(l.amount) FILTER (WHERE l.available_at <= now()), 0) AS available,
                   COALESCE(sum(l.amount) FILTER (WHERE l.available_at > now()), 0) AS pending
              FROM public.finance_ledger l
             WHERE l.account_kind = v_kind
             GROUP BY l.owner_id
        ), fr AS (
            SELECT a.*, public.fin_frozen_amount(a.owner_id, v_kind, now()) AS frozen FROM acc a
        )
        SELECT COALESCE(sum(fr.total), 0) AS ledger,
               COALESCE(sum(fr.available), 0) AS available,
               COALESCE(sum(fr.pending), 0) AS pending,
               COALESCE(sum(fr.frozen), 0) AS frozen,
               COALESCE(sum(public.fin_round_down(GREATEST(fr.available - fr.frozen, 0))), 0) AS withdrawable,
               count(*) FILTER (WHERE fr.total > 0)::integer AS accounts
          INTO v_acc FROM fr;
        SELECT COALESCE(sum(w.net_amount), 0) AS net, count(*)::integer AS n INTO v_w
          FROM public.withdrawals w
         WHERE w.account_kind = v_kind AND w.status::text IN ('PENDING', 'PROCESSING');
        v_owed := v_owed || jsonb_build_object(v_kind, jsonb_build_object(
            'total', v_acc.ledger + v_w.net,
            'ledger', v_acc.ledger,
            'available', v_acc.available,
            'pending', v_acc.pending,
            'frozen', v_acc.frozen,
            'withdrawable_now', v_acc.withdrawable,
            'withdrawals_in_progress', v_w.net,
            'withdrawals_in_progress_count', v_w.n,
            'accounts', v_acc.accounts));
    END LOOP;

    SELECT COALESCE(sum(d.remaining), 0) AS total, count(*)::integer AS n,
           COALESCE(sum(d.remaining) FILTER (WHERE d.account_kind = 'ORGANISATEUR'), 0) AS partners_total,
           count(*) FILTER (WHERE d.account_kind = 'ORGANISATEUR')::integer AS partners_count,
           COALESCE(sum(d.remaining) FILTER (WHERE d.account_kind = 'PARRAINAGE'), 0) AS referrers_total,
           count(*) FILTER (WHERE d.account_kind = 'PARRAINAGE')::integer AS referrers_count
      INTO v_debts
      FROM public.finance_debts d WHERE d.remaining > 0;

    SELECT COALESCE(sum(c.amount), 0) AS total, count(*)::integer AS n,
           count(*) FILTER (WHERE c.status = 'ECHOUE')::integer AS failed,
           count(*) FILTER (WHERE c.status = 'INCERTAIN')::integer AS uncertain
      INTO v_refunds
      FROM public.cashouts c
     WHERE c.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND')
       AND c.status IN ('A_ENVOYER', 'ENVOYE', 'INCERTAIN', 'ECHOUE');

    v_mode := public.fin_setting_text('finance.safety_reserve_mode');
    v_fixed := public.fin_setting_num('finance.safety_reserve_amount');
    SELECT COALESCE(sum(p.amount), 0) INTO v_auto
      FROM public.payments p
     WHERE p.is_platform_payment
       AND p.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING')
       AND COALESCE(p.paid_at, p.created_at) >= now() - interval '3 days';

    RETURN jsonb_build_object(
        'computed_at', now(),
        'earned', v_earned,
        'owed_partners', v_owed->'ORGANISATEUR',
        'owed_referrers', v_owed->'PARRAINAGE',
        'debts', jsonb_build_object('total', v_debts.total, 'count', v_debts.n,
                                    'partners_total', v_debts.partners_total, 'partners_count', v_debts.partners_count,
                                    'referrers_total', v_debts.referrers_total, 'referrers_count', v_debts.referrers_count),
        'refunds_to_pay', jsonb_build_object('total', v_refunds.total, 'count', v_refunds.n,
                                             'failed', v_refunds.failed, 'uncertain', v_refunds.uncertain),
        'reserve', jsonb_build_object('mode', v_mode,
                                      'amount', CASE WHEN v_mode = 'FIXED' THEN v_fixed ELSE v_auto END,
                                      'auto_amount', v_auto, 'fixed_amount', v_fixed, 'window_hours', 72));
END;
$$;

COMMENT ON FUNCTION public.finance_admin_summary(timestamptz, timestamptz) IS
    'Finition 3a (E-06, E-38) : synthèse de l''administration — gagné sur [p_from, p_to[ (finance_admin_earned) et, à l''instant, dû aux partenaires et aux parrains (grand livre + net des retraits en cours), créances ouvertes, remboursements à verser, réserve de prudence. Le retirable est calculé par le serveur avec le solde SamirPay. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_admin_summary(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_admin_summary(timestamptz, timestamptz) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. finance_admin_payments : paiements encaissés de la période, filtre de statut, pages (E-30)
--    p = { from, to, status: ALL | SUCCESS | PARTIAL | REFUND_PENDING | REFUNDED, limit (1..100, 20), offset (≥ 0) }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_admin_payments(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from timestamptz := NULLIF(p->>'from', '')::timestamptz;
    v_to timestamptz := NULLIF(p->>'to', '')::timestamptz;
    v_status text := COALESCE(NULLIF(p->>'status', ''), 'ALL');
    v_limit integer := LEAST(GREATEST(COALESCE(NULLIF(p->>'limit', '')::integer, 20), 1), 100);
    v_offset integer := GREATEST(COALESCE(NULLIF(p->>'offset', '')::integer, 0), 0);
    v_statuses text[];
    v_total integer;
    v_items jsonb;
BEGIN
    IF v_status = 'ALL' THEN
        v_statuses := ARRAY['SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING'];
    ELSIF v_status IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING') THEN
        v_statuses := ARRAY[v_status];
    ELSE
        RAISE EXCEPTION 'finance_admin_payments : statut % inconnu', v_status USING ERRCODE = '22023';
    END IF;
    IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_to <= v_from THEN
        RAISE EXCEPTION 'finance_admin_payments : période vide ou inversée (% → %)', v_from, v_to USING ERRCODE = '22023';
    END IF;

    SELECT count(*)::integer INTO v_total
      FROM public.payments py
     WHERE py.is_platform_payment AND py.status::text = ANY (v_statuses)
       AND (v_from IS NULL OR COALESCE(py.paid_at, py.created_at) >= v_from)
       AND (v_to IS NULL OR COALESCE(py.paid_at, py.created_at) < v_to);

    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.at DESC, x.id), '[]'::jsonb) INTO v_items
      FROM (
        SELECT py.id, COALESCE(py.paid_at, py.created_at) AS at,
               jsonb_build_object(
                   'id', py.id,
                   'reference', COALESCE(py.external_transaction_id, py.transaction_id),
                   'target', py.payment_target::text,
                   'operator', py.operator,
                   'status', py.status::text,
                   'encashed_at', COALESCE(py.paid_at, py.created_at),
                   'amount', py.amount,
                   'facial_amount', py.facial_amount,
                   'service_fee', COALESCE(py.service_fee, 0),
                   'aggregator_fee', COALESCE(py.aggregator_fee, 0),
                   'partner_payout', COALESCE(py.partner_payout_amount, 0),
                   'net_revenue', COALESCE(py.net_event_village_revenue, 0),
                   'refunded_net', COALESCE(py.refunded_net_revenue, 0),
                   'refunded_amount', COALESCE(py.refunded_amount, 0),
                   'duplicate_withheld', COALESCE(NULLIF(py.metadata->>'duplicate_fee_withheld', '')::numeric, 0),
                   'commissions', (SELECT COALESCE(sum(rc.amount), 0) FROM public.referral_commissions rc
                                    WHERE rc.payment_id = py.id AND rc.status::text <> 'CANCELLED'),
                   'event_title', e.title,
                   -- écart de contrôle : total ≠ part du partenaire + frais de service, ou frais de service ≠ agrégateur + net
                   'discrepancy', abs(py.amount - (COALESCE(py.partner_payout_amount, 0) + COALESCE(py.gross_event_village_revenue, 0)))
                                + abs(COALESCE(py.gross_event_village_revenue, 0)
                                      - (COALESCE(py.net_event_village_revenue, 0) + COALESCE(py.aggregator_fee, 0)))
               ) AS item
          FROM public.payments py
          LEFT JOIN public.events e ON e.id = py.event_id
         WHERE py.is_platform_payment AND py.status::text = ANY (v_statuses)
           AND (v_from IS NULL OR COALESCE(py.paid_at, py.created_at) >= v_from)
           AND (v_to IS NULL OR COALESCE(py.paid_at, py.created_at) < v_to)
         ORDER BY COALESCE(py.paid_at, py.created_at) DESC, py.id
         LIMIT v_limit OFFSET v_offset
      ) x;

    RETURN jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'items', v_items);
END;
$$;

COMMENT ON FUNCTION public.finance_admin_payments(jsonb) IS
    'Finition 3a (E-30) : paiements plateforme encaissés de la période (date COALESCE(paid_at, created_at)), filtre de statut limité à cette liste, pages de 1 à 100 lignes (20 par défaut), du plus récent au plus ancien. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_admin_payments(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_admin_payments(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- 4. finance_admin_debts : créances ouvertes, de la plus ancienne à la plus récente (E-38)
--    p = { limit (1..100, 20), offset }
--    nature : FRAIS_REMBOURSEMENT (frais SamirPay d'un remboursement repris à la partenaire), COMMISSION (commission de
--    parrainage reprise après un remboursement), REMBOURSEMENT (remboursement avancé par Event Village), AUTRE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_admin_debts(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer := LEAST(GREATEST(COALESCE(NULLIF(p->>'limit', '')::integer, 20), 1), 100);
    v_offset integer := GREATEST(COALESCE(NULLIF(p->>'offset', '')::integer, 0), 0);
    v_total integer;
    v_amount numeric;
    v_items jsonb;
BEGIN
    SELECT count(*)::integer, COALESCE(sum(d.remaining), 0) INTO v_total, v_amount
      FROM public.finance_debts d WHERE d.remaining > 0;

    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.created_at, x.id), '[]'::jsonb) INTO v_items
      FROM (
        SELECT d.id, d.created_at,
               jsonb_build_object(
                   'id', d.id,
                   'account_kind', d.account_kind,
                   'amount', d.amount,
                   'remaining', d.remaining,
                   'created_at', d.created_at,
                   'owner_id', d.owner_id,
                   'first_name', u.first_name,
                   'last_name', u.last_name,
                   'company_name', (SELECT pa.company_name FROM public.partners pa
                                     WHERE pa.user_id = d.owner_id AND d.account_kind = 'ORGANISATEUR'
                                     ORDER BY pa.created_at LIMIT 1),
                   'nature', CASE WHEN d.source_key LIKE 'CASHOUT\_FEE-%' THEN 'FRAIS_REMBOURSEMENT'
                                  WHEN d.account_kind = 'PARRAINAGE' THEN 'COMMISSION'
                                  WHEN d.refund_id IS NOT NULL THEN 'REMBOURSEMENT'
                                  ELSE 'AUTRE' END,
                   'event_title', (SELECT e.title FROM public.payments py JOIN public.events e ON e.id = py.event_id
                                    WHERE py.id = COALESCE(d.payment_id, (SELECT r.payment_id FROM public.refunds r WHERE r.id = d.refund_id)))
               ) AS item
          FROM public.finance_debts d
          JOIN public.users u ON u.id = d.owner_id
         WHERE d.remaining > 0
         ORDER BY d.created_at, d.id
         LIMIT v_limit OFFSET v_offset
      ) x;

    RETURN jsonb_build_object('total', v_total, 'amount', v_amount, 'limit', v_limit, 'offset', v_offset, 'items', v_items);
END;
$$;

COMMENT ON FUNCTION public.finance_admin_debts(jsonb) IS
    'Finition 3a (E-38) : créances ouvertes (reste dû > 0), qui doit quoi et pourquoi, de la plus ancienne à la plus récente, par pages. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_admin_debts(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_admin_debts(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- 5. finance_admin_refunds_to_pay : remboursements pas encore versés, du plus ancien au plus récent
--    p = { limit (1..100, 20), offset }. Le numéro est rendu au serveur, qui le masque avant l'écran.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_admin_refunds_to_pay(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer := LEAST(GREATEST(COALESCE(NULLIF(p->>'limit', '')::integer, 20), 1), 100);
    v_offset integer := GREATEST(COALESCE(NULLIF(p->>'offset', '')::integer, 0), 0);
    v_total integer;
    v_amount numeric;
    v_items jsonb;
BEGIN
    SELECT count(*)::integer, COALESCE(sum(c.amount), 0) INTO v_total, v_amount
      FROM public.cashouts c
     WHERE c.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND')
       AND c.status IN ('A_ENVOYER', 'ENVOYE', 'INCERTAIN', 'ECHOUE');

    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.created_at, x.id), '[]'::jsonb) INTO v_items
      FROM (
        SELECT c.id, c.created_at,
               jsonb_build_object(
                   'id', c.id,
                   'kind', c.kind,
                   'status', c.status,
                   'blocked_reason', c.blocked_reason,
                   'not_sent', c.not_sent_at IS NOT NULL,
                   'created_at', c.created_at,
                   'sent_at', c.sent_at,
                   'amount', c.amount,
                   'operator', c.operator,
                   'phone_number', c.phone_number,
                   'first_name', c.first_name,
                   'last_name', c.last_name,
                   'event_title', (SELECT e.title FROM public.events e
                                    WHERE e.id = COALESCE((SELECT t.event_id FROM public.tickets t WHERE t.id = c.ticket_id),
                                                          (SELECT py.event_id FROM public.payments py WHERE py.id = c.payment_id)))
               ) AS item
          FROM public.cashouts c
         WHERE c.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND')
           AND c.status IN ('A_ENVOYER', 'ENVOYE', 'INCERTAIN', 'ECHOUE')
         ORDER BY c.created_at, c.id
         LIMIT v_limit OFFSET v_offset
      ) x;

    RETURN jsonb_build_object('total', v_total, 'amount', v_amount, 'limit', v_limit, 'offset', v_offset, 'items', v_items);
END;
$$;

COMMENT ON FUNCTION public.finance_admin_refunds_to_pay(jsonb) IS
    'Finition 3a (E-07) : remboursements demandés et pas encore versés (versements A_ENVOYER, ENVOYE, INCERTAIN, ECHOUE ; retraits exclus), du plus ancien au plus récent, par pages. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_admin_refunds_to_pay(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_admin_refunds_to_pay(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- 6. finance_admin_owed : dû par compte, du plus grand au plus petit
--    p = { kind: ORGANISATEUR | PARRAINAGE, limit (1..100, 20), offset }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_admin_owed(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kind text := COALESCE(NULLIF(p->>'kind', ''), 'ORGANISATEUR');
    v_limit integer := LEAST(GREATEST(COALESCE(NULLIF(p->>'limit', '')::integer, 20), 1), 100);
    v_offset integer := GREATEST(COALESCE(NULLIF(p->>'offset', '')::integer, 0), 0);
    v_total integer;
    v_items jsonb;
BEGIN
    IF v_kind NOT IN ('ORGANISATEUR', 'PARRAINAGE') THEN
        RAISE EXCEPTION 'finance_admin_owed : compte % inconnu', v_kind USING ERRCODE = '22023';
    END IF;

    WITH acc AS (
        SELECT o.owner_id,
               COALESCE((SELECT sum(l.amount) FROM public.finance_ledger l
                          WHERE l.owner_id = o.owner_id AND l.account_kind = v_kind), 0) AS ledger,
               COALESCE((SELECT sum(l.amount) FROM public.finance_ledger l
                          WHERE l.owner_id = o.owner_id AND l.account_kind = v_kind AND l.available_at <= now()), 0) AS available,
               COALESCE((SELECT sum(w.net_amount) FROM public.withdrawals w
                          WHERE w.user_id = o.owner_id AND w.account_kind = v_kind
                            AND w.status::text IN ('PENDING', 'PROCESSING')), 0) AS in_progress
          FROM (SELECT DISTINCT l.owner_id FROM public.finance_ledger l WHERE l.account_kind = v_kind
                UNION
                SELECT DISTINCT w.user_id FROM public.withdrawals w
                 WHERE w.account_kind = v_kind AND w.status::text IN ('PENDING', 'PROCESSING')) o
    ), owners AS (
        SELECT a.*, a.ledger + a.in_progress AS total,
               public.fin_frozen_amount(a.owner_id, v_kind, now()) AS frozen
          FROM acc a
         WHERE a.ledger + a.in_progress > 0
    )
    SELECT (SELECT count(*)::integer FROM owners),
           COALESCE((SELECT jsonb_agg(x.item ORDER BY x.total DESC, x.owner_id) FROM (
               SELECT r.owner_id, r.total,
                      jsonb_build_object(
                          'owner_id', r.owner_id,
                          'first_name', u.first_name,
                          'last_name', u.last_name,
                          'company_name', (SELECT pa.company_name FROM public.partners pa
                                            WHERE pa.user_id = r.owner_id AND v_kind = 'ORGANISATEUR'
                                            ORDER BY pa.created_at LIMIT 1),
                          'total', r.total,
                          'ledger', r.ledger,
                          'available', r.available,
                          'pending', r.ledger - r.available,
                          'frozen', r.frozen,
                          'withdrawable_now', public.fin_round_down(GREATEST(r.available - r.frozen, 0)),
                          'withdrawals_in_progress', r.in_progress
                      ) AS item
                 FROM owners r JOIN public.users u ON u.id = r.owner_id
                ORDER BY r.total DESC, r.owner_id
                LIMIT v_limit OFFSET v_offset) x), '[]'::jsonb)
      INTO v_total, v_items;

    RETURN jsonb_build_object('kind', v_kind, 'total', v_total, 'limit', v_limit, 'offset', v_offset, 'items', v_items);
END;
$$;

COMMENT ON FUNCTION public.finance_admin_owed(jsonb) IS
    'Finition 3a (E-06) : dû par compte (partenaires ou parrains) — solde du grand livre et net des retraits en cours, dont retirable aujourd''hui, en attente, gelé — du plus grand au plus petit, par pages. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_admin_owed(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_admin_owed(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- 7. finance_admin_waiting : bloc « Argent qui attend » de l'accueil de l'administration (E-07)
--    Versements à reprendre : même liste que GET /api/admin/refunds?state=to_retry (cashouts_to_resume, filtrée sur le mode
--    du serveur, plus les paiements en échec sans identifiant SamirPay de moins de p_unconfirmed_hours heures) ;
--    remboursements à verser et créances : mêmes règles que finance_admin_summary. Les droits de chaque ligne sont
--    appliqués par la route (refunds.manage, payments.read).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_admin_waiting(p_simulated boolean, p_unconfirmed_hours integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_resume record;
    v_unconfirmed record;
    v_refunds record;
    v_debts record;
BEGIN
    SELECT count(*)::integer AS n, COALESCE(sum(c.amount), 0) AS amount INTO v_resume
      FROM public.cashouts_to_resume() r
      JOIN public.cashouts c ON c.id = r.id
     WHERE r.simulated = COALESCE(p_simulated, FALSE);
    SELECT count(*)::integer AS n, COALESCE(sum(p.amount), 0) AS amount INTO v_unconfirmed
      FROM public.payments p
     WHERE p.status::text = 'FAILED' AND p.external_transaction_id IS NULL
       AND p.created_at > now() - make_interval(hours => GREATEST(COALESCE(p_unconfirmed_hours, 48), 1));
    SELECT count(*)::integer AS n, COALESCE(sum(c.amount), 0) AS amount INTO v_refunds
      FROM public.cashouts c
     WHERE c.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND')
       AND c.status IN ('A_ENVOYER', 'ENVOYE', 'INCERTAIN', 'ECHOUE');
    SELECT count(*)::integer AS n, COALESCE(sum(d.remaining), 0) AS amount INTO v_debts
      FROM public.finance_debts d WHERE d.remaining > 0;

    RETURN jsonb_build_object(
        'to_resume', jsonb_build_object('count', v_resume.n + v_unconfirmed.n, 'amount', v_resume.amount + v_unconfirmed.amount,
                                        'cashouts', v_resume.n, 'unconfirmed_payments', v_unconfirmed.n),
        'refunds_to_pay', jsonb_build_object('count', v_refunds.n, 'amount', v_refunds.amount),
        'debts', jsonb_build_object('count', v_debts.n, 'amount', v_debts.amount));
END;
$$;

COMMENT ON FUNCTION public.finance_admin_waiting(boolean, integer) IS
    'Finition 3a (E-07) : nombres et montants du bloc « Argent qui attend » (versements à reprendre, remboursements à verser, créances), mêmes règles que les listes de la page Finance. service_role uniquement.';
REVOKE ALL ON FUNCTION public.finance_admin_waiting(boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_admin_waiting(boolean, integer) TO service_role;

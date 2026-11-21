-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 08 : commission d'Event Village sur une commande dans les relevés
-- ============================================================================
-- Comme pour les tables (lot 11a, migration 09) : avec une commission sur une commande (réglage orders.commission_rate
-- > 0, 0 % au lancement), reversement = part payée en ligne − commission, brut Event Village = frais de service +
-- commission (metadata.commission_amount, posée par order_payment_create). Sans cela, les relevés l'ignoraient.
--  1. finance_admin_earned : recopie de 20261123000109_l11a_releves.sql:17-108 ; changement : la composante hall_commissions (nom gardé pour
--     l'écran) compte aussi les commissions des commandes ;
--  2. finance_admin_payments : recopie de 20261123000109_l11a_releves.sql:111-194 ; changement : champ commission et écart de contrôle étendus
--     aux commandes.
-- L'invariant (d) des suites (tests/helpers/finance-invariants.ts) est étendu de même. Aucune donnée modifiée.
-- Rejouable : CREATE OR REPLACE.
-- ============================================================================

-- Recopie de 20261123000109_l11a_releves.sql:17-108 ; changement : commissions des commandes comprises.
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
           -- Correctifs de la contre-vérification du lot 10a (T6) : commissions des salles (comprises dans net_revenue)
           -- Lot 12a : et des commandes
           COALESCE(sum(CASE WHEN p.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER')
                             THEN COALESCE(NULLIF(p.metadata->>'commission_amount', '')::numeric, 0) ELSE 0 END), 0) AS hall_commissions,
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
        'hall_commissions', v_pay.hall_commissions,
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


-- Recopie de 20261123000109_l11a_releves.sql:111-194 ; changement : commission d'une commande.
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
                   -- Correctifs de la contre-vérification du lot 10a (T6) : commission d'Event Village sur une salle
                   -- Lot 12a : et sur une commande
                   'commission', CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER')
                                      THEN COALESCE(NULLIF(py.metadata->>'commission_amount', '')::numeric, 0) ELSE 0 END,
                   'commissions', (SELECT COALESCE(sum(rc.amount), 0) FROM public.referral_commissions rc
                                    WHERE rc.payment_id = py.id AND rc.status::text <> 'CANCELLED'),
                   'event_title', e.title,
                   -- écart de contrôle : total ≠ part du partenaire + frais de service, ou frais de service ≠ agrégateur + net
                   'discrepancy', abs(py.amount - (COALESCE(py.partner_payout_amount, 0) + COALESCE(py.gross_event_village_revenue, 0)))
                                + abs(COALESCE(py.gross_event_village_revenue, 0)
                                      - (COALESCE(py.net_event_village_revenue, 0) + COALESCE(py.aggregator_fee, 0)))
                                -- Correctifs de la contre-vérification du lot 10a (T6) : salle, reversement = facial − commission
                                -- et brut = frais de service + commission
                                + CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER') AND py.facial_amount IS NOT NULL THEN
                                      abs(COALESCE(py.partner_payout_amount, 0)
                                          - (py.facial_amount - COALESCE(NULLIF(py.metadata->>'commission_amount', '')::numeric, 0)))
                                    + abs(COALESCE(py.gross_event_village_revenue, 0)
                                          - (COALESCE(py.service_fee, 0) + COALESCE(NULLIF(py.metadata->>'commission_amount', '')::numeric, 0)))
                                  ELSE 0 END
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


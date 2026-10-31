-- ============================================================================
-- EVENT VILLAGE — LOT 3 : synthèse financière des rapports (3.3, 3.8)
-- ============================================================================
-- finance_partner_summary : source unique du rapport de clôture (et de son PDF), de l'export
-- comptable et de la page finance partenaire, lue dans le grand livre :
--   net organisateur = Σ écritures VENTE + REMBOURSEMENT (le remboursement n'est déduit qu'une fois) ;
--   frais de service payés par l'acheteur = Σ frais des billets en ligne non remboursés (informatif,
--   jamais déduit de l'organisateur) ;
--   ventes espèces = Σ prix des billets payés hors plateforme (informatif : ni frais ni revenu EV,
--   jamais dans le solde retirable).
-- Optionnellement restreinte à un événement.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finance_partner_summary(p_partner_id uuid, p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ledger record;
    v_by_target jsonb;
    v_fees numeric;
    v_cash numeric;
    v_cash_count integer;
BEGIN
    SELECT COALESCE(sum(l.amount) FILTER (WHERE l.entry_type IN ('VENTE', 'REMBOURSEMENT')), 0) AS net,
           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'VENTE'), 0) AS sales,
           COALESCE(-sum(l.amount) FILTER (WHERE l.entry_type = 'REMBOURSEMENT'), 0) AS refunded,
           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type IN ('VENTE', 'REMBOURSEMENT') AND l.available_at <= now()), 0) AS available,
           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type IN ('VENTE', 'REMBOURSEMENT') AND l.available_at > now()), 0) AS pending
      INTO v_ledger
      FROM public.finance_ledger l
     WHERE l.partner_id = p_partner_id AND l.account_kind = 'ORGANISATEUR'
       AND (p_event_id IS NULL OR l.event_id = p_event_id);

    SELECT COALESCE(jsonb_object_agg(target, net), '{}'::jsonb) INTO v_by_target
      FROM (SELECT p.payment_target::text AS target, sum(l.amount) AS net
              FROM public.finance_ledger l JOIN public.payments p ON p.id = l.payment_id
             WHERE l.partner_id = p_partner_id AND l.account_kind = 'ORGANISATEUR'
               AND l.entry_type IN ('VENTE', 'REMBOURSEMENT')
               AND (p_event_id IS NULL OR l.event_id = p_event_id)
             GROUP BY p.payment_target) s;

    SELECT COALESCE(sum(t.service_fee), 0) INTO v_fees
      FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.payments p ON p.id = t.payment_id
     WHERE e.partner_id = p_partner_id AND (p_event_id IS NULL OR t.event_id = p_event_id)
       AND p.is_platform_payment AND t.status IN ('VALIDE', 'UTILISE');

    SELECT COALESCE(sum(t.price), 0), count(*) INTO v_cash, v_cash_count
      FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
      LEFT JOIN public.payments p ON p.id = t.payment_id
     WHERE e.partner_id = p_partner_id AND (p_event_id IS NULL OR t.event_id = p_event_id)
       AND t.price > 0 AND t.status IN ('VALIDE', 'UTILISE')
       AND (p.id IS NULL OR NOT p.is_platform_payment);

    RETURN jsonb_build_object(
        'partner_id', p_partner_id,
        'event_id', p_event_id,
        'organizer_net', v_ledger.net,
        'online_sales', v_ledger.sales,
        'refunded', v_ledger.refunded,
        'available', v_ledger.available,
        'pending', v_ledger.pending,
        'by_target', v_by_target,
        'buyer_service_fees', v_fees,
        'cash_sales', v_cash,
        'cash_tickets', v_cash_count);
END;
$$;

-- Revenu Event Village (plateforme uniquement) : brut, net, part annulée par les remboursements
CREATE OR REPLACE FUNCTION public.finance_platform_revenue(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'payments', count(*),
        'volume', COALESCE(sum(amount), 0),
        'service_fees', COALESCE(sum(service_fee), 0),
        'aggregator_fees', COALESCE(sum(aggregator_fee), 0),
        'gross_revenue', COALESCE(sum(gross_event_village_revenue), 0),
        'net_revenue', COALESCE(sum(net_event_village_revenue - refunded_net_revenue), 0),
        'refunded', COALESCE(sum(refunded_amount), 0))
      FROM public.payments
     WHERE is_platform_payment
       AND status IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
       AND (p_from IS NULL OR COALESCE(paid_at, created_at) >= p_from)
       AND (p_to IS NULL OR COALESCE(paid_at, created_at) < p_to)
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.finance_partner_summary(uuid, uuid)',
        'public.finance_platform_revenue(timestamptz, timestamptz)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

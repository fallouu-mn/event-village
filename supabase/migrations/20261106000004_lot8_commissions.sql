-- ============================================================================
-- EVENT VILLAGE — LOT 8, TÂCHE 8.2 c : plafond des commissions de parrainage (contrat 2.7, 6.3, AR5, L36 à L39)
-- ============================================================================
-- Règle : les commissions d'une vente ne dépassent jamais le revenu net d'Event Village sur cette vente.
--     N1 = min(calcul, net), N2 = min(calcul, net − N1).
-- Même budget au remboursement partiel : budget = max(net − net remboursé, 0), consommé par N1 puis N2. C'est le
-- seul dépassement réel avec la grille (panier à deux prix, gros billet remboursé, porteur EVENT_VILLAGE) ; à la
-- vente, il n'existe qu'avec des taux écrits en base (r1 + r2 ≤ 13 % dans la grille). Extension de la consigne,
-- signalée (AR5, L36).
--
-- La grille ne change pas : le taux N2 reste à 2 %, l'écart avec l'Annexe A et §97 (3 %) est signalé, pas tranché
-- (L37). referral_commissions.uncapped_amount garde le montant calculé d'une ligne plafonnée, NULL sinon (L38).
--
-- Exemple : billet de 1 000 F, service 50, total 1 050, agrégateur 15,75, net 34,25. Taux fabriqués 80/30 :
-- avant N1 27,40 + N2 10,28 = 37,68 (reste −3,43) ; après N1 27,40 + N2 6,85 = 34,25 (reste 0).
--
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE ; aucun BEGIN ni COMMIT de transaction.
-- Privilèges (règle 1A.3) : SECURITY DEFINER, search_path = public, volatilité explicite ; service_role seul.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Trace du plafonnement
-- ----------------------------------------------------------------------------
ALTER TABLE public.referral_commissions ADD COLUMN IF NOT EXISTS uncapped_amount numeric(12,2);

COMMENT ON COLUMN public.referral_commissions.uncapped_amount IS
    'Lot 8 (L38) : montant calculé avant plafonnement au revenu net d''Event Village. NULL sauf plafonnement.';


-- ============================================================================
-- 2. calculate_referral_commissions (recopie intégrale de 20261101000006_lot3_commissions.sql:61-128)
-- Changements (8.2 c) : plafond de chaque génération, uncapped_amount, volatilité explicite. Le budget se calcule
-- aussi quand N1 existe déjà (ON CONFLICT DO NOTHING). N2 nulle : pas de ligne, garde v_amount > 0 existante. Le
-- grand livre est crédité du montant plafonné. Les sorties anticipées sont inchangées.
-- ============================================================================
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
    v_available := now() + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int);

    v_calc := public.fin_round_2(v_payment.net_event_village_revenue * v_rel_n1.rate_n1_at_creation / 100);
    v_amount := LEAST(v_calc, v_payment.net_event_village_revenue);
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
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id),
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
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id),
                                             'COMM-' || v_id::text, 'Commission de parrainage N2');
        END IF;
    END IF;
END;
$$;


-- ============================================================================
-- 3. fin_referral_on_refund (recopie intégrale de 20261101000006_lot3_commissions.sql:149-212)
-- Changements (8.2 c) : budget lu avant la boucle, après l'écriture de refunded_net_revenue par fin_refund_apply
-- (l'appelant). Dans la boucle, N1 d'abord, le prorata est borné par le budget restant, et ce que garde la
-- commission est retiré du budget avant le CONTINUE. Budget nul : montant cible 0, donc annulation motif
-- REMBOURSEMENT, ou régularisation si la commission est déjà versée. uncapped_amount est posé sur la ligne de
-- remplacement quand le budget a coupé le prorata. Volatilité explicite.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fin_referral_on_refund(p_payment_id uuid, p_refund_id uuid, p_prev_refunded numeric, p_new_refunded numeric)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total numeric;
    c record;
    v_eff numeric;
    v_new numeric;
    v_id uuid;
    v_budget numeric;
    v_prorata numeric;
BEGIN
    SELECT amount, GREATEST(net_event_village_revenue - refunded_net_revenue, 0) INTO v_total, v_budget
      FROM public.payments WHERE id = p_payment_id;
    IF v_total IS NULL OR v_total <= 0 OR p_new_refunded <= p_prev_refunded THEN
        RETURN;
    END IF;
    FOR c IN
        SELECT * FROM public.referral_commissions
         WHERE payment_id = p_payment_id AND kind = 'COMMISSION' AND status <> 'CANCELLED'
         ORDER BY generation, id FOR UPDATE
    LOOP
        v_eff := c.amount + COALESCE((SELECT sum(amount) FROM public.referral_commissions WHERE regularizes_id = c.id), 0);
        CONTINUE WHEN v_eff <= 0;
        v_prorata := CASE WHEN p_new_refunded >= v_total THEN 0
                          ELSE public.fin_round_2(v_eff * (v_total - p_new_refunded) / (v_total - p_prev_refunded)) END;
        v_new := LEAST(v_prorata, v_budget);
        v_budget := v_budget - LEAST(v_new, v_eff);
        CONTINUE WHEN v_new >= v_eff;

        IF c.paid_amount = 0 AND c.status IN ('PENDING', 'AVAILABLE')
           AND NOT EXISTS (SELECT 1 FROM public.referral_commissions WHERE regularizes_id = c.id) THEN
            -- Jamais versée : annulée, et remplacée au prorata pour un remboursement partiel
            UPDATE public.referral_commissions
               SET status = 'CANCELLED', cancelled_at = now(), refund_id = p_refund_id, updated_at = now(),
                   cancellation_reason = CASE WHEN v_new = 0 THEN 'REMBOURSEMENT' ELSE 'RECALCUL_PRORATA' END
             WHERE id = c.id;
            PERFORM public.fin_ledger_debit(c.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION_ANNULEE', c.amount, GREATEST(now(), c.available_at),
                                            jsonb_build_object('payment_id', p_payment_id, 'commission_id', c.id, 'refund_id', p_refund_id),
                                            'COMM-ANN-' || c.id::text, 'Commission annulée : remboursement du filleul');
            IF v_new > 0 THEN
                INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                         commission_rate, amount, status, idempotency_key, available_at, kind, replaces_id, refund_id, uncapped_amount)
                VALUES (c.sponsor_id, c.referred_id, c.generation, c.referral_type, c.payment_id, c.eligible_net_revenue,
                        c.commission_rate, v_new, c.status, c.idempotency_key || '-R-' || p_refund_id::text, c.available_at,
                        'COMMISSION', c.id, p_refund_id, CASE WHEN v_prorata > v_new THEN v_prorata END)
                RETURNING id INTO v_id;
                PERFORM public.fin_ledger_credit(c.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_new, c.available_at,
                                                 jsonb_build_object('payment_id', p_payment_id, 'commission_id', v_id),
                                                 'COMM-' || v_id::text, 'Commission recalculée au prorata du remboursement');
            END IF;
        ELSE
            -- Déjà versée (même en partie) : régularisation négative, déduite des gains futurs
            INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                     commission_rate, amount, status, idempotency_key, available_at, kind, regularizes_id, refund_id)
            VALUES (c.sponsor_id, c.referred_id, c.generation, c.referral_type, c.payment_id, c.eligible_net_revenue,
                    c.commission_rate, v_new - v_eff, 'AVAILABLE', 'REGUL-' || c.id::text || '-' || p_refund_id::text, now(),
                    'REGULARISATION', c.id, p_refund_id)
            RETURNING id INTO v_id;
            PERFORM public.fin_ledger_debit(c.sponsor_id, 'PARRAINAGE', NULL, 'REGULARISATION', v_eff - v_new, now(),
                                            jsonb_build_object('payment_id', p_payment_id, 'commission_id', v_id, 'refund_id', p_refund_id),
                                            'REGUL-' || v_id::text, 'Régularisation : commission déjà versée, remboursement du filleul');
        END IF;
    END LOOP;
END;
$$;


-- ============================================================================
-- Privilèges : service_role uniquement (règle 1A.3)
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.calculate_referral_commissions(uuid)',
        'public.fin_referral_on_refund(uuid, uuid, numeric, numeric)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

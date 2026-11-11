-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : conformité SamirPay v1.2 (tâches H7, H6, H1, H8 ; contrat M05, sections 3.1, 3.2,
-- 3.3, A5, A6, X2 à X5, B28, B106)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, contraintes DROP IF EXISTS puis ADD,
-- CREATE OR REPLACE, privilèges réappliqués. Passe avant M06 et M07 (colonnes samirpay_* et cashout_fee_apply lues
-- par cashout_finalize et cashout_admin_decide de M07, X17). Aucun passage du document SamirPay recopié : seuls des
-- noms de champs.
--  1. Colonnes des frais réels (A5, X2), toutes NULL tant que SamirPay ne les donne pas :
--       - payments.samirpay_fees, samirpay_net_amount, samirpay_ref_operator : le Cashin Direct et le statut de la
--         v1.2 ne renvoient aucun frais, elles restent NULL pour un encaissement (« non fournis », jamais 0) ;
--       - cashouts.samirpay_fees (body.fees), samirpay_net_amount (valeur absolue de body.netAmount : débit total
--         frais compris), samirpay_ref_operator (body.refOperator), samirpay_reference (body.reference, ou référence
--         saisie par « Marquer versé ») ; écrites par CashoutService.send dans la même mise à jour que CONFIRME
--         (S-V) ; montants positifs ou nuls (CHECK).
--  2. cashout_fee_apply(p_cashout_id uuid), nouvelle (H7, B28, X3, X4, A6) : imputation des frais réels d'un
--     versement confirmé, appelée par cashout_finalize (M07) à CONFIRME et rejouable sans doublon :
--       - seuls les remboursements d'une annulation d'événement décidée par la partenaire (kind
--         EVENT_CANCELLATION_REFUND, dernière ligne d'historique ANNULE de canal CANCELLATION au rôle PARTENAIRE)
--         sont imputés à son compte ORGANISATEUR ; double paiement, annulation par un admin, remboursement de billet,
--         report et retrait : à la charge d'Event Village, rien d'écrit (X4) ; frais inconnus : rien d'imputé ;
--       - écriture REGULARISATION de −frais, source CASHOUT_FEE-<versement>, refund_id, payment_id et event_id
--         renseignés, datée comme l'écriture REMBOURSEMENT du même remboursement (REMB-<remboursement>, A6 : le
--         disponible ne devient pas négatif) ; à défaut d'écriture REMBOURSEMENT (remboursement passé en créance),
--         GREATEST(now(), dernière disponibilité des VENTE de l'événement pour cette partenaire) ;
--       - tout ou rien : si le solde total du compte ne couvre pas les frais, ils vont en entier en créance
--         (CASHOUT_FEE-<versement>-CREANCE, alerte SUPERADMIN, même forme que fin_ledger_debit), jamais une écriture
--         partielle (invariant w19 : une écriture de frais vaut exactement −samirpay_fees) ;
--       - verrou : verrou consultatif du compte (fin_account_lock) puis grand livre, en dernier dans cashout_finalize
--         (versement → remboursement → paiement → billets → grand livre, contrat 3.3) ; les clés étrangères de
--         l'écriture (paiement, remboursement, événement) sont celles de l'écriture REMBOURSEMENT déjà posée par
--         fin_refund_apply : aucune arête nouvelle.
--  3. payment_release (H1, B102, B105) : recopie de 20261031000013_lot2_reservations.sql:192-226 ; un FAILED n'est
--     définitif que pour un refus explicite à l'initialisation (INIT_REJECTED, INIT_UNAUTHORIZED) ; CANCELLED lu
--     chez SamirPay (PROVIDER_*) le reste ; tout autre FAILED (PROVIDER_FAILED lu au statut, INIT_UNCERTAIN, …) et
--     l'adoption d'un identifiant (CANCELLED INIT_CONFLICT_ADOPTED) restent surveillés.
--  4. Privilèges (service_role seul).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes des frais réels SamirPay (A5, X2)
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS samirpay_fees NUMERIC(12,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS samirpay_net_amount NUMERIC(14,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS samirpay_ref_operator TEXT;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_samirpay_amounts_chk;
ALTER TABLE public.payments ADD CONSTRAINT payments_samirpay_amounts_chk
    CHECK ((samirpay_fees IS NULL OR samirpay_fees >= 0) AND (samirpay_net_amount IS NULL OR samirpay_net_amount >= 0));

ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS samirpay_fees NUMERIC(12,2);
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS samirpay_net_amount NUMERIC(14,2);
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS samirpay_ref_operator TEXT;
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS samirpay_reference TEXT;
ALTER TABLE public.cashouts DROP CONSTRAINT IF EXISTS cashouts_samirpay_amounts_chk;
ALTER TABLE public.cashouts ADD CONSTRAINT cashouts_samirpay_amounts_chk
    CHECK ((samirpay_fees IS NULL OR samirpay_fees >= 0) AND (samirpay_net_amount IS NULL OR samirpay_net_amount >= 0));

COMMENT ON COLUMN public.payments.samirpay_fees IS
    'Lot 9 bis (H6) : frais réels SamirPay de l''encaissement ; NULL tant que SamirPay ne les fournit pas (Cashin Direct v1.2 : jamais), jamais 0 supposé';
COMMENT ON COLUMN public.payments.samirpay_net_amount IS
    'Lot 9 bis (H6) : montant net SamirPay de l''encaissement, en valeur absolue ; NULL si non fourni';
COMMENT ON COLUMN public.payments.samirpay_ref_operator IS
    'Lot 9 bis (H6) : référence de l''opérateur Mobile Money ; NULL si non fournie';
COMMENT ON COLUMN public.cashouts.samirpay_fees IS
    'Lot 9 bis (H6) : frais réels du transfert (body.fees de la réponse SamirPay), débités en plus du montant';
COMMENT ON COLUMN public.cashouts.samirpay_net_amount IS
    'Lot 9 bis (H6) : débit total du transfert, frais compris (valeur absolue de body.netAmount)';
COMMENT ON COLUMN public.cashouts.samirpay_ref_operator IS
    'Lot 9 bis (H6) : référence du transfert chez l''opérateur (body.refOperator)';
COMMENT ON COLUMN public.cashouts.samirpay_reference IS
    'Lot 9 bis (H6, B4) : référence SamirPay du transfert (body.reference), ou référence saisie par « Marquer versé »';

-- ----------------------------------------------------------------------------
-- 2. cashout_fee_apply : imputation des frais réels d'un versement confirmé (H7, B28, X3, X4, A6)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashout_fee_apply(p_cashout_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c record;
    v_payment uuid;
    v_event uuid;
    v_title text;
    v_owner uuid;
    v_partner uuid;
    v_role text;
    v_at timestamptz;
    v_key text;
    v_total numeric;
    v_entry uuid;
    v_debt uuid;
BEGIN
    SELECT id, kind, status, refund_id, payment_id, samirpay_fees INTO c FROM public.cashouts WHERE id = p_cashout_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'CASHOUT_NOT_FOUND');
    END IF;
    IF c.status <> 'CONFIRME' THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'NOT_CONFIRMED');
    END IF;
    -- X4 : seule l'annulation d'un événement par la partenaire lui est imputée
    IF c.kind <> 'EVENT_CANCELLATION_REFUND' THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'EVENT_VILLAGE');
    END IF;
    IF c.samirpay_fees IS NULL OR c.samirpay_fees <= 0 THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'FEES_UNKNOWN');
    END IF;

    SELECT COALESCE(r.payment_id, c.payment_id) INTO v_payment FROM public.refunds r WHERE r.id = c.refund_id;
    v_payment := COALESCE(v_payment, c.payment_id);
    SELECT p.event_id INTO v_event FROM public.payments p WHERE p.id = v_payment;
    IF v_event IS NULL THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'NO_EVENT');
    END IF;
    SELECT h.actor_role INTO v_role
      FROM public.event_status_history h
     WHERE h.event_id = v_event AND h.new_status = 'ANNULE' AND h.channel = 'CANCELLATION'
     ORDER BY h.created_at DESC, h.id DESC
     LIMIT 1;
    IF v_role IS DISTINCT FROM 'PARTENAIRE' THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'EVENT_VILLAGE');
    END IF;

    SELECT e.title, e.partner_id, pa.user_id INTO v_title, v_partner, v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = v_event;
    IF v_owner IS NULL THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'NO_PARTNER');
    END IF;

    -- A6 : même date de disponibilité que l'écriture REMBOURSEMENT du même remboursement
    SELECT l.available_at INTO v_at
      FROM public.finance_ledger l
     WHERE l.source_key = 'REMB-' || c.refund_id::text AND l.owner_id = v_owner AND l.entry_type = 'REMBOURSEMENT';
    IF v_at IS NULL THEN
        SELECT GREATEST(now(), max(l.available_at)) INTO v_at
          FROM public.finance_ledger l
         WHERE l.event_id = v_event AND l.owner_id = v_owner AND l.entry_type = 'VENTE';
        v_at := COALESCE(v_at, now());
    END IF;

    v_key := 'CASHOUT_FEE-' || c.id::text;
    PERFORM public.fin_account_lock(v_owner, 'ORGANISATEUR');
    SELECT l.id INTO v_entry FROM public.finance_ledger l WHERE l.source_key = v_key;
    SELECT d.id INTO v_debt FROM public.finance_debts d WHERE d.source_key = v_key || '-CREANCE';
    IF v_entry IS NOT NULL OR v_debt IS NOT NULL THEN
        RETURN jsonb_build_object('applied', true, 'already', true, 'entry_id', v_entry, 'debt_id', v_debt);
    END IF;

    SELECT COALESCE(sum(l.amount), 0) INTO v_total
      FROM public.finance_ledger l WHERE l.owner_id = v_owner AND l.account_kind = 'ORGANISATEUR';
    IF v_total >= c.samirpay_fees THEN
        INSERT INTO public.finance_ledger (owner_id, account_kind, partner_id, entry_type, amount, available_at,
                                           payment_id, refund_id, event_id, source_key, description)
        VALUES (v_owner, 'ORGANISATEUR', v_partner, 'REGULARISATION', -c.samirpay_fees, v_at,
                v_payment, c.refund_id, v_event, v_key,
                format('Frais SamirPay du remboursement « %s »', v_title))
        RETURNING id INTO v_entry;
    ELSE
        INSERT INTO public.finance_debts (owner_id, account_kind, amount, remaining, reason, payment_id, refund_id, source_key)
        VALUES (v_owner, 'ORGANISATEUR', c.samirpay_fees, c.samirpay_fees,
                format('Frais SamirPay du remboursement « %s »', v_title), v_payment, c.refund_id, v_key || '-CREANCE')
        RETURNING id INTO v_debt;
        PERFORM public.fin_alert_superadmins(
            'FINANCE_DEBT_CREATED',
            'Créance sur un compte',
            format('Débit REGULARISATION de %s F sur le compte ORGANISATEUR : solde insuffisant, créance de %s F à compenser sur les gains futurs.', c.samirpay_fees, c.samirpay_fees),
            'finance_debts', v_debt,
            jsonb_build_object('owner_id', v_owner, 'account_kind', 'ORGANISATEUR', 'entry_type', 'REGULARISATION', 'amount', c.samirpay_fees,
                               'debt', c.samirpay_fees, 'source_key', v_key, 'payment_id', v_payment, 'refund_id', c.refund_id, 'event_id', v_event,
                               'cashout_id', c.id));
    END IF;
    RETURN jsonb_build_object('applied', true, 'entry_id', v_entry, 'debt_id', v_debt, 'amount', c.samirpay_fees, 'available_at', v_at);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. payment_release : un FAILED n'est plus définitif d'office (H1, B102, B105)
--    Base : 20261031000013_lot2_reservations.sql:192-226 (dernière définition, grep de toutes les migrations),
--    recopie intégrale, signature (uuid, text, text) et retour jsonb identiques ; VOLATILE rendu explicite (défaut
--    de la base, sans changement). Seul changement, la finalité posée sur le paiement : définitif seulement pour un
--    refus explicite à l'initialisation (INIT_REJECTED, clés refusées INIT_UNAUTHORIZED) ou une annulation lue chez
--    SamirPay (CANCELLED, PROVIDER_*). Un FAILED lu au statut (PROVIDER_FAILED : l'expiration d'un paiement peut
--    redevenir un succès, v1.2) ou une initialisation incertaine (INIT_UNCERTAIN, INIT_INTERNAL, …) reste surveillé
--    par le cron des succès tardifs ; au-delà de 2 h, confirmation.service.ts pose provider_final.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_release(p_payment_id uuid, p_status text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_released integer;
BEGIN
    IF p_status NOT IN ('FAILED', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION 'payment_release : statut cible invalide %', p_status;
    END IF;
    SELECT status::text INTO v_status FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'status', NULL);
    END IF;
    IF v_status <> 'PENDING' THEN
        RETURN jsonb_build_object('changed', false, 'status', v_status);
    END IF;
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT category_id FROM public.stock_reservations WHERE payment_id = p_payment_id)
     ORDER BY id FOR UPDATE;
    UPDATE public.payments
       SET status = p_status::public.payment_status_enum,
           provider_status = p_reason,
           provider_final = ((p_status = 'FAILED' AND p_reason IN ('INIT_REJECTED', 'INIT_UNAUTHORIZED'))
                             OR (p_status = 'CANCELLED' AND p_reason LIKE 'PROVIDER_%'))
     WHERE id = p_payment_id;
    UPDATE public.stock_reservations
       SET status = CASE WHEN p_status = 'EXPIRED' THEN 'EXPIRED' ELSE 'RELEASED' END, closed_at = now(), close_reason = p_reason
     WHERE payment_id = p_payment_id AND status = 'ACTIVE';
    GET DIAGNOSTICS v_released = ROW_COUNT;
    RETURN jsonb_build_object('changed', true, 'status', p_status, 'released', v_released);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Privilèges : service_role uniquement
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.cashout_fee_apply(uuid)',
        'public.payment_release(uuid, text, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

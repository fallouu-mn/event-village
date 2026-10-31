-- ============================================================================
-- EVENT VILLAGE — LOT 4 : correctif d'un défaut du lot 3 (retraits simultanés)
-- ============================================================================
-- Constaté au run CI 36 (suite finance-retraits, cas « deux retraits simultanés ») : les deux demandes
-- ont été acceptées et le solde organisateur est devenu négatif. withdrawal_request prend bien le
-- verrou du compte, mais lisait le solde disponible avec available_at <= now() : now() est l'heure de
-- DÉBUT de la transaction. La seconde demande, commencée avant que la première ne valide, attendait le
-- verrou puis ignorait le débit de la première (daté du now() de celle-ci, postérieur au sien). La
-- lecture se fait désormais à l'heure réelle (clock_timestamp), une fois le verrou obtenu.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.withdrawal_request(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := (p->>'user_id')::uuid;
    v_kind text := p->>'account_kind';
    v_method text := COALESCE(NULLIF(p->>'method', ''), 'MOBILE_MONEY');
    v_operator text := NULLIF(p->>'operator', '');
    v_phone text := NULLIF(p->>'phone_number', '');
    v_key text := NULLIF(p->>'client_key', '');
    v_gross numeric;
    v_u record;
    v_partner uuid;
    v_existing record;
    v_min numeric;
    v_rate numeric;
    v_fee numeric;
    v_net numeric;
    v_available numeric;
    v_id uuid;
    v_cashout uuid;
    v_blocked text;
BEGIN
    IF v_kind IS NULL OR v_kind NOT IN ('ORGANISATEUR', 'PARRAINAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACCOUNT', 'message', 'Compte inconnu.');
    END IF;
    IF v_method NOT IN ('MOBILE_MONEY', 'BANK') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_METHOD', 'message', 'Moyen de retrait inconnu.');
    END IF;
    IF v_method = 'BANK' AND NOT public.fin_setting_bool('finance.withdrawal_bank_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BANK_DISABLED', 'message', 'Les retraits par virement bancaire ne sont pas ouverts.');
    END IF;
    IF (p->>'gross_amount') IS NULL OR (p->>'gross_amount') !~ '^[0-9]+(\.0+)?$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant entier en FCFA attendu.');
    END IF;
    v_gross := (p->>'gross_amount')::numeric;
    IF v_gross <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant entier en FCFA attendu.');
    END IF;
    IF v_method = 'MOBILE_MONEY' AND (v_operator IS NULL OR v_operator NOT IN ('WAVE', 'ORANGE_MONEY')
                                       OR v_phone IS NULL OR v_phone !~ '^7[05678][0-9]{7}$') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DESTINATION', 'message', 'Choisissez Wave ou Orange Money et un numéro mobile sénégalais (9 chiffres).');
    END IF;

    SELECT id, first_name, last_name, status::text AS status INTO v_u FROM public.users WHERE id = v_user;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inconnu.');
    END IF;
    IF v_u.status <> 'ACTIF' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inactif.');
    END IF;
    IF v_kind = 'ORGANISATEUR' THEN
        SELECT id INTO v_partner FROM public.partners WHERE user_id = v_user AND status = 'VALIDE' ORDER BY created_at LIMIT 1;
        IF v_partner IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_PARTNER', 'message', 'Aucun compte organisateur validé.');
        END IF;
    END IF;

    PERFORM public.fin_account_lock(v_user, v_kind);

    IF v_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.withdrawals WHERE user_id = v_user AND client_idempotency_key = v_key;
        IF FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'Retrait déjà demandé avec cette clé.',
                                      'withdrawal_id', v_existing.id, 'cashout_id', v_existing.cashout_id,
                                      'gross_amount', v_existing.gross_amount, 'fee_amount', v_existing.fee_amount,
                                      'net_amount', v_existing.net_amount, 'status', v_existing.status::text);
        END IF;
    END IF;

    v_min := public.fin_setting_num('finance.withdrawal_min_amount');
    IF v_gross < v_min THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BELOW_MINIMUM', 'minimum', v_min,
                                  'message', format('Montant minimum de retrait : %s F.', v_min));
    END IF;
    -- Heure réelle, pas now() : une demande concurrente qui a attendu le verrou doit voir le débit de
    -- la précédente (daté du début de SA transaction, donc parfois après le début de celle-ci).
    SELECT COALESCE(sum(amount), 0) INTO v_available FROM public.finance_ledger
     WHERE owner_id = v_user AND account_kind = v_kind AND available_at <= clock_timestamp();
    IF v_gross > public.fin_round_down(GREATEST(v_available, 0)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'available', v_available,
                                  'message', 'Solde disponible insuffisant.');
    END IF;
    v_rate := public.fin_setting_num('finance.withdrawal_fee_rate');
    v_fee := public.fin_round_up(v_gross * v_rate / 100);
    v_net := v_gross - v_fee;
    IF v_net <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant trop faible après frais.');
    END IF;

    INSERT INTO public.withdrawals (user_id, gross_amount, fee_rate, fee_amount, net_amount, withdrawal_method, payment_details,
                                    status, account_kind, operator, phone_number, client_idempotency_key, otp_verified_at)
    VALUES (v_user, v_gross, v_rate, v_fee, v_net, v_method::withdrawal_method_enum,
            CASE WHEN v_method = 'BANK' THEN COALESCE(p->'bank_details', '{}'::jsonb)
                 ELSE jsonb_build_object('operator', v_operator, 'phone_number', v_phone) END,
            CASE WHEN v_method = 'BANK' THEN 'PENDING'::withdrawal_status_enum ELSE 'PROCESSING'::withdrawal_status_enum END,
            v_kind, v_operator, v_phone, v_key, NULLIF(p->>'otp_verified_at', '')::timestamptz)
    RETURNING id INTO v_id;

    -- Solde réservé tout de suite (rendu seulement si l'envoi est refusé)
    INSERT INTO public.finance_ledger (owner_id, account_kind, partner_id, entry_type, amount, available_at, withdrawal_id, source_key, description)
    VALUES (v_user, v_kind, v_partner, 'RETRAIT', -v_gross, now(), v_id, 'RETRAIT-' || v_id::text,
            format('Retrait %s F (frais %s F, versé %s F)', v_gross, v_fee, v_net));
    IF v_kind = 'PARRAINAGE' THEN
        PERFORM public.fin_referral_allocate(v_user, v_id, v_gross);
    END IF;

    IF v_method = 'MOBILE_MONEY' THEN
        v_blocked := CASE WHEN NULLIF(btrim(v_u.first_name), '') IS NULL OR NULLIF(btrim(v_u.last_name), '') IS NULL
                          THEN 'NAME_UNKNOWN' ELSE NULL END;
        INSERT INTO public.cashouts (kind, idempotency_key, withdrawal_id, beneficiary_user_id, operator, phone_number,
                                     first_name, last_name, amount, blocked_reason)
        VALUES ('WITHDRAWAL', 'WITHDRAWAL-' || v_id::text, v_id, v_user, v_operator, v_phone,
                NULLIF(btrim(v_u.first_name), ''), NULLIF(btrim(v_u.last_name), ''), v_net, v_blocked)
        RETURNING id INTO v_cashout;
        UPDATE public.withdrawals SET cashout_id = v_cashout WHERE id = v_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'cashout_id', v_cashout, 'gross_amount', v_gross,
                              'fee_amount', v_fee, 'net_amount', v_net,
                              'status', CASE WHEN v_method = 'BANK' THEN 'PENDING' ELSE 'PROCESSING' END);
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.withdrawal_request(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

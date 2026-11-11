-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : l'argent (M06, agent S-A ; contrat sections 3.1, 3.2, 3.3, 4.1, 5.2 à 5.5, 5.9, 5.10)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; CREATE TABLE / INDEX IF NOT EXISTS, CREATE OR REPLACE, privilèges réappliqués ;
-- aucune reprise de données. DDL avant les fonctions. Écrite tâche après tâche (section 10), un commit par tâche.
--
-- Tâche 2 (R4, R5 ; B14 à B18, A7) :
--  1. Table partner_suspension_cascades : trace de la cascade de suspension d'une partenaire (service_role seul).
--  2. fin_frozen_amount(p_owner, p_kind, p_at) (nouvelle, STABLE) : gel calculé à la lecture, jamais écrit :
--     Σ max(0, net échu) des événements SUSPENDU du compte ORGANISATEUR ; 0 pour PARRAINAGE ; un événement ANNULE
--     n'est pas gelé (ses débits sont écrits).
--  3. fin_withdrawal_check(p_user, p_kind, p_gross, p_at) (nouvelle, STABLE) : règle unique du retrait (B15),
--     appelée par withdrawal_request sous le verrou du compte : statut du compte, minimum, solde, gel, frais, net.
--  4. finance_account_balance : base 20261101000004_lot3_grand_livre.sql:304-339, recopie intégrale, signature
--     (uuid, text → jsonb) et STABLE identiques. Changements : `frozen` ajouté, `withdrawable` réduit du gel ;
--     `available` et `pending` inchangés (invariant (e)).
--  5. withdrawal_request : base 20261101000014_lot4_correctif_retraits_concurrents.sql:12-137, recopie intégrale,
--     signature (jsonb → jsonb) identique. Changements : minimum, solde et frais remplacés par fin_withdrawal_check
--     lue à l'heure réelle (clock_timestamp, correctif du lot 4) après le verrou et le contrôle de la clé ; nouveau
--     refus FUNDS_FROZEN ; texte du minimum du contrat 4.1 ; VOLATILE écrit (volatilité par défaut, aucune
--     différence de comportement).
--  6. partner_status_set : base 20261103000006_lot6_pros_admin.sql:698-769, recopie intégrale, signature
--     (jsonb → jsonb) et VOLATILE identiques. Changements : cascade. À la suspension, chaque événement PUBLIE de la
--     partenaire passe SUSPENDU (« Organisateur suspendu », acteur et rôle ADMIN) avec sa trace ; à la réactivation,
--     seuls les événements tracés encore SUSPENDU, dont la ligne d'historique de la cascade est la dernière et dont
--     la fin n'est pas passée, reviennent PUBLIE (« Organisateur réactivé ») ; les autres traces sont fermées
--     LEFT_ENDED (intact mais fini, B20) ou LEFT_CHANGED. Marqueur transactionnel ev.partner_cascade = '1' pendant
--     les deux boucles, lu par notif_event_status_changed (M09, S-D) : aucun EVENT_SUSPENDED ni EVENT_REACTIVATED
--     par événement à la partenaire (A7). Réponse + events_suspended, events_restored, events_left_suspended.
--     Verrou de la fiche : FOR NO KEY UPDATE au lieu de FOR UPDATE. payment_confirm tient l'événement (FOR NO KEY
--     UPDATE) puis écrit la VENTE au grand livre, dont la clé étrangère partner_id prend FOR KEY SHARE sur la fiche ;
--     un FOR UPDATE sur la fiche suivi du verrou des événements fermerait ce cycle. FOR NO KEY UPDATE sérialise
--     toujours deux changements de statut de la même fiche (aucune colonne de clé n'est écrite).
--     Ordre des verrous (3.3) : partners FOR NO KEY UPDATE, compte, événements ORDER BY id FOR NO KEY UPDATE,
--     historique, traces.
-- ============================================================================


-- ============================================================================
-- 1. DDL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 partner_suspension_cascades (tâche 2, B16) : une ligne par événement suspendu par la cascade.
--     outcome NULL tant que la trace est ouverte ; RESTORED, LEFT_ENDED ou LEFT_CHANGED une fois fermée.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_suspension_cascades (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id           uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    event_id             uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    suspended_history_id uuid REFERENCES public.event_status_history(id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    closed_at            timestamptz,
    outcome              text,
    restored_history_id  uuid REFERENCES public.event_status_history(id) ON DELETE SET NULL,
    CONSTRAINT partner_suspension_cascades_outcome_chk
        CHECK (outcome IS NULL OR outcome IN ('RESTORED', 'LEFT_ENDED', 'LEFT_CHANGED')),
    CONSTRAINT partner_suspension_cascades_closed_chk
        CHECK ((closed_at IS NULL) = (outcome IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_suspension_cascades_open
    ON public.partner_suspension_cascades (event_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_suspension_cascades_partner
    ON public.partner_suspension_cascades (partner_id) WHERE closed_at IS NULL;
COMMENT ON TABLE public.partner_suspension_cascades IS
    'Lot 9 bis (R5, B16) : événements suspendus par la suspension de leur partenaire ; seuls ceux-là sont rétablis à la réactivation. Service_role uniquement.';
ALTER TABLE public.partner_suspension_cascades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_suspension_cascades FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.partner_suspension_cascades TO service_role;


-- ============================================================================
-- 2. Fonctions nouvelles
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 fin_frozen_amount (tâche 2, R4, B14) : fonds gelés d'un compte à l'instant p_at.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fin_frozen_amount(p_owner uuid, p_kind text, p_at timestamptz)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_frozen numeric;
BEGIN
    IF p_owner IS NULL OR p_kind IS DISTINCT FROM 'ORGANISATEUR' THEN
        RETURN 0;
    END IF;
    SELECT COALESCE(sum(GREATEST(n.net, 0)), 0) INTO v_frozen
      FROM (SELECT l.event_id, sum(l.amount) AS net
              FROM public.finance_ledger l
              JOIN public.events e ON e.id = l.event_id
             WHERE l.owner_id = p_owner AND l.account_kind = 'ORGANISATEUR'
               AND e.status::text = 'SUSPENDU'
               AND l.available_at <= COALESCE(p_at, now())
             GROUP BY l.event_id) n;
    RETURN v_frozen;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2.2 fin_withdrawal_check (tâche 2, B15) : règle unique d'un retrait, sans écriture ni verrou.
--     Ordre : statut du compte, minimum, solde, gel, frais et net. Rend { ok, minimum, fee_rate, fee_amount,
--     net_amount, available, frozen, withdrawable } ou { ok:false, code, message, … }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fin_withdrawal_check(p_user uuid, p_kind text, p_gross numeric, p_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_at           timestamptz := COALESCE(p_at, now());
    v_status       text;
    v_min          numeric;
    v_available    numeric;
    v_frozen       numeric;
    v_withdrawable numeric;
    v_rate         numeric;
    v_fee          numeric;
    v_net          numeric;
BEGIN
    IF p_kind IS NULL OR p_kind NOT IN ('ORGANISATEUR', 'PARRAINAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACCOUNT', 'message', 'Compte inconnu.');
    END IF;
    IF p_gross IS NULL OR p_gross <= 0 OR p_gross <> trunc(p_gross) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant entier en FCFA attendu.');
    END IF;

    -- Statut du compte
    SELECT u.status::text INTO v_status FROM public.users u WHERE u.id = p_user;
    IF v_status IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inconnu.');
    END IF;
    IF v_status <> 'ACTIF' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inactif.');
    END IF;
    IF p_kind = 'ORGANISATEUR'
       AND NOT EXISTS (SELECT 1 FROM public.partners pa WHERE pa.user_id = p_user AND pa.status::text = 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_PARTNER', 'message', 'Aucun compte organisateur validé.');
    END IF;

    -- Minimum (milliers séparés par une espace insécable)
    v_min := public.fin_setting_num('finance.withdrawal_min_amount');
    IF p_gross < v_min THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BELOW_MINIMUM', 'minimum', v_min,
            'message', format('Le minimum de retrait est de %s F CFA.',
                              regexp_replace(trunc(v_min)::bigint::text, '(\d)(?=(\d{3})+$)', '\1' || chr(160), 'g')));
    END IF;

    -- Solde disponible (écritures échues à v_at)
    SELECT COALESCE(sum(amount), 0) INTO v_available FROM public.finance_ledger
     WHERE owner_id = p_user AND account_kind = p_kind AND available_at <= v_at;
    IF p_gross > public.fin_round_down(GREATEST(v_available, 0)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'available', v_available,
                                  'message', 'Solde disponible insuffisant.');
    END IF;

    -- Gel (R4) : le net échu des événements suspendus n'est pas retirable
    v_frozen := public.fin_frozen_amount(p_user, p_kind, v_at);
    v_withdrawable := public.fin_round_down(GREATEST(v_available - v_frozen, 0));
    IF p_gross > v_withdrawable THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FUNDS_FROZEN', 'frozen', v_frozen, 'withdrawable', v_withdrawable,
                                  'message', 'Une partie de vos fonds est gelée : un de vos événements est suspendu.');
    END IF;

    -- Frais et net
    v_rate := public.fin_setting_num('finance.withdrawal_fee_rate');
    v_fee := public.fin_round_up(p_gross * v_rate / 100);
    v_net := p_gross - v_fee;
    IF v_net <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant trop faible après frais.');
    END IF;

    RETURN jsonb_build_object('ok', true, 'minimum', v_min, 'fee_rate', v_rate, 'fee_amount', v_fee, 'net_amount', v_net,
                              'available', v_available, 'frozen', v_frozen, 'withdrawable', v_withdrawable);
END;
$$;


-- ============================================================================
-- 3. Recopies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 finance_account_balance (recopie de 20261101000004_lot3_grand_livre.sql:304-339) : + frozen, withdrawable
--     réduit du gel (tâche 2).
-- ----------------------------------------------------------------------------
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
    v_frozen numeric;
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
    -- Lot 9 bis (R4) : gel calculé, `available` inchangé (invariant (e))
    v_frozen := public.fin_frozen_amount(p_owner, p_kind, now());
    RETURN jsonb_build_object(
        'account_kind', p_kind,
        'available', v_available,
        'pending', v_pending,
        'next_available_at', v_next,
        'in_progress', v_in_progress,
        'debt', v_debt,
        'frozen', v_frozen,
        'withdrawable', public.fin_round_down(GREATEST(v_available - v_frozen, 0)));
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.2 withdrawal_request (recopie de 20261101000014_lot4_correctif_retraits_concurrents.sql:12-137) :
--     minimum, solde et frais par fin_withdrawal_check sous le verrou (tâche 2).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdrawal_request(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
    v_check jsonb;
    v_rate numeric;
    v_fee numeric;
    v_net numeric;
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

    -- Lot 9 bis (B15) : règle unique (minimum, solde, gel, frais), lue à l'heure réelle et non à now() : une demande
    -- concurrente qui a attendu le verrou doit voir le débit de la précédente (correctif du lot 4). L'instruction
    -- commence après le verrou : la fonction STABLE lit l'instantané de cette instruction, qui voit ce débit validé.
    v_check := public.fin_withdrawal_check(v_user, v_kind, v_gross, clock_timestamp());
    IF NOT COALESCE((v_check->>'ok')::boolean, false) THEN
        RETURN v_check;
    END IF;
    v_rate := (v_check->>'fee_rate')::numeric;
    v_fee := (v_check->>'fee_amount')::numeric;
    v_net := (v_check->>'net_amount')::numeric;

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

-- ----------------------------------------------------------------------------
-- 3.3 partner_status_set (recopie de 20261103000006_lot6_pros_admin.sql:698-769) : cascade sur les événements
--     (tâche 2, R5, B16, B17, A7).
--     p : { partner_id, actor_id, status ∈ VALIDE | REJETE | SUSPENDU, reason? }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_status_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_status  text := p->>'status';
    v_reason  text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    pa        record;
    v_revoked integer;
    v_row     record;
    v_ev        record;
    v_trace     record;
    v_history   uuid;
    v_untouched boolean;
    v_suspended uuid[] := ARRAY[]::uuid[];
    v_restored  uuid[] := ARRAY[]::uuid[];
    v_left      uuid[] := ARRAY[]::uuid[];
BEGIN
    IF v_partner IS NULL OR v_actor IS NULL OR v_status IS NULL OR v_status NOT IN ('VALIDE', 'REJETE', 'SUSPENDU') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.id = v_actor AND u.status::text = 'ACTIF'
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text IN ('ADMIN', 'SUPERADMIN'))
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Action réservée aux administrateurs.');
    END IF;
    -- Lot 9 bis : FOR NO KEY UPDATE (voir l'en-tête, point 6)
    SELECT * INTO pa FROM public.partners WHERE id = v_partner FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Partenaire introuvable.');
    END IF;
    IF pa.status::text = v_status THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'status', pa.status::text,
                                  'message', 'Le partenaire est déjà dans ce statut.');
    END IF;
    IF v_status IN ('REJETE', 'SUSPENDU') AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
                                  'message', 'Indiquez le motif (3 caractères au moins).');
    END IF;
    IF v_reason IS NOT NULL AND char_length(v_reason) > 1000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Le motif est limité à 1 000 caractères.');
    END IF;

    -- Compte du partenaire (jamais un compte supprimé) : SUSPENDU à la suspension, ACTIF sinon.
    UPDATE public.users
       SET status = (CASE WHEN v_status = 'SUSPENDU' THEN 'SUSPENDU' ELSE 'ACTIF' END)::public.user_status,
           updated_at = now()
     WHERE id = pa.user_id AND status::text <> 'SUPPRIME';

    UPDATE public.partners
       SET status = v_status::public.partner_status,
           is_verified = (v_status = 'VALIDE'),
           rejection_reason = CASE WHEN v_status = 'REJETE' THEN v_reason ELSE rejection_reason END,
           suspended_reason = CASE
               WHEN v_status = 'SUSPENDU' THEN v_reason
               WHEN v_status = 'VALIDE' AND pa.status::text = 'SUSPENDU' THEN NULL
               ELSE suspended_reason END,
           updated_at = now()
     WHERE id = pa.id
     RETURNING status::text AS status, is_verified, rejection_reason, suspended_reason INTO v_row;

    IF v_status = 'SUSPENDU' THEN
        v_revoked := public.revoke_user_sessions(pa.user_id);
    END IF;

    -- Lot 9 bis (R5, B16, B17, A7) : cascade sur les événements de la partenaire. Le marqueur transactionnel
    -- ev.partner_cascade est lu par le trigger des avis de statut (aucun avis par événement à la partenaire).
    IF v_status = 'SUSPENDU' THEN
        PERFORM set_config('ev.partner_cascade', '1', true);
        FOR v_ev IN
            SELECT e.id FROM public.events e
             WHERE e.partner_id = pa.id AND e.status::text = 'PUBLIE'
             ORDER BY e.id
               FOR NO KEY UPDATE OF e
        LOOP
            v_history := public.event_status_apply(v_ev.id, 'PUBLIE', 'SUSPENDU', v_actor, 'ADMIN', 'Organisateur suspendu', 'TRANSITION');
            INSERT INTO public.partner_suspension_cascades (partner_id, event_id, suspended_history_id)
            VALUES (pa.id, v_ev.id, v_history);
            v_suspended := v_suspended || v_ev.id;
        END LOOP;
        PERFORM set_config('ev.partner_cascade', '0', true);
    ELSIF v_status = 'VALIDE' AND pa.status::text = 'SUSPENDU' THEN
        PERFORM set_config('ev.partner_cascade', '1', true);
        -- Événements avant les traces (ordre 3.3)
        PERFORM 1 FROM public.events e
         WHERE e.id IN (SELECT k.event_id FROM public.partner_suspension_cascades k
                         WHERE k.partner_id = pa.id AND k.closed_at IS NULL)
         ORDER BY e.id
           FOR NO KEY UPDATE OF e;
        FOR v_trace IN
            SELECT k.id, k.event_id, k.suspended_history_id, e.status::text AS status, h.created_at AS suspended_at
              FROM public.partner_suspension_cascades k
              JOIN public.events e ON e.id = k.event_id
              LEFT JOIN public.event_status_history h ON h.id = k.suspended_history_id
             WHERE k.partner_id = pa.id AND k.closed_at IS NULL
             ORDER BY k.event_id
               FOR UPDATE OF k
        LOOP
            -- Intact : toujours SUSPENDU et aucune ligne d'historique après celle de la cascade
            v_untouched := v_trace.status = 'SUSPENDU' AND v_trace.suspended_at IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM public.event_status_history h2
                                 WHERE h2.event_id = v_trace.event_id AND h2.id <> v_trace.suspended_history_id
                                   AND h2.created_at >= v_trace.suspended_at);
            IF v_untouched AND public.event_end_at(v_trace.event_id) > now() THEN
                v_history := public.event_status_apply(v_trace.event_id, 'SUSPENDU', 'PUBLIE', v_actor, 'ADMIN', 'Organisateur réactivé', 'TRANSITION');
                UPDATE public.partner_suspension_cascades
                   SET closed_at = now(), outcome = 'RESTORED', restored_history_id = v_history
                 WHERE id = v_trace.id;
                v_restored := v_restored || v_trace.event_id;
            ELSE
                UPDATE public.partner_suspension_cascades
                   SET closed_at = now(), outcome = CASE WHEN v_untouched THEN 'LEFT_ENDED' ELSE 'LEFT_CHANGED' END
                 WHERE id = v_trace.id;
                IF v_trace.status = 'SUSPENDU' THEN
                    v_left := v_left || v_trace.event_id;
                END IF;
            END IF;
        END LOOP;
        PERFORM set_config('ev.partner_cascade', '0', true);
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'partner_id', pa.id, 'user_id', pa.user_id, 'old_status', pa.status::text,
        'status', v_row.status, 'is_verified', v_row.is_verified,
        'rejection_reason', v_row.rejection_reason, 'suspended_reason', v_row.suspended_reason,
        'sessions_revoked', v_revoked,
        'events_suspended', to_jsonb(v_suspended), 'events_restored', to_jsonb(v_restored),
        'events_left_suspended', to_jsonb(v_left)
    );
END;
$$;

COMMENT ON FUNCTION public.partner_status_set(jsonb) IS
    'Lot 6 (J2.6), lot 9 bis (R5) : validation, refus, suspension ou réactivation d''un partenaire ; partners.status et users.status dans la même transaction, sessions révoquées à la suspension, avis par trg_partners_notify ; cascade sur les événements PUBLIE (partner_suspension_cascades), rétablissement ciblé à la réactivation. Service_role uniquement.';


-- ============================================================================
-- 9. Privilèges : service_role uniquement
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_frozen_amount(uuid, text, timestamptz)',
        'public.fin_withdrawal_check(uuid, text, numeric, timestamptz)',
        'public.finance_account_balance(uuid, text)',
        'public.withdrawal_request(jsonb)',
        'public.partner_status_set(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

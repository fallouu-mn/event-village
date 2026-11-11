-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS, M07 : versements (agent S-V ; contrat lot9bis-design 3.1, 3.2, 5.1, 5.6, 5.7, H1, H6, H7)
-- ============================================================================
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS ; aucun BEGIN ni COMMIT de
-- transaction. DDL d'abord, fonctions ensuite, privilèges, puis la reprise de données en fin de fichier.
-- Privilèges (règle 1A.3) : SECURITY DEFINER, search_path = public, volatilité explicite ; REVOKE ALL FROM PUBLIC,
-- anon, authenticated puis GRANT EXECUTE TO service_role, fonctions de trigger comprises (patron du lot 6).
--
-- Tâche 1 (R1, R9, R10, R52, R105, B1 à B11, B19, X1, X18) :
--  1. cashouts.delay_flagged_at : retard de plus de 30 minutes signalé une fois (alerted_at sert déjà aux blocages).
--  2. cashouts_to_resume() (nouvelle, X1, A4) : seule définition des « Versements à reprendre », tous types,
--     retraits compris, sans filtre de mode (les appelants filtrent simulated) :
--       remboursement ECHOUE (un retrait ECHOUE est clos : REJECTED, solde rendu) ; tout INCERTAIN ; tout A_ENVOYER
--       bloqué (sauf SIMULATED, jamais versé) ; A_ENVOYER sans motif depuis plus de 30 min
--       (COALESCE(send_started_at, created_at)) ; ENVOYE non confirmé depuis plus de 30 min. Seuil fixe (B1).
--  3. cashouts_flag_delayed() (nouvelle) : pose delay_flagged_at sur les lignes en retard (EN_ATTENTE,
--     ENVOYE_NON_CONFIRME) du mode de la requête (ev_request_simulated) ; appelée par payments-reconcile.
--  4. cashout_admin_decide(p jsonb) (nouvelle, B2 à B4, X18) : « Renvoyer » (RESEND) et « Marquer versé »
--     (MARK_PAID), justification de 10 à 500 caractères, audit CASHOUT_RESENT ou CASHOUT_MARKED_PAID écrit dans la
--     transaction de la décision. Verrou : versement FOR UPDATE, puis cashout_finalize (tableau 3.3). Le statut
--     SamirPay d'un versement INCERTAIN ou ENVOYE avec identifiant est lu par la route juste avant (provider_status) :
--     SUCCESS → confirmé d'office (rien ne repart), PENDING → PROVIDER_PENDING, FAILED ou CANCELLED → renvoi ; sans
--     identifiant → NOT_RESENDABLE (B2). Droit vérifié en base : SUPERADMIN, ou ADMIN avec refunds.manage dans
--     admin_permissions (jamais users.role), compte ACTIF. « Marquer versé » écrit samirpay_reference et
--     samirpay_fees, colonnes de M05 (X2) : lues à l'exécution seulement (PL/pgSQL), M05 précède M07.
--  5. notif_cashouts_notify() : recopie intégrale de 20261103000006_lot6_pros_admin.sql:316-502, même signature.
--     Ajouts : retrait bloqué → ADMIN_CASHOUT_TO_RESUME (cause BLOCKED), admin_signals REFUND_TO_RETRY (aucun kind
--     nouveau, A3) et WITHDRAWAL_DELAYED ; retard posé (delay_flagged_at) → ADMIN_CASHOUT_TO_RESUME (cause DELAYED)
--     et REFUND_DELAYED ou WITHDRAWAL_DELAYED ; remboursement bloqué, ECHOUE ou INCERTAIN → REFUND_DELAYED (B11),
--     un avis par versement (clé REFUND_DELAYED:<cashout>), jamais pour un blocage SIMULATED. Le premier retour
--     anticipé (« ni statut ni blocage ») devient « ni statut, ni blocage, ni retard » ; le second est remplacé par
--     un bloc conditionnel pour que l'avis de retard parte en fin de fonction. Trigger recréé AFTER INSERT OR
--     UPDATE OF status, blocked_reason, delay_flagged_at.
--  6. event_cancellation_progress(p jsonb) : recopie intégrale de 20261102000003_lot5_cycle.sql:761-824, même
--     signature ; ajout du compteur `delayed` { count, total } (remboursements de l'événement présents dans
--     cashouts_to_resume), visible de la propriétaire et des admins (B9). Tâche 4 (fix(9b.4-SV), R20, B22) : ajout
--     de `counter_cash` { count, total, refunded_count, refunded_total } (ventes au guichet de l'événement, même
--     périmètre que event_cash_refunds de M06, marques de event_cash_refund_marks, table de M06).
--
-- Tâche 6 (R47, R30, B10, B11 ; H1 pour l'avis) :
--  5 (suite). notif_cashouts_notify : à la création d'un REFUND (paiement encaissé sans billet possible, ou en
--     double du même panier : payments.metadata.duplicate_of), PAYMENT_REFUND_STARTED au client avant tout
--     versement (montant et opérateur du paiement, variante « double ») ; un seul émetteur, ce trigger.
--  7. checkout_create_payment(p jsonb) : recopie intégrale de 20261105000006_lot7_client.sql:24-136, même
--     signature ; seule la condition « held_expires_at > now() » de la garde 3 bis est retirée : un paiement de
--     billets PENDING bloque tout second paiement du même compte pour le même événement jusqu'à son issue
--     (PAYMENT_PENDING, message inchangé). H2 passe la durée lue au réglage par hold_minutes (signature inchangée).
--
-- Tâche 7 (R106 partie argent, B12) :
--  8. calculate_referral_commissions(uuid) : recopie intégrale de 20261106000004_lot8_commissions.sql:37-112, même
--     signature ; disponibilité d'une commission de billet = GREATEST(now(), fin_event_end) + délai réglé
--     (finance.referral_availability_days, 7 par défaut, jamais moins) ; abonnement et paiement sans événement :
--     confirmation + délai, inchangé ; event_id ajouté aux refs du crédit COMMISSION.
--  9. referral_commissions_realign(p_event uuid DEFAULT NULL) (nouvelle) : lignes COMMISSION non annulées, jamais
--     retirées (paid_amount = 0), d'un paiement de billets : date = GREATEST(date, fin + délai), PENDING si future,
--     écriture COMM-<id> et compensations COMP-<écriture>-* à la même date, audit REFERRAL_COMMISSION_DEFERRED
--     (user_role SYSTEM) par ligne déplacée ; IS NOT DISTINCT FROM : un second appel ne change rien.
-- 10. events_referral_realign() et trg_events_referral_realign AFTER UPDATE OF start_date, start_time, end_date,
--     end_time ON events : la fin recule, les commissions suivent (jamais avancées). Ordre : events → commissions
--     FOR UPDATE → grand livre (tableau 3.3).
--  DML en fin de fichier : referral_commissions_realign(NULL) une fois, nombre annoncé par RAISE NOTICE.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- DDL
-- ----------------------------------------------------------------------------
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS delay_flagged_at timestamptz;

COMMENT ON COLUMN public.cashouts.delay_flagged_at IS
    'Lot 9 bis (B1, B11) : retard de plus de 30 minutes signalé (ADMIN_CASHOUT_TO_RESUME, REFUND_DELAYED ou WITHDRAWAL_DELAYED), une fois par tentative ; remis à NULL par « Renvoyer ».';


-- ----------------------------------------------------------------------------
-- 2. cashouts_to_resume() — « Versements à reprendre » (X1)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashouts_to_resume()
RETURNS TABLE (id uuid, kind text, state text, since timestamptz, has_provider_id boolean, simulated boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.id,
           c.kind,
           CASE WHEN c.status = 'ECHOUE' THEN 'ECHOUE'
                WHEN c.status = 'INCERTAIN' THEN 'INCERTAIN'
                WHEN c.status = 'ENVOYE' THEN 'ENVOYE_NON_CONFIRME'
                WHEN c.blocked_reason IS NOT NULL THEN 'BLOQUE'
                ELSE 'EN_ATTENTE' END,
           CASE WHEN c.status = 'A_ENVOYER' THEN COALESCE(c.send_started_at, c.created_at)
                WHEN c.status = 'ENVOYE' THEN COALESCE(c.sent_at, c.created_at)
                ELSE GREATEST(c.created_at, c.updated_at) END,
           c.samirpay_transaction_id IS NOT NULL,
           c.simulated
      FROM public.cashouts c
     WHERE (c.status = 'ECHOUE' AND c.kind <> 'WITHDRAWAL')
        OR c.status = 'INCERTAIN'
        OR (c.status = 'A_ENVOYER' AND c.blocked_reason IS NOT NULL AND c.blocked_reason <> 'SIMULATED')
        OR (c.status = 'A_ENVOYER' AND c.blocked_reason IS NULL
            AND COALESCE(c.send_started_at, c.created_at) < now() - interval '30 minutes')
        OR (c.status = 'ENVOYE' AND COALESCE(c.sent_at, c.created_at) < now() - interval '30 minutes')
$$;

COMMENT ON FUNCTION public.cashouts_to_resume() IS
    'Lot 9 bis (X1, A4, B1) : versements à reprendre, tous types, sans filtre de mode. state : ECHOUE, INCERTAIN, BLOQUE, EN_ATTENTE (plus de 30 min), ENVOYE_NON_CONFIRME (plus de 30 min). Service_role seul.';


-- ----------------------------------------------------------------------------
-- 3. cashouts_flag_delayed() — retard signalé une fois (appelée par payments-reconcile)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashouts_flag_delayed()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_flagged integer;
BEGIN
    WITH late AS (
        SELECT r.id FROM public.cashouts_to_resume() r
         WHERE r.state IN ('EN_ATTENTE', 'ENVOYE_NON_CONFIRME')
           AND r.simulated = public.ev_request_simulated()
    ), flagged AS (
        UPDATE public.cashouts c
           SET delay_flagged_at = now(), updated_at = now()
         WHERE c.delay_flagged_at IS NULL
           AND c.id IN (SELECT late.id FROM late)
        RETURNING c.id
    )
    SELECT count(*)::int INTO v_flagged FROM flagged;
    RETURN v_flagged;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. cashout_admin_decide(p jsonb) — « Renvoyer » et « Marquer versé » (B2 à B4, X18)
-- p = { cashout_id, actor_id, action: 'RESEND' | 'MARK_PAID', reason, reference?, fees?, provider_status? }
-- provider_status : statut SamirPay lu par la route juste avant (INCERTAIN ou ENVOYE avec identifiant).
-- Réponse : { ok: true, status[, confirmed_by_provider] } ou { ok: false, code, message } ; après un RESEND à
-- A_ENVOYER, la route appelle CashoutService.send (un seul envoi, réservation conditionnelle).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashout_admin_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id        uuid;
    v_actor     uuid;
    v_action    text := upper(btrim(COALESCE(p->>'action', '')));
    v_reason    text := btrim(COALESCE(p->>'reason', ''));
    v_ref       text := NULLIF(btrim(COALESCE(p->>'reference', '')), '');
    v_fees      numeric;
    v_provider  text := upper(NULLIF(btrim(COALESCE(p->>'provider_status', '')), ''));
    v_ustatus   text;
    v_super     boolean;
    v_allowed   boolean;
    v_role      text;
    c           record;
    v_first     text;
    v_last      text;
    v_name_fix  boolean := false;
BEGIN
    BEGIN
        v_id := NULLIF(p->>'cashout_id', '')::uuid;
        v_actor := NULLIF(p->>'actor_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CASHOUT_NOT_FOUND', 'message', 'Versement introuvable.');
    END;
    IF v_action NOT IN ('RESEND', 'MARK_PAID') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FIELD', 'message', 'Décision inconnue.');
    END IF;
    IF char_length(v_reason) < 10 OR char_length(v_reason) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez la raison (10 caractères au moins).');
    END IF;

    -- Administrateur ACTIF : SUPERADMIN, ou ADMIN avec la permission refunds.manage (jamais users.role)
    SELECT u.status::text INTO v_ustatus FROM public.users u WHERE u.id = v_actor;
    v_super := EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN');
    v_allowed := v_super OR (
        EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'ADMIN')
        AND EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'refunds.manage'));
    IF v_actor IS NULL OR v_ustatus IS DISTINCT FROM 'ACTIF' OR NOT v_allowed THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Action non autorisée.');
    END IF;
    v_role := CASE WHEN v_super THEN 'SUPERADMIN' ELSE 'ADMIN' END;

    IF v_action = 'MARK_PAID' THEN
        IF v_ref IS NULL OR NOT (v_ref ~ '^TX[A-Za-z0-9]{8}$'
                                 OR v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REFERENCE_REQUIRED', 'message', 'Indiquez la référence SamirPay du versement.');
        END IF;
        IF NULLIF(btrim(COALESCE(p->>'fees', '')), '') IS NOT NULL THEN
            BEGIN
                v_fees := (p->>'fees')::numeric;
            EXCEPTION WHEN invalid_text_representation THEN
                v_fees := -1;
            END;
            IF v_fees < 0 THEN
                RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FIELD', 'message', 'Frais invalides : indiquez un montant positif ou nul.');
            END IF;
        END IF;
    END IF;

    SELECT * INTO c FROM public.cashouts WHERE cashouts.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CASHOUT_NOT_FOUND', 'message', 'Versement introuvable.');
    END IF;
    IF c.status = 'CONFIRME' OR (c.kind = 'WITHDRAWAL' AND c.status = 'ECHOUE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_FINAL',
            'message', 'Ce versement est déjà clos : aucune décision n’est possible.');
    END IF;

    IF v_action = 'RESEND' THEN
        -- B3 : renvoi seulement si rien n'est parti
        IF c.status IN ('INCERTAIN', 'ENVOYE') THEN
            IF c.samirpay_transaction_id IS NULL THEN
                RETURN jsonb_build_object('ok', false, 'code', 'NOT_RESENDABLE',
                    'message', 'Ce versement ne peut pas être renvoyé : rien ne prouve qu’il n’est pas parti. Vérifiez auprès du support SamirPay, puis marquez-le versé s’il l’est.');
            END IF;
            IF v_provider = 'PENDING' THEN
                RETURN jsonb_build_object('ok', false, 'code', 'PROVIDER_PENDING',
                    'message', 'SamirPay indique que ce versement est encore en cours : attendez son issue.');
            END IF;
            -- B3 : SamirPay dit SUCCESS → confirmé d'office, rien ne repart ; la décision reste journalisée
            IF v_provider = 'SUCCESS' THEN
                UPDATE public.cashouts
                   SET status = 'CONFIRME', confirmed_at = now(), provider_status = 'SUCCESS', last_error = NULL, updated_at = now()
                 WHERE cashouts.id = c.id;
                PERFORM public.cashout_finalize(c.id, 'CONFIRME', c.samirpay_transaction_id);
                INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
                VALUES (v_actor, v_role, 'CASHOUT_RESENT', 'cashouts', c.id, jsonb_strip_nulls(jsonb_build_object(
                    'reason', v_reason, 'previous_status', c.status, 'samirpay_transaction_id', c.samirpay_transaction_id,
                    'provider_status', v_provider, 'outcome', 'CONFIRME_PAR_SAMIRPAY', 'kind', c.kind, 'amount', c.amount)));
                RETURN jsonb_build_object('ok', true, 'status', 'CONFIRME', 'confirmed_by_provider', true);
            END IF;
            IF v_provider IS NULL OR v_provider NOT IN ('FAILED', 'CANCELLED') THEN
                RETURN jsonb_build_object('ok', false, 'code', 'NOT_RESENDABLE',
                    'message', 'Ce versement ne peut pas être renvoyé : rien ne prouve qu’il n’est pas parti. Vérifiez auprès du support SamirPay, puis marquez-le versé s’il l’est.');
            END IF;
        ELSIF c.status = 'A_ENVOYER' THEN
            IF c.send_started_at IS NOT NULL THEN
                RETURN jsonb_build_object('ok', false, 'code', 'NOT_RESENDABLE',
                    'message', 'Ce versement ne peut pas être renvoyé : rien ne prouve qu’il n’est pas parti. Vérifiez auprès du support SamirPay, puis marquez-le versé s’il l’est.');
            END IF;
            IF c.blocked_reason = 'SIMULATED' THEN
                RETURN jsonb_build_object('ok', false, 'code', 'NOT_RESENDABLE',
                    'message', 'Ce versement a été créé en mode simulé : il ne part jamais en réel.');
            END IF;
            IF c.blocked_reason IN ('OPERATOR_UNKNOWN', 'PHONE_UNKNOWN') THEN
                RETURN jsonb_build_object('ok', false, 'code', 'NOT_RESENDABLE',
                    'message', 'Ce versement ne peut pas être renvoyé : l’opérateur ou le numéro du bénéficiaire est inconnu. Marquez-le versé s’il a été réglé autrement.');
            END IF;
            IF c.blocked_reason = 'NAME_UNKNOWN' THEN
                SELECT NULLIF(btrim(u.first_name), ''), NULLIF(btrim(u.last_name), '') INTO v_first, v_last
                  FROM public.users u WHERE u.id = c.beneficiary_user_id;
                IF v_first IS NULL OR v_last IS NULL THEN
                    RETURN jsonb_build_object('ok', false, 'code', 'NAME_STILL_UNKNOWN',
                        'message', 'Le prénom ou le nom du bénéficiaire manque encore : complétez son profil, puis renvoyez le versement.');
                END IF;
                v_name_fix := true;
            END IF;
        END IF;

        UPDATE public.cashouts
           SET status = 'A_ENVOYER', blocked_reason = NULL, send_started_at = NULL, sent_at = NULL, last_error = NULL,
               samirpay_transaction_id = NULL, provider_status = NULL, delay_flagged_at = NULL, alerted_at = NULL,
               first_name = CASE WHEN v_name_fix THEN v_first ELSE first_name END,
               last_name = CASE WHEN v_name_fix THEN v_last ELSE last_name END,
               updated_at = now()
         WHERE cashouts.id = c.id;
        IF c.refund_id IS NOT NULL THEN
            UPDATE public.refunds SET status = 'PENDING', updated_at = now() WHERE refunds.id = c.refund_id AND status = 'FAILED';
        END IF;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_actor, v_role, 'CASHOUT_RESENT', 'cashouts', c.id, jsonb_strip_nulls(jsonb_build_object(
            'reason', v_reason, 'previous_status', c.status, 'blocked_reason', c.blocked_reason,
            'samirpay_transaction_id', c.samirpay_transaction_id, 'provider_status', v_provider,
            'kind', c.kind, 'amount', c.amount)));
        RETURN jsonb_build_object('ok', true, 'status', 'A_ENVOYER');
    END IF;

    -- MARK_PAID : versé hors de l'envoi automatique, sur la foi de la référence SamirPay
    IF c.status IN ('INCERTAIN', 'ENVOYE') AND v_provider IN ('FAILED', 'CANCELLED') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PROVIDER_SAYS_FAILED',
            'message', 'SamirPay indique que ce versement a échoué : renvoyez-le plutôt.');
    END IF;
    UPDATE public.cashouts
       SET status = 'CONFIRME', confirmed_at = now(), provider_status = 'MANUEL', samirpay_reference = v_ref,
           samirpay_fees = COALESCE(v_fees, samirpay_fees), blocked_reason = NULL, last_error = NULL, updated_at = now()
     WHERE cashouts.id = c.id;
    PERFORM public.cashout_finalize(c.id, 'CONFIRME', v_ref);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'CASHOUT_MARKED_PAID', 'cashouts', c.id, jsonb_strip_nulls(jsonb_build_object(
        'reason', v_reason, 'reference', v_ref, 'fees', v_fees, 'previous_status', c.status,
        'blocked_reason', c.blocked_reason, 'provider_status', v_provider, 'kind', c.kind, 'amount', c.amount)));
    RETURN jsonb_build_object('ok', true, 'status', 'CONFIRME');
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. notif_cashouts_notify() — recopie de 20261103000006_lot6_pros_admin.sql:316-502 (voir l'en-tête)
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
        SELECT p.amount, p.operator::text, NULLIF(p.metadata->>'duplicate_of', '')
          INTO v_pay_amount, v_pay_operator, v_duplicate_of
          FROM public.payments p WHERE p.id = NEW.payment_id;
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'PAYMENT_REFUND_STARTED',
            'key', 'PAYMENT_REFUND_STARTED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'event_id', v_event,
            'data', v_event_data || jsonb_strip_nulls(jsonb_build_object(
                'cashout_id', NEW.id, 'payment_id', NEW.payment_id, 'amount', COALESCE(v_pay_amount, NEW.amount),
                'operator', COALESCE(NEW.operator::text, v_pay_operator), 'duplicate_of', v_duplicate_of))
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

DROP TRIGGER IF EXISTS trg_cashouts_notify ON public.cashouts;
CREATE TRIGGER trg_cashouts_notify
    AFTER INSERT OR UPDATE OF status, blocked_reason, delay_flagged_at ON public.cashouts
    FOR EACH ROW EXECUTE FUNCTION public.notif_cashouts_notify();


-- ----------------------------------------------------------------------------
-- 6. event_cancellation_progress(p jsonb) — recopie de 20261102000003_lot5_cycle.sql:761-824 (voir l'en-tête)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_cancellation_progress(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    a record;
    c record;
    o record;
    k record;
    v_out jsonb;
BEGIN
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    WITH co AS (
        SELECT DISTINCT ON (x.id) x.id, x.status::text AS status, x.blocked_reason, x.amount
          FROM public.cashouts x
          JOIN public.payments pay ON pay.id = x.payment_id
         WHERE x.kind <> 'WITHDRAWAL'
           AND (pay.event_id = v_event
                OR pay.id IN (SELECT tk.payment_id FROM public.tickets tk WHERE tk.event_id = v_event AND tk.payment_id IS NOT NULL))
    ), late AS (
        -- Lot 9 bis (B9) : remboursements de l'événement présents dans « Versements à reprendre »
        SELECT r.id FROM public.cashouts_to_resume() r
    )
    SELECT count(*) FILTER (WHERE co.status = 'CONFIRME') AS paid_n,
           COALESCE(sum(co.amount) FILTER (WHERE co.status = 'CONFIRME'), 0) AS paid_t,
           count(*) FILTER (WHERE (co.status = 'A_ENVOYER' AND co.blocked_reason IS NULL) OR co.status = 'ENVOYE') AS prog_n,
           COALESCE(sum(co.amount) FILTER (WHERE (co.status = 'A_ENVOYER' AND co.blocked_reason IS NULL) OR co.status = 'ENVOYE'), 0) AS prog_t,
           count(*) FILTER (WHERE co.status = 'INCERTAIN') AS verif_n,
           COALESCE(sum(co.amount) FILTER (WHERE co.status = 'INCERTAIN'), 0) AS verif_t,
           count(*) FILTER (WHERE co.status = 'ECHOUE' OR (co.status = 'A_ENVOYER' AND co.blocked_reason IS NOT NULL)) AS retry_n,
           COALESCE(sum(co.amount) FILTER (WHERE co.status = 'ECHOUE' OR (co.status = 'A_ENVOYER' AND co.blocked_reason IS NOT NULL)), 0) AS retry_t,
           count(*) FILTER (WHERE late.id IS NOT NULL) AS late_n,
           COALESCE(sum(co.amount) FILTER (WHERE late.id IS NOT NULL), 0) AS late_t
      INTO c
      FROM co LEFT JOIN late ON late.id = co.id;

    SELECT count(*) AS n, COALESCE(sum(rf.amount), 0) AS total INTO o
      FROM public.refunds rf
      JOIN public.tickets tk ON tk.id = rf.ticket_id
     WHERE tk.event_id = v_event AND rf.settlement = 'ORGANISATEUR';

    -- Lot 9 bis (tâche 4, R20, B22) : ventes au guichet à rendre en espèces par l'organisateur, même périmètre que
    -- event_cash_refunds (M06) : paiements hors plateforme SUCCESS de l'événement, marques « Remboursé » comptées.
    SELECT count(*) AS n, COALESCE(sum(pay.amount), 0) AS total,
           count(m.payment_id) AS rn, COALESCE(sum(pay.amount) FILTER (WHERE m.payment_id IS NOT NULL), 0) AS rtotal
      INTO k
      FROM public.payments pay
      LEFT JOIN public.event_cash_refund_marks m ON m.payment_id = pay.id
     WHERE pay.event_id = v_event AND NOT pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
       AND pay.status::text = 'SUCCESS' AND pay.amount > 0;

    v_out := jsonb_build_object(
        'ok', true,
        'paid', jsonb_build_object('count', c.paid_n, 'total', c.paid_t),
        'in_progress', jsonb_build_object('count', c.prog_n, 'total', c.prog_t),
        'verifying', jsonb_build_object('count', c.verif_n, 'total', c.verif_t),
        'delayed', jsonb_build_object('count', c.late_n, 'total', c.late_t),
        'organizer_cash', jsonb_build_object('count', o.n, 'total', o.total),
        'counter_cash', jsonb_build_object('count', k.n, 'total', k.total, 'refunded_count', k.rn, 'refunded_total', k.rtotal));
    IF a.is_staff THEN
        v_out := v_out || jsonb_build_object('to_retry', jsonb_build_object('count', c.retry_n, 'total', c.retry_t));
    END IF;
    RETURN v_out;
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. checkout_create_payment(p jsonb) — recopie intégrale de 20261105000006_lot7_client.sql:24-136 (voir l'en-tête)
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
-- 8. calculate_referral_commissions(p_payment_id uuid) — recopie intégrale de
--    20261106000004_lot8_commissions.sql:37-112 (voir l'en-tête)
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
-- 9. referral_commissions_realign(p_event uuid DEFAULT NULL) — reprise R106 (B12), rend le nombre de lignes déplacées
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_commissions_realign(p_event uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_days integer := public.fin_setting_num('finance.referral_availability_days')::int;
    c record;
    v_new timestamptz;
    v_status text;
    v_entry uuid;
    v_moved integer := 0;
BEGIN
    -- Lignes non annulées, jamais retirées (paid_amount = 0, B12), d'un paiement de billets rattaché à un événement.
    -- Verrou des commissions par identifiant croissant (tableau 3.3 : events → commissions → grand livre).
    FOR c IN
        SELECT rc.id, rc.available_at, rc.status::text AS status, p.event_id
          FROM public.referral_commissions rc
          JOIN public.payments p ON p.id = rc.payment_id
         WHERE rc.kind = 'COMMISSION' AND rc.cancelled_at IS NULL AND rc.paid_amount = 0
           AND rc.status::text IN ('PENDING', 'AVAILABLE')
           AND p.payment_target::text = 'TICKET' AND p.event_id IS NOT NULL
           AND (p_event IS NULL OR p.event_id = p_event)
         ORDER BY rc.id
           FOR UPDATE OF rc
    LOOP
        v_new := GREATEST(c.available_at, public.fin_event_end(c.event_id) + make_interval(days => v_days));
        -- Fin illisible : GREATEST garde l'ancienne date ; rien ne bouge si la date est déjà la bonne.
        CONTINUE WHEN v_new IS NULL OR v_new IS NOT DISTINCT FROM c.available_at;
        v_status := CASE WHEN c.status = 'AVAILABLE' AND v_new > now() THEN 'PENDING' ELSE c.status END;
        UPDATE public.referral_commissions
           SET available_at = v_new, status = v_status::commission_status_enum, updated_at = now()
         WHERE id = c.id;
        -- Écriture COMMISSION de la ligne, puis les compensations de créance qu'elle a payées (même date)
        v_entry := NULL;
        SELECT l.id INTO v_entry FROM public.finance_ledger l WHERE l.source_key = 'COMM-' || c.id::text;
        IF v_entry IS NOT NULL THEN
            UPDATE public.finance_ledger SET available_at = v_new
             WHERE id = v_entry OR source_key LIKE 'COMP-' || v_entry::text || '-%';
        END IF;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (NULL, 'SYSTEM', 'REFERRAL_COMMISSION_DEFERRED', 'referral_commissions', c.id, jsonb_build_object(
            'commission_id', c.id, 'event_id', c.event_id, 'old_available_at', c.available_at, 'new_available_at', v_new,
            'old_status', c.status, 'new_status', v_status,
            'regle', format('fin de l''événement + %s jours (finance.referral_availability_days)', v_days)));
        v_moved := v_moved + 1;
    END LOOP;
    RETURN v_moved;
END;
$$;

COMMENT ON FUNCTION public.referral_commissions_realign(uuid) IS
    'Lot 9 bis (R106, B12) : commission d''un billet repoussée à la fin de l''événement + délai réglé (jamais avancée), PENDING si la nouvelle date est future ; écriture COMM-<id> et compensations suivies ; audit REFERRAL_COMMISSION_DEFERRED par ligne ; lignes déjà retirées inchangées. Service_role seul.';


-- ----------------------------------------------------------------------------
-- 10. events_referral_realign() — trigger : la fin d'un événement recule, ses commissions suivent
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.events_referral_realign()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_date IS DISTINCT FROM OLD.end_date OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
        PERFORM public.referral_commissions_realign(NEW.id);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_referral_realign ON public.events;
CREATE TRIGGER trg_events_referral_realign
    AFTER UPDATE OF start_date, start_time, end_date, end_time ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_referral_realign();


-- ============================================================================
-- Privilèges : service_role uniquement (règle 1A.3)
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.cashouts_to_resume()',
        'public.cashouts_flag_delayed()',
        'public.cashout_admin_decide(jsonb)',
        'public.notif_cashouts_notify()',
        'public.event_cancellation_progress(jsonb)',
        'public.checkout_create_payment(jsonb)',
        'public.calculate_referral_commissions(uuid)',
        'public.referral_commissions_realign(uuid)',
        'public.events_referral_realign()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;


-- ============================================================================
-- Reprise de données (DML en fin de fichier) — tâche 7 (R106, B12)
-- Commissions de billets déjà posées à « confirmation + délai » : repoussées à la fin de l'événement + délai.
-- Rejouable : referral_commissions_realign ne touche une ligne que si sa date change (IS NOT DISTINCT FROM) ;
-- le nombre de lignes déplacées et celui des lignes déjà retirées (laissées telles quelles) sont annoncés.
-- ============================================================================
DO $$
DECLARE
    v_moved integer;
    v_paid integer;
BEGIN
    v_moved := public.referral_commissions_realign(NULL);
    SELECT count(*) INTO v_paid
      FROM public.referral_commissions rc JOIN public.payments p ON p.id = rc.payment_id
     WHERE rc.kind = 'COMMISSION' AND rc.cancelled_at IS NULL AND rc.paid_amount > 0
       AND p.payment_target::text = 'TICKET' AND p.event_id IS NOT NULL;
    RAISE NOTICE 'lot 9 bis R106 : % commission(s) repoussée(s) à la fin de l''événement + délai ; % ligne(s) déjà retirée(s) en tout ou partie, inchangée(s)', v_moved, v_paid;
END;
$$;

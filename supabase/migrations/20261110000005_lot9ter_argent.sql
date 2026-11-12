-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : argent (contrat 3.1 n° 05, 3.4 F7 à F10, 5.A A.2, A.4, A.5 ; arbitrages 11, 14, 15)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS puis ADD, CREATE OR
-- REPLACE, privilèges réappliqués. DDL avant toute fonction ; aucune donnée reprise.
-- Tâches fusionnées, dans l'ordre de leurs commits (section 10) :
--  9t.3 (consigne 0.3, fix(9t.3)) — « Constater non versé » :
--   1. Colonnes cashouts.not_sent_reference (1 à 100), not_sent_reason (10 à 500), not_sent_at, not_sent_by (sans
--      clé étrangère, K9) et contrainte cashouts_not_sent_chk (tout ou rien). cashouts reste service_role seul
--      (20261031000017_lot2_remboursements.sql:40-41) : rien ne fuit par REST. Contrainte nouvelle, recréée par
--      aucune migration gelée (A3).
--   2. cashout_admin_not_sent(p jsonb) (nouvelle, F7) : un SUPERADMIN actif, dont la session a saisi son mot de
--      passe depuis moins de 10 minutes (deuxième contrôle, D9), constate avec le support SamirPay qu'un versement
--      INCERTAIN sans identifiant SamirPay n'est pas parti : ECHOUE (provider_status NON_VERSE), cashout_finalize
--      ECHOUE (remboursement FAILED ; retrait REJECTED, RETRAIT_ANNULE du brut), audit CASHOUT_NOT_SENT dans la
--      même transaction que la transition (x3). Verrou du versement seul (FOR UPDATE), puis ceux de cashout_finalize
--      (remboursement ou retrait, grand livre) : ordre du tableau 3.3 inchangé. Rien ne repart : « Renvoyer »
--      (cashout_admin_decide, inchangée) reste une décision humaine (x4). Avis : trg_cashouts_notify inchangé.
--  9t.6 (consigne 0.6, fix(9t.6), conditionnel, déclenché par le run « avant » 128) — risque w19 :
--   3. cashout_fee_apply (recopie F10, base 20261109000005_lot9bis_samirpay.sql:80-182) : frais d'un remboursement
--      passé en entier en créance → entièrement en créance, plus de repli de date ; w19 inchangé.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Colonnes du constat « non versé » (9t.3)
-- ----------------------------------------------------------------------------
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS not_sent_reference text;
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS not_sent_reason text;
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS not_sent_at timestamptz;
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS not_sent_by uuid;
ALTER TABLE public.cashouts DROP CONSTRAINT IF EXISTS cashouts_not_sent_chk;
ALTER TABLE public.cashouts ADD CONSTRAINT cashouts_not_sent_chk CHECK (
    (not_sent_at IS NULL AND not_sent_reference IS NULL AND not_sent_reason IS NULL AND not_sent_by IS NULL)
    OR (not_sent_at IS NOT NULL AND not_sent_by IS NOT NULL
        AND char_length(btrim(not_sent_reference)) BETWEEN 1 AND 100
        AND char_length(btrim(not_sent_reason)) BETWEEN 10 AND 500));
COMMENT ON COLUMN public.cashouts.not_sent_reference IS 'Lot 9 ter (0.3) : référence du support SamirPay qui confirme que le versement n''est pas parti (1 à 100 caractères)';
COMMENT ON COLUMN public.cashouts.not_sent_reason IS 'Lot 9 ter (0.3) : motif du constat « non versé » (10 à 500 caractères)';
COMMENT ON COLUMN public.cashouts.not_sent_at IS 'Lot 9 ter (0.3) : heure du constat « non versé » ; gardée après « Renvoyer »';
COMMENT ON COLUMN public.cashouts.not_sent_by IS 'Lot 9 ter (0.3) : SUPERADMIN auteur du constat (sans clé étrangère, K9)';


-- ----------------------------------------------------------------------------
-- 2. cashout_admin_not_sent(p jsonb) — « Constater non versé » (9t.3, F7)
-- p = { cashout_id, actor_id, session_id, reference, reason }
-- Réponse : { ok: true, status: 'ECHOUE', kind } ou { ok: false, code, message } (patron cashout_admin_decide).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashout_admin_not_sent(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id      uuid := public.try_uuid(p->>'cashout_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_session uuid := public.try_uuid(p->>'session_id');
    v_reason  text := btrim(COALESCE(p->>'reason', ''));
    v_ref     text := btrim(COALESCE(p->>'reference', ''));
    c         record;
BEGIN
    IF v_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CASHOUT_NOT_FOUND', 'message', 'Versement introuvable.');
    END IF;
    IF char_length(v_reason) < 10 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez la raison (10 caractères au moins).');
    END IF;
    IF char_length(v_reason) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'La raison ne doit pas dépasser 500 caractères.');
    END IF;
    IF char_length(v_ref) NOT BETWEEN 1 AND 100 OR v_ref ~ '[[:cntrl:]]' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPPORT_REFERENCE_REQUIRED',
            'message', 'Indiquez la référence du support SamirPay (100 caractères au plus).');
    END IF;

    -- Acteur, sans verrou : SUPERADMIN par user_roles (jamais users.role), compte ACTIF
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY',
            'message', 'Seul un superadmin peut constater qu’un versement n’est pas parti.');
    END IF;

    -- Mot de passe saisi dans cette session depuis moins de 10 minutes (deuxième contrôle, D9)
    IF v_session IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.password_confirmations pc
         WHERE pc.session_id = v_session AND pc.user_id = v_actor
           AND pc.confirmed_at > clock_timestamp() - interval '10 minutes') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PASSWORD_CONFIRMATION_REQUIRED',
            'message', 'Par sécurité, saisissez votre mot de passe pour continuer.');
    END IF;

    SELECT * INTO c FROM public.cashouts WHERE cashouts.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CASHOUT_NOT_FOUND', 'message', 'Versement introuvable.');
    END IF;
    -- Après le verrou : un second constat concurrent voit l'ECHOUE du premier
    IF c.status <> 'INCERTAIN' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_UNCERTAIN',
            'message', 'Ce versement n’est plus à l’issue incertaine : relisez la liste.');
    END IF;
    IF c.samirpay_transaction_id IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PROVIDER_ID_KNOWN',
            'message', 'SamirPay a un identifiant pour ce versement : son statut fait foi. Renvoyez-le (le statut est relu d’abord) ou marquez-le versé.');
    END IF;

    -- Transition journalisée par trg_audit_cashouts ; avis par trg_cashouts_notify (inchangés)
    UPDATE public.cashouts
       SET status = 'ECHOUE', provider_status = 'NON_VERSE', last_error = 'Non versé : constaté avec le support SamirPay',
           not_sent_reference = v_ref, not_sent_reason = v_reason, not_sent_at = now(), not_sent_by = v_actor,
           updated_at = now()
     WHERE cashouts.id = c.id;
    PERFORM public.cashout_finalize(c.id, 'ECHOUE', 'Non versé (constaté avec le support SamirPay)');

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'CASHOUT_NOT_SENT', 'cashouts', c.id, jsonb_build_object(
        'reference', v_ref, 'reason', v_reason, 'previous_status', c.status, 'kind', c.kind, 'amount', c.amount,
        'attempt_count', c.attempt_count, 'last_error', c.last_error));

    RETURN jsonb_build_object('ok', true, 'status', 'ECHOUE', 'kind', c.kind);
END;
$$;

COMMENT ON FUNCTION public.cashout_admin_not_sent(jsonb) IS
    'Lot 9 ter (0.3, F7) : « Constater non versé » d''un versement INCERTAIN sans identifiant SamirPay, par un SUPERADMIN actif au mot de passe récent ; ECHOUE, cashout_finalize, audit CASHOUT_NOT_SENT dans la même transaction. Service_role seul.';

REVOKE ALL ON FUNCTION public.cashout_admin_not_sent(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cashout_admin_not_sent(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. cashout_fee_apply(p_cashout_id uuid) — frais d'un remboursement passé en entier en créance (9t.6, F10)
--    Base : 20261109000005_lot9bis_samirpay.sql:80-182 (dernière définition, grep de toutes les migrations),
--    recopie intégrale, signature (uuid) → jsonb, VOLATILE, SECURITY DEFINER et search_path identiques.
--    Le rouge de 9t.6 a rougi au run « avant » 128 (argent9ter-frais-creance, étape 6 : w19 violé par
--    CASHOUT_FEE-<id>), d'où cette recopie conditionnelle (contrat A.4.3, D-A19).
--    Seul changement : sans écriture REMBOURSEMENT du même remboursement (débit passé en entier en créance par
--    fin_ledger_debit, solde nul), le repli de date GREATEST(now(), max VENTE) (base :142-147) disparaît et les
--    frais vont en entier en créance CASHOUT_FEE-<id>-CREANCE, quel que soit le solde ; le texte de l'alerte
--    FINANCE_DEBT_CREATED le dit, ses métadonnées reçoivent refund_in_debt. Aucune écriture CASHOUT_FEE ne peut plus
--    violer w19 (inchangé). available_at rendu vaut NULL dans cette branche (lu par personne : cashout_finalize fait
--    PERFORM). Filtres X4, idempotence par source_key, verrou fin_account_lock, tout ou rien : identiques.
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
    -- Lot 9 ter (0.6, D-A19) : sans écriture REMBOURSEMENT de ce remboursement (passé en entier en créance), aucun repli
    -- de date : les frais vont en entier en créance, quel que soit le solde. Aucune écriture CASHOUT_FEE ne peut violer w19.

    v_key := 'CASHOUT_FEE-' || c.id::text;
    PERFORM public.fin_account_lock(v_owner, 'ORGANISATEUR');
    SELECT l.id INTO v_entry FROM public.finance_ledger l WHERE l.source_key = v_key;
    SELECT d.id INTO v_debt FROM public.finance_debts d WHERE d.source_key = v_key || '-CREANCE';
    IF v_entry IS NOT NULL OR v_debt IS NOT NULL THEN
        RETURN jsonb_build_object('applied', true, 'already', true, 'entry_id', v_entry, 'debt_id', v_debt);
    END IF;

    IF v_at IS NOT NULL THEN
        SELECT COALESCE(sum(l.amount), 0) INTO v_total
          FROM public.finance_ledger l WHERE l.owner_id = v_owner AND l.account_kind = 'ORGANISATEUR';
    END IF;
    IF v_at IS NOT NULL AND v_total >= c.samirpay_fees THEN
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
            CASE WHEN v_at IS NULL
                 THEN format('Débit REGULARISATION de %s F sur le compte ORGANISATEUR : frais d''un remboursement lui-même passé en créance, créance de %s F à compenser sur les gains futurs.', c.samirpay_fees, c.samirpay_fees)
                 ELSE format('Débit REGULARISATION de %s F sur le compte ORGANISATEUR : solde insuffisant, créance de %s F à compenser sur les gains futurs.', c.samirpay_fees, c.samirpay_fees) END,
            'finance_debts', v_debt,
            jsonb_build_object('owner_id', v_owner, 'account_kind', 'ORGANISATEUR', 'entry_type', 'REGULARISATION', 'amount', c.samirpay_fees,
                               'debt', c.samirpay_fees, 'source_key', v_key, 'payment_id', v_payment, 'refund_id', c.refund_id, 'event_id', v_event,
                               'cashout_id', c.id, 'refund_in_debt', (v_at IS NULL)));
    END IF;
    RETURN jsonb_build_object('applied', true, 'entry_id', v_entry, 'debt_id', v_debt, 'amount', c.samirpay_fees, 'available_at', v_at);
END;
$$;

REVOKE ALL ON FUNCTION public.cashout_fee_apply(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cashout_fee_apply(uuid) TO service_role;

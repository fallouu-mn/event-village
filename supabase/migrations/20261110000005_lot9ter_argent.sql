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

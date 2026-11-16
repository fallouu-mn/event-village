-- Correctifs de la contre-vérification de la finition 2a, T2 — valider l'écart d'une caisse : refusé à une fiche SUSPENDU
-- (route et base) ; l'écart reste à valider par un admin muni de events.write. Rapport d'audit docs/audit-finition-2a.md,
-- T2 : une partenaire suspendue validait l'écart d'une caisse de son événement (« à valider » → « validé par elle »).
--
-- Côté route : /api/partner/shifts/* compte parmi les écritures refusées à une fiche SUSPENDU (partnerEventWrite, T1).
-- Côté base (cette migration) : shift_discrepancy_validate (recopie de 20261111000005_lot9quater_argent.sql) :
--   1. en tête, la propriétaire dont la fiche est SUSPENDU est refusée (PARTNER_SUSPENDED, même texte que les autres
--      écritures) ;
--   2. un admin muni de events.write (compte ACTIF) valide aussi l'écart, journalisé avec son rôle (ADMIN) ; jusqu'ici seule
--      la propriétaire le pouvait, ce qui aurait laissé sans issue l'écart d'une fiche suspendue. Un admin sans la
--      permission, un tiers : « Caisse introuvable », comme avant.
-- Le reste est inchangé (caisse fermée, écart non nul, pas encore validé). Aucune donnée existante n'est modifiée.
-- Sans BEGIN ni COMMIT (transaction de la CLI), rejouable : CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.shift_discrepancy_validate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift uuid := public.try_uuid(p->>'shift_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    sh record;
    v_owner boolean;
    v_admin boolean;
BEGIN
    -- Correctifs de la contre-vérification (T2) : fiche SUSPENDU, caisses de ses événements en lecture seule pour la
    -- partenaire (l'admin events.write garde la validation), contrôlé avant tout le reste
    IF public.partner_owner_suspended((SELECT s.event_id FROM public.controller_shifts s WHERE s.id = v_shift), v_actor) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_shift IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Caisse ou compte manquant.');
    END IF;
    SELECT s.id, s.status::text AS status, s.partner_id, s.discrepancy_amount, s.discrepancy_validated_at, s.event_id
      INTO sh FROM public.controller_shifts s WHERE s.id = v_shift FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Caisse introuvable.');
    END IF;
    v_owner := EXISTS (SELECT 1 FROM public.partners pa JOIN public.users u ON u.id = pa.user_id
                        WHERE pa.id = sh.partner_id AND pa.user_id = v_actor AND u.status::text = 'ACTIF');
    -- T2 : un admin muni de events.write (compte ACTIF) valide aussi l'écart
    v_admin := NOT v_owner
               AND COALESCE(public.admin_can(v_actor, 'events.write'), FALSE)
               AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF');
    IF NOT (v_owner OR v_admin) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Caisse introuvable.');
    END IF;
    IF sh.status <> 'CLOTURE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_CLOSED', 'message', 'La caisse n''est pas encore fermée.');
    END IF;
    IF COALESCE(sh.discrepancy_amount, 0) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_DISCREPANCY', 'message', 'Cette caisse n''a pas d''écart à valider.');
    END IF;
    IF sh.discrepancy_validated_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_VALIDATED', 'message', 'L''écart de cette caisse est déjà validé.');
    END IF;
    UPDATE public.controller_shifts
       SET discrepancy_validated_at = now(), discrepancy_validated_by = v_actor, updated_at = now()
     WHERE id = v_shift;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN v_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END, 'SHIFT_DISCREPANCY_VALIDATED', 'controller_shifts', v_shift,
            jsonb_build_object('event_id', sh.event_id, 'discrepancy', sh.discrepancy_amount));
    RETURN jsonb_build_object('ok', true, 'shift_id', v_shift, 'discrepancy', sh.discrepancy_amount, 'validated_at', now());
END;
$$;
REVOKE ALL ON FUNCTION public.shift_discrepancy_validate(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shift_discrepancy_validate(jsonb) TO service_role;

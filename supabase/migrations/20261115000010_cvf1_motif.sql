-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — T5 : motif d'un admin de 5 à 500 caractères sur
-- « Renvoyer », « Annuler » et « Effacer » une invitation
-- ============================================================================
-- Recopie de controller_invitation_actor_check (20261115000002_finition1_equipe.sql) ; seul ajout : un motif de plus de
-- 500 caractères est refusé (REASON_TOO_LONG, même texte que adminReasonRefusal côté route). Appelée par
-- controller_invitation_resend, _cancel et _clear. Réservée au service_role. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.controller_invitation_actor_check(p jsonb, p_owner uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_staff boolean := FALSE;
BEGIN
    IF p_owner IS DISTINCT FROM v_actor THEN
        v_staff := COALESCE(public.admin_can(v_actor, 'events.write'), FALSE);
        IF NOT v_staff THEN
            IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
                RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.write',
                    'message', 'Action non autorisée : votre compte n’a pas la permission « Gérer les événements ».');
            END IF;
            RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    -- cvf1 T5 : motif d'admin de 5 à 500 caractères, comme adminReasonRefusal (team-access.ts)
    IF v_staff AND char_length(COALESCE(v_reason, '')) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_TOO_LONG', 'message', 'Le motif est trop long : 500 caractères au plus. Raccourcissez-le.');
    END IF;
    IF v_staff AND char_length(COALESCE(v_reason, '')) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
            'message', 'Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'staff', v_staff, 'reason', v_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.controller_invitation_actor_check(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_invitation_actor_check(jsonb, uuid) TO service_role;

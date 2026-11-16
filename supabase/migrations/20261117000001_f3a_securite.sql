-- ============================================================================
-- EVENT VILLAGE — Finition 3a (argent de l'administration), point 1b : SÉCURITÉ D'ABORD — permission de l'auteur
-- vérifiée en base, et non plus seulement par la route
-- ============================================================================
-- Constat (état des lieux du 16/11) : deux fonctions d'administration, exécutables par service_role seul, faisaient
-- confiance à la route pour le contrôle de l'auteur :
--   1. partner_status_set (base : 20261109000006_lot9bis_argent.sql:772-936, dernière définition, grep de toutes les
--      migrations) n'exigeait qu'un rôle ADMIN ou SUPERADMIN au compte ACTIF : un ADMIN sans partners.validate pouvait
--      valider, refuser ou réactiver, et un ADMIN suspendre, si une route l'appelait sans contrôle ;
--   2. admin_permissions_set (base : 20261108000001_lot9_securite.sql:579-622) ne lisait pas l'auteur du tout et
--      testait la cible sur l'ancienne colonne users.role (un SUPERADMIN dont users.role dit CLIENT recevait des droits,
--      un ADMIN dont users.role dit SUPERADMIN était refusé, un compte sans rôle ADMIN recevait des droits).
-- Correctif : recopies intégrales ; seules les lignes marquées « Finition 3a (1b) » changent :
--   1. suspendre : SUPERADMIN exigé ; valider, refuser, réactiver : admin_can(auteur, 'partners.validate') ; refus
--      FORBIDDEN (texte français, permission ou rôle nommé), avant tout verrou et toute écriture ;
--   2. auteur SUPERADMIN au compte ACTIF (FORBIDDEN sinon) ; cible lue dans user_roles : SUPERADMIN → TARGET_IS_SUPERADMIN,
--      sans rôle ADMIN → TARGET_NOT_ADMIN (nouveau refus, traduit en 400 par POST /api/admin/permissions).
-- Signatures, volatilité, SECURITY DEFINER et search_path identiques ; droits réaffirmés (service_role seul).
-- Aucune donnée existante modifiée. Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT idempotents).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. partner_status_set : permission de l'auteur selon l'action
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
    -- Finition 3a (1b) : permission de l'auteur, comme la route (app/api/admin/partners/[id]/status/route.ts) : suspendre
    -- est réservé au SUPERADMIN (lot 9 quater, B2) ; valider, refuser ou réactiver exige partners.validate (le SUPERADMIN
    -- a toutes les permissions). Contrôlé avant tout verrou et toute écriture.
    IF v_status = 'SUSPENDU' AND NOT EXISTS (
        SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'required_role', 'SUPERADMIN',
                                  'message', 'Seul un Superadmin peut suspendre une partenaire.');
    END IF;
    IF v_status IN ('VALIDE', 'REJETE') AND NOT COALESCE(public.admin_can(v_actor, 'partners.validate'), FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'permission', 'partners.validate',
                                  'message', 'Action non autorisée : votre compte n’a pas la permission « Valider les partenaires ».');
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
    -- Lot 9 bis (R6, R55, B37) : table fermée. EN_ATTENTE → VALIDE ; EN_ATTENTE → REJETE ; VALIDE → SUSPENDU ;
    -- SUSPENDU → VALIDE. REJETE ne revient EN_ATTENTE que par le complément du dossier (partner_dossier_resubmit).
    IF v_status = 'REJETE' AND pa.status::text <> 'EN_ATTENTE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'status', pa.status::text,
                                  'message', 'Seul un dossier en attente peut être refusé. Pour un partenaire validé, utilisez la suspension.');
    END IF;
    IF v_status = 'SUSPENDU' AND pa.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'status', pa.status::text,
                                  'message', 'Seul un partenaire validé peut être suspendu.');
    END IF;
    IF v_status = 'VALIDE' AND pa.status::text NOT IN ('EN_ATTENTE', 'SUSPENDU') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'status', pa.status::text,
                                  'message', 'Un dossier refusé doit d’abord être complété par le partenaire : il revient alors en attente de validation.');
    END IF;
    IF (v_status IN ('REJETE', 'SUSPENDU') OR (v_status = 'VALIDE' AND pa.status::text = 'SUSPENDU'))
       AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
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

    -- Lot 9 bis (ex-10.0 c, B45) : journal dans la transaction ; un échec du journal annule le changement de statut
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor,
            CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
                 THEN 'SUPERADMIN' ELSE 'ADMIN' END,
            'PARTNER_STATUS_SET', 'partners', pa.id,
            jsonb_build_object('status', pa.status::text),
            jsonb_build_object('status', v_row.status, 'is_verified', v_row.is_verified),
            jsonb_build_object('reason', v_reason, 'user_id', pa.user_id, 'sessions_revoked', v_revoked,
                               'events_suspended', to_jsonb(v_suspended), 'events_restored', to_jsonb(v_restored),
                               'events_left_suspended', to_jsonb(v_left)));

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
    'Lot 6 (J2.6), lot 9 bis (R5), finition 3a (1b) : validation, refus, suspension ou réactivation d''un partenaire ; permission de l''auteur vérifiée en base (partners.validate pour valider, refuser ou réactiver ; SUPERADMIN pour suspendre) ; partners.status et users.status dans la même transaction, sessions révoquées à la suspension, cascade sur les événements, journal dans la transaction. service_role uniquement.';
REVOKE ALL ON FUNCTION public.partner_status_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_status_set(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. admin_permissions_set : auteur SUPERADMIN actif, cible lue dans user_roles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_permissions_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin uuid := public.try_uuid(p->>'admin_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_target record;
    v_before text[];
    v_after text[];
BEGIN
    IF v_actor IS NULL OR jsonb_typeof(p->'permissions') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Changement de permissions incomplet.');
    END IF;
    -- Finition 3a (1b) : auteur SUPERADMIN (user_roles) au compte ACTIF, contrôlé en base et non plus seulement par la route
    IF NOT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.id = v_actor AND u.status::text = 'ACTIF'
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text = 'SUPERADMIN')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                  'message', 'Seul un Superadmin actif modifie les droits d’un administrateur.');
    END IF;

    -- Finition 3a (1b) : plus aucune lecture de users.role (seulement l'adresse, pour le journal)
    SELECT id, email INTO v_target FROM public.users WHERE id = v_admin FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_FOUND', 'message', 'Administrateur cible introuvable.');
    END IF;
    -- Finition 3a (1b) : rôles de la cible lus dans user_roles, jamais dans l'ancienne colonne users.role
    IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_admin AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_IS_SUPERADMIN', 'message', 'Le Superadmin dispose de toutes les permissions par défaut.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_admin AND r.role::text = 'ADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_ADMIN',
                                  'message', 'Ce compte n’est pas administrateur : ses droits ne se règlent pas ici.');
    END IF;

    SELECT COALESCE(array_agg(permission ORDER BY permission), ARRAY[]::text[]) INTO v_before
      FROM public.admin_permissions WHERE user_id = v_admin;
    SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::text[]) INTO v_after
      FROM jsonb_array_elements_text(p->'permissions') AS x;

    DELETE FROM public.admin_permissions WHERE user_id = v_admin;
    INSERT INTO public.admin_permissions (user_id, permission, granted_by)
    SELECT v_admin, x, v_actor FROM unnest(v_after) AS x;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'UPDATE_PERMISSIONS', 'admin_permissions', v_admin,
            jsonb_build_object('permissions', to_jsonb(v_before)),
            jsonb_build_object('permissions', to_jsonb(v_after)),
            jsonb_build_object('target_email', v_target.email));

    RETURN jsonb_build_object('ok', true, 'permissions', to_jsonb(v_after), 'before', to_jsonb(v_before));
END;
$$;

COMMENT ON FUNCTION public.admin_permissions_set(jsonb) IS
    'Lot 9 (A33), finition 3a (1b) : remplace les droits d''un ADMIN (user_roles) et journalise dans la transaction ; auteur SUPERADMIN au compte ACTIF exigé en base ; cible SUPERADMIN ou sans rôle ADMIN refusée (rôles lus dans user_roles, jamais users.role). service_role uniquement.';
REVOKE ALL ON FUNCTION public.admin_permissions_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_permissions_set(jsonb) TO service_role;

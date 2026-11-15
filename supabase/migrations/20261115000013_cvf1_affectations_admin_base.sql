-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — T1 en base : aucune affectation de contrôleur
-- pour un compte ADMIN ou SUPERADMIN
-- ============================================================================
-- Fonctions qui créent une affectation (INSERT INTO event_controllers), relevées dans toutes les migrations, dernière
-- version de chacune :
--   - controller_assignments_sync (20261111000001_lot9quater_comptes.sql) : recopiée ici, seul ajout : refus
--     NOT_INVITABLE quand au moins un événement serait ajouté à un compte d'administration ;
--   - controller_invitation_respond (20261115000006_cvf1_admin_non_invitable.sql) : refuse déjà l'acceptation d'un tel
--     compte (NOT_INVITABLE) ; inchangée.
-- Aucune autre fonction n'écrit dans event_controllers. Le serveur y écrit aussi directement (route d'invitation, pour un
-- compte neuf, à activer ou déjà connu de l'organisatrice) : la garde de la table ci-dessous (trigger) couvre ce chemin
-- et tout chemin futur, avec le même texte neutre.
-- Réservées au service_role (la fonction du trigger n'est exécutable par personne). Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. controller_assignments_sync (recopie de 20261111000001_lot9quater_comptes.sql)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_assignments_sync(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ctrl uuid := public.try_uuid(p->>'controller_id');
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_role text := COALESCE(NULLIF(p->>'actor_role', ''), 'PARTENAIRE');
    v_req jsonb;
    v_requested uuid[];
    v_current uuid[];
    v_added uuid[];
    v_removed uuid[];
    v_updated integer := 0;
BEGIN
    IF v_actor IS NULL OR v_ctrl IS NULL OR jsonb_typeof(p->'assignments') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'assignments') a
                WHERE public.try_uuid(a->>'event_id') IS NULL
                   OR COALESCE(jsonb_typeof(a->'can_accept_cash'), 'null') NOT IN ('boolean', 'null')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_ctrl) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_NOT_FOUND', 'message', 'Contrôleur introuvable.');
    END IF;

    -- Une ligne par événement (la dernière l'emporte)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id', x.event_id, 'can_accept_cash', x.cash) ORDER BY x.event_id), '[]'::jsonb)
      INTO v_req
      FROM (SELECT DISTINCT ON (public.try_uuid(a->>'event_id')) public.try_uuid(a->>'event_id') AS event_id,
                   CASE WHEN jsonb_typeof(a->'can_accept_cash') = 'boolean' THEN (a->>'can_accept_cash')::boolean END AS cash
              FROM jsonb_array_elements(p->'assignments') WITH ORDINALITY AS t(a, o)
             ORDER BY public.try_uuid(a->>'event_id'), o DESC) x;
    SELECT COALESCE(array_agg((a->>'event_id')::uuid), ARRAY[]::uuid[]) INTO v_requested FROM jsonb_array_elements(v_req) a;

    IF EXISTS (SELECT 1 FROM unnest(v_requested) r(id) LEFT JOIN public.events e ON e.id = r.id
                WHERE e.id IS NULL OR (v_partner IS NOT NULL AND e.partner_id IS DISTINCT FROM v_partner)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED', 'message', 'Vous n''êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;

    SELECT COALESCE(array_agg(ec.event_id), ARRAY[]::uuid[]) INTO v_current
      FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
     WHERE ec.user_id = v_ctrl AND (v_partner IS NULL OR e.partner_id = v_partner);
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) INTO v_added FROM unnest(v_requested) r(id) WHERE NOT r.id = ANY (v_current);
    SELECT COALESCE(array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[]) INTO v_removed FROM unnest(v_current) c(id) WHERE NOT c.id = ANY (v_requested);

    -- cvf1 (migration 13) : un compte d'administration (ADMIN, SUPERADMIN) ne reçoit jamais d'événement ; même texte neutre
    -- que la route (aucun nom, aucune raison). Retirer ses événements et changer son droit d'encaisser restent possibles
    -- (comptes devenus contrôleurs avant le correctif, rapport de la finition § 0.1).
    IF cardinality(v_added) > 0 AND public.account_is_staff(v_ctrl) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_INVITABLE', 'message', 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.');
    END IF;

    -- Seuls les événements confirmés (VALIDE ou PUBLIE) sont nouvellement affectés
    IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = ANY (v_added) AND e.status::text NOT IN ('VALIDE', 'PUBLIE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ELIGIBLE', 'message', 'Seuls les événements validés ou publiés peuvent être affectés.');
    END IF;

    -- Lot 9 ter (9t.5, consigne 0.5, B-D6 à B-D8) : une partenaire qui n'a jamais eu ce contrôleur dans son équipe
    -- ne l'affecte pas directement ; il accepte d'abord son invitation (R37). Compte temporaire jamais activé :
    -- inchangé (il consent par l'activation). Admin agissant : la partenaire de chaque événement ajouté.
    IF cardinality(v_added) > 0
       AND COALESCE((SELECT a.raw_app_meta_data->>'controller_activation_pending' FROM auth.users a WHERE a.id = v_ctrl), 'false') <> 'true'
       AND EXISTS (SELECT 1 FROM public.events e
                    WHERE e.id = ANY (v_added) AND NOT public.partner_controller_known(e.partner_id, v_ctrl)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_CONSENT_REQUIRED',
                                  'message', 'Ce contrôleur doit d’abord accepter votre invitation.');
    END IF;

    IF cardinality(v_removed) > 0 THEN
        DELETE FROM public.event_controllers WHERE user_id = v_ctrl AND event_id = ANY (v_removed);
    END IF;
    IF cardinality(v_added) > 0 THEN
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT (a->>'event_id')::uuid, v_ctrl, COALESCE((a->>'can_accept_cash')::boolean, FALSE), v_actor
          FROM jsonb_array_elements(v_req) a
         WHERE (a->>'event_id')::uuid = ANY (v_added);
    END IF;
    UPDATE public.event_controllers ec
       SET can_accept_cash = (a->>'can_accept_cash')::boolean
      FROM jsonb_array_elements(v_req) a
     WHERE ec.user_id = v_ctrl AND ec.event_id = (a->>'event_id')::uuid
       AND NOT ec.event_id = ANY (v_added)
       AND jsonb_typeof(a->'can_accept_cash') = 'boolean'
       AND ec.can_accept_cash IS DISTINCT FROM (a->>'can_accept_cash')::boolean;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'CONTROLLER_ASSIGNMENTS_UPDATED', 'event_controllers', v_ctrl,
            jsonb_build_object('event_ids', to_jsonb(v_current)),
            jsonb_build_object('event_ids', to_jsonb(v_requested), 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed),
                               'cash_updated', v_updated),
            jsonb_build_object('partner_id', v_partner, 'controller_id', v_ctrl));

    RETURN jsonb_build_object('ok', true, 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed), 'updated', v_updated);
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. Garde de la table event_controllers : aucune nouvelle affectation pour un compte d'administration, quel que soit le
--    chemin (fonction, écriture directe du serveur comme la route d'invitation, seed, fonction future) ; une ligne ne
--    passe pas non plus à un tel compte. Refus SQLSTATE CT409 au texte neutre (reconnu par isNotInvitableDbError,
--    lib/auth/staff-account.ts). Les lignes existantes, leur droit d'encaisser, leur porte et leur retrait ne sont pas
--    touchés.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_controllers_staff_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
        RETURN NEW;
    END IF;
    IF public.account_is_staff(NEW.user_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'CT409',
            MESSAGE = 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.',
            HINT = 'NOT_INVITABLE';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_controllers_staff_guard ON public.event_controllers;
CREATE TRIGGER trg_event_controllers_staff_guard
    BEFORE INSERT OR UPDATE OF user_id ON public.event_controllers
    FOR EACH ROW
    EXECUTE FUNCTION public.event_controllers_staff_guard();

REVOKE ALL ON FUNCTION public.controller_assignments_sync(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_assignments_sync(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_controllers_staff_guard() FROM PUBLIC, anon, authenticated;

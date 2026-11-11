-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : le cycle de l'événement (M08, agent S-C ; contrat sections 3.1, 3.2, 3.3, 4.3, 5.20 à 5.29)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, CREATE TABLE / INDEX IF NOT EXISTS, DROP … IF EXISTS
-- puis ADD pour les contraintes, INSERT … ON CONFLICT DO NOTHING, CREATE OR REPLACE, privilèges réappliqués ; aucune
-- reprise de données (A12 : les fins par défaut ne sont pas réécrites, elles sont recalculées à la lecture).
-- Écrite tâche après tâche (section 10), un commit par tâche ; le bloc des privilèges, en fin de fichier, grandit avec
-- chaque tâche. Chaque recopie part de la dernière définition (grep de toutes les migrations), signature, type de
-- retour et volatilité identiques.
--
-- Tâche 20 (R3 ; B46, D1) :
--  1. Ligne de transition SUSPENDU → TERMINE (ADMIN, motif obligatoire, canal TRANSITION, « Clore l’événement »).
--  2. event_transition(jsonb) : base 20261103000005_lot6_billetterie.sql:942-1054, recopie intégrale, signature et
--     VOLATILE identiques. Changement : SUSPENDU → TERMINE refusé EVENT_NOT_ENDED tant que la fin (event_end_at) n'est
--     pas passée (contrôlé après le motif, avant EVENT_NOT_STARTED). La permission events.write vient de
--     event_actor_profile (M04).
--  3. event_actions(jsonb) : base 20261102000003_lot5_cycle.sql:482-547, recopie intégrale, signature et STABLE
--     identiques. Changement : aucune action que event_transition refuserait par la date : PUBLIE retiré une fois la
--     fin passée (EVENT_ENDED), TERMINE depuis SUSPENDU retiré tant que la fin n'est pas passée (EVENT_NOT_ENDED).
--  Avis EVENT_CLOSED_HOLDER et EVENT_CLOSED_BY_ADMIN : trigger notif_event_status_changed (M09, S-D, fix(9b.20-SD)).
-- ============================================================================


-- ============================================================================
-- Tâche 20 — 1. Transition SUSPENDU → TERMINE par un admin (R3)
-- ============================================================================
INSERT INTO public.event_status_transitions (from_status, to_status, actor_kind, reason_required, channel, action_label)
VALUES ('SUSPENDU', 'TERMINE', 'ADMIN', TRUE, 'TRANSITION', 'Clore l’événement')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Tâche 20 — 2. event_transition (recopie, 20261103000005_lot6_billetterie.sql:942-1054)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_transition(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_to_text text := p->>'to_status';
    v_to event_status;
    v_event uuid;
    v_actor uuid;
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    e record;
    a record;
    v_role text;
    v_reason_required boolean;
    v_role_missing boolean;
    v_missing jsonb := '[]'::jsonb;
    v_history uuid;
    v_owner uuid;
BEGIN
    IF v_to_text IS NULL OR NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype AND enumlabel = v_to_text) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_STATUS', 'message', 'Statut demandé inconnu.');
    END IF;
    v_to := v_to_text::event_status;
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    IF v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT id, partner_id, status, title, image_url, start_date, start_time INTO e
      FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Vous n''êtes pas autorisé à changer le statut de cet événement.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF v_to = 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CANCELLATION_REQUIRED',
                                  'message', 'L''annulation passe par la procédure d''annulation, qui rembourse les acheteurs.');
    END IF;

    -- Règle de la table : le propriétaire agit comme partenaire, sinon l'admin comme admin
    IF a.is_owner THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'PARTENAIRE'; END IF;
    END IF;
    IF v_role IS NULL AND a.is_staff THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'ADMIN' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'ADMIN'; END IF;
    END IF;
    IF v_role IS NULL THEN
        v_role_missing := EXISTS (SELECT 1 FROM public.event_status_transitions t
                                   WHERE t.from_status = e.status AND t.to_status = v_to AND t.channel <> 'CANCELLATION');
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', v_role_missing,
            'message', CASE WHEN v_role_missing
                            THEN format('Votre rôle ne permet pas de passer cet événement de « %s » à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text))
                            ELSE format('Un événement « %s » ne peut pas passer à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text)) END);
    END IF;

    IF v_reason_required AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Un motif d''au moins 3 caractères est obligatoire.');
    END IF;

    IF e.status = 'BROUILLON' AND v_to = 'EN_ATTENTE' THEN
        IF NULLIF(btrim(COALESCE(e.image_url, '')), '') IS NULL THEN
            v_missing := v_missing || jsonb_build_object('field', 'image_url', 'message', 'Ajoutez une affiche à l''événement.');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active) THEN
            v_missing := v_missing || jsonb_build_object('field', 'ticket_categories', 'message', 'Ajoutez au moins une catégorie de billets active.');
        END IF;
        IF jsonb_array_length(v_missing) > 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SUBMIT_INCOMPLETE', 'missing', v_missing,
                                      'message', 'L''événement est incomplet : complétez-le avant de le soumettre.');
        END IF;
    END IF;
    IF v_to = 'PUBLIE' AND public.event_end_at(v_event) <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_ENDED', 'message', 'La fin de cet événement est passée : il ne peut plus être publié.');
    END IF;
    -- Lot 9 bis (R3) : un SUSPENDU ne se clôt qu'une fois sa fin passée ; avant, il se réactive ou s'annule.
    IF e.status = 'SUSPENDU' AND v_to = 'TERMINE' AND public.event_end_at(v_event) > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ENDED',
                                  'message', 'L’événement n’est pas fini : réactivez-le ou annulez-le.');
    END IF;
    IF v_to = 'TERMINE' AND ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_STARTED',
                                  'message', 'Un événement qui n''a pas commencé ne se termine pas : suspendez-le ou annulez-le.');
    END IF;

    v_history := public.event_status_apply(v_event, e.status, v_to, v_actor, v_role, v_reason, 'TRANSITION');

    -- Lot 6 : les avis (partenaire, porteurs, administrateurs) sont mis en file par le trigger
    -- trg_event_status_notify sur la ligne d'historique, dans cette même transaction.
    SELECT user_id INTO v_owner FROM public.partners WHERE id = e.partner_id;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'from', e.status::text, 'to', v_to::text,
                              'actor_role', v_role, 'reason', v_reason, 'history_id', v_history,
                              'title', e.title, 'partner_user_id', v_owner);
END;
$$;


-- ============================================================================
-- Tâche 20 — 3. event_actions (recopie, 20261102000003_lot5_cycle.sql:482-547)
-- ============================================================================
-- p : { event_id, actor_id } → { ok, status, actions[{to, reason_required, label}], can_edit, can_cancel, last_reason? }
CREATE OR REPLACE FUNCTION public.event_actions(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    e record;
    a record;
    h record;
    v_kinds text[] := ARRAY[]::text[];
    v_actions jsonb;
    v_last jsonb;
    v_ended boolean;
BEGIN
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    SELECT id, status INTO e FROM public.events WHERE id = v_event;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF a.is_owner THEN v_kinds := v_kinds || 'PARTENAIRE'::text; END IF;
    IF a.is_staff THEN v_kinds := v_kinds || 'ADMIN'::text; END IF;

    -- Lot 9 bis (R3) : aucune action que event_transition refuserait par la date
    v_ended := COALESCE(public.event_end_at(v_event) <= now(), FALSE);

    SELECT COALESCE(jsonb_agg(x.action ORDER BY x.to_status), '[]'::jsonb) INTO v_actions
      FROM (SELECT DISTINCT ON (t.to_status) t.to_status,
                   jsonb_build_object('to', t.to_status::text, 'reason_required', t.reason_required, 'label', t.action_label) AS action
              FROM public.event_status_transitions t
             WHERE t.from_status = e.status AND t.channel = 'TRANSITION' AND t.actor_kind = ANY (v_kinds)
               AND NOT (t.to_status = 'PUBLIE' AND v_ended)
               AND NOT (t.from_status = 'SUSPENDU' AND t.to_status = 'TERMINE' AND NOT v_ended)
             ORDER BY t.to_status, (t.actor_kind = 'PARTENAIRE') DESC) x;

    SELECT old_status::text AS old_status, new_status::text AS new_status, actor_role, reason, created_at INTO h
      FROM public.event_status_history
     WHERE event_id = v_event
     ORDER BY created_at DESC, txid DESC, id DESC
     LIMIT 1;
    -- Champs du record lus seulement s'il est affecté (pas de court-circuit garanti sur AND)
    IF FOUND THEN
        IF h.new_status = e.status::text THEN
            IF h.old_status = 'EN_ATTENTE' AND h.new_status = 'BROUILLON' AND h.actor_role = 'ADMIN' THEN
                v_last := jsonb_build_object('kind', 'REFUS', 'reason', h.reason, 'at', h.created_at);
            ELSIF h.old_status = 'PUBLIE' AND h.new_status = 'SUSPENDU' THEN
                v_last := jsonb_build_object('kind', 'SUSPENSION', 'reason', h.reason, 'at', h.created_at);
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'status', e.status::text,
        'actions', v_actions,
        'can_edit', a.is_owner AND e.status::text IN ('BROUILLON', 'VALIDE', 'PUBLIE', 'SUSPENDU'),
        'can_cancel', e.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU'),
        'last_reason', v_last);
END;
$$;


-- ============================================================================
-- Privilèges (toutes les fonctions du fichier) : service_role uniquement
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_transition(jsonb)',
        'public.event_actions(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

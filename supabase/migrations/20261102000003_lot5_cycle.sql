-- ============================================================================
-- EVENT VILLAGE — LOT 5 : cycle de vie de l'événement (5.2, 5.3, 5.4, 5.8, 5.12 j/k ; A6, A7)
-- ============================================================================
--  - event_status_transitions : table unique des transitions permises (liste de 5.2 mot pour mot),
--    par statut, rôle (PARTENAIRE, ADMIN, SYSTEM) et canal (TRANSITION, CANCELLATION, CRON), avec le
--    motif obligatoire et le libellé de l'action. Lisible par authenticated.
--  - event_status_history : journal des statuts en ajout seul (UPDATE et DELETE refusés, sauf la
--    cascade à la suppression de l'événement), écrit uniquement par les fonctions du cycle de vie.
--  - Garde (D3) : un changement de events.status n'est accepté que si la transaction courante a écrit
--    la ligne d'historique correspondante (ERRCODE EV422), service_role compris. Tout INSERT est forcé
--    à BROUILLON avec sa ligne NULL → BROUILLON (canal CREATION).
--  - event_transition (D4), event_actions (D5), event_cancel / event_cancellation_impact /
--    event_cancellation_progress (D6), events_finish_overdue (D7) : RPC du contrat, service_role seul.
--  - event_end_at (D7) : fin unique d'un événement, reprise par fin_event_end, scan_window et
--    ticket_sale_problems. Scan et ouverture de caisse restent possibles en TERMINE dans la fenêtre.
--  - payment_confirm : un paiement confirmé sur un événement SUSPENDU, TERMINE ou ANNULE est refusé
--    et remboursé (D6).
--  - practical_info.cancellation n'est plus écrit et est retiré des lignes existantes (motif interne) ;
--    event_cancellations devient UNIQUE(event_id). Lecture anon de events étendue aux statuts publics.
-- Ordre de verrouillage : événement, catégories (par identifiant), paiements, billets.
-- ============================================================================

-- ── Annulations : motif interne retiré des infos pratiques, une annulation par événement ─────
UPDATE public.events
   SET practical_info = practical_info - 'cancellation'
 WHERE practical_info IS NOT NULL AND jsonb_typeof(practical_info) = 'object' AND practical_info ? 'cancellation';

-- Doublons éventuels (ancienne orchestration sans contrainte) : la première annulation fait foi.
DELETE FROM public.event_cancellations c
 USING public.event_cancellations d
 WHERE c.event_id = d.event_id AND (c.cancelled_at, c.id) > (d.cancelled_at, d.id);
DROP INDEX IF EXISTS public.idx_event_cancellations_event_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_cancellations_event ON public.event_cancellations (event_id);

-- ── Table des transitions (D1) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_status_transitions (
    from_status event_status NOT NULL,
    to_status event_status NOT NULL,
    actor_kind TEXT NOT NULL CHECK (actor_kind IN ('PARTENAIRE', 'ADMIN', 'SYSTEM')),
    reason_required BOOLEAN NOT NULL DEFAULT FALSE,
    channel TEXT NOT NULL CHECK (channel IN ('TRANSITION', 'CANCELLATION', 'CRON')),
    action_label TEXT NOT NULL,
    PRIMARY KEY (from_status, to_status, actor_kind, channel)
);
COMMENT ON TABLE public.event_status_transitions IS
    'Lot 5 (5.2) : transitions de statut permises, par rôle et par canal. Seule source des actions possibles (event_actions).';

DELETE FROM public.event_status_transitions;
INSERT INTO public.event_status_transitions (from_status, to_status, actor_kind, reason_required, channel, action_label) VALUES
    ('BROUILLON',  'EN_ATTENTE', 'PARTENAIRE', FALSE, 'TRANSITION',   'Soumettre à la validation'),
    ('EN_ATTENTE', 'BROUILLON',  'PARTENAIRE', FALSE, 'TRANSITION',   'Retirer de la validation'),
    ('EN_ATTENTE', 'BROUILLON',  'ADMIN',      TRUE,  'TRANSITION',   'Refuser'),
    ('EN_ATTENTE', 'VALIDE',     'ADMIN',      FALSE, 'TRANSITION',   'Valider'),
    ('VALIDE',     'PUBLIE',     'PARTENAIRE', FALSE, 'TRANSITION',   'Publier'),
    ('VALIDE',     'PUBLIE',     'ADMIN',      FALSE, 'TRANSITION',   'Publier'),
    ('PUBLIE',     'SUSPENDU',   'ADMIN',      TRUE,  'TRANSITION',   'Suspendre'),
    ('SUSPENDU',   'PUBLIE',     'ADMIN',      FALSE, 'TRANSITION',   'Réactiver'),
    ('PUBLIE',     'ANNULE',     'PARTENAIRE', TRUE,  'CANCELLATION', 'Annuler l’événement'),
    ('PUBLIE',     'ANNULE',     'ADMIN',      TRUE,  'CANCELLATION', 'Annuler l’événement'),
    ('VALIDE',     'ANNULE',     'PARTENAIRE', TRUE,  'CANCELLATION', 'Annuler l’événement'),
    ('VALIDE',     'ANNULE',     'ADMIN',      TRUE,  'CANCELLATION', 'Annuler l’événement'),
    ('SUSPENDU',   'ANNULE',     'PARTENAIRE', TRUE,  'CANCELLATION', 'Annuler l’événement'),
    ('SUSPENDU',   'ANNULE',     'ADMIN',      TRUE,  'CANCELLATION', 'Annuler l’événement'),
    ('PUBLIE',     'TERMINE',    'SYSTEM',     FALSE, 'CRON',         'Terminer automatiquement'),
    ('PUBLIE',     'TERMINE',    'ADMIN',      FALSE, 'TRANSITION',   'Terminer');

ALTER TABLE public.event_status_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_status_transitions_read" ON public.event_status_transitions;
CREATE POLICY "event_status_transitions_read" ON public.event_status_transitions
    FOR SELECT TO authenticated USING (TRUE);
REVOKE ALL ON TABLE public.event_status_transitions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.event_status_transitions TO authenticated, service_role;

-- ── Historique des statuts (D1) ─────────────────────────────────────────────
-- actor_id sans clé étrangère : le journal garde l'auteur même si son compte est supprimé (ajout seul).
CREATE TABLE IF NOT EXISTS public.event_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    old_status event_status,
    new_status event_status NOT NULL,
    actor_id UUID,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('PARTENAIRE', 'ADMIN', 'SYSTEM')),
    reason TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('CREATION', 'TRANSITION', 'CANCELLATION', 'CRON')),
    txid BIGINT NOT NULL DEFAULT txid_current(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT event_status_history_creation CHECK ((channel = 'CREATION') = (old_status IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_event_status_history_event ON public.event_status_history (event_id, created_at, txid, id);
CREATE INDEX IF NOT EXISTS idx_event_status_history_txid ON public.event_status_history (event_id, txid);
COMMENT ON TABLE public.event_status_history IS
    'Lot 5 (5.2) : journal des statuts d''un événement, en ajout seul, écrit par les fonctions du cycle de vie. Lecture : partenaire propriétaire et admins.';

ALTER TABLE public.event_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_status_history_read" ON public.event_status_history;
CREATE POLICY "event_status_history_read" ON public.event_status_history
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_status_history.event_id AND public.is_partner_owner(e.partner_id))
        OR public.is_admin()
    );
REVOKE ALL ON TABLE public.event_status_history FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.event_status_history TO authenticated, service_role;

-- ── Reprise : événements déjà en base, chemin canonique de la table jusqu'au statut courant ──
DO $$
DECLARE
    e record;
    v_path text[];
    v_prev text;
    v_step text;
    v_role text;
    v_i integer;
BEGIN
    FOR e IN
        SELECT ev.id, ev.status::text AS status, ev.created_at, pa.user_id
          FROM public.events ev
          LEFT JOIN public.partners pa ON pa.id = ev.partner_id
         WHERE NOT EXISTS (SELECT 1 FROM public.event_status_history h WHERE h.event_id = ev.id)
    LOOP
        v_path := CASE e.status
            WHEN 'EN_ATTENTE' THEN ARRAY['EN_ATTENTE']
            WHEN 'VALIDE' THEN ARRAY['EN_ATTENTE', 'VALIDE']
            WHEN 'PUBLIE' THEN ARRAY['EN_ATTENTE', 'VALIDE', 'PUBLIE']
            WHEN 'SUSPENDU' THEN ARRAY['EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU']
            WHEN 'TERMINE' THEN ARRAY['EN_ATTENTE', 'VALIDE', 'PUBLIE', 'TERMINE']
            WHEN 'ANNULE' THEN ARRAY['EN_ATTENTE', 'VALIDE', 'PUBLIE', 'ANNULE']
            ELSE ARRAY[]::text[] END;
        INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_id, actor_role, reason, channel, created_at)
        VALUES (e.id, NULL, 'BROUILLON', e.user_id, 'PARTENAIRE', 'Reprise de l''historique (lot 5)', 'CREATION', e.created_at);
        v_prev := 'BROUILLON';
        v_i := 0;
        FOREACH v_step IN ARRAY v_path LOOP
            v_i := v_i + 1;
            v_role := CASE v_step WHEN 'EN_ATTENTE' THEN 'PARTENAIRE' WHEN 'PUBLIE' THEN 'PARTENAIRE' WHEN 'TERMINE' THEN 'SYSTEM' ELSE 'ADMIN' END;
            INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_id, actor_role, reason, channel, created_at)
            VALUES (e.id, v_prev::event_status, v_step::event_status,
                    CASE WHEN v_role = 'PARTENAIRE' THEN e.user_id END, v_role, 'Reprise de l''historique (lot 5)',
                    CASE v_step WHEN 'TERMINE' THEN 'CRON' WHEN 'ANNULE' THEN 'CANCELLATION' ELSE 'TRANSITION' END,
                    e.created_at + v_i * interval '1 millisecond');
            v_prev := v_step;
        END LOOP;
    END LOOP;
END;
$$;

-- ── Outils ──────────────────────────────────────────────────────────────────
-- Fin d'un événement (D7) : end_date + end_time à Dakar ; fin sans heure : end_date à 23:59 ;
-- sans fin : start_date à 23:59.
CREATE OR REPLACE FUNCTION public.event_end_at(p_event_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ((COALESCE(e.end_date, e.start_date) + COALESCE(CASE WHEN e.end_date IS NOT NULL THEN e.end_time END, time '23:59'))
            AT TIME ZONE 'Africa/Dakar')
      FROM public.events e WHERE e.id = p_event_id
$$;

CREATE OR REPLACE FUNCTION public.fin_event_end(p_event_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.event_end_at(p_event_id)
$$;

-- Libellé humain d'un statut (messages des RPC : jamais d'enum brut)
CREATE OR REPLACE FUNCTION public.event_status_label(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_status
        WHEN 'BROUILLON' THEN 'Brouillon'
        WHEN 'EN_ATTENTE' THEN 'En attente de validation'
        WHEN 'VALIDE' THEN 'Validé'
        WHEN 'PUBLIE' THEN 'Publié'
        WHEN 'SUSPENDU' THEN 'Suspendu'
        WHEN 'TERMINE' THEN 'Terminé'
        WHEN 'ANNULE' THEN 'Annulé'
        ELSE 'Inconnu' END
$$;

-- Acteur d'une action sur un événement : propriétaire (partners.user_id), admin (user_roles), compte ACTIF
CREATE OR REPLACE FUNCTION public.event_actor_profile(p_event uuid, p_actor uuid)
RETURNS TABLE (is_owner boolean, is_staff boolean, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_actor IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                WHERE e.id = p_event AND pa.user_id = p_actor),
           p_actor IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.user_roles r WHERE r.user_id = p_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')),
           p_actor IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF')
$$;

-- Écriture d'une transition (appelant : verrou de l'événement déjà pris) : la transition doit figurer
-- dans la table ; ligne d'historique, puis changement de statut (déverrouille la garde D3).
CREATE OR REPLACE FUNCTION public.event_status_apply(p_event uuid, p_from event_status, p_to event_status, p_actor uuid,
                                                     p_role text, p_reason text, p_channel text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_history uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_status_transitions t
                    WHERE t.from_status = p_from AND t.to_status = p_to AND t.actor_kind = p_role AND t.channel = p_channel) THEN
        RAISE EXCEPTION 'Transition de statut non prévue (% → %, %, %)', p_from, p_to, p_role, p_channel USING ERRCODE = 'EV422';
    END IF;
    INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_id, actor_role, reason, channel)
    VALUES (p_event, p_from, p_to, p_actor, p_role, p_reason, p_channel)
    RETURNING id INTO v_history;
    UPDATE public.events SET status = p_to, updated_at = now() WHERE id = p_event AND status = p_from;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Statut de l''événement % modifié entre-temps (attendu %)', p_event, p_from USING ERRCODE = 'EV422';
    END IF;
    RETURN v_history;
END;
$$;

-- Notification dans l'application (même forme que lib/notifications) ; les SMS et emails partent après le commit
CREATE OR REPLACE FUNCTION public.event_notify(p_users uuid[], p_title text, p_content text, p_metadata jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, content, channel, status, sent_at, metadata)
    SELECT s.u, 'EVENT_STATUS', p_title, p_content, 'PUSH'::notification_channel_enum, 'SENT'::notification_status_enum,
           now(), COALESCE(p_metadata, '{}'::jsonb)
      FROM (SELECT DISTINCT x AS u FROM unnest(COALESCE(p_users, ARRAY[]::uuid[])) AS x WHERE x IS NOT NULL) s;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ── Triggers : création forcée en BROUILLON, garde du statut, historique en ajout seul ──────
CREATE OR REPLACE FUNCTION public.events_force_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.status := 'BROUILLON';
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.events_log_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_uid uuid := auth.uid();
    v_role text := 'PARTENAIRE';
BEGIN
    SELECT user_id INTO v_owner FROM public.partners WHERE id = NEW.partner_id;
    IF v_uid IS NOT NULL AND v_uid IS DISTINCT FROM v_owner
       AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_uid AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        v_role := 'ADMIN';
    END IF;
    INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_id, actor_role, channel)
    VALUES (NEW.id, NULL, 'BROUILLON', COALESCE(v_uid, v_owner), v_role, 'CREATION');
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.events_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT EXISTS (
        SELECT 1 FROM public.event_status_history h
         WHERE h.event_id = OLD.id AND h.txid = txid_current()
           AND h.old_status = OLD.status AND h.new_status = NEW.status
    ) THEN
        RAISE EXCEPTION 'Le statut d''un événement ne change que par une transition'
            USING ERRCODE = 'EV422',
                  HINT = 'Utilisez la transition de statut (event_transition) ou l''annulation (event_cancel).';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_status_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Seule exception : la cascade de la suppression de l'événement (la ligne parente n'existe plus).
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = OLD.event_id) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'L''historique des statuts est en ajout seul' USING ERRCODE = 'EV422';
END;
$$;

DROP TRIGGER IF EXISTS trg_events_force_draft ON public.events;
CREATE TRIGGER trg_events_force_draft BEFORE INSERT ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_force_draft();
DROP TRIGGER IF EXISTS trg_events_log_creation ON public.events;
CREATE TRIGGER trg_events_log_creation AFTER INSERT ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_log_creation();
DROP TRIGGER IF EXISTS trg_events_status_guard ON public.events;
CREATE TRIGGER trg_events_status_guard BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_status_guard();
DROP TRIGGER IF EXISTS trg_event_status_history_append_only ON public.event_status_history;
CREATE TRIGGER trg_event_status_history_append_only BEFORE UPDATE OR DELETE ON public.event_status_history
    FOR EACH ROW EXECUTE FUNCTION public.event_status_history_append_only();

-- ── D4 : transition de statut ───────────────────────────────────────────────
-- p : { event_id, actor_id, to_status, reason? }
CREATE OR REPLACE FUNCTION public.event_transition(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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
    v_holders uuid[];
    v_meta jsonb;
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
    IF v_to = 'TERMINE' AND ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_STARTED',
                                  'message', 'Un événement qui n''a pas commencé ne se termine pas : suspendez-le ou annulez-le.');
    END IF;

    v_history := public.event_status_apply(v_event, e.status, v_to, v_actor, v_role, v_reason, 'TRANSITION');

    -- Notifications dans l'application (même transaction)
    SELECT user_id INTO v_owner FROM public.partners WHERE id = e.partner_id;
    v_meta := jsonb_build_object('event_id', v_event, 'eventId', v_event, 'status', v_to::text, 'reason', v_reason,
                                 'actionUrl', '/partner/events');
    IF e.status = 'EN_ATTENTE' AND v_to = 'BROUILLON' AND v_role = 'ADMIN' THEN
        PERFORM public.event_notify(ARRAY[v_owner], 'Événement non validé',
            format('Votre événement « %s » n''a pas été validé. Motif : %s', e.title, v_reason), v_meta);
    ELSIF v_to = 'VALIDE' THEN
        PERFORM public.event_notify(ARRAY[v_owner], 'Événement validé',
            format('Votre événement « %s » a été validé. Vous pouvez maintenant le publier.', e.title), v_meta);
    ELSIF v_to = 'SUSPENDU' THEN
        PERFORM public.event_notify(ARRAY[v_owner], 'Événement suspendu',
            format('Votre événement « %s » a été suspendu. Motif : %s', e.title, v_reason), v_meta);
        SELECT array_agg(DISTINCT t.user_id) INTO v_holders FROM public.tickets t
         WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE');
        PERFORM public.event_notify(v_holders, 'Événement suspendu',
            format('L''événement « %s » est suspendu par l''organisation. Vos billets restent valables ; vous serez informé de la suite.', e.title),
            jsonb_build_object('event_id', v_event, 'eventId', v_event, 'status', v_to::text, 'actionUrl', '/tickets'));
    ELSIF e.status = 'SUSPENDU' AND v_to = 'PUBLIE' THEN
        PERFORM public.event_notify(ARRAY[v_owner], 'Événement réactivé',
            format('Votre événement « %s » est de nouveau en ligne.', e.title), v_meta);
        SELECT array_agg(DISTINCT t.user_id) INTO v_holders FROM public.tickets t
         WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE');
        PERFORM public.event_notify(v_holders, 'Événement réactivé',
            format('L''événement « %s » est de nouveau ouvert. Vos billets restent valables.', e.title),
            jsonb_build_object('event_id', v_event, 'eventId', v_event, 'status', v_to::text, 'actionUrl', '/tickets'));
    ELSIF v_to = 'PUBLIE' THEN
        PERFORM public.event_notify(ARRAY[v_owner], 'Événement en ligne',
            format('Votre événement « %s » est désormais visible sur la billetterie publique.', e.title), v_meta);
    END IF;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'from', e.status::text, 'to', v_to::text,
                              'actor_role', v_role, 'reason', v_reason, 'history_id', v_history,
                              'title', e.title, 'partner_user_id', v_owner);
END;
$$;

-- ── D5 : actions possibles pour un acteur ───────────────────────────────────
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

    SELECT COALESCE(jsonb_agg(x.action ORDER BY x.to_status), '[]'::jsonb) INTO v_actions
      FROM (SELECT DISTINCT ON (t.to_status) t.to_status,
                   jsonb_build_object('to', t.to_status::text, 'reason_required', t.reason_required, 'label', t.action_label) AS action
              FROM public.event_status_transitions t
             WHERE t.from_status = e.status AND t.channel = 'TRANSITION' AND t.actor_kind = ANY (v_kinds)
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

-- ── D6 : annulation transactionnelle ────────────────────────────────────────
-- p : { event_id, actor_id, public_notice, internal_reason, confirm_title } → { ok, cashout_ids[] }
-- Les cashouts sont seulement créés (A_ENVOYER) : l'envoi suit le commit (lib/events/event-cancellation.service.ts).
CREATE OR REPLACE FUNCTION public.event_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    v_notice text := btrim(COALESCE(p->>'public_notice', ''));
    v_internal text := btrim(COALESCE(p->>'internal_reason', ''));
    v_confirm text := btrim(COALESCE(p->>'confirm_title', ''));
    e record;
    a record;
    r record;
    v_role text;
    v_cancellation uuid;
    v_reason text;
    v_cashout uuid;
    v_cashouts uuid[] := ARRAY[]::uuid[];
    v_res jsonb;
    v_holders uuid[];
    v_notified integer;
BEGIN
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    SELECT id, partner_id, status, title INTO e FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Seuls l''organisateur de l''événement et les administrateurs peuvent l''annuler.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF a.is_owner AND EXISTS (SELECT 1 FROM public.event_status_transitions t
                               WHERE t.from_status = e.status AND t.to_status = 'ANNULE' AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'CANCELLATION') THEN
        v_role := 'PARTENAIRE';
    ELSIF a.is_staff AND EXISTS (SELECT 1 FROM public.event_status_transitions t
                                  WHERE t.from_status = e.status AND t.to_status = 'ANNULE' AND t.actor_kind = 'ADMIN' AND t.channel = 'CANCELLATION') THEN
        v_role := 'ADMIN';
    END IF;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED',
            'message', CASE WHEN e.status = 'ANNULE' THEN 'Cet événement est déjà annulé.'
                            ELSE format('Un événement « %s » ne peut pas être annulé.', public.event_status_label(e.status::text)) END);
    END IF;
    IF v_confirm IS DISTINCT FROM btrim(e.title) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TITLE_MISMATCH',
                                  'message', 'Le titre saisi ne correspond pas au titre de l''événement.');
    END IF;
    IF char_length(v_notice) < 10 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PUBLIC_NOTICE_REQUIRED',
                                  'message', 'L''avis public doit comporter au moins 10 caractères.');
    END IF;
    IF char_length(v_internal) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL_REASON_REQUIRED',
                                  'message', 'Le motif interne doit comporter au moins 3 caractères.');
    END IF;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;

    SELECT array_agg(DISTINCT t.user_id) INTO v_holders FROM public.tickets t
     WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE');

    -- Une ligne restée d'une annulation non aboutie (statut non annulé) est remplacée
    INSERT INTO public.event_cancellations (event_id, cancelled_by, internal_reason, public_notice, cancelled_at, updated_at)
    VALUES (v_event, v_actor, v_internal, v_notice, now(), now())
    ON CONFLICT (event_id) DO UPDATE
       SET cancelled_by = EXCLUDED.cancelled_by, internal_reason = EXCLUDED.internal_reason,
           public_notice = EXCLUDED.public_notice, cancelled_at = EXCLUDED.cancelled_at, updated_at = now()
    RETURNING id INTO v_cancellation;

    PERFORM public.event_status_apply(v_event, e.status, 'ANNULE', v_actor, v_role, NULL, 'CANCELLATION');

    -- Transferts en attente révoqués
    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
     WHERE status::text = 'PENDING' AND ticket_id IN (SELECT id FROM public.tickets WHERE event_id = v_event);
    UPDATE public.tickets SET transfer_locked = FALSE WHERE event_id = v_event AND transfer_locked;

    v_reason := format('Annulation de l''événement « %s »', e.title);

    -- Paiements en ligne : le reste dû au client (refund_request, lot 3)
    FOR r IN
        SELECT pay.id FROM public.payments pay
         WHERE pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
           AND pay.status::text IN ('SUCCESS', 'PARTIAL') AND pay.amount > 0
           AND (pay.event_id = v_event
                OR pay.id IN (SELECT t.payment_id FROM public.tickets t WHERE t.event_id = v_event AND t.payment_id IS NOT NULL))
         ORDER BY pay.id
           FOR UPDATE OF pay
    LOOP
        v_cashout := public.refund_request(r.id, v_reason, 'EVENT_CANCELLATION_REFUND');
        IF v_cashout IS NOT NULL THEN
            v_cashouts := array_append(v_cashouts, v_cashout);
        END IF;
    END LOOP;

    -- Billets encore valables : espèces → remboursement par l'organisateur, gratuits et invitations
    -- → annulés (ticket_refund_request, lot 3) ; billet « à régler sur place » jamais payé → annulé.
    FOR r IN
        SELECT t.id, t.payment_id, t.order_id, t.price, t.category_id FROM public.tickets t
         WHERE t.event_id = v_event AND t.status::text = 'VALIDE'
         ORDER BY t.id
    LOOP
        IF r.payment_id IS NULL AND r.order_id IS NOT NULL AND COALESCE(r.price, 0) > 0 THEN
            UPDATE public.tickets SET status = 'ANNULE', updated_at = now() WHERE id = r.id AND status::text = 'VALIDE';
            UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = r.category_id;
        ELSE
            v_res := public.ticket_refund_request(r.id, v_actor, v_reason);
            IF COALESCE((v_res->>'ok')::boolean, false) AND v_res->>'cashout_id' IS NOT NULL THEN
                v_cashouts := array_append(v_cashouts, (v_res->>'cashout_id')::uuid);
            END IF;
        END IF;
    END LOOP;
    -- Reste (paiement déjà en remboursement, etc.) : aucun billet ne reste VALIDE sur un événement annulé
    UPDATE public.tickets SET status = 'ANNULE', updated_at = now() WHERE event_id = v_event AND status::text = 'VALIDE';

    v_notified := public.event_notify(v_holders, 'Événement annulé',
        format('L''événement « %s » est annulé. %s', e.title, v_notice),
        jsonb_build_object('event_id', v_event, 'eventId', v_event, 'status', 'ANNULE', 'actionUrl', '/tickets'));

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'cancellation_id', v_cancellation, 'actor_role', v_role,
                              'cashout_ids', to_jsonb(v_cashouts), 'holders_notified', v_notified, 'title', e.title);
END;
$$;

-- Impact avant annulation : billets VALIDE par nature, acheteurs, montants à rembourser, paiements en attente
CREATE OR REPLACE FUNCTION public.event_cancellation_impact(p jsonb)
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
    k record;
    v_online_total numeric;
    v_pending integer;
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

    WITH t AS (
        SELECT tk.id, tk.user_id, tk.price, tk.payment_id,
               CASE WHEN tk.sale_channel = 'INVITATION' THEN 'INVITATION'
                    WHEN COALESCE(tk.price, 0) = 0 THEN 'FREE'
                    WHEN pay.is_platform_payment THEN 'ONLINE'
                    ELSE 'CASH' END AS kind
          FROM public.tickets tk
          LEFT JOIN public.payments pay ON pay.id = tk.payment_id
         WHERE tk.event_id = v_event AND tk.status::text = 'VALIDE'
    )
    SELECT count(*) FILTER (WHERE kind = 'ONLINE') AS online,
           count(*) FILTER (WHERE kind = 'CASH') AS cash,
           count(*) FILTER (WHERE kind = 'FREE') AS free,
           count(*) FILTER (WHERE kind = 'INVITATION') AS invitations,
           count(DISTINCT user_id) AS buyers,
           COALESCE(sum(price) FILTER (WHERE kind = 'CASH' AND payment_id IS NOT NULL), 0) AS cash_total
      INTO k FROM t;

    SELECT COALESCE(sum(pay.amount - COALESCE((SELECT sum(rf.amount) FROM public.refunds rf
                                                WHERE rf.payment_id = pay.id AND rf.settlement = 'PLATEFORME'), 0)), 0)
      INTO v_online_total
      FROM public.payments pay
     WHERE pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
       AND pay.status::text IN ('SUCCESS', 'PARTIAL') AND pay.amount > 0
       AND (pay.event_id = v_event
            OR pay.id IN (SELECT tk.payment_id FROM public.tickets tk WHERE tk.event_id = v_event AND tk.payment_id IS NOT NULL));

    SELECT count(*) INTO v_pending
      FROM public.payments pay
     WHERE pay.is_platform_payment AND pay.payment_target::text = 'TICKET' AND pay.status::text = 'PENDING'
       AND (pay.event_id = v_event
            OR EXISTS (SELECT 1 FROM public.stock_reservations sr JOIN public.ticket_categories c ON c.id = sr.category_id
                        WHERE sr.payment_id = pay.id AND c.event_id = v_event));

    RETURN jsonb_build_object(
        'ok', true,
        'tickets', jsonb_build_object('online', k.online, 'cash', k.cash, 'free', k.free, 'invitations', k.invitations),
        'buyers', k.buyers,
        'online_refund_total', GREATEST(v_online_total, 0),
        'cash_refund_total', k.cash_total,
        'pending_payments', v_pending);
END;
$$;

-- Avancement des remboursements : versés, en cours, en vérification, à reprendre (admin seul), espèces de l'organisateur
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
    )
    SELECT count(*) FILTER (WHERE status = 'CONFIRME') AS paid_n,
           COALESCE(sum(amount) FILTER (WHERE status = 'CONFIRME'), 0) AS paid_t,
           count(*) FILTER (WHERE (status = 'A_ENVOYER' AND blocked_reason IS NULL) OR status = 'ENVOYE') AS prog_n,
           COALESCE(sum(amount) FILTER (WHERE (status = 'A_ENVOYER' AND blocked_reason IS NULL) OR status = 'ENVOYE'), 0) AS prog_t,
           count(*) FILTER (WHERE status = 'INCERTAIN') AS verif_n,
           COALESCE(sum(amount) FILTER (WHERE status = 'INCERTAIN'), 0) AS verif_t,
           count(*) FILTER (WHERE status = 'ECHOUE' OR (status = 'A_ENVOYER' AND blocked_reason IS NOT NULL)) AS retry_n,
           COALESCE(sum(amount) FILTER (WHERE status = 'ECHOUE' OR (status = 'A_ENVOYER' AND blocked_reason IS NOT NULL)), 0) AS retry_t
      INTO c FROM co;

    SELECT count(*) AS n, COALESCE(sum(rf.amount), 0) AS total INTO o
      FROM public.refunds rf
      JOIN public.tickets tk ON tk.id = rf.ticket_id
     WHERE tk.event_id = v_event AND rf.settlement = 'ORGANISATEUR';

    v_out := jsonb_build_object(
        'ok', true,
        'paid', jsonb_build_object('count', c.paid_n, 'total', c.paid_t),
        'in_progress', jsonb_build_object('count', c.prog_n, 'total', c.prog_t),
        'verifying', jsonb_build_object('count', c.verif_n, 'total', c.verif_t),
        'organizer_cash', jsonb_build_object('count', o.n, 'total', o.total));
    IF a.is_staff THEN
        v_out := v_out || jsonb_build_object('to_retry', jsonb_build_object('count', c.retry_n, 'total', c.retry_t));
    END IF;
    RETURN v_out;
END;
$$;

-- ── D7 : passage automatique à TERMINE (cron) ───────────────────────────────
-- p : { limit } → { ok, finished, ids }
CREATE OR REPLACE FUNCTION public.events_finish_overdue(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer := 200;
    r record;
    v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
    IF p ? 'limit' AND jsonb_typeof(p->'limit') = 'number' THEN
        v_limit := LEAST(GREATEST((p->>'limit')::numeric::integer, 1), 1000);
    END IF;
    FOR r IN
        SELECT e.id FROM public.events e
         WHERE e.status = 'PUBLIE' AND public.event_end_at(e.id) < now()
         ORDER BY e.id
         LIMIT v_limit
           FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public.event_status_apply(r.id, 'PUBLIE', 'TERMINE', NULL, 'SYSTEM', NULL, 'CRON');
        v_ids := array_append(v_ids, r.id);
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'finished', COALESCE(array_length(v_ids, 1), 0), 'ids', to_jsonb(v_ids));
END;
$$;

-- ── Fin unique reprise par la fenêtre de scan, le contrôle de l'événement et la vente ─────────
CREATE OR REPLACE FUNCTION public.scan_window(p_event uuid)
RETURNS TABLE (opens_at timestamptz, closes_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
               - make_interval(hours => public.fin_setting_num('access.scan_window_before_hours')::int),
           public.event_end_at(e.id) + make_interval(hours => public.fin_setting_num('access.scan_window_after_hours')::int)
      FROM public.events e WHERE e.id = p_event
$$;

-- TERMINE reste ouvert au scan et à l'encaissement jusqu'à la fermeture de la fenêtre ; ANNULE et SUSPENDU refusés
CREATE OR REPLACE FUNCTION public.scan_event_problem(p_event uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    w record;
BEGIN
    SELECT status::text INTO v_status FROM public.events WHERE id = p_event;
    IF v_status IS NULL THEN RETURN 'invalid'; END IF;
    IF v_status = 'ANNULE' THEN RETURN 'event_cancelled'; END IF;
    IF v_status = 'SUSPENDU' THEN RETURN 'event_suspended'; END IF;
    IF v_status NOT IN ('PUBLIE', 'TERMINE') THEN RETURN 'event_not_open'; END IF;
    SELECT * INTO w FROM public.scan_window(p_event);
    IF now() > w.closes_at THEN RETURN 'event_ended'; END IF;
    IF now() < w.opens_at THEN RETURN 'event_not_open'; END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ticket_sale_problems(p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event record;
    v_item record;
    v_cat record;
    v_problems jsonb := '[]'::jsonb;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'INVALID_ITEMS', 'message', 'Panier vide.'));
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_items)) <> (SELECT count(DISTINCT e->>'category_id') FROM jsonb_array_elements(p_items) e) THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'INVALID_ITEMS', 'message', 'Une catégorie apparaît plusieurs fois dans le panier.'));
    END IF;

    SELECT id, status INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.'));
    END IF;
    IF v_event.status::text <> 'PUBLIE' THEN
        v_problems := v_problems || jsonb_build_object('category_id', NULL, 'code', 'EVENT_NOT_PUBLISHED', 'message', 'Cet événement n''est pas ouvert à la vente.');
    END IF;
    -- Lot 5 (D7) : même fin que le cron et la fenêtre de scan (sans fin : début à 23:59, Africa/Dakar)
    IF public.event_end_at(p_event_id) <= now() THEN
        v_problems := v_problems || jsonb_build_object('category_id', NULL, 'code', 'EVENT_PAST', 'message', 'Cet événement est terminé.');
    END IF;

    FOR v_item IN
        SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e
    LOOP
        SELECT id, event_id, name, price, total_quantity, sold_quantity, held_quantity, is_active, is_visible, sale_start, sale_end, max_per_order
          INTO v_cat FROM public.ticket_categories WHERE id = v_item.category_id;
        IF NOT FOUND OR v_cat.event_id <> p_event_id THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_item.category_id, 'code', 'CATEGORY_NOT_FOUND', 'message', 'Catégorie introuvable pour cet événement.');
            CONTINUE;
        END IF;
        IF v_item.quantity IS NULL OR v_item.quantity < 1 THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'INVALID_QUANTITY', 'message', 'Quantité invalide.');
            CONTINUE;
        END IF;
        IF NOT v_cat.is_active THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'CATEGORY_INACTIVE', 'message', format('La catégorie « %s » n''est plus en vente.', v_cat.name));
        END IF;
        IF NOT v_cat.is_visible THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'CATEGORY_NOT_VISIBLE', 'message', format('La catégorie « %s » n''est pas proposée à la vente.', v_cat.name));
        END IF;
        IF v_cat.sale_start IS NOT NULL AND v_cat.sale_start > now() THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'SALE_NOT_STARTED', 'message', format('La vente de « %s » n''est pas encore ouverte.', v_cat.name));
        END IF;
        IF v_cat.sale_end IS NOT NULL AND v_cat.sale_end <= now() THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'SALE_CLOSED', 'message', format('La vente de « %s » est close.', v_cat.name));
        END IF;
        IF v_item.quantity > v_cat.max_per_order THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'MAX_PER_ORDER', 'message', format('Au plus %s billet(s) « %s » par commande.', v_cat.max_per_order, v_cat.name));
        END IF;
        IF v_cat.total_quantity - v_cat.sold_quantity - v_cat.held_quantity < v_item.quantity THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'INSUFFICIENT_STOCK', 'message', format('Plus assez de places « %s » disponibles.', v_cat.name));
        END IF;
    END LOOP;
    RETURN v_problems;
END;
$$;

-- Ouverture de caisse : PUBLIE, ou TERMINE tant que la fenêtre de scan est ouverte (D7)
CREATE OR REPLACE FUNCTION public.shift_open(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := (p->>'user_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_float numeric := COALESCE((p->>'opening_float')::numeric, 0);
    v_partner uuid;
    v_status text;
    v_id uuid;
BEGIN
    SELECT partner_id, status::text INTO v_partner, v_status FROM public.events WHERE id = v_event;
    IF v_partner IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND'); END IF;
    IF v_status NOT IN ('PUBLIE', 'TERMINE') THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OPEN', 'status', v_status); END IF;
    IF v_status = 'TERMINE' AND public.scan_event_problem(v_event) IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OPEN', 'status', v_status);
    END IF;
    IF NOT public.shift_can_handle_cash(v_user, v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CASH_FORBIDDEN', 'message', 'Encaissement réservé au contrôleur affecté avec la permission espèces, au partenaire propriétaire ou à un admin.');
    END IF;
    IF v_float < 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FLOAT'); END IF;
    INSERT INTO public.controller_shifts (controller_id, event_id, partner_id, opening_float_amount, status, opening_confirmed_by_pin)
    VALUES (v_user, v_event, v_partner, v_float, 'OUVERT', COALESCE((p->>'pin_verified')::boolean, FALSE))
    ON CONFLICT (controller_id, event_id) WHERE status = 'OUVERT' DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.controller_shifts WHERE controller_id = v_user AND event_id = v_event AND status = 'OUVERT';
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_ALREADY_OPEN', 'shift_id', v_id);
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, 'CAISSE', 'SHIFT_OPENED', 'controller_shifts', v_id, jsonb_build_object('event_id', v_event, 'opening_float', v_float));
    RETURN jsonb_build_object('ok', true, 'shift_id', v_id);
END;
$$;

-- ── D6 : confirmation d'un paiement sur un événement suspendu, terminé ou annulé → remboursé ──
CREATE OR REPLACE FUNCTION public.payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay record;
    v_res record;
    v_cat record;
    v_blocking text;
    v_cashout uuid;
    v_count integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
BEGIN
    SELECT id, status::text AS status, client_id, payment_target::text AS payment_target
      INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'NOT_FOUND');
    END IF;
    IF v_pay.status = 'SUCCESS' THEN
        SELECT count(*) INTO v_count FROM public.tickets WHERE payment_id = p_payment_id;
        RETURN jsonb_build_object('result', 'ALREADY_CONFIRMED', 'ticket_count', v_count);
    END IF;
    IF v_pay.status IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('result', 'REFUND_IN_PROGRESS', 'status', v_pay.status);
    END IF;
    IF v_pay.payment_target <> 'TICKET' THEN
        RETURN jsonb_build_object('result', 'NOT_TICKET');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stock_reservations WHERE payment_id = p_payment_id) THEN
        RETURN jsonb_build_object('result', 'NO_ITEMS');
    END IF;

    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT category_id FROM public.stock_reservations WHERE payment_id = p_payment_id)
     ORDER BY id FOR UPDATE;

    -- Le panier peut-il être honoré en entier ? (événement en vente, réservation active, ou stock libre si elle a échu)
    FOR v_res IN
        SELECT r.*, c.total_quantity, c.sold_quantity, c.held_quantity, c.name, e.status::text AS event_status
          FROM public.stock_reservations r
          JOIN public.ticket_categories c ON c.id = r.category_id
          JOIN public.events e ON e.id = c.event_id
         WHERE r.payment_id = p_payment_id
         ORDER BY r.category_id
    LOOP
        IF v_res.event_status = 'ANNULE' THEN
            v_blocking := format('événement annulé (%s)', v_res.name);
        ELSIF v_res.event_status = 'SUSPENDU' THEN
            v_blocking := format('événement suspendu (%s)', v_res.name);
        ELSIF v_res.event_status = 'TERMINE' THEN
            v_blocking := format('événement terminé (%s)', v_res.name);
        ELSIF v_res.status = 'ACTIVE' THEN
            CONTINUE;
        ELSIF v_res.status = 'CONVERTED' THEN
            v_blocking := format('réservation déjà convertie (%s)', v_res.name);
        ELSIF v_res.total_quantity - v_res.sold_quantity - v_res.held_quantity < v_res.quantity THEN
            v_blocking := format('plus de place « %s » après échéance de la réservation', v_res.name);
        END IF;
        EXIT WHEN v_blocking IS NOT NULL;
    END LOOP;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.stock_reservations SET status = 'RELEASED', closed_at = now(), close_reason = 'REFUND'
         WHERE payment_id = p_payment_id AND status = 'ACTIVE';
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source,
               metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
         WHERE id = p_payment_id;
        v_cashout := public.refund_request(p_payment_id, 'Panier impossible à honorer : ' || v_blocking, 'REFUND');
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
    END IF;

    -- Conversion et émission (montants lus sur les réservations, jamais recalculés)
    FOR v_res IN SELECT * FROM public.stock_reservations WHERE payment_id = p_payment_id ORDER BY category_id LOOP
        -- held d'abord (trigger), puis sold : la contrainte sold + held <= total reste respectée
        UPDATE public.stock_reservations SET status = 'CONVERTED', closed_at = now(), close_reason = 'CONFIRMED' WHERE id = v_res.id;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_res.quantity WHERE id = v_res.category_id;
        SELECT event_id INTO v_cat FROM public.ticket_categories WHERE id = v_res.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, service_fee, qr_code, status)
            SELECT v_cat.event_id, v_res.category_id, v_pay.client_id, p_payment_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   v_res.unit_price,
                   v_res.unit_service_fee,
                   'EV-QR-' || replace(gen_random_uuid()::text, '-', ''),
                   'VALIDE'
              FROM generate_series(1, v_res.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
    END LOOP;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
           confirmed_source = p_source, ticket_id = v_ticket_ids[1]
     WHERE id = p_payment_id;

    RETURN jsonb_build_object('result', 'CONFIRMED', 'ticket_ids', to_jsonb(v_ticket_ids), 'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0));
END;
$$;

-- ── E : lecture publique de events étendue aux statuts publics ──────────────
-- Le motif interne d'une annulation n'est plus sur events (seule source : event_cancellations,
-- illisible par anon). Les statuts non publics restent réservés au propriétaire et aux admins.
DROP POLICY IF EXISTS "events_read_public" ON public.events;
CREATE POLICY "events_read_public" ON public.events
    FOR SELECT USING (
        status IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE')
        OR public.is_partner_owner(partner_id)
        OR public.is_admin()
    );

-- ── Privilèges ──────────────────────────────────────────────────────────────
DO $$
DECLARE
    f text;
BEGIN
    -- RPC et fonctions internes : service_role uniquement
    FOREACH f IN ARRAY ARRAY[
        'public.event_end_at(uuid)',
        'public.fin_event_end(uuid)',
        'public.event_status_label(text)',
        'public.event_actor_profile(uuid, uuid)',
        'public.event_status_apply(uuid, event_status, event_status, uuid, text, text, text)',
        'public.event_notify(uuid[], text, text, jsonb)',
        'public.event_transition(jsonb)',
        'public.event_actions(jsonb)',
        'public.event_cancel(jsonb)',
        'public.event_cancellation_impact(jsonb)',
        'public.event_cancellation_progress(jsonb)',
        'public.events_finish_overdue(jsonb)',
        'public.scan_window(uuid)',
        'public.scan_event_problem(uuid)',
        'public.ticket_sale_problems(uuid, jsonb)',
        'public.shift_open(jsonb)',
        'public.payment_confirm(uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
    -- Fonctions de triggers : aucun EXECUTE pour les rôles API
    FOREACH f IN ARRAY ARRAY[
        'public.events_force_draft()',
        'public.events_log_creation()',
        'public.events_status_guard()',
        'public.event_status_history_append_only()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
    END LOOP;
END;
$$;

-- ============================================================================
-- EVENT VILLAGE — FINITION 1 : page Équipe (une seule équipe, claire, sans jargon)
-- ============================================================================
-- Revue d'ergonomie, section 3.2 (E-10, E-11, E-13 à E-21). Une seule lecture de l'équipe pour /partner/team et
-- l'onglet Équipe du pilotage ; invitations visibles 30 jours, annulables, effaçables, renvoyables ; avis à la
-- partenaire quand le contrôleur accepte, refuse ou laisse expirer ; réglages d'un contrôleur en une transaction.
--
-- Sécurité S1 (lecture de event_controllers) : migration précédente, 20261115000001_finition1_securite.sql.
--
-- Objets :
--   controller_invitations : état CANCELLED, colonnes phone_entered, cleared_at, last_sent_at, send_count,
--     cancelled_by (+ reprise : numéro du titulaire, date de création) ;
--   types d'avis CONTROLLER_INVITATION_ACCEPTED, _DECLINED, _EXPIRED (cloche, push, email ; jamais de SMS) ;
--   fonctions nouvelles : team_mask_name, team_gate_categories (complément 9), controller_invitation_notify_partner, partner_team_view,
--     controller_invitation_cancel, controller_invitation_clear, controller_invitation_resend,
--     controller_invitations_expire_due, event_controller_settings_set ;
--   recopies : controller_invitation_create (20261109000008_lot9bis_cycle.sql:1990-2070),
--     controller_invitation_respond (20261109000008_lot9bis_cycle.sql:2076-2143), changements indiqués en ligne.
-- Fonctions : search_path fixé, service_role seul ; SECURITY DEFINER sauf team_mask_name (IMMUTABLE, aucune lecture).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2. Invitations de contrôleur : annulation, effacement, renvoi, numéro saisi
-- ----------------------------------------------------------------------------
ALTER TABLE public.controller_invitations DROP CONSTRAINT IF EXISTS controller_invitations_status_check;
ALTER TABLE public.controller_invitations ADD CONSTRAINT controller_invitations_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'));
ALTER TABLE public.controller_invitations ADD COLUMN IF NOT EXISTS phone_entered text;
ALTER TABLE public.controller_invitations ADD COLUMN IF NOT EXISTS cleared_at timestamptz;
ALTER TABLE public.controller_invitations ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
ALTER TABLE public.controller_invitations ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 1;
ALTER TABLE public.controller_invitations ADD COLUMN IF NOT EXISTS cancelled_by uuid;
ALTER TABLE public.controller_invitations DROP CONSTRAINT IF EXISTS controller_invitations_cancelled_by_fkey;
ALTER TABLE public.controller_invitations ADD CONSTRAINT controller_invitations_cancelled_by_fkey
    FOREIGN KEY (cancelled_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.controller_invitations DROP CONSTRAINT IF EXISTS controller_invitations_send_count_check;
ALTER TABLE public.controller_invitations ADD CONSTRAINT controller_invitations_send_count_check CHECK (send_count >= 1);
-- Reprise : date du dernier envoi = création ; numéro saisi = numéro du titulaire (l'invitation a été trouvée par lui)
UPDATE public.controller_invitations SET last_sent_at = created_at WHERE last_sent_at IS NULL;
ALTER TABLE public.controller_invitations ALTER COLUMN last_sent_at SET DEFAULT now();
ALTER TABLE public.controller_invitations ALTER COLUMN last_sent_at SET NOT NULL;
UPDATE public.controller_invitations ci SET phone_entered = u.phone
  FROM public.users u WHERE u.id = ci.user_id AND ci.phone_entered IS NULL;
CREATE INDEX IF NOT EXISTS idx_controller_invitations_partner_created
    ON public.controller_invitations (partner_id, created_at DESC);
COMMENT ON COLUMN public.controller_invitations.phone_entered IS
    'Finition 1 (E-19) : numéro saisi par l''organisateur, affiché sur sa page Équipe (il le connaît déjà).';
COMMENT ON COLUMN public.controller_invitations.cleared_at IS
    'Finition 1 (E-19) : invitation expirée, refusée ou annulée effacée de la page Équipe par l''organisateur.';


-- ----------------------------------------------------------------------------
-- 3. Types d'avis à la partenaire (E-20) : cloche, push, email ; jamais de SMS
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('CONTROLLER_INVITATION_ACCEPTED', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'], 'PARTNER', 'BLOCK', FALSE, NULL),
    ('CONTROLLER_INVITATION_DECLINED', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'], 'PARTNER', 'BLOCK', FALSE, NULL),
    ('CONTROLLER_INVITATION_EXPIRED',  'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'], 'PARTNER', 'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- ----------------------------------------------------------------------------
-- 4. Aides
-- ----------------------------------------------------------------------------
-- Nom masqué d'un titulaire (même règle que lib/security/mask.ts, maskPersonName) : « Mo*** D*** ».
CREATE OR REPLACE FUNCTION public.team_mask_name(p_first text, p_last text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN btrim(COALESCE(p_first, '')) = '' AND btrim(COALESCE(p_last, '')) = '' THEN 'Titulaire du compte'
        ELSE concat_ws(' ',
            CASE WHEN btrim(COALESCE(p_first, '')) <> '' THEN left(btrim(p_first), 2) || '***' END,
            CASE WHEN btrim(COALESCE(p_last, '')) <> '' THEN left(btrim(p_last), 1) || '***' END)
    END;
$$;

-- Complément 9 : catégories qu'une porte laisse entrer (celles de sa zone), avec leur couleur au contrôle, dans l'ordre
-- des catégories ; [] si la zone n'admet aucune catégorie. Lecture seule.
CREATE OR REPLACE FUNCTION public.team_gate_categories(p_gate uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', c.name, 'scan_color', c.scan_color)
                              ORDER BY c.price, lower(c.name), c.id), '[]'::jsonb)
      FROM public.event_gates g
      JOIN public.zone_categories zc ON zc.zone_id = g.zone_id
      JOIN public.ticket_categories c ON c.id = zc.category_id
     WHERE g.id = p_gate;
$$;

-- Avis à la propriétaire de la fiche quand une invitation est acceptée, refusée ou expirée (une fois par invitation et
-- par type : clé d'idempotence). Nom complet pour une acceptation (il rejoint l'équipe), masqué sinon.
CREATE OR REPLACE FUNCTION public.controller_invitation_notify_partner(p_invitation uuid, p_type text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
    v_events jsonb;
    v_name text;
BEGIN
    IF p_type NOT IN ('CONTROLLER_INVITATION_ACCEPTED', 'CONTROLLER_INVITATION_DECLINED', 'CONTROLLER_INVITATION_EXPIRED') THEN
        RAISE EXCEPTION 'controller_invitation_notify_partner : type inconnu %', p_type;
    END IF;
    SELECT ci.id, ci.assignments, pa.user_id AS owner_id, u.first_name, u.last_name
      INTO r
      FROM public.controller_invitations ci
      JOIN public.partners pa ON pa.id = ci.partner_id
      JOIN public.users u ON u.id = ci.user_id
     WHERE ci.id = p_invitation;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    v_name := CASE WHEN p_type = 'CONTROLLER_INVITATION_ACCEPTED'
                   THEN NULLIF(btrim(concat_ws(' ', btrim(COALESCE(r.first_name, '')), btrim(COALESCE(r.last_name, '')))), '')
                   ELSE public.team_mask_name(r.first_name, r.last_name) END;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'event_id', e.id, 'title', e.title,
               'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
           ORDER BY e.start_date, e.start_time, e.id), '[]'::jsonb)
      INTO v_events
      FROM public.events e
     WHERE e.id IN (SELECT public.try_uuid(a->>'event_id') FROM jsonb_array_elements(r.assignments) a);
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', p_type, 'key', p_type || ':' || r.id::text,
        'user_id', r.owner_id,
        'data', jsonb_build_object('invitation_id', r.id, 'controller_name', COALESCE(v_name, 'Titulaire du compte'),
                                   'events', v_events)));
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. controller_invitation_create (recopie, 20261109000008_lot9bis_cycle.sql:1990-2070)
-- ----------------------------------------------------------------------------
-- Changements : numéro saisi (p.phone_entered) enregistré ; l'invitation en attente remplacée passe à CANCELLED
-- (annulée par l'acteur, effacée de la page) au lieu d'EXPIRED, pour ne pas déclencher l'avis « expirée ».
CREATE OR REPLACE FUNCTION public.controller_invitation_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_user uuid := public.try_uuid(p->>'user_id');
    v_phone text := NULLIF(btrim(COALESCE(p->>'phone_entered', '')), '');
    v_assignments jsonb;
    v_company text;
    v_events jsonb;
    v_id uuid;
    v_expires timestamptz;
BEGIN
    IF v_actor IS NULL OR v_partner IS NULL OR v_user IS NULL OR jsonb_typeof(p->'assignments') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p->'assignments') = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Invitation incomplète.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'assignments') a
                WHERE public.try_uuid(a->>'event_id') IS NULL
                   OR jsonb_typeof(a->'can_accept_cash') NOT IN ('boolean', 'null')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Invitation incomplète.');
    END IF;
    SELECT COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) INTO v_company
      FROM public.partners pa WHERE pa.id = v_partner;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Organisateur introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Ce compte n''est pas actif.');
    END IF;

    -- Une ligne par événement (le dernier droit d'encaisser donné l'emporte), événements de la partenaire seulement
    SELECT jsonb_agg(jsonb_build_object('event_id', x.event_id, 'can_accept_cash', x.cash) ORDER BY x.event_id)
      INTO v_assignments
      FROM (SELECT DISTINCT ON (public.try_uuid(a->>'event_id')) public.try_uuid(a->>'event_id') AS event_id,
                   COALESCE((a->>'can_accept_cash')::boolean, FALSE) AS cash
              FROM jsonb_array_elements(p->'assignments') WITH ORDINALITY AS t(a, o)
             ORDER BY public.try_uuid(a->>'event_id'), o DESC) x;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_assignments) a
                LEFT JOIN public.events e ON e.id = (a->>'event_id')::uuid
                WHERE e.id IS NULL OR e.partner_id IS DISTINCT FROM v_partner) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED', 'message', 'Vous n''êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_assignments) a
                JOIN public.events e ON e.id = (a->>'event_id')::uuid
                WHERE e.status::text NOT IN ('VALIDE', 'PUBLIE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ELIGIBLE', 'message', 'Seuls les événements validés ou publiés peuvent être affectés.');
    END IF;

    -- Finition 1 : une seule invitation en attente par partenaire et par compte ; la précédente est annulée et effacée
    -- (remplacée par celle-ci), sans avis « expirée »
    UPDATE public.controller_invitations
       SET status = 'CANCELLED', responded_at = now(), cancelled_by = v_actor, cleared_at = now()
     WHERE partner_id = v_partner AND user_id = v_user AND status = 'PENDING';

    INSERT INTO public.controller_invitations (partner_id, user_id, created_by, assignments, phone_entered)
    VALUES (v_partner, v_user, v_actor, v_assignments, v_phone)
    RETURNING id, expires_at INTO v_id, v_expires;

    SELECT jsonb_agg(jsonb_build_object(
               'event_id', e.id, 'title', e.title,
               'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
           ORDER BY e.start_date, e.start_time, e.id)
      INTO v_events
      FROM public.events e
     WHERE e.id IN (SELECT (a->>'event_id')::uuid FROM jsonb_array_elements(v_assignments) a);

    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_INVITATION', 'key', 'CONTROLLER_INVITATION:' || v_id::text,
        'user_id', v_user, 'actor_id', v_actor,
        'data', jsonb_build_object('invitation_id', v_id, 'company', v_company, 'expires_at', v_expires, 'events', v_events)));

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, COALESCE(NULLIF(p->>'actor_role', ''), 'PARTENAIRE'), 'CONTROLLER_INVITATION_CREATED', 'controller_invitations', v_id,
            jsonb_build_object('user_id', v_user, 'assignments', v_assignments),
            jsonb_build_object('partner_id', v_partner, 'expires_at', v_expires, 'reason', NULLIF(btrim(COALESCE(p->>'reason', '')), '')));

    RETURN jsonb_build_object('ok', true, 'invitation_id', v_id, 'expires_at', v_expires);
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. controller_invitation_respond (recopie, 20261109000008_lot9bis_cycle.sql:2076-2143)
-- ----------------------------------------------------------------------------
-- Changements : invitation annulée par l'organisateur → INVITATION_CANCELLED ; avis à la partenaire (E-20) à
-- l'acceptation, au refus et quand la réponse arrive après l'échéance.
CREATE OR REPLACE FUNCTION public.controller_invitation_respond(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_accept boolean;
    inv record;
    v_assigned uuid[];
BEGIN
    IF v_id IS NULL OR v_actor IS NULL OR jsonb_typeof(p->'accept') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Réponse incomplète.');
    END IF;
    v_accept := (p->>'accept')::boolean;
    SELECT * INTO inv FROM public.controller_invitations WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    IF inv.user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    -- Finition 1 (E-19) : invitation annulée par l'organisateur
    IF inv.status = 'CANCELLED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_CANCELLED', 'message', 'L’organisateur a annulé cette invitation.');
    END IF;
    IF inv.status <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_PENDING', 'status', inv.status, 'message', 'Cette invitation a déjà reçu une réponse.');
    END IF;
    IF inv.expires_at <= now() THEN
        UPDATE public.controller_invitations SET status = 'EXPIRED', responded_at = now() WHERE id = inv.id;
        PERFORM public.controller_invitation_notify_partner(inv.id, 'CONTROLLER_INVITATION_EXPIRED');
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_EXPIRED', 'message', 'Cette invitation a expiré.');
    END IF;

    IF NOT v_accept THEN
        UPDATE public.controller_invitations SET status = 'DECLINED', responded_at = now() WHERE id = inv.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_actor, 'CLIENT', 'CONTROLLER_INVITATION_DECLINED', 'controller_invitations', inv.id,
                jsonb_build_object('partner_id', inv.partner_id));
        PERFORM public.controller_invitation_notify_partner(inv.id, 'CONTROLLER_INVITATION_DECLINED');
        RETURN jsonb_build_object('ok', true, 'status', 'DECLINED');
    END IF;

    -- Rôle CONTROLEUR ajouté au compte, sans toucher au reste (users.role recalculé par le trigger de user_roles)
    INSERT INTO public.user_roles (user_id, role) VALUES (v_actor, 'CLIENT'), (v_actor, 'CONTROLEUR')
    ON CONFLICT (user_id, role) DO NOTHING;
    -- Affectations aux événements encore VALIDE ou PUBLIE de la partenaire, en une instruction (un SMS regroupé)
    WITH ins AS (
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT e.id, v_actor, COALESCE((a->>'can_accept_cash')::boolean, FALSE), inv.created_by
          FROM jsonb_array_elements(inv.assignments) a
          JOIN public.events e ON e.id = public.try_uuid(a->>'event_id')
         WHERE e.partner_id = inv.partner_id AND e.status::text IN ('VALIDE', 'PUBLIE')
        ON CONFLICT (event_id, user_id) DO NOTHING
        RETURNING event_id
    )
    SELECT COALESCE(array_agg(event_id ORDER BY event_id), ARRAY[]::uuid[]) INTO v_assigned FROM ins;
    UPDATE public.controller_invitations SET status = 'ACCEPTED', responded_at = now() WHERE id = inv.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, 'CLIENT', 'CONTROLLER_INVITATION_ACCEPTED', 'controller_invitations', inv.id,
            jsonb_build_object('assigned_event_ids', to_jsonb(v_assigned)), jsonb_build_object('partner_id', inv.partner_id));
    PERFORM public.controller_invitation_notify_partner(inv.id, 'CONTROLLER_INVITATION_ACCEPTED');
    RETURN jsonb_build_object('ok', true, 'status', 'ACCEPTED', 'assigned_event_ids', to_jsonb(v_assigned));
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. Droit d'agir sur une invitation (aide des trois actions de la partenaire)
-- ----------------------------------------------------------------------------
-- p = { actor_id, invitation_id, reason? }. Propriétaire de la fiche de l'invitation, ou admin muni de events.write
-- (motif de 5 caractères au moins, journalisé) ; un tiers ou une invitation inconnue : INVITATION_NOT_FOUND (aucun
-- indice) ; un admin sans la permission : PERMISSION_MISSING ; compte non actif : ACCOUNT_NOT_ACTIVE.
-- Rend { ok, staff, reason } ou le refus ; la ligne est verrouillée (FOR UPDATE) par l'appelant.
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
    IF v_staff AND char_length(COALESCE(v_reason, '')) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
            'message', 'Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'staff', v_staff, 'reason', v_reason);
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. controller_invitation_cancel (nouvelle, E-19)
-- ----------------------------------------------------------------------------
-- p = { actor_id, invitation_id, reason? } → { ok, invitation_id, status: 'CANCELLED' }. En attente et non échue
-- seulement (sinon INVITATION_NOT_PENDING). Le lien du SMS ne mène plus à rien (controller_invitations_mine ne rend
-- que les invitations en attente ; controller_invitation_respond rend INVITATION_CANCELLED). Aucun message au titulaire.
CREATE OR REPLACE FUNCTION public.controller_invitation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    inv record;
    chk jsonb;
BEGIN
    IF v_id IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    SELECT ci.*, pa.user_id AS owner_id INTO inv
      FROM public.controller_invitations ci JOIN public.partners pa ON pa.id = ci.partner_id
     WHERE ci.id = v_id FOR UPDATE OF ci;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    chk := public.controller_invitation_actor_check(p, inv.owner_id);
    IF (chk->>'ok')::boolean IS NOT TRUE THEN
        RETURN chk;
    END IF;
    IF inv.status <> 'PENDING' OR inv.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_PENDING', 'message', 'Cette invitation n’attend plus de réponse.');
    END IF;
    UPDATE public.controller_invitations
       SET status = 'CANCELLED', responded_at = now(), cancelled_by = v_actor
     WHERE id = inv.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN (chk->>'staff')::boolean THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_INVITATION_CANCELLED',
            'controller_invitations', inv.id,
            jsonb_build_object('partner_id', inv.partner_id, 'user_id', inv.user_id, 'reason', chk->>'reason'));
    RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id, 'status', 'CANCELLED');
END;
$$;


-- ----------------------------------------------------------------------------
-- 9. controller_invitation_clear (nouvelle, E-19 « Effacer »)
-- ----------------------------------------------------------------------------
-- p = { actor_id, invitation_id, reason? } → { ok, invitation_id }. Expirée, refusée ou annulée (une invitation en
-- attente échue est d'abord close EXPIRED) ; en attente et non échue : INVITATION_STILL_PENDING ; acceptée :
-- INVITATION_NOT_FOUND (elle n'est pas affichée). Déjà effacée : succès sans nouvel effet.
CREATE OR REPLACE FUNCTION public.controller_invitation_clear(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    inv record;
    chk jsonb;
BEGIN
    IF v_id IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    SELECT ci.*, pa.user_id AS owner_id INTO inv
      FROM public.controller_invitations ci JOIN public.partners pa ON pa.id = ci.partner_id
     WHERE ci.id = v_id FOR UPDATE OF ci;
    IF NOT FOUND OR inv.status = 'ACCEPTED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    chk := public.controller_invitation_actor_check(p, inv.owner_id);
    IF (chk->>'ok')::boolean IS NOT TRUE THEN
        RETURN chk;
    END IF;
    IF inv.status = 'PENDING' AND inv.expires_at > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_STILL_PENDING',
            'message', 'Cette invitation attend encore une réponse : annulez-la d’abord.');
    END IF;
    IF inv.cleared_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id);
    END IF;
    UPDATE public.controller_invitations
       SET cleared_at = now(),
           status = CASE WHEN status = 'PENDING' THEN 'EXPIRED' ELSE status END,
           responded_at = CASE WHEN status = 'PENDING' THEN expires_at ELSE responded_at END
     WHERE id = inv.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN (chk->>'staff')::boolean THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_INVITATION_CLEARED',
            'controller_invitations', inv.id,
            jsonb_build_object('partner_id', inv.partner_id, 'status', inv.status, 'reason', chk->>'reason'));
    RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id);
END;
$$;


-- ----------------------------------------------------------------------------
-- 10. controller_invitation_resend (nouvelle, E-19 « Renvoyer l'invitation »)
-- ----------------------------------------------------------------------------
-- p = { actor_id, invitation_id, reason?, check_only? } → { ok, invitation_id, phone, expires_at, send_count }.
-- check_only : droit et état vérifiés, sans effet, numéro du titulaire rendu à la route (quota du numéro réservé avant
-- le renvoi : aucun quota d'un numéro n'est consommé pour un appelant sans droit). En attente et non échue seulement :
-- prolongée de 72 h, CONTROLLER_INVITATION remis en file (SMS, cloche, push, email ; clé du n-ième envoi).
CREATE OR REPLACE FUNCTION public.controller_invitation_resend(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_check boolean := COALESCE(jsonb_typeof(p->'check_only') = 'boolean' AND (p->>'check_only')::boolean, FALSE);
    inv record;
    chk jsonb;
    v_phone text;
    v_company text;
    v_events jsonb;
    v_expires timestamptz;
    v_count integer;
BEGIN
    IF v_id IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    SELECT ci.*, pa.user_id AS owner_id, COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS company
      INTO inv
      FROM public.controller_invitations ci JOIN public.partners pa ON pa.id = ci.partner_id
     WHERE ci.id = v_id FOR UPDATE OF ci;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    chk := public.controller_invitation_actor_check(p, inv.owner_id);
    IF (chk->>'ok')::boolean IS NOT TRUE THEN
        RETURN chk;
    END IF;
    IF inv.status <> 'PENDING' OR inv.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_PENDING',
            'message', 'Cette invitation n’attend plus de réponse : invitez de nouveau.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = inv.user_id AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Ce compte n’est pas actif : il ne peut pas être invité.');
    END IF;
    SELECT u.phone INTO v_phone FROM public.users u WHERE u.id = inv.user_id;
    IF v_check THEN
        RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id, 'phone', v_phone);
    END IF;

    UPDATE public.controller_invitations
       SET expires_at = now() + interval '72 hours', last_sent_at = now(), send_count = send_count + 1
     WHERE id = inv.id
    RETURNING expires_at, send_count INTO v_expires, v_count;
    SELECT jsonb_agg(jsonb_build_object(
               'event_id', e.id, 'title', e.title,
               'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
           ORDER BY e.start_date, e.start_time, e.id)
      INTO v_events
      FROM public.events e
     WHERE e.id IN (SELECT public.try_uuid(a->>'event_id') FROM jsonb_array_elements(inv.assignments) a);
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_INVITATION', 'key', 'CONTROLLER_INVITATION:' || inv.id::text || ':' || v_count::text,
        'user_id', inv.user_id, 'actor_id', v_actor,
        'data', jsonb_build_object('invitation_id', inv.id, 'company', inv.company, 'expires_at', v_expires, 'events', v_events)));
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN (chk->>'staff')::boolean THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_INVITATION_RESENT',
            'controller_invitations', inv.id,
            jsonb_build_object('partner_id', inv.partner_id, 'send_count', v_count, 'expires_at', v_expires, 'reason', chk->>'reason'));
    RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id, 'phone', v_phone, 'expires_at', v_expires, 'send_count', v_count);
END;
$$;


-- ----------------------------------------------------------------------------
-- 11. controller_invitations_expire_due (nouvelle, E-20) : appelée par /api/cron/reminders
-- ----------------------------------------------------------------------------
-- Invitations en attente échues → EXPIRED (date de réponse = échéance) et avis CONTROLLER_INVITATION_EXPIRED à la
-- partenaire (une fois : clé d'idempotence). Idempotent. → { ok, expired }.
CREATE OR REPLACE FUNCTION public.controller_invitations_expire_due()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_count integer := 0;
BEGIN
    FOR v_id IN
        UPDATE public.controller_invitations
           SET status = 'EXPIRED', responded_at = expires_at
         WHERE status = 'PENDING' AND expires_at <= now()
        RETURNING id
    LOOP
        PERFORM public.controller_invitation_notify_partner(v_id, 'CONTROLLER_INVITATION_EXPIRED');
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'expired', v_count);
END;
$$;


-- ----------------------------------------------------------------------------
-- 12. partner_team_view (nouvelle, E-13) : la seule lecture de l'équipe
-- ----------------------------------------------------------------------------
-- p = { partner_id, event_id? } (organisateur résolu et droits vérifiés par la route). Portée « page » : tous les
-- événements de l'organisateur ; portée « événement » : cet événement seulement (EVENT_NOT_FOUND s'il n'est pas à lui).
-- → { ok, partner_id, partner_name, event | null, members[], invitations[], events[], counts }. Chaque cellule de l'écran vient
-- d'ici : état et dates, porte (zone) ou point d'entrée, « Peut changer de porte », espèces, caisse ouverte, entrées et
-- dernier scan par événement ; invitations des 30 derniers jours non effacées (en attente toujours) ; événements et
-- leurs portes ; comptages des bandeaux.
CREATE OR REPLACE FUNCTION public.partner_team_view(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_event_json jsonb := 'null'::jsonb;
    v_members jsonb;
    v_invitations jsonb;
    v_events jsonb;
    v_counts jsonb;
BEGIN
    IF v_partner IS NULL OR (COALESCE(jsonb_typeof(p->'event_id'), 'null') <> 'null' AND v_event IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande invalide.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = v_partner) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Organisateur introuvable.');
    END IF;
    IF v_event IS NOT NULL THEN
        SELECT jsonb_build_object('id', e.id, 'title', e.title, 'status', e.status::text,
                                  'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar',
                                  'assignable', e.status::text IN ('VALIDE', 'PUBLIE'),
                                  'has_zones', EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = e.id))
          INTO v_event_json
          FROM public.events e
         WHERE e.id = v_event AND e.partner_id = v_partner;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
        END IF;
    END IF;

    -- Événements de la portée, avec leurs portes
    WITH ev AS (
        SELECT e.id, e.title, e.status::text AS status,
               (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar' AS start_at,
               (COALESCE(e.end_date, e.start_date) + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar' AS end_at
          FROM public.events e
         WHERE e.partner_id = v_partner AND (v_event IS NULL OR e.id = v_event)
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', ev.id, 'title', ev.title, 'status', ev.status, 'start_at', ev.start_at,
               'assignable', ev.status IN ('VALIDE', 'PUBLIE'),
               'past', ev.end_at < now() OR ev.status IN ('TERMINE', 'ANNULE'),
               'has_zones', EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = ev.id),
               'gates', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'zone_name', z.name,
                                                                      'categories', public.team_gate_categories(g.id))
                                                   ORDER BY z.position, lower(z.name), lower(g.name))
                                    FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id
                                   WHERE g.event_id = ev.id), '[]'::jsonb),
               -- Complément 9 : catégories en vente qu'aucune porte ne laisse entrer ; portes sans contrôleur (zones seulement)
               'uncovered_categories', CASE WHEN EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = ev.id) THEN COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('name', c.name, 'scan_color', c.scan_color) ORDER BY c.price, lower(c.name), c.id)
                      FROM public.ticket_categories c
                     WHERE c.event_id = ev.id AND c.is_active
                       AND (COALESCE(c.sale_online, FALSE) OR COALESCE(c.sale_counter, FALSE))
                       AND NOT EXISTS (SELECT 1 FROM public.zone_categories zc
                                         JOIN public.event_gates g ON g.zone_id = zc.zone_id
                                        WHERE zc.category_id = c.id)), '[]'::jsonb) ELSE '[]'::jsonb END,
               'gates_without_controller', COALESCE((
                    SELECT jsonb_agg(g.name ORDER BY lower(g.name))
                      FROM public.event_gates g
                     WHERE g.event_id = ev.id
                       AND NOT EXISTS (SELECT 1 FROM public.event_controllers x WHERE x.event_id = ev.id AND x.gate_id = g.id)), '[]'::jsonb))
           ORDER BY ev.start_at NULLS LAST, lower(ev.title)), '[]'::jsonb)
      INTO v_events
      FROM ev;

    -- Membres : comptes affectés à au moins un événement de la portée
    WITH ev AS (
        SELECT e.id, e.title, e.status::text AS status,
               (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar' AS start_at,
               (COALESCE(e.end_date, e.start_date) + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar' AS end_at
          FROM public.events e
         WHERE e.partner_id = v_partner AND (v_event IS NULL OR e.id = v_event)
    ), ec AS (
        SELECT x.id, x.event_id, x.user_id, x.can_accept_cash, x.entry_point, x.gate_id, x.gate_change_allowed, x.created_at,
               ev.title, ev.status, ev.start_at, ev.end_at
          FROM public.event_controllers x JOIN ev ON ev.id = x.event_id
    ), scans AS (
        SELECT sc.scanner_id, sc.event_id, count(*) FILTER (WHERE sc.accepted) AS entries, max(sc.created_at) AS last_at
          FROM public.ticket_scans sc
         WHERE sc.event_id IN (SELECT id FROM ev)
         GROUP BY sc.scanner_id, sc.event_id
    ), people AS (
        SELECT ec.user_id, min(ec.created_at) AS first_at FROM ec GROUP BY ec.user_id
    )
    SELECT COALESCE(jsonb_agg(m.item ORDER BY m.sort_key, m.user_id), '[]'::jsonb)
      INTO v_members
      FROM (
        SELECT u.id AS user_id,
               lower(btrim(concat_ws(' ', COALESCE(u.first_name, ''), COALESCE(u.last_name, '')))) AS sort_key,
               jsonb_build_object(
                   'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'phone', u.phone,
                   'account_state', st.state,
                   'active_since', GREATEST(people.first_at, act.at),
                   'activation', CASE WHEN st.state = 'PENDING_ACTIVATION' THEN (
                        SELECT jsonb_build_object('sent_at', o.created_at, 'expires_at', o.expires_at)
                          FROM public.otp_codes o
                         WHERE o.phone IN (u.phone, ltrim(u.phone, '+'), '+' || ltrim(u.phone, '+'))
                           AND o.purpose = 'CONTROLLER_SETUP'
                         ORDER BY o.created_at DESC LIMIT 1) END,
                   'other_organizers', EXISTS (SELECT 1 FROM public.event_controllers x2 JOIN public.events e2 ON e2.id = x2.event_id
                                                WHERE x2.user_id = u.id AND e2.partner_id IS DISTINCT FROM v_partner),
                   'assignments', (SELECT jsonb_agg(jsonb_build_object(
                           'assignment_id', ec.id, 'event_id', ec.event_id, 'title', ec.title, 'status', ec.status,
                           'start_at', ec.start_at, 'past', ec.end_at < now() OR ec.status IN ('TERMINE', 'ANNULE'),
                           'gate', (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'zone_name', z.name,
                                                              'categories', public.team_gate_categories(g.id))
                                      FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id
                                     WHERE g.id = ec.gate_id),
                           'has_zones', EXISTS (SELECT 1 FROM public.event_zones z2 WHERE z2.event_id = ec.event_id),
                           'gate_change_allowed', ec.gate_change_allowed,
                           'entry_point', ec.entry_point,
                           'can_accept_cash', ec.can_accept_cash,
                           'open_shift', EXISTS (SELECT 1 FROM public.controller_shifts s
                                                  WHERE s.event_id = ec.event_id AND s.controller_id = ec.user_id AND s.status = 'OUVERT'),
                           'entries', COALESCE(sc.entries, 0),
                           'last_scan_at', sc.last_at)
                       ORDER BY ec.start_at NULLS LAST, lower(ec.title))
                      FROM ec LEFT JOIN scans sc ON sc.scanner_id = ec.user_id AND sc.event_id = ec.event_id
                     WHERE ec.user_id = u.id)
               ) AS item
          FROM people
          JOIN public.users u ON u.id = people.user_id
          LEFT JOIN auth.users au ON au.id = u.id
          CROSS JOIN LATERAL (SELECT CASE
                    WHEN u.status::text IN ('SUSPENDU', 'SUPPRIME') THEN 'SUSPENDED'
                    WHEN COALESCE(au.raw_app_meta_data->>'controller_activation_pending', 'false') = 'true' THEN 'PENDING_ACTIVATION'
                    ELSE 'ACTIVE' END AS state) st
          LEFT JOIN LATERAL (SELECT max(al.created_at) AS at FROM public.audit_logs al
                              WHERE al.action = 'CONTROLLER_ACCOUNT_ACTIVATED' AND al.object_id = u.id) act ON TRUE
      ) m;

    -- Invitations : en attente (non échues) toujours ; expirées, refusées, annulées des 30 derniers jours ; non effacées
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', ci.id,
               'state', CASE WHEN ci.status = 'PENDING' AND ci.expires_at <= now() THEN 'EXPIRED' ELSE ci.status END,
               'phone_entered', ci.phone_entered,
               'display_name', public.team_mask_name(u.first_name, u.last_name),
               'created_at', ci.created_at, 'last_sent_at', ci.last_sent_at, 'expires_at', ci.expires_at,
               'responded_at', CASE WHEN ci.status = 'PENDING' AND ci.expires_at <= now() THEN ci.expires_at ELSE ci.responded_at END,
               'send_count', ci.send_count,
               'events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                          'id', e.id, 'title', e.title,
                                          'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar',
                                          'assignable', e.status::text IN ('VALIDE', 'PUBLIE'))
                                      ORDER BY e.start_date, e.start_time, e.id)
                                     FROM public.events e
                                    WHERE e.id IN (SELECT public.try_uuid(a->>'event_id') FROM jsonb_array_elements(ci.assignments) a)),
                                  '[]'::jsonb))
           ORDER BY ci.created_at DESC, ci.id), '[]'::jsonb)
      INTO v_invitations
      FROM public.controller_invitations ci
      JOIN public.users u ON u.id = ci.user_id
     WHERE ci.partner_id = v_partner
       AND ci.cleared_at IS NULL
       AND ci.status <> 'ACCEPTED'
       AND ((ci.status = 'PENDING' AND ci.expires_at > now())
            OR COALESCE(CASE WHEN ci.status = 'PENDING' THEN ci.expires_at ELSE ci.responded_at END, ci.created_at) > now() - interval '30 days')
       AND (v_event IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(ci.assignments) a WHERE public.try_uuid(a->>'event_id') = v_event));

    -- Comptages des bandeaux (aucun comptage à l'écran)
    SELECT jsonb_build_object(
               'members', jsonb_array_length(v_members),
               'ready', (SELECT count(*) FROM jsonb_array_elements(v_members) x WHERE x->>'account_state' = 'ACTIVE'),
               'pending', (SELECT count(*) FROM jsonb_array_elements(v_members) x WHERE x->>'account_state' = 'PENDING_ACTIVATION')
                        + (SELECT count(*) FROM jsonb_array_elements(v_invitations) i WHERE i->>'state' = 'PENDING'),
               'without_gate', (SELECT count(DISTINCT x->>'user_id') FROM jsonb_array_elements(v_members) x,
                                       jsonb_array_elements(x->'assignments') a
                                 WHERE (a->>'has_zones')::boolean AND a->'gate' = 'null'::jsonb AND NOT (a->>'past')::boolean),
               'to_follow_up', (SELECT count(*) FROM jsonb_array_elements(v_invitations) i WHERE i->>'state' IN ('EXPIRED', 'DECLINED')))
      INTO v_counts;

    RETURN jsonb_build_object('ok', true, 'partner_id', v_partner,
                              'partner_name', (SELECT COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name)
                                                 FROM public.partners pa WHERE pa.id = v_partner),
                              'event', v_event_json, 'members', v_members,
                              'invitations', v_invitations, 'events', v_events, 'counts', v_counts);
END;
$$;


-- ----------------------------------------------------------------------------
-- 13. event_controller_settings_set (nouvelle, E-14) : porte ou point d'entrée, « Peut changer de porte », espèces
-- ----------------------------------------------------------------------------
-- p = { actor_id, event_id, controller_id, gate_id?, gate_change_allowed?, entry_point?, can_accept_cash, reason? }.
-- Propriétaire de l'événement, ou admin muni de events.write (motif de 5 caractères au moins) ; tiers : EVENT_NOT_FOUND.
-- Événement à zones : porte de cet événement ou aucune (GATE_INVALID sinon), le point d'entrée prend le nom de la porte ;
-- sans zone : point d'entrée libre (80 caractères), aucune porte. Une transaction ; audit CONTROLLER_SETTINGS_SET.
CREATE OR REPLACE FUNCTION public.event_controller_settings_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_controller uuid := public.try_uuid(p->>'controller_id');
    v_gate uuid := public.try_uuid(p->>'gate_id');
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_entry text := NULLIF(btrim(COALESCE(p->>'entry_point', '')), '');
    v_allowed boolean;
    v_cash boolean;
    v_zones boolean;
    v_gate_name text;
    v_gate_json jsonb := 'null'::jsonb;
    v_open boolean;
    a record;
    ec record;
BEGIN
    IF v_actor IS NULL OR v_event IS NULL OR v_controller IS NULL
       OR jsonb_typeof(p->'can_accept_cash') IS DISTINCT FROM 'boolean'
       OR (COALESCE(jsonb_typeof(p->'gate_id'), 'null') <> 'null' AND v_gate IS NULL)
       OR COALESCE(jsonb_typeof(p->'gate_change_allowed'), 'null') NOT IN ('null', 'boolean')
       OR char_length(COALESCE(v_entry, '')) > 80 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Réglages invalides.');
    END IF;
    v_cash := (p->>'can_accept_cash')::boolean;
    v_allowed := COALESCE((p->>'gate_change_allowed')::boolean, FALSE);
    PERFORM 1 FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (COALESCE(a.is_owner, FALSE) OR COALESCE(a.is_staff, FALSE)) THEN
        IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.write',
                'message', 'Action non autorisée : votre compte n’a pas la permission « Gérer les événements ».');
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT COALESCE(a.is_active, FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF NOT COALESCE(a.is_owner, FALSE) AND char_length(COALESCE(v_reason, '')) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
            'message', 'Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.');
    END IF;
    v_zones := EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event);
    -- Complément 9 : sur un événement à zones, la porte se choisit dans la liste ; aucun texte libre
    IF v_zones AND v_entry IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'GATES_CONFIGURED',
            'message', 'Cet événement a des portes : choisissez la porte du contrôleur dans la liste.');
    END IF;
    IF NOT v_zones AND v_gate IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'GATE_INVALID', 'message', 'Cet événement n’a pas de portes : indiquez un point d’entrée.');
    END IF;
    IF v_gate IS NOT NULL THEN
        SELECT g.name, jsonb_build_object('id', g.id, 'name', g.name, 'zone_name', z.name, 'categories', public.team_gate_categories(g.id))
          INTO v_gate_name, v_gate_json
          FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id
         WHERE g.id = v_gate AND g.event_id = v_event;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_INVALID', 'message', 'Porte inconnue : choisissez une porte de cet événement.');
        END IF;
    END IF;
    SELECT x.id, x.gate_id, x.gate_change_allowed, x.entry_point, x.can_accept_cash INTO ec
      FROM public.event_controllers x
     WHERE x.event_id = v_event AND x.user_id = v_controller FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Ce contrôleur ne contrôle pas cet événement.');
    END IF;
    UPDATE public.event_controllers
       SET gate_id = CASE WHEN v_zones THEN v_gate ELSE NULL END,
           gate_change_allowed = CASE WHEN v_zones THEN v_allowed ELSE FALSE END,
           entry_point = CASE WHEN v_zones THEN v_gate_name ELSE v_entry END,
           can_accept_cash = v_cash
     WHERE id = ec.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, CASE WHEN COALESCE(a.is_owner, FALSE) THEN 'PARTENAIRE' ELSE 'ADMIN' END, 'CONTROLLER_SETTINGS_SET',
            'event_controllers', ec.id,
            jsonb_build_object('gate_id', ec.gate_id, 'gate_change_allowed', ec.gate_change_allowed,
                               'entry_point', ec.entry_point, 'can_accept_cash', ec.can_accept_cash),
            jsonb_build_object('gate_id', CASE WHEN v_zones THEN v_gate END, 'gate_change_allowed', v_zones AND v_allowed,
                               'entry_point', CASE WHEN v_zones THEN v_gate_name ELSE v_entry END, 'can_accept_cash', v_cash),
            jsonb_build_object('event_id', v_event, 'controller_id', v_controller, 'reason', v_reason));
    v_open := EXISTS (SELECT 1 FROM public.controller_shifts s
                       WHERE s.event_id = v_event AND s.controller_id = v_controller AND s.status = 'OUVERT');
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'controller_id', v_controller,
                              'gate', CASE WHEN v_zones THEN v_gate_json ELSE 'null'::jsonb END,
                              'gate_change_allowed', v_zones AND v_allowed,
                              'entry_point', CASE WHEN v_zones THEN v_gate_name ELSE v_entry END,
                              'can_accept_cash', v_cash, 'open_shift', v_open);
END;
$$;


-- ----------------------------------------------------------------------------
-- 14. Droits : service_role seul
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.team_mask_name(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_gate_categories(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_notify_partner(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_respond(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_actor_check(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_clear(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_resend(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitations_expire_due() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_team_view(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.event_controller_settings_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_mask_name(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.team_gate_categories(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_notify_partner(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_respond(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_actor_check(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_cancel(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_clear(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_resend(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitations_expire_due() TO service_role;
GRANT EXECUTE ON FUNCTION public.partner_team_view(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.event_controller_settings_set(jsonb) TO service_role;

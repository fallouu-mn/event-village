-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — un contrôleur qui devient compte
-- d'administration (ADMIN ou SUPERADMIN), par la page des comptes ou par toute autre voie qui donne ce rôle
-- ============================================================================
-- Décision de l'utilisateur, en base :
--   - caisse ouverte : promotion refusée, « Cette personne a une caisse ouverte sur « {événement} ». Elle doit la fermer
--     avec l’organisatrice avant de devenir administrateur. » ;
--   - sinon, dans la transaction de la promotion : affectations retirées, rôle CONTROLEUR retiré, invitations en attente
--     annulées, sessions révoquées, journal, avis CONTROLLER_BECAME_ADMIN à chaque organisatrice (cloche, push, email,
--     sans SMS) ; scans et caisses passés intacts ;
--   - garde-fou : aucun compte d'administration ne garde d'affectation, même si promotion et invitation sont
--     simultanées (le compte est verrouillé par la promotion, puis lu sous verrou par l'affectation, l'invitation et
--     l'acceptation).
-- Objets : type d'avis CONTROLLER_BECAME_ADMIN ; controller_staff_open_shift, controller_staff_promotion_preview,
-- controller_staff_promotion_apply ; déclencheurs trg_user_roles_staff_promotion (user_roles) et
-- trg_users_staff_promotion (users.role) ; recopies de user_roles_set (20261109000004), notif_event_controllers_notify
-- (20261109000010), event_controllers_staff_guard (20261115000013), controller_invitation_create (20261115000012) et
-- controller_invitation_respond (20261115000006). Aucune donnée existante modifiée. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Type d'avis à l'organisatrice : cloche, push, email ; jamais de SMS
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('CONTROLLER_BECAME_ADMIN', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'], 'PARTNER', 'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

-- ----------------------------------------------------------------------------
-- 2. Caisse ouverte d'un compte qui contrôle (affectation ou rôle CONTROLEUR) : NULL, ou l'événement et le texte du refus
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_staff_open_shift(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
               'event_id', s.event_id, 'title', e.title,
               'message', format('Cette personne a une caisse ouverte sur « %s ». Elle doit la fermer avec l’organisatrice avant de devenir administrateur.', e.title))
      FROM public.controller_shifts s
      JOIN public.events e ON e.id = s.event_id
     WHERE s.controller_id = p_user AND s.status = 'OUVERT'
       AND (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.user_id = p_user)
            OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role::text = 'CONTROLEUR'))
     ORDER BY s.opened_at, s.id
     LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 3. Avant de promouvoir (page des comptes) : nombre d'organisatrices (texte de confirmation) et caisse ouverte (refus)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_staff_promotion_preview(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Compte illisible.');
    END IF;
    RETURN jsonb_build_object('ok', true,
        'organizers', (SELECT count(DISTINCT e.partner_id) FROM public.event_controllers ec
                         JOIN public.events e ON e.id = ec.event_id WHERE ec.user_id = v_user),
        'events', (SELECT count(*) FROM public.event_controllers ec WHERE ec.user_id = v_user),
        'open_shift', public.controller_staff_open_shift(v_user));
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Promotion d'un compte en administration : dans la transaction qui donne le rôle ADMIN ou SUPERADMIN
-- ----------------------------------------------------------------------------
-- Caisse ouverte : refus EV409 (indice STAFF_PROMOTION_OPEN_SHIFT, texte de la décision), la transaction est annulée.
-- Sinon : affectations retirées (sans avis de retrait au compte promu, ni SMS), rôle CONTROLEUR retiré, invitations en
-- attente annulées, sessions révoquées (le scanner resté ouvert est refusé), journal CONTROLLER_REMOVED_FOR_ADMIN, avis
-- CONTROLLER_BECAME_ADMIN à chaque organisatrice dont il quitte l'équipe. Scans et caisses ne sont pas touchés.
-- Sans rien à retirer : aucun effet (appelée deux fois par la même promotion, la seconde ne fait rien).
CREATE OR REPLACE FUNCTION public.controller_staff_promotion_apply(p_user uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift jsonb;
    v_role boolean;
    v_events uuid[];
    v_partners uuid[];
    v_invitations integer := 0;
    v_sessions integer := 0;
    v_name text;
    v_actor_role text;
BEGIN
    IF p_user IS NULL THEN
        RETURN jsonb_build_object('ok', true, 'changed', false);
    END IF;
    -- Verrou du compte avant toute lecture : une affectation, une invitation ou une acceptation simultanée attend la fin de
    -- la promotion, puis voit le rôle d'administration et refuse ; une affectation validée avant est retirée ci-dessous
    PERFORM 1 FROM public.users u WHERE u.id = p_user FOR NO KEY UPDATE;
    v_role := EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role::text = 'CONTROLEUR');
    SELECT COALESCE(array_agg(ec.event_id ORDER BY ec.event_id), ARRAY[]::uuid[]),
           COALESCE(array_agg(DISTINCT e.partner_id ORDER BY e.partner_id), ARRAY[]::uuid[])
      INTO v_events, v_partners
      FROM public.event_controllers ec
      JOIN public.events e ON e.id = ec.event_id
     WHERE ec.user_id = p_user;
    IF cardinality(v_events) = 0 AND NOT v_role
       AND NOT EXISTS (SELECT 1 FROM public.controller_invitations ci WHERE ci.user_id = p_user AND ci.status = 'PENDING') THEN
        RETURN jsonb_build_object('ok', true, 'changed', false);
    END IF;

    v_shift := public.controller_staff_open_shift(p_user);
    IF v_shift IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'EV409', MESSAGE = v_shift->>'message', HINT = 'STAFF_PROMOTION_OPEN_SHIFT';
    END IF;

    PERFORM set_config('event_village.staff_promotion', 'on', true);
    DELETE FROM public.event_controllers WHERE user_id = p_user;
    PERFORM set_config('event_village.staff_promotion', 'off', true);
    IF v_role THEN
        DELETE FROM public.user_roles WHERE user_id = p_user AND role::text = 'CONTROLEUR';
    END IF;
    UPDATE public.controller_invitations
       SET status = 'CANCELLED', responded_at = now(), cancelled_by = p_actor
     WHERE user_id = p_user AND status = 'PENDING';
    GET DIAGNOSTICS v_invitations = ROW_COUNT;
    IF cardinality(v_events) > 0 OR v_role THEN
        v_sessions := public.revoke_user_sessions(p_user);
    END IF;

    SELECT NULLIF(btrim(concat_ws(' ', btrim(COALESCE(u.first_name, '')), btrim(COALESCE(u.last_name, '')))), '')
      INTO v_name FROM public.users u WHERE u.id = p_user;
    PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CONTROLLER_BECAME_ADMIN',
                'key', 'CONTROLLER_BECAME_ADMIN:' || pa.id::text || ':' || p_user::text || ':tx' || txid_current()::text,
                'user_id', pa.user_id,
                'actor_id', p_actor,
                'data', jsonb_build_object('controller_name', COALESCE(v_name, 'Un membre de votre équipe'))))
      FROM public.partners pa
     WHERE pa.id = ANY (v_partners);

    v_actor_role := CASE
        WHEN p_actor IS NULL THEN 'SYSTEM'
        WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_actor AND r.role::text = 'SUPERADMIN') THEN 'SUPERADMIN'
        ELSE 'ADMIN' END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (p_actor, v_actor_role, 'CONTROLLER_REMOVED_FOR_ADMIN', 'users', p_user,
            jsonb_build_object('event_ids', to_jsonb(v_events), 'controller_role', v_role),
            jsonb_build_object('event_ids', '[]'::jsonb, 'controller_role', false),
            jsonb_build_object('partner_ids', to_jsonb(v_partners), 'invitations_cancelled', v_invitations,
                               'sessions_revoked', v_sessions));
    RETURN jsonb_build_object('ok', true, 'changed', true, 'event_ids', to_jsonb(v_events), 'partner_ids', to_jsonb(v_partners),
                              'invitations_cancelled', v_invitations, 'sessions_revoked', v_sessions);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Déclencheurs : toute voie qui donne le rôle (user_roles, source des droits ; users.role, colonne héritée)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_roles_staff_promotion()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.controller_staff_promotion_apply(NEW.user_id, public.try_uuid(current_setting('event_village.actor_id', true)));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_staff_promotion ON public.user_roles;
CREATE TRIGGER trg_user_roles_staff_promotion
    AFTER INSERT OR UPDATE OF role ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role IN ('ADMIN', 'SUPERADMIN'))
    EXECUTE FUNCTION public.user_roles_staff_promotion();

CREATE OR REPLACE FUNCTION public.users_staff_promotion()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.controller_staff_promotion_apply(NEW.id, public.try_uuid(current_setting('event_village.actor_id', true)));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_staff_promotion ON public.users;
CREATE TRIGGER trg_users_staff_promotion
    AFTER UPDATE OF role ON public.users
    FOR EACH ROW
    WHEN (NEW.role IN ('ADMIN', 'SUPERADMIN') AND OLD.role IS DISTINCT FROM NEW.role)
    EXECUTE FUNCTION public.users_staff_promotion();

-- ----------------------------------------------------------------------------
-- 6. Recopies
-- ----------------------------------------------------------------------------
-- 6.1 user_roles_set (20261109000004_lot9bis_droits.sql) : CONTROLEUR retiré avec un rôle d'administration, refus d'une
--     caisse ouverte (texte de la promotion), auteur transmis au déclencheur
CREATE OR REPLACE FUNCTION public.user_roles_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_target text[];
    v_before text[];
    v_invalid text[];
    v_actor_super boolean;
    -- Migration 14
    v_staff boolean;
    v_shift jsonb;
    v_hint text;
    v_text text;
BEGIN
    IF v_user IS NULL OR v_actor IS NULL OR jsonb_typeof(p->'roles') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Changement de rôles incomplet.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Changement de rôles réservé à un administrateur actif.');
    END IF;
    v_actor_super := EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role = 'SUPERADMIN');

    SELECT array_agg(DISTINCT x ORDER BY x) INTO v_target
      FROM (SELECT jsonb_array_elements_text(p->'roles') AS x UNION SELECT 'CLIENT') s;
    SELECT array_agg(x ORDER BY x) INTO v_invalid
      FROM unnest(v_target) AS x
     WHERE x NOT IN (SELECT unnest(enum_range(NULL::public.user_role))::text);
    IF v_invalid IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ROLE', 'roles', to_jsonb(v_invalid), 'message', 'Rôle inconnu.');
    END IF;

    PERFORM 1 FROM public.users WHERE id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY[]::text[]) INTO v_before
      FROM public.user_roles WHERE user_id = v_user;
    IF NOT v_actor_super AND ('SUPERADMIN' = ANY (v_target) OR 'SUPERADMIN' = ANY (v_before)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_REQUIRED', 'message', 'Seul un superadmin peut attribuer ou retirer le rôle de superadmin.');
    END IF;
    IF NOT v_actor_super AND (('ADMIN' = ANY (v_target)) IS DISTINCT FROM ('ADMIN' = ANY (v_before))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ADMIN_ROLE_SUPERADMIN_ONLY',
                                  'message', 'Seul un superadmin peut créer un administrateur ou changer ce rôle.');
    END IF;

    -- Migration 14 : un compte d'administration n'est jamais contrôleur. Avec ADMIN ou SUPERADMIN, CONTROLEUR est retiré.
    -- Une caisse ouverte refuse la promotion (rien ne change). Sinon, l'insertion du rôle déclenche, dans cette transaction,
    -- controller_staff_promotion_apply (affectations, invitations en attente, sessions, journal, avis aux organisatrices),
    -- avec l'auteur lu dans event_village.actor_id.
    v_staff := 'ADMIN' = ANY (v_target) OR 'SUPERADMIN' = ANY (v_target);
    IF v_staff THEN
        v_target := array_remove(v_target, 'CONTROLEUR');
        v_shift := public.controller_staff_open_shift(v_user);
        IF v_shift IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_HAS_OPEN_SHIFT', 'event_id', v_shift->'event_id',
                                      'event_title', v_shift->'title', 'message', v_shift->>'message');
        END IF;
    END IF;
    PERFORM set_config('event_village.actor_id', v_actor::text, true);

    BEGIN
        DELETE FROM public.user_roles WHERE user_id = v_user AND NOT (role::text = ANY (v_target));
        INSERT INTO public.user_roles (user_id, role)
        SELECT v_user, x::public.user_role FROM unnest(v_target) AS x
        ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN SQLSTATE 'EV409' THEN
        -- Migration 14 : caisse ouverte entre la vérification et l'écriture (promotion) : le texte de la promotion
        GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT, v_text = MESSAGE_TEXT;
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_HAS_OPEN_SHIFT',
                                  'message', CASE WHEN v_hint = 'STAFF_PROMOTION_OPEN_SHIFT' THEN v_text
                                                  ELSE 'Ce contrôleur a une caisse ouverte : clôturez-la avant de lui retirer ce rôle.' END);
    END;

    -- Lot 9 bis (ex-10.0 c, B45, tâche 19) : journal ROLES_SET dans la transaction, avec l'acteur ; s'il ne s'écrit
    -- pas, l'erreur remonte et aucun rôle n'est changé.
    IF v_target IS DISTINCT FROM v_before THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
        VALUES (v_actor, CASE WHEN v_actor_super THEN 'SUPERADMIN' ELSE 'ADMIN' END, 'ROLES_SET', 'users', v_user,
                jsonb_build_object('roles', to_jsonb(v_before)), jsonb_build_object('roles', to_jsonb(v_target)),
                jsonb_build_object(
                    'added', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_target) x WHERE NOT (x = ANY (v_before))), '[]'::jsonb),
                    'removed', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_before) x WHERE NOT (x = ANY (v_target))), '[]'::jsonb)));
    END IF;

    RETURN jsonb_build_object('ok', true,
        'before', to_jsonb(v_before),
        'after', to_jsonb(v_target),
        'added', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_target) x WHERE NOT (x = ANY (v_before))), '[]'::jsonb),
        'removed', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_before) x WHERE NOT (x = ANY (v_target))), '[]'::jsonb));
END;
$$;

-- 6.2 notif_event_controllers_notify (20261109000010_lot9bis_email.sql) : aucun avis de retrait pendant une promotion
CREATE OR REPLACE FUNCTION public.notif_event_controllers_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ev   jsonb;
    v_item jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_ev := public.notif_pros_event_data(NEW.event_id);
        v_item := jsonb_strip_nulls(jsonb_build_object('event_id', NEW.event_id, 'title', v_ev->>'title', 'start_at', v_ev->>'start_at'));
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'CONTROLLER_ASSIGNED',
            'key', 'CONTROLLER_ASSIGNED:' || NEW.id::text,
            'user_id', NEW.user_id,
            'event_id', NEW.event_id,
            'actor_id', NEW.created_by,
            'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL'),
            'data', v_ev || jsonb_build_object('assignment_id', NEW.id, 'entry_point', NEW.entry_point, 'can_accept_cash', NEW.can_accept_cash)
        ));
        PERFORM public.notif_upsert_aggregated_sms(jsonb_build_object(
            'type', 'CONTROLLER_ASSIGNED',
            'key', 'CONTROLLER_ASSIGNED_SMS:' || NEW.user_id::text || ':tx' || txid_current()::text,
            'user_id', NEW.user_id,
            'event_id', NEW.event_id,
            'actor_id', NEW.created_by,
            'event', v_item,
            'data', v_ev || jsonb_build_object('assignment_id', NEW.id, 'entry_point', NEW.entry_point,
                                               'can_accept_cash', NEW.can_accept_cash, 'events', jsonb_build_array(v_item))
        ));
        RETURN NEW;
    END IF;

    -- DELETE : une suppression en cascade (événement ou compte supprimé) ne prévient personne.
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = OLD.user_id)
       OR NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = OLD.event_id) THEN
        RETURN OLD;
    END IF;
    -- Migration 14 : retrait par la promotion du compte en administration : aucun avis de retrait au compte promu (ni
    -- SMS) ; ses rappels de la veille encore en attente sont annulés. Les organisatrices reçoivent CONTROLLER_BECAME_ADMIN.
    IF current_setting('event_village.staff_promotion', true) = 'on' THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'NO_LONGER_ASSIGNED', finished_at = now()
         WHERE type = 'CONTROLLER_REMINDER' AND status = 'PENDING'
           AND event_id = OLD.event_id AND recipient_user_id = OLD.user_id;
        RETURN OLD;
    END IF;
    v_ev := public.notif_pros_event_data(OLD.event_id);
    v_item := jsonb_strip_nulls(jsonb_build_object('event_id', OLD.event_id, 'title', v_ev->>'title', 'start_at', v_ev->>'start_at'));
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_UNASSIGNED',
        'key', 'CONTROLLER_UNASSIGNED:' || OLD.id::text,
        'user_id', OLD.user_id,
        'event_id', OLD.event_id,
        'actor_id', OLD.created_by,
        'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL'),
        'data', v_ev || jsonb_build_object('assignment_id', OLD.id)
    ));
    PERFORM public.notif_upsert_aggregated_sms(jsonb_build_object(
        'type', 'CONTROLLER_UNASSIGNED',
        'key', 'CONTROLLER_UNASSIGNED_SMS:' || OLD.user_id::text || ':tx' || txid_current()::text,
        'user_id', OLD.user_id,
        'event_id', OLD.event_id,
        'actor_id', OLD.created_by,
        'event', v_item,
        'data', v_ev || jsonb_build_object('assignment_id', OLD.id, 'events', jsonb_build_array(v_item))
    ));
    -- Rappels de la veille encore en attente pour cette affectation : annulés dans la même transaction.
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'NO_LONGER_ASSIGNED', finished_at = now()
     WHERE type = 'CONTROLLER_REMINDER' AND status = 'PENDING'
       AND event_id = OLD.event_id AND recipient_user_id = OLD.user_id;
    RETURN OLD;
END;
$$;

-- 6.3 event_controllers_staff_guard (20261115000013) : compte verrouillé en partage avant d'être lu
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
    -- Migration 14 : le compte est verrouillé en partage avant d'être lu ; une promotion en cours (verrou du compte) fait
    -- attendre l'affectation, qui voit ensuite le rôle d'administration et refuse
    PERFORM 1 FROM public.users u WHERE u.id = NEW.user_id FOR SHARE;
    IF public.account_is_staff(NEW.user_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'CT409',
            MESSAGE = 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.',
            HINT = 'NOT_INVITABLE';
    END IF;
    RETURN NEW;
END;
$$;

-- 6.4 controller_invitation_create (20261115000012) : compte verrouillé en partage avant d'être lu
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
    -- Migration 14 : le compte est verrouillé en partage avant d'être lu ; une promotion en cours (verrou du compte) fait
    -- attendre l'invitation, qui voit ensuite le rôle d'administration et refuse (aucune invitation en attente pour lui)
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR SHARE;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Ce compte n''est pas actif.');
    END IF;
    -- cvf1 T1 : un compte d'administration n'est jamais invité (texte neutre, qui ne dit pas pourquoi)
    IF public.account_is_staff(v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_INVITABLE', 'message', 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.');
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

    -- cvf1 R2 : verrou par organisatrice et par compte ; des demandes simultanées passent l'une après l'autre. Une
    -- invitation identique (mêmes événements, mêmes droits) envoyée il y a moins de 60 secondes et toujours en attente
    -- n'est pas recréée : refus, aucun SMS (la route rend l'unité du numéro). « Inviter de nouveau » avec d'autres
    -- événements remplace toujours la précédente.
    PERFORM pg_advisory_xact_lock(hashtextextended('controller_invitation:' || v_partner::text || ':' || v_user::text, 0));
    IF EXISTS (SELECT 1 FROM public.controller_invitations ci
                WHERE ci.partner_id = v_partner AND ci.user_id = v_user AND ci.status = 'PENDING'
                  AND ci.expires_at > now() AND ci.created_at > now() - interval '60 seconds'
                  AND ci.assignments = v_assignments) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_ALREADY_SENT', 'message', 'Une invitation vient d’être envoyée à ce numéro. Attendez sa réponse ou utilisez « Renvoyer ».');
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

-- 6.5 controller_invitation_respond (20261115000006) : compte verrouillé avant l'invitation
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
    -- Migration 14 : le compte qui répond est verrouillé avant l'invitation, dans le même ordre que la promotion (compte,
    -- puis invitations) : une promotion en cours fait attendre la réponse, qui trouve ensuite l'invitation annulée
    PERFORM 1 FROM public.users u WHERE u.id = v_actor FOR NO KEY UPDATE;
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

    -- cvf1 T1 : un compte d'administration ne devient jamais contrôleur ; il peut encore refuser l'invitation
    IF v_accept AND public.account_is_staff(v_actor) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_INVITABLE', 'message', 'Ce compte ne peut pas devenir contrôleur. Refusez cette invitation.');
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

REVOKE ALL ON FUNCTION public.controller_staff_open_shift(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_staff_promotion_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_staff_promotion_apply(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_roles_staff_promotion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.users_staff_promotion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_roles_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_event_controllers_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.event_controllers_staff_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_respond(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_staff_open_shift(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_staff_promotion_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_staff_promotion_apply(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_roles_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_respond(jsonb) TO service_role;

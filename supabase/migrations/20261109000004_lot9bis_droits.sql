-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : les droits (M04, agent S-B ; contrat sections 3.1, 3.2, 3.3, 4.2, 5.11 à 5.19)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; CREATE TABLE / INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS
-- puis ADD pour les contraintes et triggers, CREATE OR REPLACE, privilèges réappliqués ; aucune reprise de données.
-- Écrite tâche après tâche (section 10), un commit par tâche ; le bloc des privilèges, en fin de fichier, grandit avec
-- chaque tâche. Aucune permission n'est donnée par cette migration (A13, B32).
--
-- Tâche 11 (R2, R71 ; B30, B31, B33) :
--  1. admin_can(p_actor, p_permission) (nouvelle, STABLE) : SUPERADMIN dans user_roles, ou ADMIN dans user_roles avec
--     la ligne admin_permissions ; jamais users.role (règle 1B.8 ; has_admin_permission, qui le lit, reste inutilisée).
--  2. event_actor_profile_perm(p_event, p_actor, p_permission) (nouvelle, STABLE) : même retour que
--     event_actor_profile, is_staff := admin_can(p_actor, p_permission). Nom nouveau plutôt qu'une surcharge (A2, X8).
--  3. event_actor_profile(uuid, uuid) : base 20261102000003_lot5_cycle.sql:191-205, signature et retour identiques ;
--     corps = event_actor_profile_perm(…, 'events.write'). Resserre d'un coup event_transition, event_cancel,
--     event_update, ticket_category_guard et les invitations : un admin sans events.write n'est plus « staff ».
--     PL/pgSQL au lieu de SQL : la fonction ne cite qu'un objet créé plus haut dans ce fichier (règle section 1).
--  4. pilotage_access(uuid, uuid) : base 20261102000005_lot5_pilotage.sql:135-157, recopie intégrale, signature et
--     STABLE identiques. Changement : profil lu avec events.read ; un compte ADMIN ou SUPERADMIN sans la permission
--     reçoit PERMISSION_MISSING (un tiers garde EVENT_NOT_FOUND, sans indice).
--  5. pilotage_refusal(text) : base 20261102000005_lot5_pilotage.sql:159-171, recopie intégrale, signature et
--     IMMUTABLE identiques. Changement : PERMISSION_MISSING, texte du contrat 4.2 et `permission: events.read`.
--  6. participants_export(jsonb) : base 20261108000002_lot9_invitations.sql:268-335, recopie intégrale, signature et
--     VOLATILE identiques. Changement : export avec contacts par un compte ADMIN ou SUPERADMIN non propriétaire →
--     admin_can(partners.read) exigé (PERMISSION_MISSING `permission: partners.read`, contrôlé avant pilotage_access
--     pour nommer la permission de l'action demandée), sans ligne participant_exports.
--  7. event_controller_set_cash(jsonb) : base 20261102000005_lot5_pilotage.sql:967-1024, recopie intégrale,
--     signature identique, VOLATILE écrit (défaut de la base). Changement : un admin muni de events.write (ou le
--     SUPERADMIN) modifie le droit d'encaisser (avant : OWNER_ONLY pour tout admin) ; sans la permission :
--     PERMISSION_MISSING ; le journal porte le rôle de l'acteur (PARTENAIRE ou ADMIN).
--  8. user_roles_set(jsonb) : base 20261102000002_lot5_dette.sql:411-472, recopie intégrale, signature identique,
--     VOLATILE écrit (défaut de la base). Changement : ajout OU retrait du rôle ADMIN par un acteur non SUPERADMIN →
--     ADMIN_ROLE_SUPERADMIN_ONLY, rien d'écrit (R71, décision D3).
-- Verrous : aucun nouveau (lectures sans verrou de user_roles et admin_permissions).
--
-- Tâche 13 (R57 ; B35, D4) :
--  9. Table password_confirmations (session_id clé primaire, user_id, confirmed_at), service_role seul.
--
-- Tâche 15 (R6 ; B38, X9 ; porte aussi R59 de la tâche 34, B33 de la tâche 11 et l'audit de la tâche 19) :
-- 10. admin_user_status_set(p jsonb) (nouvelle) : statut ACTIF ou SUSPENDU d'un compte par un admin users.write ;
--     compte partenaire refusé (PARTNER_STATUS_VIA_PARTNER_SHEET), compte admin réservé au SUPERADMIN, motif exigé à
--     la suspension, sessions révoquées, journal USER_STATUS_SET et avis ACCOUNT_SUSPENDED / ACCOUNT_REACTIVATED dans
--     la transaction.
--
-- Tâche 17 (R53, R54, R90 ; B40 à B42) :
-- 11. Colonnes partners.ninea et partners.rccm (≤ 40 caractères, facultatives) et partners.resubmitted_at.
-- 12. partner_register_finalize(jsonb) : base 20261108000001_lot9_securite.sql:637-700, recopie intégrale, signature
--     et VOLATILE identiques. Changements : appelée après la vérification du code (R53), elle pose
--     users.phone_verified_at et partners.phone_verified = TRUE, et enregistre ninea et rccm (R90).
-- 13. partner_dossier_resubmit(p jsonb) (nouvelle) : complément d'un dossier REJETE une seule fois (R54) ; REJETE →
--     EN_ATTENTE, resubmitted_at, pièces rattachées, motif gardé, ADMIN_PARTNER_RESUBMITTED aux admins partners.read.
--
-- Tâche 19 (ex-10.0 c ; B45, D9) :
--  8 bis. user_roles_set (même définition, point 8) écrit son journal ROLES_SET (acteur, rôles avant et après) dans la
--     transaction, après le changement : un journal refusé annule le changement de rôles.
-- 14. Trigger trg_audit_cashouts AFTER INSERT OR UPDATE OF status, blocked_reason ON cashouts (audit_log_changes).
--
-- Délégation fix(9b.23-SB) (R63 ; B54, pour S-C) :
-- 15. account_phone_finalize(jsonb) : base 20261108000004_lot9_compte.sql:203-270, recopie intégrale, signature et
--     VOLATILE identiques. Changement : transferts PENDING vers l'ancien numéro annulés dans la transaction (expéditeur :
--     billet déverrouillé, TRANSFER_RECIPIENT_CHANGED ; invitation sans expéditeur : billet ANNULE, place rendue, sans
--     avis) ; `transfers_cancelled` dans la réponse et le journal.
--
-- Délégation fix(9b.49-SB) (G.49, B97, pour S-G) :
-- 15 bis. account_phone_finalize (même définition, point 15) : la ligne au numéro de l'ancien téléphone reste SMS seul
--     (`channels: ['SMS']`) ; seconde mise en file PHONE_CHANGED au compte, `channels: ['EMAIL']`, clé distincte.
-- ============================================================================


-- ============================================================================
-- Tâche 11 — 1. admin_can (nouvelle)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_can(p_actor uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_actor IS NOT NULL AND p_permission IS NOT NULL AND (
           EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_actor AND r.role::text = 'SUPERADMIN')
        OR (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_actor AND r.role::text = 'ADMIN')
            AND EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = p_actor AND ap.permission = p_permission)))
$$;


-- ============================================================================
-- Tâche 11 — 2. event_actor_profile_perm (nouvelle)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_actor_profile_perm(p_event uuid, p_actor uuid, p_permission text)
RETURNS TABLE (is_owner boolean, is_staff boolean, is_active boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT p_actor IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                WHERE e.id = p_event AND pa.user_id = p_actor),
           COALESCE(public.admin_can(p_actor, p_permission), FALSE),
           p_actor IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF');
END;
$$;


-- ============================================================================
-- Tâche 11 — 3. event_actor_profile (recopie, 20261102000003_lot5_cycle.sql:191-205)
-- ============================================================================
-- Acteur d'une action sur un événement : propriétaire (partners.user_id), admin muni de events.write (lot 9 bis,
-- R2 : admin_can, user_roles et admin_permissions), compte ACTIF
CREATE OR REPLACE FUNCTION public.event_actor_profile(p_event uuid, p_actor uuid)
RETURNS TABLE (is_owner boolean, is_staff boolean, is_active boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT f.is_owner, f.is_staff, f.is_active
      FROM public.event_actor_profile_perm(p_event, p_actor, 'events.write') f;
END;
$$;


-- ============================================================================
-- Tâche 11 — 4. pilotage_access (recopie, 20261102000005_lot5_pilotage.sql:135-157)
-- ============================================================================
-- NULL si l'acteur peut lire le pilotage de l'événement, sinon le code du refus. Un tiers (partenaire
-- B, client) reçoit EVENT_NOT_FOUND, comme pour un événement inconnu : aucune donnée, aucun indice.
-- Lot 9 bis (R2) : un admin doit avoir events.read ; sans elle, PERMISSION_MISSING.
CREATE OR REPLACE FUNCTION public.pilotage_access(p_event uuid, p_actor uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    a record;
BEGIN
    IF p_event IS NULL OR p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event) THEN
        RETURN 'EVENT_NOT_FOUND';
    END IF;
    SELECT * INTO a FROM public.event_actor_profile_perm(p_event, p_actor, 'events.read');
    IF NOT (a.is_owner OR a.is_staff) THEN
        IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN 'PERMISSION_MISSING';
        END IF;
        RETURN 'EVENT_NOT_FOUND';
    END IF;
    IF NOT a.is_active THEN
        RETURN 'ACCOUNT_NOT_ACTIVE';
    END IF;
    RETURN NULL;
END;
$$;


-- ============================================================================
-- Tâche 11 — 5. pilotage_refusal (recopie, 20261102000005_lot5_pilotage.sql:159-171)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pilotage_refusal(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('ok', false, 'code', p_code, 'message', CASE p_code
        WHEN 'EVENT_NOT_FOUND' THEN 'Événement introuvable.'
        WHEN 'ACCOUNT_NOT_ACTIVE' THEN 'Votre compte n’est pas actif.'
        WHEN 'INVALID_INPUT' THEN 'Demande invalide.'
        WHEN 'PERMISSION_MISSING' THEN 'Action non autorisée : votre compte n’a pas la permission « Consulter les événements ».'
        ELSE 'Accès refusé.' END)
        || CASE WHEN p_code = 'PERMISSION_MISSING' THEN jsonb_build_object('permission', 'events.read') ELSE '{}'::jsonb END
$$;


-- ============================================================================
-- Tâche 11 — 6. participants_export (recopie, 20261108000002_lot9_invitations.sql:268-335)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.participants_export(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_purpose text := NULLIF(btrim(COALESCE(p->>'purpose', '')), '');
    v_contacts boolean;
    v_code text;
    v_title text;
    v_rows jsonb;
    v_count integer;
    v_export uuid;
BEGIN
    -- Lot 9 bis (R2, B31) : téléphones et emails des participants pour un admin non propriétaire = partners.read
    IF p->'include_contacts' = 'true'::jsonb
       AND v_event IS NOT NULL AND v_actor IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.events WHERE id = v_event)
       AND NOT (SELECT pr.is_owner FROM public.event_actor_profile_perm(v_event, v_actor, 'partners.read') pr)
       AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN'))
       AND NOT public.admin_can(v_actor, 'partners.read') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'partners.read',
            'message', 'Action non autorisée : votre compte n’a pas la permission « Consulter les partenaires et leurs contacts ».');
    END IF;
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    IF jsonb_typeof(p->'include_contacts') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
                                  'message', 'Indiquez si le téléphone et l’email doivent figurer dans l’export.');
    END IF;
    v_contacts := (p->>'include_contacts')::boolean;
    IF v_contacts AND (v_purpose IS NULL OR v_purpose NOT IN ('URGENT_EVENT_INFO', 'SAFETY_AND_RECEPTION')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PURPOSE_REQUIRED',
            'message', 'Pour exporter le téléphone et l’email, choisissez une finalité : information urgente sur l’événement, ou sécurité et accueil.');
    END IF;
    IF NOT v_contacts THEN
        v_purpose := NULL;
    END IF;
    SELECT title INTO v_title FROM public.events WHERE id = v_event;

    -- Participants = billets VALIDE et UTILISE, invitations comprises ; ni paiement, ni prix, ni numéro de billet
    SELECT COALESCE(jsonb_agg(r.line ORDER BY r.sort_name NULLS LAST, r.category, r.created_at, r.id), '[]'::jsonb), count(*)
      INTO v_rows, v_count
      FROM (
          SELECT tk.id, tk.created_at, c.name AS category,
                 public.pilotage_display_name(u.first_name, u.last_name) AS sort_name,
                 jsonb_build_object(
                     'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name),
                                      CASE WHEN tk.user_id IS NULL AND tk.sale_channel = 'INVITATION' THEN 'Invitation en attente'
                                           WHEN tk.user_id IS NULL THEN 'Vente au guichet' ELSE 'Participant sans nom' END),
                     'category', c.name,
                     'channel', CASE tk.sale_channel WHEN 'ONLINE' THEN 'En ligne' WHEN 'FREE' THEN 'Gratuit'
                                     WHEN 'COUNTER' THEN 'Guichet' WHEN 'INVITATION' THEN 'Invitation' END,
                     'status', public.pilotage_ticket_status_label(tk.status::text),
                     'entered_at', CASE WHEN tk.status::text = 'UTILISE' THEN
                                       COALESCE(to_char(COALESCE(tk.checked_in_at, sc.created_at) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY HH24:MI'),
                                                'Entrée enregistrée')
                                   END)
                 || CASE WHEN v_contacts THEN jsonb_build_object('phone', u.phone, 'email', u.email) ELSE '{}'::jsonb END AS line
            FROM public.tickets tk
            JOIN public.ticket_categories c ON c.id = tk.category_id
            LEFT JOIN public.users u ON u.id = tk.user_id
            LEFT JOIN LATERAL (SELECT x.created_at FROM public.ticket_scans x
                                WHERE x.ticket_id = tk.id AND x.accepted ORDER BY x.created_at LIMIT 1) sc ON TRUE
           WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE')
      ) r;

    INSERT INTO public.participant_exports (event_id, actor_id, include_contacts, purpose, row_count)
    VALUES (v_event, v_actor, v_contacts, v_purpose, v_count)
    RETURNING id INTO v_export;

    RETURN jsonb_build_object('ok', true, 'export_id', v_export, 'event_id', v_event, 'title', v_title,
                              'include_contacts', v_contacts, 'purpose', v_purpose, 'row_count', v_count, 'rows', v_rows);
END;
$$;


-- ============================================================================
-- Tâche 11 — 7. event_controller_set_cash (recopie, 20261102000005_lot5_pilotage.sql:967-1024)
-- ============================================================================
-- ── Permission espèces d'une affectation (propriétaire, ou admin events.write ; journalisée) ───
-- p : { assignment_id, actor_id, can_accept_cash (booléen) }
CREATE OR REPLACE FUNCTION public.event_controller_set_cash(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment uuid := public.try_uuid(p->>'assignment_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_value boolean;
    r record;
    v_staff boolean;
    v_open boolean;
BEGIN
    IF v_actor IS NULL OR jsonb_typeof(p->'can_accept_cash') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Indiquez la permission espèces (oui ou non).');
    END IF;
    v_value := (p->>'can_accept_cash')::boolean;
    IF v_assignment IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;

    SELECT ec.id, ec.event_id, ec.user_id, ec.can_accept_cash, pa.user_id AS owner_id
      INTO r
      FROM public.event_controllers ec
      JOIN public.events e ON e.id = ec.event_id
      JOIN public.partners pa ON pa.id = e.partner_id
     WHERE ec.id = v_assignment
       FOR UPDATE OF ec;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;
    v_staff := FALSE;
    IF r.owner_id IS DISTINCT FROM v_actor THEN
        -- Lot 9 bis (R2, B31) : un admin muni de events.write (ou le SUPERADMIN) agit ; sans elle, refus nommé
        v_staff := public.admin_can(v_actor, 'events.write');
        IF NOT v_staff THEN
            IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
                RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.write',
                    'message', 'Action non autorisée : votre compte n’a pas la permission « Gérer les événements ».');
            END IF;
            RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;

    UPDATE public.event_controllers SET can_accept_cash = v_value WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, CASE WHEN v_staff THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_CASH_PERMISSION_SET', 'event_controllers', r.id,
            jsonb_build_object('can_accept_cash', r.can_accept_cash),
            jsonb_build_object('can_accept_cash', v_value),
            jsonb_build_object('event_id', r.event_id, 'controller_id', r.user_id));
    v_open := EXISTS (SELECT 1 FROM public.controller_shifts s
                       WHERE s.event_id = r.event_id AND s.controller_id = r.user_id AND s.status = 'OUVERT');

    RETURN jsonb_build_object('ok', true, 'assignment_id', r.id, 'event_id', r.event_id, 'controller_id', r.user_id,
                              'can_accept_cash', v_value, 'changed', r.can_accept_cash IS DISTINCT FROM v_value,
                              'open_shift', v_open);
END;
$$;


-- ============================================================================
-- Tâche 11 — 8. user_roles_set (recopie, 20261102000002_lot5_dette.sql:411-472)
-- ============================================================================
-- p : { user_id, roles text[], actor_id }. CLIENT toujours conservé. Si le trigger controller_removal_guard
-- refuse le retrait de CONTROLEUR (caisse ouverte, EV409), aucun rôle n'est modifié.
-- Lot 9 bis (R71) : le rôle ADMIN ne s'ajoute ni ne se retire que par un SUPERADMIN.
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

    BEGIN
        DELETE FROM public.user_roles WHERE user_id = v_user AND NOT (role::text = ANY (v_target));
        INSERT INTO public.user_roles (user_id, role)
        SELECT v_user, x::public.user_role FROM unnest(v_target) AS x
        ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN SQLSTATE 'EV409' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_HAS_OPEN_SHIFT',
                                  'message', 'Ce contrôleur a une caisse ouverte : clôturez-la avant de lui retirer ce rôle.');
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


-- ============================================================================
-- Tâche 13 (R57 ; B35, D4) — 9. Table password_confirmations
-- ============================================================================
-- Saisie du mot de passe liée à une session GoTrue (session_id du jeton, validé par GoTrue avant lecture) : écrite
-- par POST /api/account/password-confirm et par POST /api/auth/login, lue par requireRecentPassword (10 min). Aucune
-- clé étrangère vers auth.sessions (schéma de GoTrue) : une ligne d'une session fermée ne sert plus à rien, elle ne
-- donne aucun accès. Clé étrangère vers users : FOR KEY SHARE sur le compte à l'écriture, seul verrou de la transaction.
-- service_role seul (RLS activée, aucune politique).
CREATE TABLE IF NOT EXISTS public.password_confirmations (
    session_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_confirmations_user ON public.password_confirmations (user_id);
ALTER TABLE public.password_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.password_confirmations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.password_confirmations TO service_role;
COMMENT ON TABLE public.password_confirmations IS
    'Lot 9 bis (R57) : dernière saisie du mot de passe par session ; une action sensible exige moins de 10 minutes.';


-- ============================================================================
-- Tâche 15 (R6 ; B38, X9 ; R59 et B74 de la tâche 34, B33 de la tâche 11, B45 de la tâche 19)
-- 10. admin_user_status_set (nouvelle)
-- ============================================================================
-- Statut d'un compte (suspension, réactivation) par un admin, en une transaction : p = { actor_id, user_id, status
-- ('ACTIF' | 'SUSPENDU'), reason }. Acteur ACTIF muni de users.write (ou SUPERADMIN). Refus, sans aucune écriture :
-- compte partenaire → PARTNER_STATUS_VIA_PARTNER_SHEET (la fiche partenaire, avec motif, est la seule voie : B38) ;
-- compte ADMIN ou SUPERADMIN par un acteur non SUPERADMIN → ADMIN_ROLE_SUPERADMIN_ONLY (B33) ; suspension sans motif
-- (3 caractères au moins) → REASON_REQUIRED. Changement effectif : users.status, sessions révoquées à la suspension
-- (revoke_user_sessions), journal USER_STATUS_SET avec l'acteur et le motif (B45), puis l'avis au compte
-- ACCOUNT_SUSPENDED (motif) ou ACCOUNT_REACTIVATED (seulement depuis SUSPENDU), politique ALLOW du registre (M03) :
-- le SMS part malgré la suspension (R59, B74). Même statut : rien d'écrit, `changed: false`.
-- Verrous : users FOR UPDATE (compte visé) → sessions de GoTrue → audit → boîte d'envoi (ordre 3.3).
CREATE OR REPLACE FUNCTION public.admin_user_status_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_status text := p->>'status';
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_old text;
    v_actor_super boolean;
    v_revoked integer;
    v_audit uuid;
    v_type text;
BEGIN
    IF v_user IS NULL OR v_actor IS NULL OR v_status IS NULL OR v_status NOT IN ('ACTIF', 'SUSPENDU')
       OR char_length(COALESCE(v_reason, '')) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Changement de statut incomplet.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT public.admin_can(v_actor, 'users.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Changement de statut réservé à un administrateur habilité.');
    END IF;
    v_actor_super := EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN');

    SELECT u.status::text INTO v_old FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Utilisateur cible introuvable.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.partners pa WHERE pa.user_id = v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_STATUS_VIA_PARTNER_SHEET',
            'message', 'Ce compte est celui d’un partenaire : suspendez-le ou réactivez-le depuis sa fiche partenaire, avec un motif.');
    END IF;
    IF NOT v_actor_super
       AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_user AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ADMIN_ROLE_SUPERADMIN_ONLY',
                                  'message', 'Seul un superadmin peut créer un administrateur ou changer ce rôle.');
    END IF;
    IF v_status = 'SUSPENDU' AND char_length(COALESCE(v_reason, '')) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif de la suspension (3 caractères au moins).');
    END IF;
    IF v_old = v_status THEN
        RETURN jsonb_build_object('ok', true, 'user_id', v_user, 'old_status', v_old, 'status', v_status, 'changed', false,
                                  'sessions_revoked', 0);
    END IF;

    UPDATE public.users SET status = v_status::public.user_status, updated_at = now() WHERE id = v_user;
    v_revoked := 0;
    IF v_status = 'SUSPENDU' THEN
        v_revoked := public.revoke_user_sessions(v_user);
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, CASE WHEN v_actor_super THEN 'SUPERADMIN' ELSE 'ADMIN' END, 'USER_STATUS_SET', 'users', v_user,
            jsonb_build_object('status', v_old), jsonb_build_object('status', v_status),
            jsonb_build_object('reason', v_reason, 'sessions_revoked', v_revoked))
    RETURNING id INTO v_audit;

    v_type := CASE WHEN v_status = 'SUSPENDU' THEN 'ACCOUNT_SUSPENDED'
                   WHEN v_old = 'SUSPENDU' THEN 'ACCOUNT_REACTIVATED' END;
    IF v_type IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', v_type, 'key', v_type || ':' || v_audit::text,
            'user_id', v_user, 'actor_id', v_actor,
            'data', jsonb_strip_nulls(jsonb_build_object('reason', CASE WHEN v_type = 'ACCOUNT_SUSPENDED' THEN v_reason END))));
    END IF;

    RETURN jsonb_build_object('ok', true, 'user_id', v_user, 'old_status', v_old, 'status', v_status, 'changed', true,
                              'sessions_revoked', v_revoked);
END;
$$;


-- ============================================================================
-- Tâche 17 (R53, R54, R90 ; B40 à B42) — 11. Colonnes partners.ninea, partners.rccm, partners.resubmitted_at
-- ============================================================================
-- Aucune donnée existante : les contraintes de longueur sont posées valides d'emblée (DROP IF EXISTS puis ADD).
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS ninea text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS rccm text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz;
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_ninea_length_chk;
ALTER TABLE public.partners ADD CONSTRAINT partners_ninea_length_chk CHECK (ninea IS NULL OR char_length(ninea) <= 40);
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_rccm_length_chk;
ALTER TABLE public.partners ADD CONSTRAINT partners_rccm_length_chk CHECK (rccm IS NULL OR char_length(rccm) <= 40);
COMMENT ON COLUMN public.partners.ninea IS 'Lot 9 bis (R90) : NINEA déclaré à l’inscription ou au complément du dossier, facultatif.';
COMMENT ON COLUMN public.partners.rccm IS 'Lot 9 bis (R90) : RCCM déclaré à l’inscription ou au complément du dossier, facultatif.';
COMMENT ON COLUMN public.partners.resubmitted_at IS 'Lot 9 bis (R54) : date du complément d’un dossier refusé (une seule fois).';


-- ============================================================================
-- Tâche 17 — 12. partner_register_finalize (recopie, 20261108000001_lot9_securite.sql:637-700)
-- ============================================================================
-- p : { user_id, first_name, last_name, phone, email, partner: { company_name, commercial_name, description, address,
--       city, phone, email, id_card_url, business_doc_url, ninea?, rccm? }, activities[], upload_ids[], ip } → { ok,
--     partner_id } ou { ok:false, code:'INVALID_DOCUMENT_UPLOAD', message }.
-- Profil, fiche, activités, rattachement des deux pièces et audit vont ensemble : trg_partners_notify part dans la
-- même transaction, l'accusé n'est émis que si tout est passé. Une pièce consommée entre-temps annule le tout par
-- le bloc d'exception ; toute autre erreur remonte, et la route retire le compte de connexion.
-- Lot 9 bis (R53, R90) : la route n'appelle cette fonction qu'après la vérification du code SMS : numéro vérifié
-- (users.phone_verified_at, partners.phone_verified), NINEA et RCCM enregistrés.
CREATE OR REPLACE FUNCTION public.partner_register_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_partner jsonb := p->'partner';
    v_partner_id uuid;
    v_activities text[];
    v_upload_ids uuid[];
    v_claimed integer;
BEGIN
    IF v_user IS NULL OR jsonb_typeof(v_partner) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p->'activities') IS DISTINCT FROM 'array'
       OR jsonb_typeof(p->'upload_ids') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Inscription partenaire incomplète.');
    END IF;

    SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::text[]) INTO v_activities
      FROM jsonb_array_elements_text(p->'activities') AS x;
    SELECT COALESCE(array_agg(public.try_uuid(x)), ARRAY[]::uuid[]) INTO v_upload_ids
      FROM jsonb_array_elements_text(p->'upload_ids') AS x;

    BEGIN
        INSERT INTO public.users (id, first_name, last_name, phone, email, role, status, referral_status, phone_verified_at, updated_at)
        VALUES (v_user, p->>'first_name', p->>'last_name', p->>'phone', p->>'email',
                'PARTENAIRE'::public.user_role, 'EN_ATTENTE'::public.user_status, 'STANDARD'::public.referral_status, now(), now())
        ON CONFLICT (id) DO UPDATE
           SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone, email = EXCLUDED.email,
               role = EXCLUDED.role, status = EXCLUDED.status, referral_status = EXCLUDED.referral_status,
               phone_verified_at = EXCLUDED.phone_verified_at, updated_at = EXCLUDED.updated_at;

        INSERT INTO public.partners (user_id, company_name, commercial_name, description, address, city, phone, email,
                                     id_card_url, business_doc_url, status, is_verified, phone_verified, ninea, rccm)
        VALUES (v_user, v_partner->>'company_name', v_partner->>'commercial_name', v_partner->>'description', v_partner->>'address',
                v_partner->>'city', v_partner->>'phone', v_partner->>'email', v_partner->>'id_card_url', v_partner->>'business_doc_url',
                'EN_ATTENTE'::public.partner_status, FALSE, TRUE,
                NULLIF(btrim(COALESCE(v_partner->>'ninea', '')), ''), NULLIF(btrim(COALESCE(v_partner->>'rccm', '')), ''))
        RETURNING id INTO v_partner_id;

        INSERT INTO public.partner_activities (partner_id, activity_type, is_active)
        SELECT v_partner_id, x::public.partner_activity_type, TRUE FROM unnest(v_activities) AS x;

        UPDATE public.partner_document_uploads
           SET claimed_partner_id = v_partner_id, claimed_at = now()
         WHERE id = ANY (v_upload_ids) AND claimed_at IS NULL AND expires_at > now();
        GET DIAGNOSTICS v_claimed = ROW_COUNT;
        IF v_claimed <> 2 THEN
            RAISE EXCEPTION USING ERRCODE = 'EV409', MESSAGE = 'Pièces justificatives déjà utilisées ou expirées.';
        END IF;

        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
        VALUES (v_user, 'PARTENAIRE', 'PARTNER_REGISTRATION', 'partners', v_partner_id,
                jsonb_build_object('company_name', v_partner->>'company_name', 'status', 'EN_ATTENTE', 'activities', to_jsonb(v_activities)),
                jsonb_build_object('ip', COALESCE(p->>'ip', 'inconnue')));
    EXCEPTION WHEN SQLSTATE 'EV409' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DOCUMENT_UPLOAD',
                                  'message', 'Pièces justificatives déjà utilisées ou expirées : déposez-les à nouveau.');
    END;

    RETURN jsonb_build_object('ok', true, 'partner_id', v_partner_id);
END;
$$;


-- ============================================================================
-- Tâche 17 — 13. partner_dossier_resubmit (nouvelle)
-- ============================================================================
-- Complément d'un dossier refusé, une seule fois (R54, B41). p = { user_id, upload_ids[2], id_card_url,
-- business_doc_url, ninea?, rccm? } (pièces résolues par la route depuis leurs jetons de dépôt, comme à l'inscription).
-- Refus sans effet : fiche introuvable → PARTNER_NOT_FOUND ; statut autre que REJETE → DOSSIER_NOT_REJECTED ;
-- complément déjà fait → RESUBMIT_ALREADY_USED ; pièce consommée ou expirée → INVALID_DOCUMENT_UPLOAD.
-- Effet : pièces rattachées, chemins des pièces, NINEA et RCCM remplacés s'ils sont fournis, partners.status
-- EN_ATTENTE (is_verified faux), resubmitted_at posé, users.status EN_ATTENTE (comme à l'inscription), motif du refus
-- gardé ; journal PARTNER_DOSSIER_RESUBMITTED ; ADMIN_PARTNER_RESUBMITTED aux admins partners.read. Aucun avis à la
-- partenaire (trg_partners_notify : retour en attente sans avis).
-- Verrous : partners FOR NO KEY UPDATE → users (UPDATE) → pièces : même ordre que partner_status_set (M06, S-A :
-- fiche puis compte), pour qu'un refus ou une validation concurrente ne forme aucun cycle ; le tableau 3.3 écrivait
-- users → partners, écart signalé au rapport.
CREATE OR REPLACE FUNCTION public.partner_dossier_resubmit(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_upload_ids uuid[];
    v_ninea text := NULLIF(btrim(COALESCE(p->>'ninea', '')), '');
    v_rccm text := NULLIF(btrim(COALESCE(p->>'rccm', '')), '');
    pa record;
    v_claimed integer;
BEGIN
    IF v_user IS NULL OR jsonb_typeof(p->'upload_ids') IS DISTINCT FROM 'array'
       OR NULLIF(btrim(COALESCE(p->>'id_card_url', '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(p->>'business_doc_url', '')), '') IS NULL
       OR char_length(COALESCE(v_ninea, '')) > 40 OR char_length(COALESCE(v_rccm, '')) > 40 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Complément du dossier incomplet.');
    END IF;
    SELECT COALESCE(array_agg(public.try_uuid(x)), ARRAY[]::uuid[]) INTO v_upload_ids
      FROM jsonb_array_elements_text(p->'upload_ids') AS x;

    SELECT pa0.id, pa0.status::text AS status, pa0.resubmitted_at, pa0.company_name
      INTO pa
      FROM public.partners pa0
     WHERE pa0.user_id = v_user
       FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Profil partenaire introuvable.');
    END IF;
    IF pa.status <> 'REJETE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DOSSIER_NOT_REJECTED', 'message', 'Seul un dossier refusé peut être complété.');
    END IF;
    IF pa.resubmitted_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESUBMIT_ALREADY_USED',
                                  'message', 'Votre dossier a déjà été complété une fois. Contactez le support.');
    END IF;

    BEGIN
        UPDATE public.partner_document_uploads
           SET claimed_partner_id = pa.id, claimed_at = now()
         WHERE id = ANY (v_upload_ids) AND claimed_at IS NULL AND expires_at > now();
        GET DIAGNOSTICS v_claimed = ROW_COUNT;
        IF v_claimed <> 2 THEN
            RAISE EXCEPTION USING ERRCODE = 'EV409', MESSAGE = 'Pièces justificatives déjà utilisées ou expirées.';
        END IF;

        UPDATE public.partners
           SET id_card_url = p->>'id_card_url', business_doc_url = p->>'business_doc_url',
               ninea = COALESCE(v_ninea, ninea), rccm = COALESCE(v_rccm, rccm),
               status = 'EN_ATTENTE'::public.partner_status, is_verified = FALSE, resubmitted_at = now()
         WHERE id = pa.id;
        UPDATE public.users SET status = 'EN_ATTENTE'::public.user_status, updated_at = now() WHERE id = v_user;

        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
        VALUES (v_user, 'PARTENAIRE', 'PARTNER_DOSSIER_RESUBMITTED', 'partners', pa.id,
                jsonb_build_object('status', 'REJETE'), jsonb_build_object('status', 'EN_ATTENTE'),
                jsonb_build_object('ninea_set', v_ninea IS NOT NULL, 'rccm_set', v_rccm IS NOT NULL));

        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_PARTNER_RESUBMITTED',
            'ref', pa.id::text,
            'data', jsonb_build_object('partner_id', pa.id,
                                       'company', COALESCE(NULLIF(btrim(pa.company_name), ''), 'Un partenaire'))));
    EXCEPTION WHEN SQLSTATE 'EV409' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DOCUMENT_UPLOAD',
                                  'message', 'Pièces justificatives déjà utilisées ou expirées : déposez-les à nouveau.');
    END;

    RETURN jsonb_build_object('ok', true, 'partner_id', pa.id, 'status', 'EN_ATTENTE',
                              'message', 'Dossier envoyé : il est de nouveau en cours de vérification.');
END;
$$;


-- ============================================================================
-- Tâche 19 (ex-10.0 c ; B45, D9) — 14. Trigger trg_audit_cashouts
-- ============================================================================
-- Chaque création d'un versement et chaque changement de son statut ou de son motif de blocage est journalisé dans
-- la même instruction (audit_log_changes, comme payments, refunds et withdrawals : object_type 'cashouts', ligne
-- entière dans old_value et new_value), y compris les écritures faites par TypeScript (CashoutService) : un journal
-- refusé annule l'écriture. Lu par l'invariant w2. Fonction de trigger existante : rien à accorder.
DROP TRIGGER IF EXISTS trg_audit_cashouts ON public.cashouts;
CREATE TRIGGER trg_audit_cashouts
    AFTER INSERT OR UPDATE OF status, blocked_reason ON public.cashouts
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();


-- ============================================================================
-- Délégation fix(9b.23-SB) (R63 ; B54) — 15. account_phone_finalize (recopie, 20261108000004_lot9_compte.sql:203-270)
-- ============================================================================
-- p = { user_id, new_phone, expected_phone, new_email, keep_session_id }, en une transaction : profil, autres sessions,
-- SMS à l'ancien numéro, audit. keep_session_id est obligatoire : jamais de révocation totale par défaut.
-- Lot 9 bis (R63, B54) : les transferts PENDING vers l'ancien numéro sont annulés dans la même transaction. Transfert
-- d'un expéditeur : CANCELLED, billet déverrouillé (rendu à l'expéditeur), TRANSFER_RECIPIENT_CHANGED à l'expéditeur.
-- Invitation sans expéditeur : CANCELLED, billet VALIDE → ANNULE, place rendue (sold_quantity − 1), sans avis.
-- Verrous : users FOR UPDATE → catégories des invitations ORDER BY id FOR NO KEY UPDATE → transferts ORDER BY id
-- FOR UPDATE → billets (ordre 3.3 : catégories avant transferts, transferts avant billets ; la catégorie d'un billet ne
-- change jamais, lue d'abord sans verrou comme ticket_invitation_cancel).
CREATE OR REPLACE FUNCTION public.account_phone_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user      uuid := NULLIF(p->>'user_id', '')::uuid;
    v_new       text := NULLIF(btrim(COALESCE(p->>'new_phone', '')), '');
    v_expected  text := p->>'expected_phone';
    v_new_email text := NULLIF(btrim(COALESCE(p->>'new_email', '')), '');
    v_keep      uuid := NULLIF(p->>'keep_session_id', '')::uuid;
    v_old       text;
    v_role      text;
    v_old_e164  text;
    v_sessions  integer;
    v_queued    integer := 0;
    v_tr        record;
    v_tk        record;
    v_cancelled integer := 0;
BEGIN
    IF v_user IS NULL OR v_keep IS NULL OR v_new IS NULL OR v_new !~ '^\+221[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;

    SELECT u.phone, u.role::text INTO v_old, v_role FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_old IS DISTINCT FROM v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_CONFLICT');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id <> v_user AND u.phone IN (v_new, ltrim(v_new, '+'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_TAKEN');
    END IF;

    UPDATE public.users
       SET phone = v_new, phone_verified_at = now(), email = COALESCE(v_new_email, email)
     WHERE id = v_user;

    UPDATE auth.refresh_tokens
       SET revoked = true, updated_at = now()
     WHERE user_id = v_user::text
       AND session_id IS DISTINCT FROM v_keep
       AND revoked IS DISTINCT FROM true;
    DELETE FROM auth.sessions WHERE user_id = v_user AND id <> v_keep;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    IF v_old ~ '^\+?221[0-9]{9}$' THEN
        v_old_e164 := '+' || ltrim(v_old, '+');

        -- Lot 9 bis (R63, B54) : transferts en attente vers l'ancien numéro annulés (le destinataire n'a plus ce numéro).
        PERFORM 1
           FROM public.ticket_categories c
          WHERE c.id IN (SELECT t.category_id
                           FROM public.ticket_transfers x JOIN public.tickets t ON t.id = x.ticket_id
                          WHERE x.status::text = 'PENDING' AND x.from_user_id IS NULL
                            AND x.to_phone_or_email IN (v_old_e164, ltrim(v_old_e164, '+')))
          ORDER BY c.id
            FOR NO KEY UPDATE;
        FOR v_tr IN
            SELECT x.id, x.ticket_id, x.from_user_id
              FROM public.ticket_transfers x
             WHERE x.status::text = 'PENDING' AND x.to_phone_or_email IN (v_old_e164, ltrim(v_old_e164, '+'))
             ORDER BY x.id
               FOR UPDATE
        LOOP
            SELECT t.id, t.status::text AS status, t.category_id, t.event_id INTO v_tk
              FROM public.tickets t WHERE t.id = v_tr.ticket_id FOR UPDATE;
            UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now() WHERE id = v_tr.id;
            v_cancelled := v_cancelled + 1;
            IF v_tr.from_user_id IS NULL THEN
                -- Invitation à réclamer : billet annulé et place rendue, aucun avis (B54)
                IF v_tk.status = 'VALIDE' THEN
                    UPDATE public.tickets SET status = 'ANNULE', transfer_locked = FALSE, updated_at = now() WHERE id = v_tk.id;
                    UPDATE public.ticket_categories SET sold_quantity = sold_quantity - 1 WHERE id = v_tk.category_id;
                ELSE
                    UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = v_tk.id;
                END IF;
            ELSE
                UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = v_tk.id;
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'TRANSFER_RECIPIENT_CHANGED', 'key', 'TRANSFER_RECIPIENT_CHANGED:' || v_tr.id::text,
                    'user_id', v_tr.from_user_id, 'event_id', v_tk.event_id,
                    'data', COALESCE(public.notif_event_data(v_tk.event_id), '{}'::jsonb)
                            || jsonb_build_object('transfer_id', v_tr.id, 'ticket_id', v_tk.id)));
            END IF;
        END LOOP;

        -- Sans user_id : l'envoyeur viserait le numéro du compte, c'est-à-dire le nouveau (L30). Lot 9 bis (G.49) : le
        -- registre déclare aussi EMAIL ; cette ligne au numéro reste SMS seul.
        v_queued := public.notif_enqueue(jsonb_build_object(
            'type', 'PHONE_CHANGED',
            'key', 'PHONE_CHANGED:' || v_user::text || ':' || txid_current()::text,
            'phone', v_old_e164,
            'data', '{}'::jsonb,
            'channels', jsonb_build_array('SMS')));
    END IF;

    -- Lot 9 bis (G.49, B97) : seconde mise en file au compte, EMAIL seul (adresse vérifiée exigée par notif_enqueue, M10) ;
    -- clé distincte de celle du SMS.
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PHONE_CHANGED',
        'key', 'PHONE_CHANGED:' || v_user::text || ':' || txid_current()::text || ':compte',
        'user_id', v_user,
        'data', '{}'::jsonb,
        'channels', jsonb_build_array('EMAIL')));

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_PHONE_CHANGED', 'users', v_user, jsonb_build_object(
        'old_phone_masked', CASE WHEN v_old IS NULL THEN NULL ELSE '*** ** ' || right(v_old, 2) END,
        'new_phone_masked', '*** ** ' || right(v_new, 2),
        'sms_queued', v_queued > 0,
        'sessions_revoked', v_sessions,
        'transfers_cancelled', v_cancelled));

    RETURN jsonb_build_object('ok', true, 'sessions_revoked', v_sessions, 'transfers_cancelled', v_cancelled);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PHONE_TAKEN');
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
        'public.admin_can(uuid, text)',
        'public.event_actor_profile_perm(uuid, uuid, text)',
        'public.event_actor_profile(uuid, uuid)',
        'public.pilotage_access(uuid, uuid)',
        'public.pilotage_refusal(text)',
        'public.participants_export(jsonb)',
        'public.event_controller_set_cash(jsonb)',
        'public.user_roles_set(jsonb)',
        'public.admin_user_status_set(jsonb)',
        'public.partner_register_finalize(jsonb)',
        'public.partner_dossier_resubmit(jsonb)',
        'public.account_phone_finalize(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUATER : comptes (A3, A4, A5 ; AUD-02, AUD-19, G-04, G-97)
-- ============================================================================
-- A4 (AUD-19) : l'adresse technique d'un compte à numéro n'est plus déductible du numéro. Nouveau format
--   « u<32 hexadécimaux>@comptes.eventvillage.invalid » (domaine réservé .invalid, RFC 2606 : aucune boîte possible),
--   unique par compte, jamais affichée, refusée à la saisie. Les comptes existants (« <chiffres>@eventvillage.sn »)
--   reçoivent technical_email_for(id) dans auth.users, auth.identities et public.users (section 9, en fin de fichier).
--   GoTrue ne peut plus émettre de code ni de lien email vers une adresse technique (connexion par code, récupération,
--   confirmation, changement d'adresse, réauthentification) : trigger auth_users_guard_writes, sauf permis à usage
--   unique posé par l'application juste avant (connexion par code SMS : generateLink).
-- A3 (AUD-02, G-04) : aucun changement de mot de passe chez GoTrue sans permis à usage unique posé par une route de
--   l'application (qui a vérifié l'ancien mot de passe, une session de récupération ou le code d'activation) : un jeton
--   de session volé ne suffit plus (PUT /auth/v1/user refusé par la base). La marque « compte contrôleur à activer »
--   passe de raw_user_meta_data (écrit par l'utilisateur) à raw_app_meta_data (service_role seul) :
--   controller_activation_pending. Recopies qui la lisent : notif_on_password_changed, controller_account_states,
--   controller_assignments_sync.
-- Objets :
--   nouvelles : is_technical_email(text), technical_email_for(uuid), auth_write_permit_grant(jsonb),
--               auth_users_guard_writes() (trigger) ; tables auth_write_permits, account_recovery_grants ;
--   contraintes neuves : users_email_pending_reserved_chk, users_email_verified_reserved_chk,
--               email_verifications_email_reserved_chk (les contraintes gelées ne sont pas touchées) ;
--   recopies : handle_new_user (20261031000002:18-53), account_profile_finalize (20261109000010:651-736),
--              admin_notification_detail (20261103000008:212-279), notif_on_password_changed (20261109000009:1608-1635),
--              controller_account_states (20261109000008:2189-2212), controller_assignments_sync
--              (20261110000006:489-583) ; changement de chaque recopie indiqué au-dessus d'elle.
-- Données (section 9) : adresses techniques, marque d'activation des contrôleurs, marque is_essai_fixture du seed de
--   démonstration (raw_app_meta_data, comptes du domaine essai.eventvillage.invalid seulement).
-- Aucun BEGIN ni COMMIT ; rejouable. Fonctions SECURITY DEFINER, search_path fixé, REVOKE ALL FROM PUBLIC, anon,
-- authenticated ; GRANT EXECUTE TO service_role (les recopies gardent leurs droits : CREATE OR REPLACE).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Adresse technique (A4)
-- ----------------------------------------------------------------------------
-- Adresse technique : ancien domaine eventvillage.sn et ses sous-domaines (règle B100 du lot 9 bis), ou tout domaine
-- réservé .invalid (comptes à numéro, comptes de démonstration).
CREATE OR REPLACE FUNCTION public.is_technical_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT COALESCE(p_email, '') ~* '@([a-z0-9-]+\.)*eventvillage\.sn$'
        OR COALESCE(p_email, '') ~* '@([a-z0-9-]+\.)*invalid$';
$$;
REVOKE ALL ON FUNCTION public.is_technical_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_technical_email(text) TO service_role;

-- Adresse technique d'un compte, tirée de son identifiant (reprise des comptes existants, rétablissement d'une adresse
-- vidée). Les créations de l'application tirent une adresse aléatoire du même domaine (lib/auth/technical-email.ts).
CREATE OR REPLACE FUNCTION public.technical_email_for(p_user uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT 'u' || replace(p_user::text, '-', '') || '@comptes.eventvillage.invalid';
$$;
REVOKE ALL ON FUNCTION public.technical_email_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_email_for(uuid) TO service_role;

-- Contraintes neuves (motif en ligne : aucune fonction appelée par une contrainte). Une adresse .invalid n'est jamais
-- en attente, jamais vérifiée, jamais destinataire d'un lien de vérification.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_pending_reserved_chk;
ALTER TABLE public.users ADD CONSTRAINT users_email_pending_reserved_chk CHECK (
    email_pending IS NULL OR email_pending !~* '@([a-z0-9-]+\.)*invalid$'
);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_verified_reserved_chk;
ALTER TABLE public.users ADD CONSTRAINT users_email_verified_reserved_chk CHECK (
    email_verified_at IS NULL OR email IS NULL OR email !~* '@([a-z0-9-]+\.)*invalid$'
);
ALTER TABLE public.email_verifications DROP CONSTRAINT IF EXISTS email_verifications_email_reserved_chk;
ALTER TABLE public.email_verifications ADD CONSTRAINT email_verifications_email_reserved_chk CHECK (
    email !~* '@([a-z0-9-]+\.)*invalid$'
);


-- ----------------------------------------------------------------------------
-- 2. Permis d'écriture GoTrue à usage unique (A3, A4)
-- ----------------------------------------------------------------------------
-- PASSWORD : une route de l'application a vérifié le droit de changer le mot de passe (ancien mot de passe, session
-- de récupération, code d'activation, création par un administrateur) et va appeler GoTrue. EMAIL_LINK : la connexion
-- par code SMS va demander à GoTrue un lien de session (generateLink) pour l'adresse technique du compte. Valable
-- 60 secondes, consommé par le trigger auth_users_guard_writes.
CREATE TABLE IF NOT EXISTS public.auth_write_permits (
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind       text NOT NULL CHECK (kind IN ('PASSWORD', 'EMAIL_LINK')),
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, kind)
);
COMMENT ON TABLE public.auth_write_permits IS
    'Lot 9 quater (A3, A4) : permis à usage unique (60 s) posés par les routes de l''application avant un changement de mot de passe ou un lien de session GoTrue ; consommés par le trigger auth_users_guard_writes. service_role seul.';
ALTER TABLE public.auth_write_permits ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.auth_write_permits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_write_permits TO service_role;

-- Session de récupération (A3, G-04) : un code SMS « Mot de passe oublié » vérifié (POST /api/auth/verify-otp,
-- objet PASSWORD_RESET) ouvre une autorisation de 15 minutes, consommée par POST /api/auth/reset-password. Le lien
-- email de récupération de GoTrue, lui, se reconnaît à la méthode « recovery » du jeton.
CREATE TABLE IF NOT EXISTS public.account_recovery_grants (
    user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
COMMENT ON TABLE public.account_recovery_grants IS
    'Lot 9 quater (A3, G-04) : autorisation de choisir un nouveau mot de passe après un code SMS « Mot de passe oublié » (15 min, usage unique). service_role seul.';
ALTER TABLE public.account_recovery_grants ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.account_recovery_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.account_recovery_grants TO service_role;

-- p = { user_id, kind } → { ok, expires_at } ; kind inconnu ou compte absent → { ok: false, code }.
CREATE OR REPLACE FUNCTION public.auth_write_permit_grant(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := public.try_uuid(p->>'user_id');
    v_kind    text := p->>'kind';
    v_expires timestamptz := now() + interval '60 seconds';
BEGIN
    IF v_user IS NULL OR v_kind IS NULL OR v_kind NOT IN ('PASSWORD', 'EMAIL_LINK') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;
    INSERT INTO public.auth_write_permits (user_id, kind, expires_at)
    VALUES (v_user, v_kind, v_expires)
    ON CONFLICT (user_id, kind) DO UPDATE SET expires_at = EXCLUDED.expires_at;
    RETURN jsonb_build_object('ok', true, 'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION public.auth_write_permit_grant(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_write_permit_grant(jsonb) TO service_role;

-- Trigger BEFORE UPDATE sur auth.users. Écrit par GoTrue (rôle supabase_auth_admin) ; la fonction appartient au
-- propriétaire des migrations (SECURITY DEFINER) et lit public.auth_write_permits.
--  - Mot de passe : encrypted_password qui change → permis PASSWORD exigé (consommé), sinon exception : GoTrue répond
--    une erreur et rien n'est écrit (PUT /auth/v1/user avec un jeton seul, AUD-02).
--  - Adresse technique : un jeton email posé (recovery_token, confirmation_token, email_change_token_*,
--    reauthentication_token) → permis EMAIL_LINK exigé (consommé), sinon exception : aucun code ni lien email
--    (POST /auth/v1/otp, /recover, /resend, /reauthenticate, AUD-19).
CREATE OR REPLACE FUNCTION public.auth_users_guard_writes()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token boolean;
BEGIN
    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
        DELETE FROM public.auth_write_permits
         WHERE user_id = NEW.id AND kind = 'PASSWORD' AND expires_at > now();
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Lot 9 quater (A3) : changement de mot de passe refusé hors des routes de l''application'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_token := (COALESCE(NEW.recovery_token, '') <> '' AND NEW.recovery_token IS DISTINCT FROM OLD.recovery_token)
            OR (COALESCE(NEW.confirmation_token, '') <> '' AND NEW.confirmation_token IS DISTINCT FROM OLD.confirmation_token)
            OR (COALESCE(NEW.email_change_token_new, '') <> '' AND NEW.email_change_token_new IS DISTINCT FROM OLD.email_change_token_new)
            OR (COALESCE(NEW.email_change_token_current, '') <> '' AND NEW.email_change_token_current IS DISTINCT FROM OLD.email_change_token_current)
            OR (COALESCE(NEW.reauthentication_token, '') <> '' AND NEW.reauthentication_token IS DISTINCT FROM OLD.reauthentication_token);
    IF v_token AND (public.is_technical_email(OLD.email) OR public.is_technical_email(NEW.email)) THEN
        DELETE FROM public.auth_write_permits
         WHERE user_id = NEW.id AND kind = 'EMAIL_LINK' AND expires_at > now();
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Lot 9 quater (A4) : aucun code ni lien email vers une adresse technique'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.auth_users_guard_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_guard_writes ON auth.users;
CREATE TRIGGER on_auth_user_guard_writes
    BEFORE UPDATE OF encrypted_password, recovery_token, confirmation_token, email_change_token_new,
                     email_change_token_current, reauthentication_token ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auth_users_guard_writes();


-- ----------------------------------------------------------------------------
-- 3. handle_new_user (recopie de 20261031000002_lot1a_failles_sans_privilege.sql:18-53)
--    Changement : un compte créé par GoTrue avec un numéro et sans adresse reçoit technical_email_for(id) au lieu de
--    « <numéro>@eventvillage.sn ». (Inscription publique fermée au lot 9 quater : seuls les comptes créés par le
--    service_role passent ici.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_phone TEXT := NULLIF(TRIM(NEW.phone), '');
    v_email TEXT := NULLIF(TRIM(NEW.email), '');
BEGIN
    IF v_email IS NULL AND v_phone IS NOT NULL THEN
        v_email := public.technical_email_for(NEW.id);
    END IF;

    INSERT INTO public.users (id, first_name, last_name, phone, email, role, status, referral_status)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Utilisateur'),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'Event Village'),
        v_phone,
        v_email,
        'CLIENT',
        'ACTIF',
        'STANDARD'
    )
    ON CONFLICT (id) DO UPDATE SET
        email      = EXCLUDED.email,
        updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'CLIENT')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. account_profile_finalize (recopie de 20261109000010_lot9bis_email.sql:651-736)
--    Changement : l'adresse technique reconnue est celle de is_technical_email (ancien et nouveau domaine) : une adresse
--    vidée, rétablie par la route sur l'adresse technique du compte, donne CLEARED.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_profile_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user     uuid := NULLIF(p->>'user_id', '')::uuid;
    v_first    text := NULLIF(btrim(COALESCE(p->>'first_name', '')), '');
    v_last     text := NULLIF(btrim(COALESCE(p->>'last_name', '')), '');
    v_email    text := lower(NULLIF(btrim(COALESCE(p->>'email', '')), ''));
    v_expected text := p->>'expected_email';
    v_cur_first text;
    v_cur_last  text;
    v_cur_email text;
    v_cur_pending  text;
    v_cur_verified timestamptz;
    v_role      text;
    v_new_email    text;
    v_new_pending  text;
    v_new_verified timestamptz;
    v_state     text := 'UNCHANGED';
    v_fields    text[] := ARRAY[]::text[];
BEGIN
    IF v_user IS NULL OR v_first IS NULL OR v_last IS NULL OR v_email IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;

    SELECT u.first_name, u.last_name, u.email, u.email_pending, u.email_verified_at, u.role::text
      INTO v_cur_first, v_cur_last, v_cur_email, v_cur_pending, v_cur_verified, v_role
      FROM public.users u WHERE u.id = v_user
       FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_cur_email IS DISTINCT FROM v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_CONFLICT');
    END IF;

    v_new_email := v_cur_email;
    v_new_pending := v_cur_pending;
    v_new_verified := v_cur_verified;
    IF public.is_technical_email(v_email) THEN
        v_state := 'CLEARED';
        v_new_email := v_email;
        v_new_pending := NULL;
        v_new_verified := NULL;
    ELSIF v_email = lower(COALESCE(v_cur_email, '')) OR v_email = v_cur_pending THEN
        v_state := 'UNCHANGED';
    ELSE
        IF (public.account_identity_taken(v_user, v_email, NULL)->>'email_taken')::boolean THEN
            RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
        END IF;
        v_state := 'PENDING';
        v_new_pending := v_email;
        v_new_verified := NULL;
    END IF;

    IF v_cur_first IS DISTINCT FROM v_first THEN v_fields := v_fields || 'first_name'::text; END IF;
    IF v_cur_last IS DISTINCT FROM v_last THEN v_fields := v_fields || 'last_name'::text; END IF;
    IF v_cur_email IS DISTINCT FROM v_new_email OR v_cur_pending IS DISTINCT FROM v_new_pending
       OR v_cur_verified IS DISTINCT FROM v_new_verified THEN
        v_fields := v_fields || 'email'::text;
    END IF;

    UPDATE public.users
       SET first_name = v_first, last_name = v_last, email = v_new_email,
           email_pending = v_new_pending, email_verified_at = v_new_verified
     WHERE id = v_user;

    -- Liens ouverts fermés quand l'adresse visée change (ordre des verrous : compte, puis liens).
    IF v_state IN ('CLEARED', 'PENDING') THEN
        UPDATE public.email_verifications
           SET superseded_at = now()
         WHERE user_id = v_user AND used_at IS NULL AND superseded_at IS NULL;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_PROFILE_UPDATED', 'users', v_user, jsonb_build_object('fields', to_jsonb(v_fields)));

    RETURN jsonb_build_object('ok', true, 'email_state', v_state, 'email_pending', v_new_pending);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. admin_notification_detail (recopie de 20261103000008_lot6_supervision.sql:212-279)
--    Changement : aucune adresse technique (is_technical_email) n'est montrée, ni celle du compte ni celle de la ligne.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_notification_detail(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id     uuid;
    o        public.notification_outbox%ROWTYPE;
    v_first  text;
    v_last   text;
    v_uphone text;
    v_umail  text;
    v_etitle text;
    v_estat  text;
    v_data   jsonb;
    v_mail   text;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object'
       OR COALESCE(p->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Notification introuvable.');
    END IF;
    v_id := (p->>'id')::uuid;

    SELECT * INTO o FROM public.notification_outbox WHERE id = v_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Notification introuvable.');
    END IF;

    IF o.recipient_user_id IS NOT NULL THEN
        SELECT u.first_name, u.last_name, u.phone, u.email INTO v_first, v_last, v_uphone, v_umail
          FROM public.users u WHERE u.id = o.recipient_user_id;
    END IF;
    IF o.event_id IS NOT NULL THEN
        SELECT e.title, e.status::text INTO v_etitle, v_estat FROM public.events e WHERE e.id = o.event_id;
    END IF;

    IF o.origin = 'SYNC_LOG' THEN
        v_data := CASE WHEN jsonb_typeof(o.template_data -> 'purpose') = 'string'
                       THEN jsonb_build_object('purpose', o.template_data -> 'purpose')
                       ELSE '{}'::jsonb END;
    ELSE
        v_data := o.template_data;
    END IF;

    -- Email réel seulement (lot 9 quater, A4 : aucune adresse technique, ancien ou nouveau domaine, n'est montrée).
    v_mail := COALESCE(CASE WHEN NOT public.is_technical_email(COALESCE(o.recipient_email, '')) THEN o.recipient_email END,
                       CASE WHEN v_umail IS NOT NULL AND NOT public.is_technical_email(v_umail) THEN v_umail END);

    RETURN jsonb_build_object(
        'ok', true,
        'item', (to_jsonb(o) - 'claim_token' - 'template_data') || jsonb_build_object(
            'template_data', v_data,
            'recipient', jsonb_build_object(
                'user_id', o.recipient_user_id,
                'display_name', CASE WHEN o.recipient_user_id IS NOT NULL
                                     THEN COALESCE(public.pilotage_display_name(v_first, v_last), 'Compte sans nom') END,
                'phone', COALESCE(o.recipient_phone, v_uphone),
                'email', v_mail
            ),
            'event_title', v_etitle,
            'event_status', v_estat,
            'can_retry', (o.status = 'FAILED' AND o.origin = 'OUTBOX')
        )
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. notif_on_password_changed (recopie de 20261109000009_lot9bis_messages.sql:1608-1635)
--    Changement : la marque de l'activation d'un contrôleur est lue dans raw_app_meta_data (service_role seul), plus
--    dans raw_user_meta_data que l'utilisateur écrit (AUD-02). Seule l'activation (première pose du mot de passe choisi,
--    après le code reçu par SMS) reste sans avis ; tout autre changement, par tout chemin, est prévenu.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_on_password_changed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.id) THEN
        RETURN NEW;
    END IF;
    -- Lot 9 bis (R29) : activation du compte coquille, aucune alerte de sécurité. Reste S3 : GoTrue écrit le mot de
    -- passe et les métadonnées par deux UPDATE distincts ; le mot de passe est donc posé pendant que le compte est encore
    -- marqué coquille (POST /api/controller/setup le pose avant de retirer la marque). Seule l'activation donne un mot de
    -- passe à un compte coquille (création : INSERT, hors de ce trigger) ; toute pose ultérieure reste prévenue.
    IF COALESCE(OLD.raw_app_meta_data->>'controller_activation_pending', '') = 'true' THEN
        RETURN NEW;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PASSWORD_CHANGED',
        'key', 'PASSWORD_CHANGED:' || NEW.id::text || ':'
               || COALESCE(floor(extract(epoch FROM NEW.updated_at) * 1000000)::bigint::text, 'tx' || txid_current()::text),
        'user_id', NEW.id,
        'data', '{}'::jsonb
    ));
    RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. controller_account_states (recopie de 20261109000008_lot9bis_cycle.sql:2189-2212)
--    Changement : marque lue dans raw_app_meta_data.controller_activation_pending.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_account_states(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_items jsonb;
BEGIN
    IF jsonb_typeof(p->'user_ids') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'user_id', u.id,
               'account_state', CASE WHEN COALESCE(a.raw_app_meta_data->>'controller_activation_pending', 'false') = 'true'
                                     THEN 'PENDING_ACTIVATION' ELSE 'ACTIVATED' END) ORDER BY u.id), '[]'::jsonb)
      INTO v_items
      FROM public.users u
      LEFT JOIN auth.users a ON a.id = u.id
     WHERE u.id IN (SELECT public.try_uuid(x) FROM jsonb_array_elements_text(p->'user_ids') AS x);
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. controller_assignments_sync (recopie de 20261110000006_lot9ter_equipe_messages.sql:489-583)
--    Changement : marque lue dans raw_app_meta_data.controller_activation_pending.
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
-- 9. Reprise des données (DML après toute la DDL ; chaque instruction ne touche que les lignes encore à reprendre)
-- ----------------------------------------------------------------------------
-- 9.1 Adresses techniques « <chiffres>@eventvillage.sn » → technical_email_for(id). auth.users d'abord (identifiant de
--     connexion par mot de passe : la route /api/auth/login relit l'adresse du compte par son numéro), puis l'identité
--     email de GoTrue (identity_data.email ; provider_id seulement s'il portait l'ancienne adresse), puis public.users.
--     Aucune colonne de jeton ni de mot de passe n'est écrite : le trigger auth_users_guard_writes ne se déclenche pas.
UPDATE auth.identities i
   SET identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(public.technical_email_for(i.user_id))),
       provider_id = CASE WHEN i.provider_id = i.identity_data->>'email' THEN i.user_id::text ELSE i.provider_id END,
       updated_at = now()
 WHERE i.provider = 'email'
   AND COALESCE(i.identity_data->>'email', '') ~ '^[0-9]+@eventvillage\.sn$';

UPDATE auth.users a
   SET email = public.technical_email_for(a.id),
       updated_at = now()
 WHERE COALESCE(a.email, '') ~ '^[0-9]+@eventvillage\.sn$';

UPDATE public.users u
   SET email = public.technical_email_for(u.id)
 WHERE COALESCE(u.email, '') ~ '^[0-9]+@eventvillage\.sn$';

-- 9.2 Marque d'activation des contrôleurs : copiée dans raw_app_meta_data pour les comptes qui ont le rôle CONTROLEUR
--     (une marque posée par un autre compte sur lui-même n'est pas reprise), puis retirée de raw_user_meta_data.
UPDATE auth.users a
   SET raw_app_meta_data = COALESCE(a.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('controller_activation_pending', true)
 WHERE COALESCE(a.raw_user_meta_data->>'is_temporary_controller_account', '') = 'true'
   AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = a.id AND r.role::text = 'CONTROLEUR')
   AND COALESCE(a.raw_app_meta_data->>'controller_activation_pending', '') <> 'true';

UPDATE auth.users a
   SET raw_user_meta_data = a.raw_user_meta_data - 'is_temporary_controller_account'
 WHERE a.raw_user_meta_data ? 'is_temporary_controller_account';

-- 9.3 Marque is_essai_fixture du seed de démonstration (garde de scripts/dev/seed-dev.core.ts) : copiée dans
--     raw_app_meta_data pour les seuls comptes du domaine du seed, puis retirée de raw_user_meta_data.
UPDATE auth.users a
   SET raw_app_meta_data = COALESCE(a.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('is_essai_fixture', true)
 WHERE COALESCE(a.raw_user_meta_data->>'is_essai_fixture', '') = 'true'
   AND lower(COALESCE(a.email, '')) LIKE '%@essai.eventvillage.invalid'
   AND COALESCE(a.raw_app_meta_data->>'is_essai_fixture', '') <> 'true';

UPDATE auth.users a
   SET raw_user_meta_data = a.raw_user_meta_data - 'is_essai_fixture'
 WHERE a.raw_user_meta_data ? 'is_essai_fixture';

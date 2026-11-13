-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : comptes créés par un admin, activation par lien (A2 : AUTH-02, T2) ; journal du
-- code administrateur (A3 : AUTH-05)
-- ============================================================================
-- A2 (décision du chef de projet) : l'admin ne saisit plus de mot de passe. Le compte est créé avec un mot de passe
--   aléatoire jamais montré et la marque app_metadata.account_activation_pending ; le titulaire reçoit par SMS un lien
--   d'activation à usage unique (24 h) où il choisit son mot de passe selon la règle commune. Tant que la marque est
--   posée, aucune connexion (mot de passe, code SMS, « Mot de passe oublié »). L'admin voit « Activation en attente » et
--   peut renvoyer le lien (le précédent n'est plus valable). Même mécanique que l'activation d'un contrôleur, généralisée.
-- Objets :
--   table account_activations : empreinte SHA-256 du jeton (jamais le jeton), échéance, usage, remplacement, auteur ;
--   account_activation_issue(p) : { user_id, token_hash, actor_id } → nouveau lien de 24 h, les précédents remplacés ;
--   account_activation_consume(p) : { token_hash } → { ok, user_id } ou { ok: false, code UNKNOWN | USED | EXPIRED } ;
--   registre : ACCOUNT_ACTIVATION et OTP_ADMIN (envois synchrones, journal seulement : ni jeton ni code stockés) ;
--   recopie : notification_sync_log (20261108000004_lot9_compte.sql:49-111), changement : deux types journalisés ;
--   recopie : notif_on_password_changed (20261111000001_lot9quater_comptes.sql, section 6), changement : l'activation
--             d'un compte créé par un admin est sans avis, comme celle d'un contrôleur.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_activations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash    text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at    timestamptz NOT NULL,
    used_at       timestamptz,
    superseded_at timestamptz,
    created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_account_activations_user ON public.account_activations (user_id, created_at DESC);
ALTER TABLE public.account_activations ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.account_activations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.account_activations TO service_role;
COMMENT ON TABLE public.account_activations IS
    'Lot 9 quinquies (A2 : AUTH-02) : liens d''activation des comptes créés par un admin (empreinte du jeton seulement, 24 h, usage unique). service_role seul.';

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('ACCOUNT_ACTIVATION',         'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL),
    ('OTP_ADMIN',                  'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

-- p = { user_id, token_hash, actor_id } → { ok, id, expires_at }
CREATE OR REPLACE FUNCTION public.account_activation_issue(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := public.try_uuid(p->>'user_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_hash    text := lower(btrim(COALESCE(p->>'token_hash', '')));
    v_expires timestamptz := clock_timestamp() + interval '24 hours';
    v_id      uuid;
BEGIN
    IF v_user IS NULL OR v_hash !~ '^[0-9a-f]{64}$' OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('account_activation:' || v_user::text));
    UPDATE public.account_activations SET superseded_at = clock_timestamp()
     WHERE user_id = v_user AND used_at IS NULL AND superseded_at IS NULL;
    INSERT INTO public.account_activations (user_id, token_hash, expires_at, created_by)
    VALUES (v_user, v_hash, v_expires, v_actor)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION public.account_activation_issue(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_activation_issue(jsonb) TO service_role;

-- p = { token_hash } → { ok, user_id } ou { ok: false, code } ; le lien est consommé (used_at) avant la pose du mot de passe
CREATE OR REPLACE FUNCTION public.account_activation_consume(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hash text := lower(btrim(COALESCE(p->>'token_hash', '')));
    v_row  record;
BEGIN
    IF v_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN');
    END IF;
    SELECT a.id, a.user_id, a.expires_at, a.used_at, a.superseded_at INTO v_row
      FROM public.account_activations a WHERE a.token_hash = v_hash FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN');
    END IF;
    IF v_row.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USED');
    END IF;
    IF v_row.superseded_at IS NOT NULL OR v_row.expires_at <= clock_timestamp() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EXPIRED');
    END IF;
    UPDATE public.account_activations SET used_at = clock_timestamp() WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', true, 'user_id', v_row.user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.account_activation_consume(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_activation_consume(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- notification_sync_log (recopie de 20261108000004_lot9_compte.sql:49-111) ; changement : ACCOUNT_ACTIVATION, OTP_ADMIN
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_sync_log(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type    text := p->>'type';
    v_ref     text := NULLIF(btrim(COALESCE(p->>'ref', '')), '');
    v_phone   text := NULLIF(btrim(COALESCE(p->>'phone', '')), '');
    v_user    uuid := NULLIF(p->>'user_id', '')::uuid;
    v_actor   uuid := NULLIF(p->>'actor_id', '')::uuid;
    v_outcome text := p->>'outcome';
    v_reason  text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_purpose text;
    v_key     text;
    v_id      uuid;
    v_now     timestamptz := now();
BEGIN
    v_purpose := CASE v_type
        WHEN 'OTP_LOGIN' THEN 'LOGIN'
        WHEN 'OTP_REGISTER' THEN 'REGISTER'
        WHEN 'OTP_PASSWORD_RESET' THEN 'PASSWORD_RESET'
        WHEN 'OTP_WITHDRAWAL' THEN 'WITHDRAWAL'
        WHEN 'OTP_PHONE_CHANGE' THEN 'PHONE_CHANGE'
        WHEN 'OTP_AUTH_HOOK' THEN 'AUTH_HOOK'
        WHEN 'CONTROLLER_INVITE' THEN 'CONTROLLER_SETUP'
        -- Lot 9 quinquies (A2, A3) : lien d'activation d'un compte créé par un admin ; code administrateur
        WHEN 'ACCOUNT_ACTIVATION' THEN 'ACCOUNT_ACTIVATION'
        WHEN 'OTP_ADMIN' THEN 'ADMIN_STEP_UP'
    END;
    IF v_purpose IS NULL OR NOT EXISTS (SELECT 1 FROM public.notification_types t WHERE t.type = v_type AND t.sync_only) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TYPE',
            'message', 'Seuls les codes à usage unique et les invitations se journalisent ici.');
    END IF;
    IF v_ref IS NULL OR v_outcome IS NULL OR v_outcome NOT IN ('SENT', 'FAILED', 'UNCERTAIN', 'SKIPPED')
       OR (v_phone IS NULL AND v_user IS NULL)
       OR (v_phone IS NOT NULL AND v_phone !~ '^\+221[0-9]{9}$')
       OR (v_outcome <> 'SENT' AND v_reason IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Journal d''envoi incomplet.');
    END IF;

    v_key := v_type || ':' || v_ref;
    INSERT INTO public.notification_outbox (
        idempotency_key, group_key, type, family, topic, channel, origin,
        recipient_user_id, recipient_phone, actor_id, template_data, status, reason,
        attempts, max_attempts, due_at, next_attempt_at, sent_at, finished_at, provider_message_id, decision
    ) VALUES (
        v_key || ':SMS', v_key, v_type, 'ESSENTIAL', NULL, 'SMS', 'SYNC_LOG',
        v_user, v_phone, v_actor, jsonb_build_object('purpose', v_purpose), v_outcome,
        CASE WHEN v_outcome = 'SENT' THEN NULL ELSE v_reason END,
        CASE WHEN v_outcome = 'SKIPPED' THEN 0 ELSE 1 END, 5, v_now, v_now,
        CASE WHEN v_outcome IN ('SENT', 'UNCERTAIN') THEN v_now END, v_now,
        NULLIF(left(COALESCE(p->>'provider_message_id', ''), 200), ''),
        jsonb_build_object('at', v_now, 'stage', 'SYNC', 'outcome', v_outcome)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT o.id INTO v_id FROM public.notification_outbox o WHERE o.idempotency_key = v_key || ':SMS';
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.notification_sync_log(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_sync_log(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- notif_on_password_changed (recopie de 20261111000001_lot9quater_comptes.sql, section 6) ; changement : activation
-- d'un compte créé par un admin sans avis
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
    -- Lot 9 quinquies (A2 : AUTH-02) : activation d'un compte créé par un admin (premier mot de passe choisi par le
    -- titulaire après le lien reçu par SMS) : aucun avis, comme l'activation d'un contrôleur.
    IF COALESCE(OLD.raw_app_meta_data->>'account_activation_pending', '') = 'true' THEN
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


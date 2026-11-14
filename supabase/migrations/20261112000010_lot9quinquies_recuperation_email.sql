-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : « Mot de passe oublié » par email via l'application et Resend (B2 : AUTH-08, T5)
-- ============================================================================
-- B2 (décision du chef de projet) : le lien de récupération par email part de l'application (POST
--   /api/auth/forgot-password, Resend, même expéditeur que les autres emails, modèle en français), à usage unique, valable
--   60 minutes, réponse toujours neutre. Seule une adresse VÉRIFIÉE d'un compte ACTIF reçoit un lien. GoTrue n'envoie
--   plus aucun email : plus besoin du SMTP de Supabase (docs/deploiement-projet-neuf.md).
-- Objets :
--   table password_reset_links : empreinte SHA-256 du jeton (jamais le jeton), échéance (60 min), usage, remplacement ;
--   password_reset_link_issue(p) : { email, token_hash } → { ok, issued, user_id? } (issued = false sans compte éligible) ;
--   password_reset_link_consume(p) : { token_hash } → { ok, user_id } ou { ok: false, code UNKNOWN | USED | EXPIRED } ;
--   recopie : auth_users_guard_writes (20261111000001_lot9quater_comptes.sql, section 2), changement : le permis
--     EMAIL_LINK est exigé pour tout jeton email, quelle que soit l'adresse (et plus seulement une adresse technique).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_links (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash    text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at    timestamptz NOT NULL,
    used_at       timestamptz,
    superseded_at timestamptz,
    created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_links_user ON public.password_reset_links (user_id, created_at DESC);
ALTER TABLE public.password_reset_links ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.password_reset_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.password_reset_links TO service_role;
COMMENT ON TABLE public.password_reset_links IS
    'Lot 9 quinquies (B2 : AUTH-08) : liens « Mot de passe oublié » envoyés par email (empreinte du jeton seulement, 60 min, usage unique). service_role seul.';

-- p = { email, token_hash } → { ok, issued, user_id? }
CREATE OR REPLACE FUNCTION public.password_reset_link_issue(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text := lower(btrim(COALESCE(p->>'email', '')));
    v_hash  text := lower(btrim(COALESCE(p->>'token_hash', '')));
    v_user  uuid;
BEGIN
    IF v_hash !~ '^[0-9a-f]{64}$' OR position('@' IN v_email) <= 1 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT u.id INTO v_user FROM public.users u
     WHERE lower(u.email) = v_email AND u.email_verified_at IS NOT NULL AND u.status::text = 'ACTIF'
       AND NOT public.is_technical_email(u.email)
     LIMIT 1;
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', true, 'issued', false);
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('password_reset_link:' || v_user::text));
    UPDATE public.password_reset_links SET superseded_at = clock_timestamp()
     WHERE user_id = v_user AND used_at IS NULL AND superseded_at IS NULL;
    INSERT INTO public.password_reset_links (user_id, token_hash, expires_at)
    VALUES (v_user, v_hash, clock_timestamp() + interval '60 minutes');
    RETURN jsonb_build_object('ok', true, 'issued', true, 'user_id', v_user);
END;
$$;
REVOKE ALL ON FUNCTION public.password_reset_link_issue(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_reset_link_issue(jsonb) TO service_role;

-- p = { token_hash } → { ok, user_id } ou { ok: false, code } ; le lien est consommé avant la pose du mot de passe
CREATE OR REPLACE FUNCTION public.password_reset_link_consume(p jsonb)
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
    SELECT l.id, l.user_id, l.expires_at, l.used_at, l.superseded_at INTO v_row
      FROM public.password_reset_links l WHERE l.token_hash = v_hash FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN');
    END IF;
    IF v_row.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USED');
    END IF;
    IF v_row.superseded_at IS NOT NULL OR v_row.expires_at <= clock_timestamp() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EXPIRED');
    END IF;
    UPDATE public.password_reset_links SET used_at = clock_timestamp() WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', true, 'user_id', v_row.user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.password_reset_link_consume(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_reset_link_consume(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- auth_users_guard_writes (recopie de 20261111000001_lot9quater_comptes.sql, section 2) ; changement : permis exigé pour
-- tout jeton email. Le déclencheur on_auth_user_guard_writes est inchangé (il appelle cette fonction).
-- ----------------------------------------------------------------------------
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
    -- Lot 9 quinquies (B2 : AUTH-08, T5) : GoTrue n'envoie plus AUCUN email ; tout jeton email (toute adresse) exige le
    -- permis EMAIL_LINK posé par une route de l'application (la connexion par code SMS : lien de session). Les liens de
    -- récupération par email passent par l'application et Resend (password_reset_links).
    IF v_token THEN
        DELETE FROM public.auth_write_permits
         WHERE user_id = NEW.id AND kind = 'EMAIL_LINK' AND expires_at > now();
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Lot 9 quinquies (B2) : aucun code ni lien email de GoTrue hors des routes de l''application'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

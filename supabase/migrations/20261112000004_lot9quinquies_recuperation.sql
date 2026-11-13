-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : récupération du mot de passe liée à la session (A8, contre-vérification du
-- lot 9 quater, point 1)
-- ============================================================================
-- Avant : le code SMS « Mot de passe oublié » ouvrait une autorisation par COMPTE (account_recovery_grants, 15 min) ;
--   n'importe quelle session du compte (une session volée) pouvait la consommer et choisir le mot de passe.
-- Désormais (décision du chef de projet) : l'autorisation est liée à la SESSION ouverte par le code, consommée une seule
--   fois, valable 10 minutes. Une session ouverte AVANT la vérification du code (session volée, ou toute autre session
--   déjà en cours) est refusée ; la session ouverte par le code la consomme (supprimée à l'usage). Le permis d'écriture GoTrue
--   (auth_write_permits, 60 s) n'est posé par POST /api/auth/reset-password qu'après cette consommation, pour ce seul
--   appel.
-- Objets :
--   account_recovery_grants : colonne issued_at (heure de la vérification du code) ;
--   account_recovery_open(p) : ouvre (ou rouvre) l'autorisation du compte, 10 minutes, sans session liée ;
--   account_recovery_consume(p) : { user_id, session_id } → { ok } ou { ok: false, code NO_GRANT | OTHER_SESSION } ;
--     lit auth.sessions (created_at) sous verrou de la ligne de l'autorisation.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

ALTER TABLE public.account_recovery_grants ADD COLUMN IF NOT EXISTS issued_at timestamptz NOT NULL DEFAULT clock_timestamp();

COMMENT ON TABLE public.account_recovery_grants IS
    'Lot 9 quater (A3, G-04) puis lot 9 quinquies (A8) : autorisation de choisir un nouveau mot de passe après un code SMS « Mot de passe oublié », réservée à une session ouverte après le code (issued_at), 10 min, usage unique. service_role seul.';

-- p = { user_id } → { ok, expires_at }
CREATE OR REPLACE FUNCTION public.account_recovery_open(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := public.try_uuid(p->>'user_id');
    v_now     timestamptz := clock_timestamp();
    v_expires timestamptz := clock_timestamp() + interval '10 minutes';
BEGIN
    IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    INSERT INTO public.account_recovery_grants (user_id, expires_at, issued_at)
    VALUES (v_user, v_expires, v_now)
    ON CONFLICT (user_id) DO UPDATE SET expires_at = EXCLUDED.expires_at, issued_at = EXCLUDED.issued_at;
    RETURN jsonb_build_object('ok', true, 'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION public.account_recovery_open(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_recovery_open(jsonb) TO service_role;

-- p = { user_id, session_id } → { ok: true } (autorisation consommée) ou { ok: false, code }
CREATE OR REPLACE FUNCTION public.account_recovery_consume(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := public.try_uuid(p->>'user_id');
    v_session uuid := public.try_uuid(p->>'session_id');
    v_grant   record;
    v_created timestamptz;
BEGIN
    IF v_user IS NULL OR v_session IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT g.user_id, g.expires_at, g.issued_at INTO v_grant
      FROM public.account_recovery_grants g WHERE g.user_id = v_user FOR UPDATE;
    IF NOT FOUND OR v_grant.expires_at <= clock_timestamp() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_GRANT');
    END IF;
    SELECT s.created_at INTO v_created FROM auth.sessions s WHERE s.id = v_session AND s.user_id = v_user;
    IF NOT FOUND OR v_created < v_grant.issued_at THEN
        -- Session ouverte avant la vérification du code (session volée, ou toute autre session déjà en cours) : refus ;
        -- l'autorisation reste pour la session ouverte par le code.
        RETURN jsonb_build_object('ok', false, 'code', 'OTHER_SESSION');
    END IF;
    DELETE FROM public.account_recovery_grants WHERE user_id = v_user;
    RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.account_recovery_consume(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_recovery_consume(jsonb) TO service_role;

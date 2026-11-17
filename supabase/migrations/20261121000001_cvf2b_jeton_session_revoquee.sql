-- ============================================================================
-- EVENT VILLAGE — CONTRE-VÉRIFICATION 2B, points 6.6 et 6.7 : jeton d'une session fermée refusé par l'API REST
-- ============================================================================
-- Constat (docs/audit-finition-2b.md, 6.6 et 6.7) : après « Se déconnecter » ou « Déconnecter tous mes appareils »,
-- GoTrue refuse l'ancien jeton d'accès, mais PostgREST ne vérifie que sa signature et son échéance : la REST le
-- servait jusqu'à l'échéance (jwt_expiry, 1 h).
--
-- Correctif : fonction de pré-requête de PostgREST (réglage pgrst.db_pre_request du rôle authenticator), appelée avant
-- CHAQUE requête de l'API REST, dans la transaction de la requête, sous le rôle du jeton :
--   - sans jeton, jeton anon ou service_role : rien (aucune lecture) ;
--   - tout autre jeton (authenticated) : sa session (`session_id` du jeton) doit exister dans auth.sessions, appartenir
--     au compte du jeton (`sub`) et ne pas être échue (not_after) ; sinon refus HTTP 401, message sans détail.
--     Un jeton authenticated SANS session_id est refusé aussi (GoTrue en met toujours un).
--   Une seule lecture, par la clé primaire de auth.sessions (sessions_pkey).
-- Champ : l'API REST seulement (/rest/v1, tables et RPC). Realtime, Storage et GoTrue ne passent pas par PostgREST :
-- GoTrue vérifie déjà la session ; Realtime et Storage acceptent le jeton jusqu'à son échéance (jwt_expiry ramené à
-- 600 s, supabase/config.toml ; Realtime coupe l'abonnement à l'échéance).
--
-- Schéma `securite` (et non public) : la fonction doit être exécutable par anon, authenticated et service_role (PostgREST
-- l'appelle sous le rôle de la requête) ; dans public elle serait une RPC exposée et contredirait les inventaires du
-- schéma public (tests/schema/fonctions-privileges, invariant q6 de tests/helpers/lot9quater-invariants). Le schéma
-- `securite` n'est pas exposé par l'API (config.toml [api] schemas) et ne contient que cette fonction.
--
-- Aucun BEGIN ni COMMIT ; rejouable (IF NOT EXISTS, CREATE OR REPLACE, ALTER ROLE … SET idempotent).
-- Contrôle à la fin : échec explicite si le réglage n'est pas posé sur authenticator.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS securite;
REVOKE ALL ON SCHEMA securite FROM PUBLIC;
GRANT USAGE ON SCHEMA securite TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION securite.db_pre_request()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claims jsonb := auth.jwt();
    v_role   text;
    v_sid    text;
    v_sub    text;
BEGIN
    -- Sans jeton (claims vides) : rôle anon de PostgREST, rien à vérifier
    IF v_claims IS NULL OR v_claims = '{}'::jsonb THEN
        RETURN;
    END IF;
    v_role := v_claims->>'role';
    IF v_role IN ('anon', 'service_role') THEN
        RETURN;
    END IF;

    v_sid := v_claims->>'session_id';
    v_sub := v_claims->>'sub';
    IF v_sid IS NULL OR v_sub IS NULL
       OR v_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (
           SELECT 1
             FROM auth.sessions s
            WHERE s.id = v_sid::uuid
              AND s.user_id::text = v_sub
              AND (s.not_after IS NULL OR s.not_after > now())
       )
    THEN
        RAISE SQLSTATE 'PGRST'
            USING MESSAGE = '{"code":"SESSION_FERMEE","message":"Votre session est fermée. Reconnectez-vous.","details":null,"hint":null}',
                  DETAIL  = '{"status":401,"headers":{"WWW-Authenticate":"Bearer error=\"invalid_token\""}}';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION securite.db_pre_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION securite.db_pre_request() TO anon, authenticated, service_role;

COMMENT ON FUNCTION securite.db_pre_request() IS
    'Contre-vérification 2B (6.6, 6.7) : pré-requête de PostgREST. Refuse (401) un jeton authenticated dont la session '
    '(session_id) n''existe plus dans auth.sessions, n''est pas celle du compte ou est échue ; anon et service_role : rien.';

-- Branchement : réglage lu par PostgREST dans pg_db_role_setting (configuration en base), rechargé par NOTIFY
ALTER ROLE authenticator SET pgrst.db_pre_request = 'securite.db_pre_request';
NOTIFY pgrst, 'reload config';

-- Contrôle : le réglage est posé sur authenticator
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_db_role_setting rs
         WHERE rs.setrole = 'authenticator'::regrole
           AND rs.setdatabase = 0
           AND 'pgrst.db_pre_request=securite.db_pre_request' = ANY (rs.setconfig)
    ) THEN
        RAISE EXCEPTION 'cvf2b 6.6 : pgrst.db_pre_request absent du rôle authenticator';
    END IF;
END;
$$;

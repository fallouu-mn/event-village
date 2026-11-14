-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES, correctifs de la contre-vérification, point 2 : identifiants de GoTrue secrets
-- ============================================================================
-- Constat (contre-vérification, run 177, tests/audit-auth/cv9qq-2 c) : GoTrue, appelé directement avec la clé publique
--   et l'adresse réelle d'un compte, acceptait 12 mauvais mots de passe puis ouvrait la session : la limite de 10 échecs
--   par compte et par 15 minutes (A1) ne valait que pour POST /api/auth/login.
-- Règle : GoTrue ne connaît plus aucun identifiant qu'un tiers puisse savoir.
--   - auth.users.email est TOUJOURS une adresse technique « k<40 hex>@comptes.eventvillage.invalid » tirée d'une empreinte
--     HMAC-SHA256 de l'identifiant du compte avec une clé secrète tirée au hasard par cette migration et gardée dans le
--     schéma `private` (jamais exposé par l'API, aucun droit pour anon, authenticated ni service_role) : ni l'adresse
--     réelle, ni le numéro, ni l'identifiant du compte (technical_email_for), et impossible à recalculer sans la clé.
--     L'adresse réelle reste dans public.users ; POST /api/auth/login fait la correspondance (numéro ou adresse →
--     compte → identifiant GoTrue relu par l'API d'administration).
--   - Numéro : la connexion par numéro est FERMÉE chez GoTrue (fournisseur Téléphone désactivé : [auth.sms]
--     enable_signup = false en local ; réglage du tableau de bord à vérifier, rapport). auth.users.phone garde le numéro
--     du compte : GoTrue en garantit l'unicité (changement de numéro, lot 9 : AM1) sans jamais l'accepter comme
--     identifiant de connexion.
--   - Garanti par la base, quel que soit l'appelant : déclencheur avant toute mise à jour de auth.users (adresse remise,
--     changement d'adresse en attente annulé, identité email de GoTrue reprise sur l'adresse technique) ;
--     handle_new_user remet l'adresse technique juste après la création (le profil public.users reçoit d'abord
--     l'adresse passée à la création). Aucun déclencheur sur auth.identities (droit non établi sur un projet hébergé) :
--     une identité créée par GoTrue après le compte est reprise à la première mise à jour du compte (connexion
--     comprise) ; elle ne sert jamais à la connexion par mot de passe.
-- Objets :
--   schéma private ; table private.auth_login_key (clé, 32 octets) ; private.auth_login_alias(uuid) ;
--   private.auth_users_login_alias() (déclencheur on_auth_user_login_alias, BEFORE UPDATE ON auth.users) ;
--   recopie : handle_new_user (20261111000001_lot9quater_comptes.sql, section 3) ;
--   reprise des comptes existants, avec contrôles avant et après (échec explicite si un compte garde une autre adresse).
-- Aucun BEGIN ni COMMIT ; rejouable (la clé n'est tirée qu'une fois : rejouer ne change aucune adresse).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.auth_login_key (
    singleton  boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    secret     bytea NOT NULL CHECK (octet_length(secret) >= 32),
    created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.auth_login_key FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO private.auth_login_key (singleton, secret) VALUES (true, extensions.gen_random_bytes(32))
ON CONFLICT (singleton) DO NOTHING;
COMMENT ON TABLE private.auth_login_key IS
    'Lot 9 quinquies (contre-vérification, point 2) : clé secrète de l''empreinte qui donne l''identifiant GoTrue de chaque compte. Jamais exposée ; aucun droit pour anon, authenticated ni service_role.';

-- Identifiant GoTrue d'un compte : empreinte HMAC-SHA256 (40 premiers caractères hexadécimaux) de son identifiant
CREATE OR REPLACE FUNCTION private.auth_login_alias(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 'k' || left(encode(extensions.hmac(convert_to(lower(p_user::text), 'UTF8'), k.secret, 'sha256'), 'hex'), 40)
           || '@comptes.eventvillage.invalid'
      FROM private.auth_login_key k
     WHERE k.singleton;
$$;
REVOKE ALL ON FUNCTION private.auth_login_alias(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- auth.users : adresse technique à chaque mise à jour, quel que soit l'appelant (API d'administration, GoTrue, migration,
-- seed)
CREATE OR REPLACE FUNCTION private.auth_users_login_alias()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.email := private.auth_login_alias(NEW.id);
    IF COALESCE(NEW.email_change, '') <> '' THEN
        NEW.email_change := '';
    END IF;
    -- Identité email de GoTrue (créée après le compte) : adresse technique. Reprise ici (chaque connexion met auth.users à
    -- jour) plutôt que par un déclencheur sur auth.identities.
    UPDATE auth.identities i
       SET identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(NEW.email))
     WHERE i.user_id = NEW.id
       AND i.provider = 'email'
       AND i.identity_data->>'email' IS DISTINCT FROM NEW.email;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.auth_users_login_alias() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS on_auth_user_login_alias ON auth.users;
CREATE TRIGGER on_auth_user_login_alias
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION private.auth_users_login_alias();

-- ----------------------------------------------------------------------------
-- handle_new_user (recopie de 20261111000001_lot9quater_comptes.sql, section 3)
--   Changement : le profil reçoit l'adresse passée à la création, puis auth.users reçoit l'adresse technique (déclencheur
--   on_auth_user_login_alias).
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

    -- Contre-vérification du lot 9 quinquies (point 2) : identifiant GoTrue secret
    UPDATE auth.users SET email = private.auth_login_alias(NEW.id) WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Reprise des comptes existants, contrôles avant et après
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_total     integer;
    v_phone     integer;
    v_not_alias integer;
    v_profile   integer;
BEGIN
    SELECT count(*),
           count(*) FILTER (WHERE COALESCE(a.phone, '') <> ''),
           count(*) FILTER (WHERE a.email IS DISTINCT FROM private.auth_login_alias(a.id)),
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id AND lower(u.email) = lower(a.email)))
      INTO v_total, v_phone, v_not_alias, v_profile
      FROM auth.users a;
    RAISE NOTICE 'Identifiants GoTrue, avant : % compte(s), % avec un numéro, % sans l''adresse technique d''empreinte, % avec l''adresse du profil',
        v_total, v_phone, v_not_alias, v_profile;
END $$;

UPDATE auth.identities i
   SET identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(private.auth_login_alias(i.user_id))),
       provider_id = i.user_id::text
 WHERE i.provider = 'email'
   AND (i.identity_data->>'email' IS DISTINCT FROM private.auth_login_alias(i.user_id) OR i.provider_id IS DISTINCT FROM i.user_id::text);

UPDATE auth.users a
   SET email = private.auth_login_alias(a.id)
 WHERE a.email IS DISTINCT FROM private.auth_login_alias(a.id);

DO $$
DECLARE
    v_total     integer;
    v_phone     integer;
    v_not_alias integer;
    v_profile   integer;
    v_ident     integer;
BEGIN
    SELECT count(*),
           count(*) FILTER (WHERE COALESCE(a.phone, '') <> ''),
           count(*) FILTER (WHERE a.email IS DISTINCT FROM private.auth_login_alias(a.id)
                               OR a.email !~ '^k[0-9a-f]{40}@comptes\.eventvillage\.invalid$'),
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id AND lower(u.email) = lower(a.email)))
      INTO v_total, v_phone, v_not_alias, v_profile
      FROM auth.users a;
    SELECT count(*) INTO v_ident
      FROM auth.identities i
     WHERE i.provider = 'email' AND i.identity_data->>'email' IS DISTINCT FROM private.auth_login_alias(i.user_id);
    RAISE NOTICE 'Identifiants GoTrue, après : % compte(s), % avec un numéro (fournisseur Téléphone fermé), % sans l''adresse technique d''empreinte, % avec l''adresse du profil, % identité(s) email à reprendre',
        v_total, v_phone, v_not_alias, v_profile, v_ident;
    IF v_not_alias > 0 OR v_profile > 0 OR v_ident > 0 THEN
        RAISE EXCEPTION 'Contre-vérification, point 2 : reprise incomplète des identifiants GoTrue (adresses %, adresses du profil %, identités %)',
            v_not_alias, v_profile, v_ident;
    END IF;
END $$;

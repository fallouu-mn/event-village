-- ============================================================================
-- EVENT VILLAGE — LOT 12b, migration 01 : code de remise visible dans l'application, pour le client seul
-- ============================================================================
-- Décision 1 du client (21/11, docs/lot12a-rapport.md § 12) : « Au lot 12b, le client verra aussi son code dans
-- l'application, sur sa commande, compte connecté seulement : code gardé chiffré dans private, jamais lisible par la
-- partenaire ni le livreur, jamais en file, push ni email. »
-- Avant ce lot, seule l'empreinte HMAC du code est gardée (orders.code_hash, private.order_issue_code,
-- 20261130000006_l12a_etapes.sql:281-299) : le code n'existe en clair que dans la réponse de la fonction à la route,
-- qui l'envoie par SMS et l'efface.
--  1. clé de chiffrement private.order_code_enc_key (32 octets tirés une fois, distincte de la clé de l'empreinte),
--     lisible seulement par les fonctions en base (aucun rôle de l'API, pas même le rôle de service) ;
--  2. table private.order_codes (commande, code chiffré, empreinte au moment de l'émission, heure) : aucun droit pour un
--     rôle de l'API ; le schéma private n'est pas exposé ;
--  3. private.order_issue_code : SEULE recopie du lot, depuis sa dernière définition
--     (20261130000006_l12a_etapes.sql:281-299, aucune redéfinition depuis) ; ajout : le code tiré est aussi écrit chiffré
--     dans private.order_codes (une ligne par commande, remplacée à chaque nouveau code) ;
--  4. déclencheur private.order_codes_clear (après mise à jour de orders.code_hash) : code effacé dès que l'empreinte
--     repasse à vide (remise : 20261130000006:419 ; fin de la commande : 20261130000006:160) ou change sans nouvelle
--     émission ; aucune fonction existante n'est recopiée pour l'effacement ;
--  5. order_code_reveal(p) : lecture du code par le client connecté de la commande (compte actif), commande ouverte et
--     en attente de remise (prête à retirer, en route), code émis et toujours valable (empreinte vérifiée) ; jamais pour
--     la partenaire, le livreur ni l'administration ; aucune trace du code dans le journal.
-- Rejouable : CREATE … IF NOT EXISTS, clé tirée une seule fois (ON CONFLICT DO NOTHING), CREATE OR REPLACE,
-- DROP TRIGGER IF EXISTS puis CREATE, REVOKE et GRANT idempotents. Aucun BEGIN ni COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clé de chiffrement du code
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.order_code_enc_key (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    secret BYTEA NOT NULL CHECK (octet_length(secret) >= 32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.order_code_enc_key FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO private.order_code_enc_key (singleton, secret) VALUES (TRUE, extensions.gen_random_bytes(32))
ON CONFLICT (singleton) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Codes chiffrés (une ligne par commande, tant que le code vaut)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.order_codes (
    order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    code_enc BYTEA NOT NULL,
    code_hash TEXT NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.order_codes FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE private.order_codes IS
    'Lot 12b : code de remise chiffré (pgp_sym_encrypt, clé private.order_code_enc_key), lu seulement par order_code_reveal pour le client de la commande ; effacé quand orders.code_hash repasse à vide ou change.';

-- Chiffrement et déchiffrement : la clé n'est lue que par ces deux aides
CREATE OR REPLACE FUNCTION private.order_code_encrypt(p_code text)
RETURNS bytea
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT extensions.pgp_sym_encrypt(p_code, encode(k.secret, 'hex'), 'cipher-algo=aes256')
      FROM private.order_code_enc_key k WHERE k.singleton;
$$;

CREATE OR REPLACE FUNCTION private.order_code_decrypt(p_enc bytea)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT extensions.pgp_sym_decrypt(p_enc, encode(k.secret, 'hex'))
      FROM private.order_code_enc_key k WHERE k.singleton;
$$;

-- ----------------------------------------------------------------------------
-- 3. Émission d'un code : recopie de 20261130000006_l12a_etapes.sql:281-299 (dernière définition) ; ajout : le code
--    est aussi écrit chiffré dans private.order_codes
-- ----------------------------------------------------------------------------
-- Nouveau code à 4 chiffres (tirage cryptographique) ; seule son empreinte est gardée ; essais remis à zéro
CREATE OR REPLACE FUNCTION private.order_issue_code(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    b      bytea := extensions.gen_random_bytes(4);
    v_code text;
    v_hash text;
BEGIN
    v_code := lpad((((get_byte(b, 0)::bigint << 24) | (get_byte(b, 1) << 16) | (get_byte(b, 2) << 8) | get_byte(b, 3)) % 10000)::text, 4, '0');
    PERFORM set_config('event_village.order_flow', 'on', true);
    UPDATE public.orders
       SET code_hash = private.order_code_hash(id, v_code), code_issued_at = now(), code_attempts = 0, updated_at = now()
     WHERE id = p_order_id;
    SELECT code_hash INTO v_hash FROM public.orders WHERE id = p_order_id;
    -- Lot 12b : code visible par le client dans sa commande (décision 1 du 21/11), gardé chiffré ; l'ancien est remplacé
    IF v_hash IS NOT NULL THEN
        INSERT INTO private.order_codes (order_id, code_enc, code_hash, issued_at)
        VALUES (p_order_id, private.order_code_encrypt(v_code), v_hash, now())
        ON CONFLICT (order_id) DO UPDATE SET code_enc = EXCLUDED.code_enc, code_hash = EXCLUDED.code_hash, issued_at = EXCLUDED.issued_at;
    END IF;
    RETURN v_code;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Effacement : dès que l'empreinte de la commande repasse à vide (remise, fin) ou ne correspond plus au code gardé
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.order_codes_clear()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM private.order_codes c
     WHERE c.order_id = NEW.id AND (NEW.code_hash IS NULL OR c.code_hash IS DISTINCT FROM NEW.code_hash);
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_z_order_codes_clear ON public.orders;
CREATE TRIGGER trg_z_order_codes_clear
    AFTER UPDATE OF code_hash ON public.orders
    FOR EACH ROW
    WHEN (NEW.code_hash IS DISTINCT FROM OLD.code_hash)
    EXECUTE FUNCTION private.order_codes_clear();

-- ----------------------------------------------------------------------------
-- 5. Lecture du code par le client de la commande
-- ----------------------------------------------------------------------------
-- p : order_id, client_id (compte de la session, jamais lu dans la requête). Rend { ok, code, issued_at, locked,
-- resends_left } ou { ok: false, code, message } ; une commande d'un autre compte répond « introuvable ».
CREATE OR REPLACE FUNCTION public.order_code_reveal(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_client   uuid := public.try_uuid(p->>'client_id');
    o          record;
    c          record;
    v_code     text;
BEGIN
    IF v_order_id IS NULL OR v_client IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT id, client_id, venue_id, order_state, delivery_mode::text AS mode, code_hash, code_attempts, code_resends, closed_at
      INTO o FROM public.orders WHERE id = v_order_id;
    IF NOT FOUND OR o.venue_id IS NULL OR o.client_id <> v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    -- Commande ouverte et en attente de remise : prête à retirer, ou en route
    IF o.closed_at IS NOT NULL OR o.code_hash IS NULL
       OR NOT ((o.mode = 'RETRAIT' AND o.order_state = 'PRETE') OR (o.mode = 'LIVRAISON' AND o.order_state = 'EN_ROUTE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CODE_YET',
            'message', 'Le code apparaît quand la commande est prête à retirer ou en route.');
    END IF;
    SELECT code_enc, code_hash, issued_at INTO c FROM private.order_codes WHERE order_id = o.id;
    IF NOT FOUND OR c.code_hash IS DISTINCT FROM o.code_hash THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CODE_NOT_AVAILABLE',
            'message', 'Ce code n’est plus affichable : demandez un nouveau code, il s’affichera ici.');
    END IF;
    v_code := private.order_code_decrypt(c.code_enc);
    -- Défense en profondeur : jamais un code qui ne correspond plus à l'empreinte de la commande
    IF v_code IS NULL OR v_code !~ '^[0-9]{4}$' OR private.order_code_hash(o.id, v_code) IS DISTINCT FROM o.code_hash THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CODE_NOT_AVAILABLE',
            'message', 'Ce code n’est plus affichable : demandez un nouveau code, il s’affichera ici.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'code', v_code, 'issued_at', c.issued_at,
        'locked', o.code_attempts >= public.fin_setting_num('orders.code_max_attempts')::int,
        'resends_left', GREATEST(public.fin_setting_num('orders.code_resend_max')::int - o.code_resends, 0));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Droits : aides privées à aucun rôle de l'API ; lecture du code au rôle de service seulement (route serveur)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.order_code_encrypt(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_code_decrypt(bytea) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_issue_code(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_codes_clear() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_code_reveal(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_code_reveal(jsonb) TO service_role;

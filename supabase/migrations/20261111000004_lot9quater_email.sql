-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUATER : adresse email en attente (A9 ; AUD-34)
-- ============================================================================
-- AUD-34 : quand un compte valide une adresse, les autres comptes qui l'attendaient la perdaient sans le savoir
--   (20261109000010_lot9bis_email.sql:1038-1040) : une victime qui clique un lien qu'elle n'a pas demandé rattachait
--   son adresse au compte d'un tiers et perdait sa propre attente. Désormais l'attente des autres comptes reste ; elle
--   n'est retirée qu'à la confirmation par son titulaire (son lien répond EMAIL_TAKEN, retrait existant) ; chaque
--   titulaire est prévenu (type EMAIL_CLAIMED_ELSEWHERE : cloche et SMS, ESSENTIAL, sans l'adresse).
-- Objets : registre EMAIL_CLAIMED_ELSEWHERE ; recopie email_verification_finalize
--   (20261109000010_lot9bis_email.sql:965-1049), changement indiqué au-dessus du bloc remplacé. Droits inchangés
--   (CREATE OR REPLACE ; service_role seul, 20261109000010:1049-1064).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('EMAIL_CLAIMED_ELSEWHERE',    'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS'],                 'ANY',        'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- ----------------------------------------------------------------------------
-- email_verification_finalize (recopie de 20261109000010_lot9bis_email.sql:965-1049)
-- Changement : l'attente de la même adresse sur d'autres comptes n'est plus retirée ni ses liens fermés ; avis
-- EMAIL_CLAIMED_ELSEWHERE à chacun de ces comptes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_verification_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hash     text := lower(btrim(COALESCE(p->>'token_hash', '')));
    v_expected text := p->>'expected_email';
    v_user     uuid;
    v_target   text;
    v_link     record;
    v_email    text;
    v_pending  text;
    v_verified timestamptz;
    v_role     text;
    v_now      timestamptz;
BEGIN
    IF v_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;
    SELECT l.user_id, l.email INTO v_user, v_target FROM public.email_verifications l WHERE l.token_hash = v_hash;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;

    -- Comptes d'abord, dans un seul ordre : deux validations de la même adresse se suivent, sans interblocage.
    PERFORM 1 FROM public.users u
      WHERE u.id = v_user OR u.email_pending = v_target
      ORDER BY u.id
        FOR UPDATE;
    SELECT l.id, l.used_at, l.superseded_at, l.expires_at INTO v_link
      FROM public.email_verifications l WHERE l.token_hash = v_hash
       FOR UPDATE;
    v_now := clock_timestamp();
    SELECT u.email, u.email_pending, u.email_verified_at, u.role::text INTO v_email, v_pending, v_verified, v_role
      FROM public.users u WHERE u.id = v_user;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;

    IF v_link.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_USED');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users o WHERE o.id <> v_user AND lower(o.email) = v_target) THEN
        UPDATE public.users SET email_pending = NULL WHERE id = v_user AND email_pending = v_target;
        UPDATE public.email_verifications SET superseded_at = v_now WHERE id = v_link.id AND superseded_at IS NULL;
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
    END IF;
    IF v_link.superseded_at IS NOT NULL
       OR NOT (v_pending = v_target
               OR (v_pending IS NULL AND v_verified IS NULL AND lower(COALESCE(v_email, '')) = v_target)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;
    IF v_link.expires_at <= v_now THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_EXPIRED');
    END IF;
    IF v_email IS DISTINCT FROM v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_CONFLICT');
    END IF;

    UPDATE public.users
       SET email = v_target, email_verified_at = v_now, email_pending = NULL
     WHERE id = v_user;
    UPDATE public.email_verifications SET used_at = v_now WHERE id = v_link.id;
    UPDATE public.email_verifications
       SET superseded_at = v_now
     WHERE user_id = v_user AND id <> v_link.id AND used_at IS NULL AND superseded_at IS NULL;
    -- Lot 9 quater (A9 : AUD-34) : la même adresse en attente sur d'autres comptes (tenus plus haut) n'est PAS retirée
    -- ici : elle ne l'est qu'à la confirmation par leur titulaire (son lien répond alors EMAIL_TAKEN et retire
    -- l'attente). Chaque titulaire est prévenu (EMAIL_CLAIMED_ELSEWHERE, cloche et SMS, sans l'adresse).
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'EMAIL_CLAIMED_ELSEWHERE',
        'key', 'EMAIL_CLAIMED_ELSEWHERE:' || o.id::text || ':' || v_link.id::text,
        'user_id', o.id,
        'data', '{}'::jsonb))
      FROM public.users o
     WHERE o.id <> v_user AND o.email_pending = v_target;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_EMAIL_VERIFIED', 'users', v_user, jsonb_build_object('verification_id', v_link.id));

    RETURN jsonb_build_object('ok', true, 'user_id', v_user);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
END;
$$;

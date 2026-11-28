-- ============================================================================
-- EVENT VILLAGE — LOT « AVIS », PHASE 2 : CORRECTIF T4 DE LA CONTRE-VÉRIFICATION (docs/audit-avis-phase2.md)
-- ============================================================================
-- Constat : l'avis d'anonymisation (ACCOUNT_ANONYMIZATION_NOTICE, D8) écrit le numéro du compte dans la boîte d'envoi
-- (recipient_phone de chaque ligne) ; l'anonymisation efface le numéro et l'adresse du profil sans toucher la boîte d'envoi :
-- le numéro « effacé » reste lisible, et une reprise de l'envoyeur l'utiliserait encore. La garde de la boîte d'envoi
-- (notification_outbox_guard) interdit de changer le destinataire d'une ligne terminée : une mise à jour directe est refusée.
--
-- Correctif :
--  1. notification_outbox_guard — recopie de 20261103000002_lot6_outbox.sql:233-260 : sous la GUC de transaction
--     notif.anonymize = on (posée par la fonction 2 seulement), le numéro et l'adresse d'une ligne terminée peuvent être
--     VIDÉS (NULL), rien d'autre : ni la clé, ni le compte, ni une autre valeur ;
--  2. public.notification_outbox_anonymize(compte) — nouvelle, rôle de service seulement (appelée par
--     AdminService.anonymizeUser à la fin de l'anonymisation) : refusée si le compte n'est pas anonymisé (adresse
--     technique <id>@deleted.eventvillage.sn) ; lignes du compte encore en attente ou en cours d'envoi → annulées (motif
--     ACCOUNT_ANONYMIZED : une seule tentative pour l'avis, aucune reprise après l'effacement) ; numéro et adresse retirés
--     de toutes les lignes du compte.
-- Recopie : ajouts seuls, aucune ligne de la dernière définition retirée (tests/schema/migration-avis2-rejouable.test.ts).
-- Sans BEGIN ni COMMIT, rejouable (CREATE OR REPLACE) ; aucune donnée écrite par la migration.
-- ============================================================================

-- 1. Garde de la boîte d'envoi (recopie de 20261103000002_lot6_outbox.sql:233-260)
-- Garde des statuts, valable pour le service_role : une ligne terminée (SENT, SKIPPED, CANCELLED,
-- UNCERTAIN) ne change plus de statut, de clé ni de destinataire ; une ligne FAILED ne repart (PENDING)
-- que par la relance manuelle (GUC de transaction notif.manual_retry = on, posée par notification_retry).
CREATE OR REPLACE FUNCTION public.notification_outbox_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IN ('SENT', 'SKIPPED', 'CANCELLED', 'UNCERTAIN', 'FAILED') THEN
        -- Avis phase 2 (correctif T4) : anonymisation d'un compte, numéro et adresse seulement vidés (jamais remplacés)
        IF COALESCE(current_setting('notif.anonymize', true), '') = 'on'
           AND NEW.idempotency_key IS NOT DISTINCT FROM OLD.idempotency_key
           AND NEW.recipient_user_id IS NOT DISTINCT FROM OLD.recipient_user_id
           AND (NEW.recipient_phone IS NULL OR NEW.recipient_phone IS NOT DISTINCT FROM OLD.recipient_phone)
           AND (NEW.recipient_email IS NULL OR NEW.recipient_email IS NOT DISTINCT FROM OLD.recipient_email) THEN
            NULL;
        ELSE
        IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
           OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
           OR NEW.recipient_phone IS DISTINCT FROM OLD.recipient_phone
           OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email THEN
            RAISE EXCEPTION USING ERRCODE = 'NT409', MESSAGE = 'Une notification terminée ne change plus.';
        END IF;
        END IF;
    END IF;
    IF OLD.status IN ('SENT', 'SKIPPED', 'CANCELLED', 'UNCERTAIN') AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION USING ERRCODE = 'NT409', MESSAGE = 'Une notification terminée ne change plus.';
    END IF;
    IF OLD.status = 'FAILED' AND NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status <> 'PENDING' OR COALESCE(current_setting('notif.manual_retry', true), '') <> 'on' THEN
            RAISE EXCEPTION USING ERRCODE = 'NT409',
                MESSAGE = 'Une notification en échec ne repart que par une relance manuelle.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notification_outbox_guard() FROM PUBLIC, anon, authenticated;

-- 2. Boîte d'envoi d'un compte anonymisé
CREATE OR REPLACE FUNCTION public.notification_outbox_anonymize(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cancelled integer;
    v_cleared   integer;
BEGIN
    IF p_user IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = p_user AND u.email = p_user::text || '@deleted.eventvillage.sn') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'NOT_ANONYMIZED');
    END IF;
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'ACCOUNT_ANONYMIZED', finished_at = now()
     WHERE recipient_user_id = p_user AND status IN ('PENDING', 'SENDING');
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
    PERFORM set_config('notif.anonymize', 'on', true);
    UPDATE public.notification_outbox
       SET recipient_phone = NULL, recipient_email = NULL
     WHERE recipient_user_id = p_user AND (recipient_phone IS NOT NULL OR recipient_email IS NOT NULL);
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
    PERFORM set_config('notif.anonymize', '', true);
    RETURN jsonb_build_object('ok', true, 'cancelled', v_cancelled, 'cleared', v_cleared);
END;
$$;
REVOKE ALL ON FUNCTION public.notification_outbox_anonymize(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_outbox_anonymize(uuid) TO service_role;

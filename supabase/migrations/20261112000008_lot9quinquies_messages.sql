-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : messages de sécurité du compte (C2 : AUTH-09 ; C3 : AUTH-12)
-- ============================================================================
-- C2 (décision du chef de projet) : quand une nouvelle adresse email est vérifiée, SMS indispensable au numéro du compte
--   « Event Village : une adresse email a été ajoutée à votre compte. Si ce n'est pas vous : {lien}/aide » (type
--   EMAIL_ADDED, avec un email de confirmation à l'adresse désormais vérifiée). Déclencheur sur la consommation du lien
--   de vérification (email_verifications.used_at), posée seulement par email_verification_finalize : le vrai parcours.
--   En cas de changement, l'email à l'ANCIENNE adresse vérifiée part de POST /api/account/email/verify (Resend, envoi
--   synchrone), qui lit l'ancienne adresse avant la validation.
-- C3 : accusé de réception de la partenaire aussi par SMS (PARTNER_REGISTERED_ACK : + SMS) ; texte « Event Village :
--   votre demande de compte partenaire {société} est enregistrée. Réponse sous 48 h. » (« reçue » : ç hors GSM-7).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('EMAIL_ADDED',                'ESSENTIAL', NULL,            ARRAY['SMS','EMAIL'],                  'ANY',        'BLOCK', FALSE, NULL),
    ('PARTNER_REGISTERED_ACK',     'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'PARTNER',    'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

CREATE OR REPLACE FUNCTION public.notif_email_verification_used()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.used_at IS NULL AND NEW.used_at IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.email_verified_at IS NOT NULL
                     AND NOT public.is_technical_email(u.email)) THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'EMAIL_ADDED',
            'key', 'EMAIL_ADDED:' || NEW.user_id::text || ':' || NEW.id::text,
            'user_id', NEW.user_id,
            'data', '{}'::jsonb
        ));
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.notif_email_verification_used() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_verification_used ON public.email_verifications;
CREATE TRIGGER trg_email_verification_used
    AFTER UPDATE OF used_at ON public.email_verifications
    FOR EACH ROW EXECUTE FUNCTION public.notif_email_verification_used();

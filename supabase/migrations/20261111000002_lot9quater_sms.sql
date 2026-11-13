-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUATER : coût des SMS (A8 ; AUD-05)
-- ============================================================================
-- A8 (AUD-05) : les codes vers un numéro SANS compte (inscription, connexion d'un numéro inconnu) ont leur propre part
--   quotidienne (lib/sms/sms-guard.ts, compteur sms_otp_new_number, SMS_OTP_NEW_NUMBER_DAILY_CAP) qui ne tire plus sur
--   le plafond global : des inscriptions en masse ne bloquent plus les codes des comptes existants. Quand cette part
--   est atteinte, les administrateurs sont prévenus une fois par jour : type ADMIN_SMS_CAP_NEW_NUMBERS.
-- Objets :
--   registre : ADMIN_SMS_CAP_NEW_NUMBERS (ESSENTIAL, IN_APP + EMAIL, ADMIN, permission notifications.read, comme
--              ADMIN_SMS_CAP_GLOBAL et ADMIN_SMS_CAP_NON_OTP, 20261109000003_lot9bis_registre.sql:118-119) ;
--   recopie : notification_admin_alert (20261103000002_lot6_outbox.sql:727-745), changement : le type
--             ADMIN_SMS_CAP_NEW_NUMBERS est admis.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('ADMIN_SMS_CAP_NEW_NUMBERS',  'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'notifications.read')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- ----------------------------------------------------------------------------
-- notification_admin_alert (recopie de 20261103000002_lot6_outbox.sql:727-745)
-- Changement : ADMIN_SMS_CAP_NEW_NUMBERS admis (part quotidienne des codes vers un numéro sans compte atteinte).
-- ----------------------------------------------------------------------------
-- Alerte de plafond SMS (lib/sms/sms-guard.ts, raiseCapAlert) : mise en file pour les admins, une fois par
-- jour (la clé porte le jour).
CREATE OR REPLACE FUNCTION public.notification_admin_alert(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type text := p->>'type';
    v_ref  text := p->>'ref';
    v_n    integer;
BEGIN
    IF v_type IS NULL OR v_type NOT IN ('ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP', 'ADMIN_SMS_CAP_NEW_NUMBERS') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TYPE', 'message', 'Type d''alerte inconnu.');
    END IF;
    IF v_ref IS NULL OR v_ref !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Jour de l''alerte invalide (AAAA-MM-JJ).');
    END IF;
    v_n := public.notif_enqueue_admins(jsonb_build_object('type', v_type, 'ref', v_ref, 'data', COALESCE(p->'data', '{}'::jsonb)));
    RETURN jsonb_build_object('ok', true, 'created', v_n);
END;
$$;

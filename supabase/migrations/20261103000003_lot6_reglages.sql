-- ============================================================================
-- EVENT VILLAGE — LOT 6 : réglages des notifications (tâche 6.5, contrat I1)
-- ============================================================================
-- Idempotente : peut être rejouée sans effet de bord.
--  1. Les 9 clés notif.* (rappels J-1 et H-3, politique SMS des rappels, plage sans SMS optionnel, seuil
--     d'alerte du volume de SMS du jour), même mécanisme historisé que finance.* (lot 3) et access.*
--     (lot 4) : valeur {"value": …}, validation fin_setting_valid, écriture finance_setting_set
--     (SUPERADMIN actif seulement), historique par trigger (platform_settings_audit).
--  2. fin_setting_valid : recopie intégrale de 20261102000006_lot5_temps_reel.sql, plus les clés notif.*
--     (2 booléens, 2 choix, 5 entiers bornés). Début = fin de la plage sans SMS est admis : plage vide.
--  3. finance_setting_set : recopie intégrale de 20261102000006_lot5_temps_reel.sql, plus les 9 clés dans
--     la liste blanche ; message FORBIDDEN générique.
--  4. Politique platform_settings_admin_write : un ADMIN connecté n'écrit plus aucune clé notif.* par REST
--     (comme finance.* et access.*).
--  5. Privilèges des deux fonctions réappliqués (service_role seul).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clés et valeurs par défaut
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('notif.reminder_j1_enabled', '{"value": true}',
        'Rappel envoyé la veille du début de l''événement aux porteurs d''un billet valide (true : activé)'),
    ('notif.reminder_j1_hour', '{"value": 10}',
        'Heure du rappel de la veille, heure de Dakar (entier de 6 à 20)'),
    ('notif.reminder_h3_enabled', '{"value": true}',
        'Rappel envoyé quelques heures avant le début de l''événement (true : activé)'),
    ('notif.reminder_h3_hours', '{"value": 3}',
        'Nombre d''heures avant le début pour le rappel du jour même (entier de 1 à 12)'),
    ('notif.j1_sms', '{"value": "ALWAYS"}',
        'SMS du rappel de la veille : ALWAYS (toujours), IF_NO_PUSH (seulement si aucune notification push n''a été remise), NEVER (jamais)'),
    ('notif.h3_sms', '{"value": "IF_NO_PUSH"}',
        'SMS du rappel avant le début : ALWAYS (toujours), IF_NO_PUSH (seulement si aucune notification push n''a été remise), NEVER (jamais)'),
    ('notif.sms_quiet_start', '{"value": 22}',
        'Début de la plage sans SMS optionnel, heure de Dakar (entier de 0 à 23 ; début = fin : aucune plage)'),
    ('notif.sms_quiet_end', '{"value": 8}',
        'Fin de la plage sans SMS optionnel, heure de Dakar (entier de 0 à 23 ; début = fin : aucune plage)'),
    ('notif.sms_daily_alert', '{"value": 2000}',
        'Seuil du nombre de SMS du jour (codes compris) au-delà duquel les administrateurs sont alertés (entier de 1 à 1 000 000)')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Validation (reprise de 20261102000006_lot5_temps_reel.sql, plus les clés notif.*)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fin_setting_valid(p_key text, v jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    n numeric;
BEGIN
    IF v IS NULL THEN RETURN FALSE; END IF;
    IF p_key IN ('finance.payout_hold_enabled', 'finance.withdrawal_bank_enabled', 'access.counter_sale_enabled',
                 'notif.reminder_j1_enabled', 'notif.reminder_h3_enabled') THEN
        RETURN jsonb_typeof(v) = 'boolean';
    END IF;
    IF p_key = 'access.manual_entry_scope' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('ASSIGNED_CONTROLLER', 'STAFF');
    END IF;
    IF p_key = 'finance.cancellation_aggregator_fee_bearer' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('EVENT_VILLAGE', 'ORGANISATEUR');
    END IF;
    IF p_key IN ('notif.j1_sms', 'notif.h3_sms') THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('ALWAYS', 'IF_NO_PUSH', 'NEVER');
    END IF;
    IF jsonb_typeof(v) <> 'number' THEN RETURN FALSE; END IF;
    n := (v #>> '{}')::numeric;
    RETURN CASE p_key
        WHEN 'finance.service_fee_rate' THEN n >= 0 AND n <= 50
        WHEN 'finance.aggregator_fee_rate.WAVE' THEN n >= 0 AND n <= 10
        WHEN 'finance.aggregator_fee_rate.ORANGE_MONEY' THEN n >= 0 AND n <= 10
        WHEN 'finance.payout_delay_hours' THEN n = trunc(n) AND n >= 0 AND n <= 720
        WHEN 'finance.withdrawal_fee_rate' THEN n >= 0 AND n <= 10
        WHEN 'finance.withdrawal_min_amount' THEN n = trunc(n) AND n >= 0 AND n <= 10000000
        WHEN 'finance.referral_availability_days' THEN n = trunc(n) AND n >= 7 AND n <= 14
        WHEN 'access.scan_window_before_hours' THEN n = trunc(n) AND n >= 0 AND n <= 48
        WHEN 'access.scan_window_after_hours' THEN n = trunc(n) AND n >= 0 AND n <= 48
        WHEN 'access.low_stock_threshold' THEN n = trunc(n) AND n >= 1 AND n <= 1000
        WHEN 'notif.reminder_j1_hour' THEN n = trunc(n) AND n >= 6 AND n <= 20
        WHEN 'notif.reminder_h3_hours' THEN n = trunc(n) AND n >= 1 AND n <= 12
        WHEN 'notif.sms_quiet_start' THEN n = trunc(n) AND n >= 0 AND n <= 23
        WHEN 'notif.sms_quiet_end' THEN n = trunc(n) AND n >= 0 AND n <= 23
        WHEN 'notif.sms_daily_alert' THEN n = trunc(n) AND n >= 1 AND n <= 1000000
        ELSE FALSE END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Écriture (reprise de 20261102000006_lot5_temps_reel.sql, plus les clés notif.* dans la liste)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_setting_set(p_key text, p_value jsonb, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := p_value->'value';
BEGIN
    IF p_key IS NULL OR p_key NOT IN (
        'finance.service_fee_rate', 'finance.aggregator_fee_rate.WAVE', 'finance.aggregator_fee_rate.ORANGE_MONEY',
        'finance.cancellation_aggregator_fee_bearer', 'finance.payout_hold_enabled', 'finance.payout_delay_hours',
        'finance.withdrawal_fee_rate', 'finance.withdrawal_min_amount', 'finance.withdrawal_bank_enabled',
        'finance.referral_availability_days', 'access.manual_entry_scope', 'access.scan_window_before_hours',
        'access.scan_window_after_hours', 'access.counter_sale_enabled', 'access.low_stock_threshold',
        'notif.reminder_j1_enabled', 'notif.reminder_j1_hour', 'notif.reminder_h3_enabled', 'notif.reminder_h3_hours',
        'notif.j1_sms', 'notif.h3_sms', 'notif.sms_quiet_start', 'notif.sms_quiet_end', 'notif.sms_daily_alert') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_KEY', 'message', 'Réglage inconnu.');
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un SUPERADMIN actif modifie les réglages de la plateforme.');
    END IF;
    IF NOT public.fin_setting_valid(p_key, v) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_VALUE', 'message', format('Valeur refusée pour %s : %s', p_key, COALESCE(v::text, 'absente')));
    END IF;
    PERFORM set_config('finance.change_reason', COALESCE(p_reason, ''), true);
    INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
    VALUES (p_key, jsonb_build_object('value', v), p_actor, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'key', p_key, 'value', v);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Écriture REST d'un admin : jamais une clé finance.*, access.* ni notif.*
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
    FOR ALL
    USING (is_admin() AND key NOT LIKE 'finance.%' AND key NOT LIKE 'access.%' AND key NOT LIKE 'notif.%')
    WITH CHECK (is_admin() AND key NOT LIKE 'finance.%' AND key NOT LIKE 'access.%' AND key NOT LIKE 'notif.%');

-- ----------------------------------------------------------------------------
-- 5. Privilèges : service_role uniquement
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_setting_valid(text, jsonb)',
        'public.finance_setting_set(text, jsonb, uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

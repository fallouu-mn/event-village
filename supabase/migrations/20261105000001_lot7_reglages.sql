-- ============================================================================
-- EVENT VILLAGE — LOT 7 : réglages SUPERADMIN du lot (tâches 7.0 a, 7.0 b, 7.3 ; contrat M1)
-- ============================================================================
-- Idempotente : peut être rejouée sans effet de bord (aucun BEGIN ni COMMIT ; ON CONFLICT DO NOTHING,
-- CREATE OR REPLACE, DROP POLICY IF EXISTS).
-- Seule migration du lot qui recopie fin_setting_valid et finance_setting_set : elle porte TOUTES les clés
-- nouvelles du lot 7 (aucun conflit entre tâches, contrat section 2).
--  1. Clés et valeurs par défaut, même mécanisme historisé que finance.* (lot 3), access.* (lot 4) et notif.*
--     (lot 6) : valeur {"value": …}, validation fin_setting_valid, écriture finance_setting_set (SUPERADMIN
--     actif seulement), historique par trigger (trg_platform_settings_audit) :
--       - notif.sms_optional_daily_cap (700) : budget des SMS optionnels par jour de Dakar (7.0 a, D13) ;
--       - notif.free_ticket_reminder_sms (NEVER) : SMS des rappels d'un porteur de billets gratuits (7.0 b, D17) ;
--       - features.halls_enabled, features.tables_enabled, features.orders_enabled (false) : interrupteurs des
--         services hors billetterie (7.3, D55).
--  2. notif.sms_daily_alert supprimée (D15) : la suppression est historisée par trg_platform_settings_audit
--     (motif « suppression ») ; le type ADMIN_SMS_DAILY_THRESHOLD reste au registre (lignes déjà écrites).
--  3. fin_setting_valid : recopie intégrale de 20261103000003_lot6_reglages.sql, plus les clés du lot 7
--     (3 booléens, 1 choix, 1 entier borné), moins la branche notif.sms_daily_alert. IMMUTABLE conservé.
--  4. finance_setting_set : recopie intégrale de 20261103000003_lot6_reglages.sql ; liste blanche = celle du
--     lot 6 − notif.sms_daily_alert + les 5 clés du lot 7.
--  5. Politique platform_settings_admin_write : un ADMIN connecté n'écrit plus aucune clé features.* par REST
--     (comme finance.*, access.* et notif.*). La lecture reste ouverte (platform_settings_read).
--  6. Privilèges des deux fonctions réappliqués (service_role seul).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clés et valeurs par défaut
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('notif.sms_optional_daily_cap', '{"value": 700}',
        'Nombre maximal de SMS optionnels (rappels, changements, signaux des pros) envoyés par jour de Dakar ; au-delà : non envoyés (entier de 0 à 1 000 000 ; 0 : aucun SMS optionnel)'),
    ('notif.free_ticket_reminder_sms', '{"value": "NEVER"}',
        'SMS des rappels pour un porteur qui ne détient que des billets gratuits ou des invitations : NEVER (jamais) ou SAME_AS_PAID (comme un billet payant)'),
    ('features.halls_enabled', '{"value": false}',
        'Salles de fête visibles et utilisables (true : activé)'),
    ('features.tables_enabled', '{"value": false}',
        'Réservation de tables visible et utilisable (true : activé)'),
    ('features.orders_enabled', '{"value": false}',
        'Commandes de repas visibles et utilisables (true : activé)')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Clé retirée (D15) : historisée « suppression » par trg_platform_settings_audit ; rejouée, ne fait rien
-- ----------------------------------------------------------------------------
DELETE FROM public.platform_settings WHERE key = 'notif.sms_daily_alert';

-- ----------------------------------------------------------------------------
-- 3. Validation (reprise de 20261103000003_lot6_reglages.sql, plus les clés du lot 7)
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
                 'notif.reminder_j1_enabled', 'notif.reminder_h3_enabled',
                 'features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled') THEN
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
    IF p_key = 'notif.free_ticket_reminder_sms' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('NEVER', 'SAME_AS_PAID');
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
        WHEN 'notif.sms_optional_daily_cap' THEN n = trunc(n) AND n >= 0 AND n <= 1000000
        ELSE FALSE END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Écriture (reprise de 20261103000003_lot6_reglages.sql ; liste blanche du lot 7)
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
        'notif.j1_sms', 'notif.h3_sms', 'notif.sms_quiet_start', 'notif.sms_quiet_end',
        'notif.sms_optional_daily_cap', 'notif.free_ticket_reminder_sms',
        'features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled') THEN
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
-- 5. Écriture REST d'un admin : jamais une clé finance.*, access.*, notif.* ni features.*
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
    FOR ALL
    USING (is_admin() AND key NOT LIKE 'finance.%' AND key NOT LIKE 'access.%' AND key NOT LIKE 'notif.%'
           AND key NOT LIKE 'features.%')
    WITH CHECK (is_admin() AND key NOT LIKE 'finance.%' AND key NOT LIKE 'access.%' AND key NOT LIKE 'notif.%'
                AND key NOT LIKE 'features.%');

-- ----------------------------------------------------------------------------
-- 6. Privilèges : service_role uniquement
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

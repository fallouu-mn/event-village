-- ============================================================================
-- EVENT VILLAGE — LOT 3 : réglages financiers historisés (3.1, 3.5, 3.6, 3.7)
-- ============================================================================
-- Les décisions client ne sont pas validées : valeurs par défaut réglables par le SUPERADMIN.
--  - platform_settings_history : toute modification de platform_settings est historisée (trigger).
--  - Clés finance.* : écrites uniquement par finance_setting_set (SUPERADMIN, valeur validée) ;
--    un ADMIN ne peut plus les écrire directement.
--  - Jamais rétroactif : les valeurs sont recopiées sur chaque ligne au moment où elle naît
--    (paiement, commission, retrait, remboursement) ; changer un réglage ne modifie rien d'existant.
--  - fin_setting lève une exception si une clé manque : aucune valeur de repli dans le code.
-- ============================================================================

-- ── Historique ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings_history (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_settings_history_key ON public.platform_settings_history (key, changed_at DESC);
ALTER TABLE public.platform_settings_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_settings_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_settings_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_settings_history_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.platform_settings_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.platform_settings_history (key, old_value, new_value, changed_by, reason)
        VALUES (NEW.key, NULL, NEW.value, NEW.updated_by, NULLIF(current_setting('finance.change_reason', true), ''));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.value IS DISTINCT FROM OLD.value THEN
            INSERT INTO public.platform_settings_history (key, old_value, new_value, changed_by, reason)
            VALUES (NEW.key, OLD.value, NEW.value, NEW.updated_by, NULLIF(current_setting('finance.change_reason', true), ''));
        END IF;
        RETURN NEW;
    END IF;
    INSERT INTO public.platform_settings_history (key, old_value, new_value, changed_by, reason)
    VALUES (OLD.key, OLD.value, NULL, NULL, 'suppression');
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_audit ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.platform_settings
    FOR EACH ROW EXECUTE FUNCTION public.platform_settings_audit();

-- ── Valeurs par défaut (forme {"value": …}) ─────────────────────────────────
-- Taux de service : celui en vigueur (ticketing_fee_config), 5 % selon l'Annexe C du CDC.
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('finance.service_fee_rate',
        jsonb_build_object('value', COALESCE((SELECT (value->>'service_fee_rate')::numeric FROM public.platform_settings WHERE key = 'ticketing_fee_config'), 5)),
        'Frais de service payés par l''acheteur (% du prix facial, arrondis au FCFA supérieur par billet)'),
    ('finance.aggregator_fee_rate.WAVE', '{"value": 1.5}', 'Frais d''agrégateur SamirPay sur le total payé, opérateur Wave (%)'),
    ('finance.aggregator_fee_rate.ORANGE_MONEY', '{"value": 1.5}', 'Frais d''agrégateur SamirPay sur le total payé, opérateur Orange Money (%)'),
    ('finance.cancellation_aggregator_fee_bearer', '{"value": "EVENT_VILLAGE"}', 'Qui supporte les frais d''agrégateur perdus quand l''organisateur annule ou rembourse : EVENT_VILLAGE ou ORGANISATEUR'),
    ('finance.payout_hold_enabled', '{"value": true}', 'Fonds organisateur bloqués jusqu''à la fin de l''événement + délai (false : disponibles dès la confirmation)'),
    ('finance.payout_delay_hours', '{"value": 48}', 'Délai après la fin de l''événement avant que les fonds organisateur soient disponibles (heures)'),
    ('finance.withdrawal_fee_rate', '{"value": 1}', 'Frais de retrait (% du montant demandé, arrondis au FCFA supérieur, CDC §83 et §105)'),
    ('finance.withdrawal_min_amount', '{"value": 5000}', 'Seuil minimum de retrait (FCFA, CDC §83 et §105)'),
    ('finance.withdrawal_bank_enabled', '{"value": false}', 'Retraits par virement bancaire autorisés'),
    ('finance.referral_availability_days', '{"value": 7}', 'Délai avant qu''une commission de parrainage devienne disponible (jours, 7 à 14, CDC §102)')
ON CONFLICT (key) DO NOTHING;

-- ── Lecture (sans repli) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_setting(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
BEGIN
    SELECT value->'value' INTO v FROM public.platform_settings WHERE key = p_key;
    IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
        RAISE EXCEPTION 'réglage financier % absent', p_key;
    END IF;
    RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_setting_num(p_key text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := public.fin_setting(p_key);
BEGIN
    IF jsonb_typeof(v) <> 'number' THEN
        RAISE EXCEPTION 'réglage financier % : nombre attendu, %', p_key, v;
    END IF;
    RETURN (v #>> '{}')::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_setting_bool(p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := public.fin_setting(p_key);
BEGIN
    IF jsonb_typeof(v) <> 'boolean' THEN
        RAISE EXCEPTION 'réglage financier % : booléen attendu, %', p_key, v;
    END IF;
    RETURN (v #>> '{}')::boolean;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_setting_text(p_key text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := public.fin_setting(p_key);
BEGIN
    IF jsonb_typeof(v) <> 'string' THEN
        RAISE EXCEPTION 'réglage financier % : texte attendu, %', p_key, v;
    END IF;
    RETURN v #>> '{}';
END;
$$;

-- ── Validation et écriture (SUPERADMIN) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_setting_valid(p_key text, v jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    n numeric;
BEGIN
    IF v IS NULL THEN RETURN FALSE; END IF;
    IF p_key IN ('finance.payout_hold_enabled', 'finance.withdrawal_bank_enabled') THEN
        RETURN jsonb_typeof(v) = 'boolean';
    END IF;
    IF p_key = 'finance.cancellation_aggregator_fee_bearer' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('EVENT_VILLAGE', 'ORGANISATEUR');
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
        ELSE FALSE END;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_setting_set(p_key text, p_value jsonb, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
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
        'finance.referral_availability_days') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_KEY', 'message', 'Réglage inconnu.');
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un SUPERADMIN actif modifie les réglages financiers.');
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

-- ── RLS : un ADMIN n'écrit plus les clés finance.* directement ──────────────
DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
    FOR ALL
    USING (is_admin() AND key NOT LIKE 'finance.%')
    WITH CHECK (is_admin() AND key NOT LIKE 'finance.%');

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.platform_settings_audit()',
        'public.fin_setting(text)',
        'public.fin_setting_num(text)',
        'public.fin_setting_bool(text)',
        'public.fin_setting_text(text)',
        'public.fin_setting_valid(text, jsonb)',
        'public.finance_setting_set(text, jsonb, uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

-- ============================================================================
-- EVENT VILLAGE — LOT 11c-a, migration 01 : réglages des tables d'un événement
-- ============================================================================
-- Décisions du client (25/11) : une table d'un événement est un lot de N billets vendu par le moteur des billets ;
-- frais de service du client = finance.service_fee_rate (comme les billets), aucune commission au lancement. Deux
-- réglages propres, sans rien reprendre des réglages tables.* (restaurants) :
--  1. valeurs par défaut (ON CONFLICT DO NOTHING : une valeur déjà réglée est gardée) :
--     features.event_tables_enabled (false) : interrupteur propre des tables d'événement, fermé jusqu'à la recette
--       (features.tables_enabled reste celui des restaurants) ;
--     event_tables.max_per_account (2) : tables au plus par compte et par événement (achetées) ;
--  2. event_tables_setting_valid (bornes) et event_tables_settings_defaults (valeurs d'origine, lues par la route des
--     réglages avec platform_settings_defaults) ;
--     event_tables_setting_set : modification de ces deux réglages par un super-administrateur actif (mêmes règles que
--     finance_setting_set : refus UNKNOWN_KEY, FORBIDDEN, INVALID_VALUE ; motif historisé par platform_settings_history).
--     finance_setting_set, fin_setting_valid et platform_settings_defaults ne sont PAS recopiés : la suite d'audit
--     cv12a-3 (S1) exige une seule recopie de ces fonctions après main ; la route des réglages du super-administrateur
--     appelle cette fonction pour les deux clés du lot.
-- Rejouable : ON CONFLICT DO NOTHING, CREATE OR REPLACE.
-- ============================================================================

INSERT INTO public.platform_settings (key, value, description) VALUES
    ('features.event_tables_enabled', '{"value": false}',
     'Tables d''un événement : service ouvert (vente de tables sur la fiche d''un événement). Fermé jusqu''à la recette.'),
    ('event_tables.max_per_account', '{"value": 2}',
     'Tables d''un événement : tables au plus par compte et par événement')
ON CONFLICT (key) DO NOTHING;

-- Validation des deux clés (même contrat que fin_setting_valid : bornes identiques à lib/settings/catalog.ts)
CREATE OR REPLACE FUNCTION public.event_tables_setting_valid(p_key text, v jsonb)
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
    IF p_key = 'features.event_tables_enabled' THEN
        RETURN jsonb_typeof(v) = 'boolean';
    END IF;
    IF p_key = 'event_tables.max_per_account' THEN
        IF jsonb_typeof(v) <> 'number' THEN RETURN FALSE; END IF;
        n := (v #>> '{}')::numeric;
        RETURN n = trunc(n) AND n >= 1 AND n <= 10;
    END IF;
    RETURN FALSE;
END;
$$;

-- Valeurs d'origine des clés event_tables.* (même calcul que platform_settings_defaults, qui ne couvre pas ce préfixe)
CREATE OR REPLACE FUNCTION public.event_tables_settings_defaults()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_object_agg(s.key, COALESCE(
               (SELECT COALESCE(h.old_value, h.new_value)
                  FROM public.platform_settings_history h
                 WHERE h.key = s.key
                 ORDER BY h.changed_at, h.id
                 LIMIT 1),
               s.value) -> 'value'), '{}'::jsonb)
      FROM public.platform_settings s
     WHERE s.key ~ '^event_tables\.'
$$;

CREATE OR REPLACE FUNCTION public.event_tables_setting_set(p_key text, p_value jsonb, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := p_value->'value';
BEGIN
    IF p_key IS NULL OR p_key NOT IN ('features.event_tables_enabled', 'event_tables.max_per_account') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_KEY', 'message', 'Réglage inconnu.');
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un super-administrateur actif peut modifier les réglages.');
    END IF;
    IF NOT public.event_tables_setting_valid(p_key, v) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_VALUE', 'message', format('Valeur refusée pour %s : %s', p_key, COALESCE(v::text, 'absente')));
    END IF;
    PERFORM set_config('finance.change_reason', COALESCE(p_reason, ''), true);
    INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
    VALUES (p_key, jsonb_build_object('value', v), p_actor, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'key', p_key, 'value', v);
END;
$$;

REVOKE ALL ON FUNCTION public.event_tables_setting_valid(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_tables_setting_valid(text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_tables_settings_defaults() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_tables_settings_defaults() TO service_role;
REVOKE ALL ON FUNCTION public.event_tables_setting_set(text, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_tables_setting_set(text, jsonb, uuid, text) TO service_role;

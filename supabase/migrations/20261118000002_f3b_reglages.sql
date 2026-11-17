-- Finition 3b (E-35) — valeur par défaut de chaque réglage de la plateforme, montrée à l'écran.
--
-- platform_settings_defaults() : pour chaque réglage exposé par /api/admin/finance-settings (finance.*, access.*, notif.*,
-- features.*, support.*), sa valeur d'origine, lue dans l'historique (trigger platform_settings_audit, lot 3) :
--   - première ligne de l'historique créée à l'insertion (old_value NULL) : la valeur insérée par la migration ;
--   - première ligne d'un réglage antérieur au trigger (old_value non NULL) : la valeur d'avant le premier changement ;
--   - aucun historique : la valeur actuelle (jamais changée).
-- Rend {"<clé>": <valeur>} (valeur sans l'enveloppe {"value": …}). Lecture seule. Sans BEGIN ni COMMIT ; rejouable.

CREATE OR REPLACE FUNCTION public.platform_settings_defaults()
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
     WHERE s.key ~ '^(finance|access|notif|features|support)\.'
$$;

COMMENT ON FUNCTION public.platform_settings_defaults() IS
    'Finition 3b (E-35) : valeur d''origine de chaque réglage de la plateforme (premier état de l''historique, sinon la valeur actuelle).';

REVOKE ALL ON FUNCTION public.platform_settings_defaults() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_settings_defaults() TO service_role;

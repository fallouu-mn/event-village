-- Finition 3d (recours et suppléance), point 4b — page Équipe d'un admin : l'organisatrice se choisit dans une liste avec
-- recherche (fini « ?partnerId= » tapé à la main).
--
-- 1. public.f3d_fold(text) : minuscules, sans accents (é → e, ç → c, œ → o…), espaces réduits. Sert à la recherche.
-- 2. public.admin_organizers_search(p jsonb) : organisatrices VALIDE ou SUSPENDU dont le nom commercial, la raison sociale,
--    la ville ou le nom de la titulaire contiennent chaque mot cherché (sans accents ni majuscules). Une seule réponse
--    jsonb (aucune limite de lignes de l'API) ; tri et limite à 20 par la route (GET /api/partner/team/organizers), qui
--    contrôle le droit events.read. Lecture seule. Le texte cherché est un paramètre, jamais collé dans une requête.
--
-- Sans BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT idempotents).

CREATE OR REPLACE FUNCTION public.f3d_fold(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT btrim(regexp_replace(
        translate(lower(COALESCE(t, '')), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'),
        '\s+', ' ', 'g'));
$$;
REVOKE ALL ON FUNCTION public.f3d_fold(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f3d_fold(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_organizers_search(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_words text[];
BEGIN
    v_words := ARRAY(
        SELECT w FROM regexp_split_to_table(public.f3d_fold(left(COALESCE(p->>'q', ''), 80)), ' ') AS w
         WHERE w <> '');
    RETURN jsonb_build_object('ok', true, 'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                   'partner_id', pa.id,
                   'name', COALESCE(NULLIF(btrim(pa.commercial_name), ''), NULLIF(btrim(pa.company_name), ''), 'Organisatrice sans nom'),
                   'city', NULLIF(btrim(pa.city), ''),
                   'status', pa.status::text))
          FROM public.partners pa
          LEFT JOIN public.users u ON u.id = pa.user_id
         WHERE pa.status::text IN ('VALIDE', 'SUSPENDU')
           AND NOT EXISTS (
               SELECT 1 FROM unnest(v_words) AS w
                WHERE position(w IN public.f3d_fold(concat_ws(' ', pa.commercial_name, pa.company_name, pa.city, u.first_name, u.last_name))) = 0)
    ), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_organizers_search(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_organizers_search(jsonb) TO service_role;

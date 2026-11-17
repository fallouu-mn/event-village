-- Finition 2b (A, E-22) — couleur au contrôle posée par la base quand elle manque, distincte pour chaque catégorie de
-- l'événement, jamais confondable avec un verdict du scanner. L'écran la propose déjà (proposeScanColor,
-- lib/scan/scan-result.ts) ; la base la pose pour toute catégorie enregistrée sans couleur (ancien écran, appel direct,
-- remise à vide) : chaque catégorie a ainsi une couleur au contrôle.
-- Règle (même ordre qu'à l'écran) : BLANC, NOIR, VIOLET, ROSE, TURQUOISE, BLEU, ARGENT ; la première qu'aucune autre
-- catégorie de l'événement n'a ; les sept prises, la moins employée, dans cet ordre. OR n'est jamais proposé (écart
-- CIEDE2000 de 24,0 avec l'orange « mauvaise zone », 5,1 avec l'ambre « hors fenêtre ») ; il reste choisissable.
--  1. ticket_category_auto_color(événement, catégorie à exclure) : la couleur proposée ;
--  2. déclencheur BEFORE INSERT OR UPDATE OF scan_color : couleur vide → couleur proposée (la catégorie elle-même exclue
--     du compte) ; une couleur choisie n'est jamais changée ;
--  3. catégories existantes sans couleur : couleur posée, événement par événement, dans l'ordre prix, nom, identifiant
--     (celui de l'éditeur des zones). Une écriture de scan_color ne déclenche que trg_ticket_categories_updated_at
--     (aucune alerte ni aucun avis : les autres déclencheurs portent sur d'autres colonnes).
-- Sans BEGIN ni COMMIT, rejouable : CREATE OR REPLACE, DROP TRIGGER IF EXISTS ; seule donnée écrite : la couleur des
-- catégories qui n'en avaient pas (contrôle avant et après au rapport).

-- 1. Couleur proposée
CREATE OR REPLACE FUNCTION public.ticket_category_auto_color(p_event uuid, p_exclude uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.color
      FROM unnest(ARRAY['BLANC', 'NOIR', 'VIOLET', 'ROSE', 'TURQUOISE', 'BLEU', 'ARGENT']::text[]) WITH ORDINALITY AS o(color, pos)
     ORDER BY (SELECT count(*) FROM public.ticket_categories c
                WHERE c.event_id = p_event AND c.scan_color = o.color AND c.id IS DISTINCT FROM p_exclude),
              o.pos
     LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.ticket_category_auto_color(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_auto_color(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.ticket_category_auto_color(uuid, uuid) IS
    'Finition 2b (A) : couleur au contrôle proposée pour une catégorie de l''événement (ordre BLANC, NOIR, VIOLET, ROSE, '
    'TURQUOISE, BLEU, ARGENT ; la première libre, sinon la moins employée ; jamais OR). Même ordre que '
    'AUTO_SCAN_COLOR_ORDER (lib/scan/scan-result.ts).';

-- 2. Couleur posée quand elle manque
CREATE OR REPLACE FUNCTION public.ticket_categories_auto_color()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.scan_color IS NULL THEN
        NEW.scan_color := public.ticket_category_auto_color(NEW.event_id, NEW.id);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ticket_categories_auto_color() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ticket_categories_auto_color ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_auto_color
    BEFORE INSERT OR UPDATE OF scan_color ON public.ticket_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.ticket_categories_auto_color();

-- 3. Catégories existantes sans couleur
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.id, c.event_id
          FROM public.ticket_categories c
         WHERE c.scan_color IS NULL
         ORDER BY c.event_id, c.price, c.name, c.id
    LOOP
        UPDATE public.ticket_categories
           SET scan_color = public.ticket_category_auto_color(r.event_id, r.id)
         WHERE id = r.id;
    END LOOP;
END;
$$;

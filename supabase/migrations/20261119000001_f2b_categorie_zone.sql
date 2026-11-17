-- Finition 2b (A, E-22) — supprimer une catégorie sans vente ne laisse jamais une zone sans catégorie admise.
-- Constat (état des lieux du 15/11, point 2, sécurité faible) : la suppression effaçait aussi les admissions de la
-- catégorie (zone_categories, clé étrangère ON DELETE CASCADE) sans revérifier les règles des zones (event_zones_save :
-- chaque zone admet au moins une catégorie) ; une zone pouvait rester sans catégorie admise, chaque billet présenté à ses
-- portes y était alors refusé.
-- Règle : refus clair CATEGORY_ONLY_IN_ZONE quand une zone n'admet que cette catégorie ; le message nomme la ou les zones
-- et dit où les régler (étape « Contrôle à l'entrée » du formulaire) ; suggestion ENTRY_CONTROL pour l'écran. Les autres
-- règles des zones ne dépendent pas d'une suppression (une catégorie supprimée n'a plus à entrer par une zone ENTREE).
-- Verrous : ticket_category_guard (événement NKU, catégories FOR UPDATE), comme event_zones_save : les deux se suivent.
-- Sans BEGIN ni COMMIT, rejouable (CREATE OR REPLACE) ; aucune donnée écrite.

-- ticket_category_delete (recopie de 20261102000004_lot5_edition.sql, seule version ; contrôle des zones ajouté)
CREATE OR REPLACE FUNCTION public.ticket_category_delete(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_guard jsonb;
    v_name text;
    v_zones text[];
BEGIN
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    SELECT name INTO v_name FROM public.ticket_categories WHERE id = v_category AND event_id = v_event;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
    END IF;
    -- Billet (tout statut), réservation (toute ligne : clé étrangère RESTRICT) ou passage au contrôle : suppression impossible
    IF EXISTS (SELECT 1 FROM public.tickets t WHERE t.category_id = v_category)
       OR EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.category_id = v_category)
       OR EXISTS (SELECT 1 FROM public.ticket_scans s WHERE s.category_id = v_category) THEN
        RETURN public.event_edit_refusal('CATEGORY_HAS_SALES',
            'Des billets de cette catégorie ont été vendus ou réservés : elle ne peut pas être supprimée. Désactivez-la pour arrêter sa vente.',
            NULL, jsonb_build_object('suggestion', 'DEACTIVATE'));
    END IF;
    -- Finition 2b (A) : une zone qui n'admet que cette catégorie resterait sans catégorie admise
    PERFORM 1 FROM public.event_zones z WHERE z.event_id = v_event ORDER BY z.id FOR UPDATE;
    SELECT array_agg(z.name ORDER BY z.position, lower(btrim(z.name)), z.id) INTO v_zones
      FROM public.event_zones z
     WHERE z.event_id = v_event
       AND EXISTS (SELECT 1 FROM public.zone_categories zc WHERE zc.zone_id = z.id AND zc.category_id = v_category)
       AND NOT EXISTS (SELECT 1 FROM public.zone_categories zc WHERE zc.zone_id = z.id AND zc.category_id <> v_category);
    IF cardinality(v_zones) > 0 THEN
        RETURN public.event_edit_refusal('CATEGORY_ONLY_IN_ZONE',
            CASE WHEN cardinality(v_zones) = 1
                 THEN format('La zone « %s » n’admet que cette catégorie : elle resterait sans catégorie. Avant de la supprimer, cochez une autre catégorie pour cette zone ou retirez la zone, à l’étape « Contrôle à l’entrée ».', v_zones[1])
                 ELSE format('Les zones %s et « %s » n’admettent que cette catégorie : elles resteraient sans catégorie. Avant de la supprimer, cochez une autre catégorie pour ces zones ou retirez-les, à l’étape « Contrôle à l’entrée ».',
                             (SELECT string_agg('« ' || n || ' »', ', ' ORDER BY o) FROM unnest(v_zones[1:cardinality(v_zones) - 1]) WITH ORDINALITY AS x(n, o)),
                             v_zones[cardinality(v_zones)])
            END,
            NULL, jsonb_build_object('suggestion', 'ENTRY_CONTROL', 'zones', to_jsonb(v_zones)));
    END IF;
    DELETE FROM public.ticket_categories WHERE id = v_category AND event_id = v_event;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_DELETED', 'TICKET_CATEGORY', v_category,
            jsonb_build_object('event_id', v_event, 'name', v_name));
    RETURN jsonb_build_object('ok', true, 'category_id', v_category);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_category_delete(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_delete(jsonb) TO service_role;

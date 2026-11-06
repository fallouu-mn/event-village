-- ============================================================================
-- EVENT VILLAGE — LOT 8 (8.2 l) : enregistrement du profil partenaire en une seule transaction
-- ============================================================================
-- Contrat : scratchpad/lot8-design.md, sections 2.9, 3.9 et 8.4 ; décision L55.
-- Migration rejouable (CREATE OR REPLACE) ; aucune migration gelée modifiée.
--
-- partner_profile_update : nouvelle. Ferme le point ouvert 12 du lot 7 : PATCH /api/partner/profile écrivait la
-- fiche, puis les activités, puis retirait les autres, hors transaction.
--  - Entrée { partner_id, user_id, fields: {…}, activities: […] | null } ; la route valide tout avant l'appel.
--  - Fiche verrouillée FOR UPDATE, sur le couple (id, user_id) : compte d'un autre ou fiche absente,
--    { ok: false, code: 'PARTNER_NOT_FOUND' }, rien d'écrit.
--  - Une colonne s'écrit selon la PRÉSENCE de sa clé dans `fields` : clé absente, colonne inchangée ; clé à null,
--    colonne vidée. Liste fermée, celle de la route : aucune autre clé n'est lue (status, is_verified, user_id…).
--  - Activités : seulement si `activities` est un tableau. Ajout ou réactivation d'abord, retrait des autres
--    ensuite. Une activité hors énumération lève 22P02 et annule tout, la fiche comprise.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.partner_profile_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_id uuid := (p->>'partner_id')::uuid;
    v_user_id uuid := (p->>'user_id')::uuid;
    v_fields jsonb := COALESCE(p->'fields', '{}'::jsonb);
    v_activities jsonb := p->'activities';
    v_wanted text[];
BEGIN
    PERFORM 1
       FROM public.partners
      WHERE id = v_partner_id AND user_id = v_user_id
        FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'code', 'PARTNER_NOT_FOUND');
    END IF;

    IF v_fields ?| ARRAY['company_name', 'commercial_name', 'description', 'address', 'city', 'latitude', 'longitude',
                         'phone', 'email', 'logo_url', 'cover_url'] THEN
        UPDATE public.partners
           SET company_name    = CASE WHEN v_fields ? 'company_name' THEN v_fields->>'company_name' ELSE company_name END,
               commercial_name = CASE WHEN v_fields ? 'commercial_name' THEN v_fields->>'commercial_name' ELSE commercial_name END,
               description     = CASE WHEN v_fields ? 'description' THEN v_fields->>'description' ELSE description END,
               address         = CASE WHEN v_fields ? 'address' THEN v_fields->>'address' ELSE address END,
               city            = CASE WHEN v_fields ? 'city' THEN v_fields->>'city' ELSE city END,
               latitude        = CASE WHEN v_fields ? 'latitude' THEN (v_fields->>'latitude')::double precision ELSE latitude END,
               longitude       = CASE WHEN v_fields ? 'longitude' THEN (v_fields->>'longitude')::double precision ELSE longitude END,
               phone           = CASE WHEN v_fields ? 'phone' THEN v_fields->>'phone' ELSE phone END,
               email           = CASE WHEN v_fields ? 'email' THEN v_fields->>'email' ELSE email END,
               logo_url        = CASE WHEN v_fields ? 'logo_url' THEN v_fields->>'logo_url' ELSE logo_url END,
               cover_url       = CASE WHEN v_fields ? 'cover_url' THEN v_fields->>'cover_url' ELSE cover_url END,
               updated_at      = now()
         WHERE id = v_partner_id;
    END IF;

    IF jsonb_typeof(v_activities) = 'array' THEN
        SELECT COALESCE(array_agg(DISTINCT value), ARRAY[]::text[])
          INTO v_wanted
          FROM jsonb_array_elements_text(v_activities);

        INSERT INTO public.partner_activities (partner_id, activity_type, is_active)
        SELECT v_partner_id, wanted::public.partner_activity_type, TRUE
          FROM unnest(v_wanted) AS wanted
        ON CONFLICT ON CONSTRAINT uq_partner_activity DO UPDATE SET is_active = TRUE;

        DELETE FROM public.partner_activities
         WHERE partner_id = v_partner_id
           AND activity_type::text <> ALL (v_wanted);
    END IF;

    RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- ── Privilèges ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.partner_profile_update(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_profile_update(jsonb) TO service_role;

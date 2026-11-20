-- ============================================================================
-- EVENT VILLAGE — LOT 10b, migration 06 : date exacte de l'envoi d'une salle en validation
-- ============================================================================
-- Point ouvert du rapport du lot 10b : la file de validation affichait la date de dernière modification.
--  1. colonne halls.submitted_at (envoi en validation : création ou renvoi), reprise une fois par created_at pour les
--     salles déjà en attente ;
--  2. halls_validation_guard : recopie de 20261126000002_l10b_salles.sql:214-242 ; changement : submitted_at posé à la création d'une salle
--     en attente, gardé ensuite (seules les fonctions de la base l'écrivent) ;
--  3. hall_submit : recopie de 20261126000002_l10b_salles.sql:250-305 ; changement : submitted_at posé au renvoi en validation.
-- Rejouable : ADD COLUMN IF NOT EXISTS, UPDATE limité aux lignes vides, CREATE OR REPLACE.
-- ============================================================================

ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
COMMENT ON COLUMN public.halls.submitted_at IS
    'Lot 10b (contre-vérification) : date du dernier envoi en validation (création ou renvoi par la propriétaire).';
UPDATE public.halls SET submitted_at = created_at
 WHERE submitted_at IS NULL AND validation_status = 'EN_ATTENTE_VALIDATION';

-- Recopie de 20261126000002_l10b_salles.sql:214-242 ; changement : submitted_at.
CREATE OR REPLACE FUNCTION public.halls_validation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Écriture par hall_validation_decide (drapeau de la transaction) : rien à corriger
    IF current_setting('event_village.hall_validation', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.validation_status := CASE WHEN public.fin_setting_bool('halls.validation_required')
                                      THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
        NEW.validation_reason := NULL;
        NEW.validated_by := NULL;
        NEW.validated_at := CASE WHEN NEW.validation_status = 'VALIDEE' THEN now() END;
        -- Contre-vérification du lot 10b (point ouvert) : date exacte de l'envoi en validation
        NEW.submitted_at := CASE WHEN NEW.validation_status = 'EN_ATTENTE_VALIDATION' THEN now() END;
        RETURN NEW;
    END IF;
    -- Mise à jour par la partenaire ou par une route : statut et décision gardés. Lot 10b : une salle refusée puis
    -- modifiée reste refusée jusqu'à ce que sa propriétaire la renvoie en validation (hall_submit)
    NEW.validation_status := OLD.validation_status;
    NEW.validation_reason := OLD.validation_reason;
    NEW.validated_by := OLD.validated_by;
    NEW.validated_at := OLD.validated_at;
    NEW.submitted_at := OLD.submitted_at;
    RETURN NEW;
END;
$$;

-- Recopie de 20261126000002_l10b_salles.sql:250-305 ; changement : submitted_at au renvoi.
CREATE OR REPLACE FUNCTION public.hall_submit(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_hall_id uuid := public.try_uuid(p->>'hall_id');
    h         record;
    v_missing text[] := ARRAY[]::text[];
    v_new     text;
BEGIN
    SELECT hl.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = v_hall_id FOR UPDATE OF hl;
    IF v_hall_id IS NULL OR v_actor IS NULL OR NOT FOUND OR h.owner_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Salle introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF h.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre compte partenaire doit être validé avant d’envoyer une salle.');
    END IF;
    IF h.validation_status <> 'REFUSEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', CASE h.validation_status
            WHEN 'EN_ATTENTE_VALIDATION' THEN 'Cette salle attend déjà la validation d’Event Village.'
            WHEN 'VALIDEE' THEN 'Cette salle est déjà validée.'
            ELSE 'Cette salle est suspendue : seule l’équipe d’Event Village peut la réactiver.' END);
    END IF;
    IF NULLIF(btrim(h.name), '') IS NULL THEN v_missing := v_missing || 'le nom'::text; END IF;
    IF h.price_per_day IS NULL OR h.price_per_day < 1 THEN v_missing := v_missing || 'le prix par jour'::text; END IF;
    IF NULLIF(btrim(COALESCE(h.address, '')), '') IS NULL OR NULLIF(btrim(COALESCE(h.city, '')), '') IS NULL THEN
        v_missing := v_missing || 'l’adresse et la ville'::text;
    END IF;
    IF COALESCE(cardinality(h.images), 0) < 1 THEN v_missing := v_missing || 'une photo au moins'::text; END IF;
    IF h.latitude IS NULL THEN v_missing := v_missing || 'la position sur la carte'::text; END IF;
    IF cardinality(v_missing) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_INCOMPLETE',
            'message', 'Avant d’envoyer la salle, ajoutez ' || array_to_string(v_missing, ', ') || '.');
    END IF;
    v_new := CASE WHEN public.fin_setting_bool('halls.validation_required') THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
    PERFORM set_config('event_village.hall_validation', 'on', true);
    UPDATE public.halls
       SET validation_status = v_new, validation_reason = NULL, validated_by = NULL,
           validated_at = CASE WHEN v_new = 'VALIDEE' THEN now() END, updated_at = now(),
           submitted_at = CASE WHEN v_new = 'EN_ATTENTE_VALIDATION' THEN now() ELSE submitted_at END
     WHERE id = h.id;
    PERFORM set_config('event_village.hall_validation', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'HALL_SUBMITTED', 'halls', h.id,
            jsonb_build_object('validation_status', h.validation_status), jsonb_build_object('validation_status', v_new));
    RETURN jsonb_build_object('ok', true, 'hall_id', h.id, 'validation_status', v_new);
END;
$$;

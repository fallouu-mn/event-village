-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 02 : fermetures exceptionnelles, disponibilités, recherche
-- ============================================================================
-- Décisions du client : une fermeture exceptionnelle (jour entier ou plage horaire) rend l'établissement non
-- réservable ; les réservations déjà prises sur la période sont annulées et remboursées en entier, clients prévenus.
-- Créneaux montrés en pastilles.
--  1. venue_closures (lecture et écriture REST fermées) ; venue_closed_during(établissement, créneau) ;
--     venue_closure_parse(p) (période et motif) ; venue_closure_touched (réservations qui tiennent une table sur la
--     période, montant rendu = tout ce qui a été payé) ; venue_closure_preview(p) (aperçu avant de confirmer) ;
--     venue_closure_create(p) (sous le verrou de l'établissement, liste identique à l'aperçu exigée, chaque réservation
--     annulée par l'établissement et remboursée à 100 % par table_close_apply, avis au client) ; venue_closure_delete(p)
--     (fermeture pas encore finie retirée ; les réservations annulées le restent) ; propriétaire, compte ACTIF et fiche
--     VALIDE exigés (venue_owner_refusal, migration 01) ;
--  2. table_free_count, venue_is_public, venue_slots(p) (pastilles d'un jour, toutes les 30 minutes dans les horaires),
--     venue_floor(p) (plan de salle public : tables placées, état au créneau, rien sur les clients), venue_search(p)
--     (recherche : texte, ville, genre ; avec date et personnes, créneaux autour de l'heure voulue) ;
--  3. table_reserve : recopie de 20261123000111_l11a_cv_limite_client.sql:69-266 ; changement : refus VENUE_CLOSED sur une
--     fermeture exceptionnelle ;
--  4. table_hold_refusal : recopie de 20261123000105_l11a_paiement.sql:31-73 ; changement : même refus au paiement (une
--     attente échue reprise par un paiement repasse tous les contrôles) ;
-- Toutes réservées au rôle de service. Rejouable : CREATE TABLE IF NOT EXISTS, DROP … IF EXISTS puis ADD,
-- CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fermetures exceptionnelles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    period TSRANGE GENERATED ALWAYS AS (tsrange(starts_at, ends_at, '[)')) STORED
);

COMMENT ON TABLE public.venue_closures IS
    'Lot 11b : fermeture exceptionnelle d''un établissement (jour entier ou plage horaire, heure de Dakar) ; plus réservable, réservations touchées annulées et remboursées en entier.';

CREATE INDEX IF NOT EXISTS idx_venue_closures_venue_id ON public.venue_closures(venue_id);

ALTER TABLE public.venue_closures DROP CONSTRAINT IF EXISTS venue_closures_period_chk;
ALTER TABLE public.venue_closures ADD CONSTRAINT venue_closures_period_chk CHECK (
    ends_at > starts_at AND ends_at - starts_at <= interval '92 days'
    AND EXTRACT(SECOND FROM starts_at) = 0 AND EXTRACT(SECOND FROM ends_at) = 0);
ALTER TABLE public.venue_closures DROP CONSTRAINT IF EXISTS venue_closures_reason_chk;
ALTER TABLE public.venue_closures ADD CONSTRAINT venue_closures_reason_chk CHECK (length(btrim(reason)) BETWEEN 3 AND 200);
-- Deux fermetures en cours d'un même établissement ne se chevauchent pas
ALTER TABLE public.venue_closures DROP CONSTRAINT IF EXISTS no_overlapping_venue_closures;
ALTER TABLE public.venue_closures ADD CONSTRAINT no_overlapping_venue_closures
    EXCLUDE USING gist (venue_id WITH =, period WITH &&) WHERE (cancelled_at IS NULL);

-- Aucune lecture ni écriture REST : tout passe par le serveur (routes de l'établissement, fonctions en base)
ALTER TABLE public.venue_closures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venue_closures FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.venue_closures TO service_role;

-- Le créneau touche-t-il une fermeture exceptionnelle en cours ?
CREATE OR REPLACE FUNCTION public.venue_closed_during(p_venue_id uuid, p_slot tsrange)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.venue_closures c
                    WHERE c.venue_id = p_venue_id AND c.cancelled_at IS NULL AND c.period && p_slot);
$$;

-- Nombre de tables actives de l'établissement qui conviennent (personnes, zone) et sont libres sur tout le créneau ;
-- une attente de paiement échue ne tient plus sa table
CREATE OR REPLACE FUNCTION public.table_free_count(p_venue_id uuid, p_slot tsrange, p_guests integer, p_zone_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)::integer
      FROM public.restaurant_tables c
     WHERE c.venue_id = p_venue_id AND c.is_active AND (p_zone_id IS NULL OR c.zone_id = p_zone_id)
       AND p_guests BETWEEN c.min_capacity AND c.capacity
       AND NOT EXISTS (SELECT 1 FROM public.table_reservations o
                        WHERE o.table_id = c.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && p_slot
                          AND NOT (o.booking_state = 'EN_ATTENTE_PAIEMENT' AND o.hold_expires_at <= now()));
$$;

-- Période d'une fermeture : start_date, start_time (vide : début de journée), end_date (vide : start_date), end_time
-- (vide : fin de journée), reason. Rend {ok, starts_at, ends_at, reason} ou le refus.
CREATE OR REPLACE FUNCTION public.venue_closure_parse(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sd     date;
    v_ed     date;
    v_st     time;
    v_et     time;
    v_start  timestamp;
    v_end    timestamp;
    v_now    timestamp := public.hall_dakar_now();
    v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 200), '');
BEGIN
    BEGIN
        v_sd := (p->>'start_date')::date;
        v_ed := COALESCE(NULLIF(p->>'end_date', '')::date, v_sd);
        v_st := NULLIF(p->>'start_time', '')::time;
        v_et := NULLIF(p->>'end_time', '')::time;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'Une date ou une heure de la fermeture n’est pas valable.');
    END;
    IF v_sd IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'Choisissez le jour de la fermeture.');
    END IF;
    IF (v_st IS NOT NULL AND (EXTRACT(MINUTE FROM v_st)::int % 15 <> 0 OR EXTRACT(SECOND FROM v_st) <> 0))
       OR (v_et IS NOT NULL AND (EXTRACT(MINUTE FROM v_et)::int % 15 <> 0 OR EXTRACT(SECOND FROM v_et) <> 0)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME', 'message', 'Choisissez des heures au quart d’heure près (par exemple 18:00 ou 18:15).');
    END IF;
    v_start := v_sd + COALESCE(v_st, time '00:00');
    v_end := CASE WHEN v_et IS NULL OR v_et = time '00:00' THEN (v_ed + 1) + time '00:00' ELSE v_ed + v_et END;
    IF v_end <= v_start THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'La fin de la fermeture doit venir après son début.');
    END IF;
    IF v_sd < v_now::date THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Une fermeture commence aujourd’hui au plus tôt.');
    END IF;
    IF v_end <= v_now THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Cette période est déjà passée.');
    END IF;
    IF v_sd > v_now::date + 365 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'Une fermeture se prévoit au plus un an à l’avance.');
    END IF;
    IF v_end - v_start > interval '92 days' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'Une fermeture dure au plus 92 jours.');
    END IF;
    IF v_reason IS NULL OR length(v_reason) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé aux clients dont la réservation est annulée.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'starts_at', v_start, 'ends_at', v_end, 'reason', v_reason);
END;
$$;

-- Réservations qui tiennent une table sur la période (attente de paiement en cours, demande, confirmée), avec ce que
-- le client récupère (tout ce qu'il a payé : remboursement en entier)
CREATE OR REPLACE FUNCTION public.venue_closure_touched(p_venue_id uuid, p_period tsrange)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'reservation_id', r.id, 'date', r.reservation_date, 'time', to_char(r.reservation_time, 'HH24:MI'),
               'end_time', to_char(upper(r.slot), 'HH24:MI'), 'guests', r.guest_count, 'table_number', t.table_number,
               'booking_state', r.booking_state, 'paid_amount', r.paid_amount, 'refund_amount', r.paid_amount - r.refunded_amount,
               'client_name', btrim(COALESCE(u.first_name, '') || ' ' || left(COALESCE(u.last_name, ''), 1) || CASE WHEN COALESCE(u.last_name, '') <> '' THEN '.' ELSE '' END))
             ORDER BY r.reservation_date, r.reservation_time, t.table_number), '[]'::jsonb)
      FROM public.table_reservations r
      LEFT JOIN public.restaurant_tables t ON t.id = r.table_id
      LEFT JOIN public.users u ON u.id = r.client_id
     WHERE r.venue_id = p_venue_id AND r.slot && p_period
       AND (r.booking_state IN ('EN_ATTENTE_ACCEPTATION', 'CONFIRMEE')
            OR (r.booking_state = 'EN_ATTENTE_PAIEMENT' AND r.hold_expires_at > now()));
$$;

-- Aperçu avant de confirmer : période lue, réservations touchées et montant rendu
CREATE OR REPLACE FUNCTION public.venue_closure_preview(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_refusal  jsonb;
    v_period   jsonb;
    v_range    tsrange;
    v_touched  jsonb;
BEGIN
    v_refusal := public.venue_owner_refusal(v_actor, v_venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    v_period := public.venue_closure_parse(p);
    IF (v_period->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_period;
    END IF;
    v_range := tsrange((v_period->>'starts_at')::timestamp, (v_period->>'ends_at')::timestamp, '[)');
    IF EXISTS (SELECT 1 FROM public.venue_closures c WHERE c.venue_id = v_venue_id AND c.cancelled_at IS NULL AND c.period && v_range) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_OVERLAP', 'message', 'Une fermeture est déjà prévue sur une partie de cette période.');
    END IF;
    v_touched := public.venue_closure_touched(v_venue_id, v_range);
    RETURN jsonb_build_object('ok', true, 'starts_at', v_period->>'starts_at', 'ends_at', v_period->>'ends_at', 'reason', v_period->>'reason',
                              'reservations', v_touched, 'count', jsonb_array_length(v_touched),
                              'refund_total', COALESCE((SELECT sum((x->>'refund_amount')::numeric) FROM jsonb_array_elements(v_touched) x), 0));
END;
$$;

-- Fermeture confirmée : sous le verrou de l'établissement, la liste doit être celle de l'aperçu (expected_count), puis
-- chaque réservation touchée est annulée par l'établissement et remboursée en entier (table_close_apply, 100 %),
-- client prévenu (avis d'annulation, motif « Fermeture exceptionnelle : … »)
CREATE OR REPLACE FUNCTION public.venue_closure_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_expected integer;
    v_refusal  jsonb;
    v_period   jsonb;
    v_range    tsrange;
    v_touched  jsonb;
    v_id       uuid;
    h          record;
    x          jsonb;
    v_res      jsonb;
    v_ids      uuid[] := ARRAY[]::uuid[];
    v_refund   numeric := 0;
    v_count    integer := 0;
BEGIN
    v_refusal := public.venue_owner_refusal(v_actor, v_venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    BEGIN
        v_expected := (p->>'expected_count')::int;
    EXCEPTION WHEN others THEN
        v_expected := NULL;
    END;
    IF v_expected IS NULL OR v_expected < 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PREVIEW_REQUIRED', 'message', 'Affichez d’abord les réservations touchées, puis confirmez.');
    END IF;
    v_period := public.venue_closure_parse(p);
    IF (v_period->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_period;
    END IF;
    v_range := tsrange((v_period->>'starts_at')::timestamp, (v_period->>'ends_at')::timestamp, '[)');

    -- Une écriture à la fois par établissement : aucune réservation ne se glisse entre la liste et la fermeture
    PERFORM public.table_venue_lock(v_venue_id);
    FOR h IN SELECT id FROM public.table_reservations
              WHERE venue_id = v_venue_id AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now() LOOP
        PERFORM public.table_expire_hold(h.id);
    END LOOP;
    v_touched := public.venue_closure_touched(v_venue_id, v_range);
    IF jsonb_array_length(v_touched) <> v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PREVIEW_CHANGED',
            'message', format('Les réservations de cette période ont changé (%s au lieu de %s) : vérifiez la liste de nouveau avant de confirmer.',
                              jsonb_array_length(v_touched), v_expected),
            'count', jsonb_array_length(v_touched));
    END IF;
    BEGIN
        INSERT INTO public.venue_closures (venue_id, starts_at, ends_at, reason, created_by)
        VALUES (v_venue_id, (v_period->>'starts_at')::timestamp, (v_period->>'ends_at')::timestamp, v_period->>'reason', v_actor)
        RETURNING id INTO v_id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_OVERLAP', 'message', 'Une fermeture est déjà prévue sur une partie de cette période.');
    END;
    FOR x IN SELECT * FROM jsonb_array_elements(v_touched) LOOP
        v_res := public.table_close_apply((x->>'reservation_id')::uuid, 'ANNULEE_ETABLISSEMENT', 'ETABLISSEMENT', v_actor,
                                          'Fermeture exceptionnelle : ' || (v_period->>'reason'), 100);
        v_ids := v_ids || ARRAY(SELECT jsonb_array_elements_text(v_res->'cashout_ids')::uuid);
        v_refund := v_refund + COALESCE((v_res->>'refund_amount')::numeric, 0);
        v_count := v_count + 1;
    END LOOP;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_CLOSURE_CREATED', 'venue_closures', v_id,
            jsonb_build_object('starts_at', v_period->>'starts_at', 'ends_at', v_period->>'ends_at', 'reason', v_period->>'reason'),
            jsonb_build_object('venue_id', v_venue_id, 'cancelled', v_count, 'refund_total', v_refund, 'cashout_ids', to_jsonb(v_ids)));
    RETURN jsonb_build_object('ok', true, 'closure_id', v_id, 'cancelled', v_count, 'refund_total', v_refund, 'cashout_ids', to_jsonb(v_ids),
                              'starts_at', v_period->>'starts_at', 'ends_at', v_period->>'ends_at');
END;
$$;

-- Fermeture retirée (pas encore finie) : l'établissement redevient réservable ; les réservations annulées le restent
CREATE OR REPLACE FUNCTION public.venue_closure_delete(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_id      uuid := public.try_uuid(p->>'closure_id');
    c         record;
    v_refusal jsonb;
BEGIN
    SELECT * INTO c FROM public.venue_closures WHERE id = v_id FOR UPDATE;
    IF v_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_NOT_FOUND', 'message', 'Fermeture introuvable.');
    END IF;
    v_refusal := public.venue_owner_refusal(v_actor, c.venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN CASE WHEN v_refusal->>'code' = 'VENUE_NOT_FOUND'
                    THEN jsonb_build_object('ok', false, 'code', 'CLOSURE_NOT_FOUND', 'message', 'Fermeture introuvable.')
                    ELSE v_refusal END;
    END IF;
    IF c.cancelled_at IS NOT NULL OR c.ends_at <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_ENDED', 'message', 'Cette fermeture est déjà retirée ou terminée.');
    END IF;
    UPDATE public.venue_closures SET cancelled_at = now(), cancelled_by = v_actor WHERE id = c.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_CLOSURE_REMOVED', 'venue_closures', c.id,
            jsonb_build_object('starts_at', c.starts_at, 'ends_at', c.ends_at), jsonb_build_object('cancelled', true));
    RETURN jsonb_build_object('ok', true, 'closure_id', c.id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Disponibilités (pastilles), plan de salle public, recherche
-- ----------------------------------------------------------------------------
-- Établissement visible du public : actif, validé, partenaire VALIDE (comme table_reserve et la lecture publique)
CREATE OR REPLACE FUNCTION public.venue_is_public(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
                    WHERE ve.id = p_venue_id AND ve.is_active AND ve.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE');
$$;

-- Créneaux d'un jour (pastilles, toutes les 30 minutes dans les horaires) : libre si l'heure est à venir (90 jours au
-- plus), hors fermeture exceptionnelle, et si une table qui convient est libre sur tout le créneau.
-- p : venue_id, date, guests (1 à 50), zone_id (facultatif).
CREATE OR REPLACE FUNCTION public.venue_slots(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_zone_id  uuid := public.try_uuid(NULLIF(p->>'zone_id', ''));
    v_date     date;
    v_guests   integer;
    v          record;
    v_now      timestamp := public.hall_dakar_now();
    v_min      integer;
    v_slots    jsonb := '[]'::jsonb;
    v_open     integer := 0;
    v_closed   integer := 0;
    v_free     integer := 0;
    v_t        timestamp;
    v_slot     tsrange;
    v_n        integer;
    v_state    text;
BEGIN
    IF v_venue_id IS NULL OR NOT public.venue_is_public(v_venue_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est plus proposé.');
    END IF;
    BEGIN
        v_date := (p->>'date')::date;
        v_guests := COALESCE(NULLIF(p->>'guests', '')::int, 2);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Choisissez une date et un nombre de personnes valables.');
    END;
    IF v_date IS NULL OR v_guests < 1 OR v_guests > 50 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Choisissez une date et un nombre de personnes entre 1 et 50.');
    END IF;
    SELECT * INTO v FROM public.venues WHERE id = v_venue_id;
    v_min := COALESCE(v.slot_minutes, public.fin_setting_num('tables.slot_minutes')::int);
    IF NOT EXISTS (SELECT 1 FROM public.restaurant_tables c WHERE c.venue_id = v.id AND c.is_active
                      AND (v_zone_id IS NULL OR c.zone_id = v_zone_id) AND v_guests BETWEEN c.min_capacity AND c.capacity) THEN
        RETURN jsonb_build_object('ok', true, 'date', v_date, 'guests', v_guests, 'slot_minutes', v_min, 'day', 'NO_TABLE_FITS',
                                  'slots', '[]'::jsonb, 'message', format('Aucune table ne peut accueillir %s personnes ici.', v_guests));
    END IF;
    FOR v_t IN SELECT gs FROM generate_series(v_date + time '00:00', v_date + time '23:30', interval '30 minutes') AS gs LOOP
        v_slot := tsrange(v_t, v_t + v_min * interval '1 minute', '[)');
        CONTINUE WHEN NOT public.venue_open_covers(v.id, v_slot);
        v_open := v_open + 1;
        IF public.venue_closed_during(v.id, v_slot) THEN
            v_closed := v_closed + 1;
            CONTINUE;
        END IF;
        IF v_t <= v_now THEN
            v_state := 'PASSE'; v_n := 0;
        ELSIF v_t > v_now + interval '90 days' THEN
            v_state := 'TROP_LOIN'; v_n := 0;
        ELSE
            v_n := public.table_free_count(v.id, v_slot, v_guests, v_zone_id);
            v_state := CASE WHEN v_n > 0 THEN 'LIBRE' ELSE 'COMPLET' END;
        END IF;
        IF v_n > 0 THEN v_free := v_free + 1; END IF;
        v_slots := v_slots || jsonb_build_object('time', to_char(v_t, 'HH24:MI'), 'end_time', to_char(upper(v_slot), 'HH24:MI'),
                                                 'state', v_state, 'free_tables', v_n);
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'date', v_date, 'guests', v_guests, 'slot_minutes', v_min, 'slots', v_slots,
        'day', CASE WHEN v_open = 0 THEN 'FERME'
                    WHEN v_closed = v_open THEN 'FERMETURE_EXCEPTIONNELLE'
                    WHEN v_date < v_now::date THEN 'PASSE'
                    WHEN v_free = 0 THEN 'COMPLET'
                    ELSE 'OUVERT' END,
        'partly_closed', v_closed > 0 AND v_closed < v_open);
END;
$$;

-- Plan de salle d'un établissement public (montré seulement s'il est activé) : tables placées et zones, état de chaque
-- table au créneau choisi (LIBRE, PRISE, HORS_CAPACITE) ; rien sur les clients.
-- p : venue_id, date, time, guests (facultatifs : sans eux, aucun état).
CREATE OR REPLACE FUNCTION public.venue_floor(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v          record;
    v_date     date;
    v_time     time;
    v_guests   integer;
    v_slot     tsrange;
    v_min      integer;
BEGIN
    IF v_venue_id IS NULL OR NOT public.venue_is_public(v_venue_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est plus proposé.');
    END IF;
    SELECT * INTO v FROM public.venues WHERE id = v_venue_id;
    IF NOT v.floor_plan_enabled THEN
        RETURN jsonb_build_object('ok', true, 'enabled', false, 'tables', '[]'::jsonb, 'zones', '[]'::jsonb);
    END IF;
    BEGIN
        v_date := NULLIF(p->>'date', '')::date;
        v_time := NULLIF(p->>'time', '')::time;
        v_guests := NULLIF(p->>'guests', '')::int;
    EXCEPTION WHEN others THEN
        v_date := NULL;
    END;
    v_min := COALESCE(v.slot_minutes, public.fin_setting_num('tables.slot_minutes')::int);
    IF v_date IS NOT NULL AND v_time IS NOT NULL THEN
        v_slot := tsrange(v_date + v_time, v_date + v_time + v_min * interval '1 minute', '[)');
    END IF;
    RETURN jsonb_build_object('ok', true, 'enabled', true,
        'tables', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'id', c.id, 'number', c.table_number, 'capacity', c.capacity, 'min_capacity', c.min_capacity, 'zone_id', c.zone_id,
                     'x', c.plan_x, 'y', c.plan_y, 'shape', c.plan_shape, 'rotation', c.plan_rotation,
                     'state', CASE WHEN v_slot IS NULL THEN NULL
                                   WHEN v_guests IS NOT NULL AND v_guests NOT BETWEEN c.min_capacity AND c.capacity THEN 'HORS_CAPACITE'
                                   WHEN EXISTS (SELECT 1 FROM public.table_reservations o
                                                 WHERE o.table_id = c.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && v_slot
                                                   AND NOT (o.booking_state = 'EN_ATTENTE_PAIEMENT' AND o.hold_expires_at <= now())) THEN 'PRISE'
                                   ELSE 'LIBRE' END) ORDER BY c.table_number)
                   FROM public.restaurant_tables c WHERE c.venue_id = v.id AND c.is_active AND c.plan_x IS NOT NULL), '[]'::jsonb),
        'zones', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'x', z.plan_x, 'y', z.plan_y, 'w', z.plan_w, 'h', z.plan_h) ORDER BY z.name)
                   FROM public.restaurant_zones z WHERE z.venue_id = v.id AND z.is_active AND z.plan_x IS NOT NULL), '[]'::jsonb));
END;
$$;

-- Recherche publique : texte (nom, ville, adresse, partenaire), ville, genre ; avec une date et un nombre de personnes,
-- les créneaux libres autour de l'heure voulue (une heure avant et après, toutes les 30 minutes ; sans heure : de 12:00 à
-- 22:00) et, au choix, seulement les établissements qui en ont. 24 par page (48 au plus).
CREATE OR REPLACE FUNCTION public.venue_search(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_q      text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'q', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_city   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'city', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_kind   text := NULLIF(upper(COALESCE(p->>'kind', '')), '');
    v_date   date;
    v_time   time;
    v_guests integer;
    v_avail  boolean := COALESCE((p->>'available')::boolean, FALSE);
    v_limit  integer;
    v_offset integer;
    v_like   text;
    v_now    timestamp := public.hall_dakar_now();
    v_times  time[];
    v_total  integer;
    v_rows   jsonb;
    v_cities jsonb;
BEGIN
    BEGIN
        v_date := NULLIF(p->>'date', '')::date;
        v_time := NULLIF(p->>'time', '')::time;
        v_guests := COALESCE(NULLIF(p->>'guests', '')::int, 2);
        v_limit := COALESCE(NULLIF(p->>'limit', '')::int, 24);
        v_offset := COALESCE(NULLIF(p->>'offset', '')::int, 0);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Un des filtres n’est pas valable : vérifiez la date, l’heure et le nombre de personnes.');
    END;
    IF v_guests < 1 OR v_guests > 50 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Indiquez un nombre de personnes entre 1 et 50.');
    END IF;
    IF v_kind IS NOT NULL AND v_kind NOT IN ('RESTAURANT', 'BAR', 'ESPACE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Choisissez restaurant, bar ou espace.');
    END IF;
    IF v_time IS NOT NULL AND (EXTRACT(MINUTE FROM v_time)::int % 15 <> 0 OR EXTRACT(SECOND FROM v_time) <> 0) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Choisissez une heure au quart d’heure près.');
    END IF;
    IF v_date IS NOT NULL THEN
        IF v_date < v_now::date THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date à venir.');
        END IF;
        IF v_date > v_now::date + 90 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 90 jours à venir.');
        END IF;
        v_times := CASE WHEN v_time IS NULL
                        THEN ARRAY(SELECT gs::time FROM generate_series(timestamp '2001-01-01 12:00', timestamp '2001-01-01 22:00', interval '30 minutes') gs)
                        ELSE ARRAY(SELECT (timestamp '2001-01-01' + v_time + d * interval '30 minutes')::time
                                     FROM generate_series(-2, 2) d
                                    WHERE timestamp '2001-01-01' + v_time + d * interval '30 minutes' >= timestamp '2001-01-01'
                                      AND timestamp '2001-01-01' + v_time + d * interval '30 minutes' < timestamp '2001-01-02') END;
    END IF;
    v_limit := LEAST(GREATEST(v_limit, 1), 48);
    v_offset := LEAST(GREATEST(v_offset, 0), 10000);
    v_like := CASE WHEN v_q IS NULL THEN NULL
                   ELSE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' END;

    WITH visible AS (
        SELECT ve.id, ve.name, ve.kind, ve.city, ve.address, ve.photos, ve.latitude, ve.longitude, ve.deposit_per_person,
               ve.confirmation_mode, ve.created_at, ve.floor_plan_enabled,
               COALESCE(ve.slot_minutes, public.fin_setting_num('tables.slot_minutes')::int) AS slot_min,
               COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS partner_name
          FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
         WHERE ve.is_active AND ve.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE'
    ), matching AS (
        SELECT vi.* FROM visible vi
         WHERE (v_like IS NULL OR vi.name ILIKE v_like OR vi.city ILIKE v_like OR vi.address ILIKE v_like OR vi.partner_name ILIKE v_like)
           AND (v_city IS NULL OR lower(btrim(vi.city)) = lower(v_city))
           AND (v_kind IS NULL OR vi.kind = v_kind)
           AND EXISTS (SELECT 1 FROM public.restaurant_tables c WHERE c.venue_id = vi.id AND c.is_active
                          AND v_guests BETWEEN c.min_capacity AND c.capacity)
    ), slotted AS (
        SELECT m.*,
               CASE WHEN v_date IS NULL THEN '[]'::jsonb ELSE COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('time', to_char(t, 'HH24:MI'),
                                                       'state', CASE WHEN v_date + t <= v_now THEN 'PASSE'
                                                                     WHEN public.table_free_count(m.id, tsrange(v_date + t, v_date + t + m.slot_min * interval '1 minute', '[)'), v_guests, NULL) > 0
                                                                     THEN 'LIBRE' ELSE 'COMPLET' END) ORDER BY t)
                     FROM unnest(v_times) AS t
                    WHERE public.venue_open_covers(m.id, tsrange(v_date + t, v_date + t + m.slot_min * interval '1 minute', '[)'))
                      AND NOT public.venue_closed_during(m.id, tsrange(v_date + t, v_date + t + m.slot_min * interval '1 minute', '[)'))), '[]'::jsonb) END AS slots
          FROM matching m
    ), filtered AS (
        SELECT s.*, EXISTS (SELECT 1 FROM jsonb_array_elements(s.slots) e WHERE e->>'state' = 'LIBRE') AS has_free
          FROM slotted s
         WHERE NOT v_avail OR v_date IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(s.slots) e WHERE e->>'state' = 'LIBRE')
    )
    SELECT (SELECT count(*) FROM filtered),
           COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'id', f.id, 'name', f.name, 'kind', f.kind, 'city', f.city, 'address', f.address,
                        'photo', f.photos[1], 'photo_count', cardinality(f.photos), 'latitude', f.latitude, 'longitude', f.longitude,
                        'deposit_per_person', f.deposit_per_person, 'confirmation_mode', f.confirmation_mode,
                        'slot_minutes', f.slot_min, 'partner_name', f.partner_name, 'floor_plan', f.floor_plan_enabled,
                        'slots', f.slots, 'has_free', f.has_free) ORDER BY f.rank)
                      FROM (SELECT x.*, row_number() OVER (ORDER BY x.has_free DESC, x.created_at DESC, x.id) AS rank
                              FROM filtered x ORDER BY rank LIMIT v_limit OFFSET v_offset) f), '[]'::jsonb),
           COALESCE((SELECT jsonb_agg(c ORDER BY c) FROM (SELECT DISTINCT btrim(city) AS c FROM visible
                                                          WHERE NULLIF(btrim(city), '') IS NOT NULL) y), '[]'::jsonb)
      INTO v_total, v_rows, v_cities;
    RETURN jsonb_build_object('ok', true, 'total', v_total, 'venues', v_rows, 'cities', v_cities, 'limit', v_limit, 'offset', v_offset,
                              'date', v_date, 'time', to_char(v_time, 'HH24:MI'), 'guests', v_guests);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Réserver : fermeture exceptionnelle
-- ----------------------------------------------------------------------------
-- Recopie de 20261123000111_l11a_cv_limite_client.sql:69-266 ; changement : refus VENUE_CLOSED.
CREATE OR REPLACE FUNCTION public.table_reserve(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_table_id uuid := public.try_uuid(NULLIF(p->>'table_id', ''));
    v_zone_id  uuid := public.try_uuid(NULLIF(p->>'zone_id', ''));
    v_date     date;
    v_time     time;
    v_guests   integer;
    v          record;
    t          record;
    h          record;
    v_now      timestamp := public.hall_dakar_now();
    v_start    timestamp;
    v_slot_min integer;
    v_slot     tsrange;
    v_refusal  jsonb;
    v_deposit  numeric := 0;
    v_rate     numeric := public.fin_setting_num('tables.service_fee_rate');
    v_fee      numeric := 0;
    v_state    text;
    v_hold     timestamptz;
    v_due      timestamptz;
    v_id       uuid;
BEGIN
    IF NOT public.fin_setting_bool('features.tables_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'La réservation de tables n’est pas encore ouverte.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de réserver pour le moment.');
    END IF;
    IF v_venue_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_venue_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est plus proposé.');
    END IF;
    BEGIN
        v_date := (p->>'date')::date;
        v_time := (p->>'time')::time;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'La date ou l’heure choisie n’est pas valable.');
    END;
    IF v_date IS NULL OR v_time IS NULL OR v_time >= time '24:00' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'La date ou l’heure choisie n’est pas valable.');
    END IF;
    IF EXTRACT(SECOND FROM v_time) <> 0 OR EXTRACT(MINUTE FROM v_time)::int % 15 <> 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME', 'message', 'Choisissez une heure au quart d’heure près (par exemple 20:00, 20:15 ou 20:30).');
    END IF;
    BEGIN
        v_guests := (p->>'guests')::int;
    EXCEPTION WHEN others THEN
        v_guests := NULL;
    END;
    IF v_guests IS NULL OR v_guests < 1 OR v_guests > 50 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_GUESTS', 'message', 'Indiquez un nombre de personnes entre 1 et 50.');
    END IF;

    -- Une écriture à la fois par établissement, puis attentes de paiement échues rendues
    PERFORM public.table_venue_lock(v_venue_id);
    FOR h IN SELECT id FROM public.table_reservations
              WHERE venue_id = v_venue_id AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now() LOOP
        PERFORM public.table_expire_hold(h.id);
    END LOOP;

    SELECT ve.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = v_venue_id;
    IF NOT v.is_active OR v.partner_status <> 'VALIDE'
       OR (v.validation_status <> 'VALIDEE'
           AND (public.fin_setting_bool('tables.validation_required') OR v.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement n’accepte pas de réservation pour le moment.');
    END IF;
    IF v.owner_id = v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OWN_VENUE', 'message', 'Vous ne pouvez pas réserver dans votre propre établissement.');
    END IF;

    v_start := v_date + v_time;
    IF v_start <= v_now THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date et une heure à venir.');
    END IF;
    IF v_start > v_now + interval '90 days' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 90 jours à venir.');
    END IF;
    v_slot_min := COALESCE(v.slot_minutes, public.fin_setting_num('tables.slot_minutes')::int);
    v_slot := tsrange(v_start, v_start + v_slot_min * interval '1 minute', '[)');
    IF NOT public.venue_open_covers(v.id, v_slot) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS', 'message', 'L’établissement n’est pas ouvert à cette heure-là. Choisissez une autre heure.');
    END IF;

    -- Lot 11b : fermeture exceptionnelle de l'établissement sur ce créneau
    IF public.venue_closed_during(v.id, v_slot) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_CLOSED', 'message', 'L’établissement est exceptionnellement fermé à cette heure-là. Choisissez une autre date ou une autre heure.');
    END IF;

    -- Équivalent côté tables du trou T5 de la contre-vérification de la 10a : verrou par client (après celui de
    -- l'établissement, toujours dans cet ordre) avant de compter ses demandes : deux demandes simultanées du même client
    -- dans deux établissements ne passent pas toutes les deux
    PERFORM pg_advisory_xact_lock(hashtextextended('table_client:' || v_client::text, 0));
    -- Contre-vérification de la 11a (T2) : une seule table par client et par créneau dans cet établissement, puis au
    -- plus tables.max_pending_per_client réservations à venir non payées (gratuites confirmées comprises)
    v_refusal := COALESCE(public.table_client_slot_refusal(v_client, v.id, v_slot, NULL),
                          public.table_client_unpaid_refusal(v_client, NULL));
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;

    -- Zone et table : de cet établissement seulement
    IF v_zone_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.restaurant_zones z WHERE z.id = v_zone_id AND z.venue_id = v.id AND z.is_active) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Cette zone n’existe pas dans cet établissement.');
    END IF;
    IF v_table_id IS NOT NULL THEN
        SELECT * INTO t FROM public.restaurant_tables
         WHERE id = v_table_id AND venue_id = v.id AND is_active AND (v_zone_id IS NULL OR zone_id = v_zone_id);
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Cette table n’existe pas dans cet établissement.');
        END IF;
        IF v_guests > t.capacity OR v_guests < t.min_capacity THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_TOO_SMALL',
                'message', format('Cette table accueille de %s à %s personnes.', t.min_capacity, t.capacity));
        END IF;
        IF EXISTS (SELECT 1 FROM public.table_reservations o
                    WHERE o.table_id = t.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && v_slot) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Cette table est déjà réservée à cette heure-là. Choisissez une autre heure ou une autre table.');
        END IF;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.restaurant_tables c
                        WHERE c.venue_id = v.id AND c.is_active AND (v_zone_id IS NULL OR c.zone_id = v_zone_id)
                          AND v_guests BETWEEN c.min_capacity AND c.capacity) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_TABLE_FITS',
                'message', format('Aucune table ne peut accueillir %s personnes. Contactez l’établissement.', v_guests));
        END IF;
        -- La plus petite table qui convient et qui est libre sur tout le créneau
        SELECT c.* INTO t FROM public.restaurant_tables c
         WHERE c.venue_id = v.id AND c.is_active AND (v_zone_id IS NULL OR c.zone_id = v_zone_id)
           AND v_guests BETWEEN c.min_capacity AND c.capacity
           AND NOT EXISTS (SELECT 1 FROM public.table_reservations o
                            WHERE o.table_id = c.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && v_slot)
         ORDER BY c.capacity, c.table_number, c.id
         LIMIT 1;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_TABLE_FREE', 'message', 'Aucune table libre à cette heure-là. Choisissez une autre heure.');
        END IF;
    END IF;

    -- Argent, figé à la création : acompte par personne × personnes, frais de service arrondis au franc supérieur
    IF v.deposit_per_person IS NOT NULL THEN
        v_deposit := v.deposit_per_person * v_guests;
        v_fee := public.fin_round_up(v_deposit * v_rate / 100);
    END IF;
    IF v_deposit > 0 THEN
        v_state := 'EN_ATTENTE_PAIEMENT';
        v_hold := now() + make_interval(mins => public.fin_setting_num('tables.hold_minutes')::int);
    ELSIF v.confirmation_mode = 'MANUELLE' THEN
        v_state := 'EN_ATTENTE_ACCEPTATION';
        v_due := LEAST(now() + make_interval(mins => public.fin_setting_num('tables.response_minutes')::int), v_start AT TIME ZONE 'Africa/Dakar');
    ELSE
        v_state := 'CONFIRMEE';
    END IF;

    PERFORM set_config('event_village.table_booking', 'on', true);
    BEGIN
        INSERT INTO public.table_reservations (
            partner_id, venue_id, table_id, zone_id, client_id, reservation_date, reservation_time, guest_count, slot_minutes,
            booking_state, confirmation_mode, deposit_per_person, deposit_amount, service_fee_rate, service_fee_amount, total_amount,
            commission_rate, is_platform_payment, payment_status, hold_expires_at, response_due_at, confirmed_at, special_requests)
        VALUES (
            v.partner_id, v.id, t.id, t.zone_id, v_client, v_date, v_time, v_guests, v_slot_min,
            v_state, v.confirmation_mode, v.deposit_per_person, v_deposit, CASE WHEN v_deposit > 0 THEN v_rate END, v_fee, v_deposit + v_fee,
            CASE WHEN v_deposit > 0 THEN public.fin_setting_num('tables.commission_rate') END, v_deposit > 0, 'PENDING',
            v_hold, v_due, CASE WHEN v_state = 'CONFIRMEE' THEN now() END,
            NULLIF(left(btrim(regexp_replace(COALESCE(p->>'notes', ''), '[[:cntrl:]]', ' ', 'g')), 500), ''))
        RETURNING id INTO v_id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_TABLE_FREE', 'message', 'Aucune table libre à cette heure-là. Choisissez une autre heure.');
    END;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_client, 'CLIENT', 'TABLE_RESERVATION_CREATED', 'table_reservations', v_id,
            jsonb_build_object('booking_state', v_state, 'total_amount', v_deposit + v_fee, 'table_id', t.id),
            jsonb_build_object('venue_id', v.id, 'date', v_date, 'time', v_time, 'guests', v_guests, 'slot_minutes', v_slot_min));

    IF v_state = 'CONFIRMEE' THEN
        PERFORM public.table_notify('TABLE_RESERVATION_CONFIRMED', v_id, 'CLIENT');
        PERFORM public.table_notify('TABLE_NEW_RESERVATION', v_id, 'OWNER');
    ELSIF v_state = 'EN_ATTENTE_ACCEPTATION' THEN
        PERFORM public.table_notify('TABLE_REQUEST_SENT', v_id, 'CLIENT');
        PERFORM public.table_notify('TABLE_REQUEST_TO_ANSWER', v_id, 'OWNER');
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'reservation_id', v_id, 'booking_state', v_state,
        'venue_id', v.id, 'venue_name', v.name, 'table_id', t.id, 'table_number', t.table_number, 'zone_id', t.zone_id,
        'date', v_date, 'time', to_char(v_time, 'HH24:MI'), 'end_time', to_char(upper(v_slot), 'HH24:MI'), 'guests', v_guests,
        'deposit_amount', v_deposit, 'service_fee_amount', v_fee, 'total_amount', v_deposit + v_fee,
        'hold_expires_at', v_hold, 'response_due_at', v_due,
        'cancel_free_hours', public.fin_setting_num('tables.cancel_free_hours'));
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Paiement d'une attente reprise : fermeture exceptionnelle
-- ----------------------------------------------------------------------------
-- Recopie de 20261123000105_l11a_paiement.sql:31-73 ; changement : refus VENUE_CLOSED.
CREATE OR REPLACE FUNCTION public.table_hold_refusal(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
    v record;
    t record;
BEGIN
    SELECT * INTO r FROM public.table_reservations WHERE id = p_reservation_id;
    IF NOT FOUND OR r.venue_id IS NULL THEN
        RETURN jsonb_build_object('code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT ve.*, pa.status::text AS partner_status INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id WHERE ve.id = r.venue_id;
    IF NOT v.is_active OR v.partner_status <> 'VALIDE'
       OR (v.validation_status <> 'VALIDEE'
           AND (public.fin_setting_bool('tables.validation_required') OR v.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN
        RETURN jsonb_build_object('code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement n’accepte pas de réservation pour le moment.');
    END IF;
    SELECT * INTO t FROM public.restaurant_tables WHERE id = r.table_id AND venue_id = r.venue_id AND is_active;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('code', 'TABLE_NOT_FOUND', 'message', 'Cette table n’existe pas dans cet établissement.');
    END IF;
    IF r.guest_count > t.capacity OR r.guest_count < t.min_capacity THEN
        RETURN jsonb_build_object('code', 'TABLE_TOO_SMALL', 'message', format('Cette table accueille de %s à %s personnes.', t.min_capacity, t.capacity));
    END IF;
    IF lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('code', 'RESERVATION_NOT_ACTIVE', 'message', 'Cette réservation ne peut plus être payée.');
    END IF;
    IF NOT public.venue_open_covers(r.venue_id, r.slot) THEN
        RETURN jsonb_build_object('code', 'OUTSIDE_HOURS', 'message', 'L’établissement n’est pas ouvert à cette heure-là. Choisissez une autre heure.');
    END IF;
    -- Lot 11b : fermeture exceptionnelle posée depuis (une attente échue n'est pas annulée par la fermeture)
    IF public.venue_closed_during(r.venue_id, r.slot) THEN
        RETURN jsonb_build_object('code', 'VENUE_CLOSED', 'message', 'L’établissement est exceptionnellement fermé à cette heure-là : la réservation ne peut plus être payée.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.table_reservations o
                WHERE o.table_id = r.table_id AND o.id <> r.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && r.slot) THEN
        RETURN jsonb_build_object('code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la table a été réservée par quelqu’un d’autre.');
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.venue_closed_during(uuid, tsrange) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_free_count(uuid, tsrange, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_closure_parse(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_closure_touched(uuid, tsrange) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_closure_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_closure_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_closure_delete(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_is_public(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_slots(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_floor(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_search(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reserve(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_hold_refusal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.venue_closed_during(uuid, tsrange) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_free_count(uuid, tsrange, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_closure_parse(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_closure_touched(uuid, tsrange) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_closure_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_closure_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_closure_delete(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_is_public(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_slots(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_floor(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_search(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reserve(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_hold_refusal(uuid) TO service_role;

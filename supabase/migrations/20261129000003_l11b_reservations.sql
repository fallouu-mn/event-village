-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 03 : réservations (code court, « J'arrive », aperçu d'annulation, recettes, F1)
-- ============================================================================
--  1. table_reservations.short_code (7 caractères, unique, posé par trg_b_table_reservations_short_code ; lien court
--     des SMS « /t/<code> », pas un secret : la page exige la session et la propriété) ; client_coming_at (« J'arrive ») ;
--  2. table_partner_fiche_refusal(partenaire) : fiche VALIDE pour écrire (F1) ;
--  3. table_cancel_preview(p) : ce que le client récupère s'il annule maintenant (même règle que l'annulation, même
--     arrondi que table_refund_payment), avec l'heure limite de l'annulation gratuite ;
--  4. table_client_coming(p) : « J'arrive » (réservation confirmée du client, de 24 h avant l'heure à la fin de la garde
--     de la table) ; avis à l'établissement TABLE_CLIENT_COMING (type ajouté par la migration 04) ;
--  5. table_partner_earnings(actor) : recettes des établissements d'une partenaire, lues dans le grand livre ;
--     table_quote(p) : devis affiché avant de réserver (même calcul que table_reserve) ;
--  6. table_reservation_presence : recopie de 20261123000106_l11a_annulation.sql:316-362 ; changement (F1) : refus
--     PARTNER_SUSPENDED (ou PARTNER_NOT_VALIDATED) pour une fiche qui n'est pas VALIDE ;
--  7. table_reservation_cancel : recopie de 20261123000112_l11a_cv_annulation_demande.sql:14-79 ; changement (F1) : même refus pour
--     l'annulation par l'établissement.
-- Toutes réservées au rôle de service. Rejouable : ADD COLUMN IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS,
-- CREATE OR REPLACE, DROP TRIGGER IF EXISTS puis CREATE, codes posés seulement là où ils manquent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Code court (lien des SMS) et « J'arrive »
-- ----------------------------------------------------------------------------
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS short_code TEXT;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS client_coming_at TIMESTAMPTZ;

COMMENT ON COLUMN public.table_reservations.short_code IS
    'Lot 11b : identifiant court de la réservation (7 caractères), lien des SMS « /t/<code> » ; pas un secret : la page exige la session du client ou de l''établissement.';
COMMENT ON COLUMN public.table_reservations.client_coming_at IS
    'Lot 11b : le client a répondu « J''arrive » au rappel (montré sur le planning de l''établissement).';

-- 7 caractères parmi 31 (sans 0, 1, i, l, o) : 27 milliards de codes ; unicité vérifiée, nouvel essai sinon
CREATE OR REPLACE FUNCTION public.table_short_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_alpha text := '23456789abcdefghjkmnpqrstuvwxyz';
    v_code  text;
    v_try   integer := 0;
BEGIN
    LOOP
        v_code := '';
        FOR i IN 1..7 LOOP
            v_code := v_code || substr(v_alpha, 1 + floor(random() * 31)::int, 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.table_reservations WHERE short_code = v_code);
        v_try := v_try + 1;
        IF v_try > 20 THEN
            RAISE EXCEPTION 'table_short_code : aucun code libre après 20 essais';
        END IF;
    END LOOP;
    RETURN v_code;
END;
$$;

-- Code posé à la création (après la garde et l'état dérivé : ordre alphabétique des déclencheurs BEFORE)
CREATE OR REPLACE FUNCTION public.table_reservations_short_code()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.short_code IS NULL THEN
        NEW.short_code := public.table_short_code();
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.table_reservations_short_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_b_table_reservations_short_code ON public.table_reservations;
CREATE TRIGGER trg_b_table_reservations_short_code
    BEFORE INSERT ON public.table_reservations
    FOR EACH ROW EXECUTE FUNCTION public.table_reservations_short_code();

-- Réservations déjà là : un code chacune (une fois ; écriture admise par la garde avec le drapeau des fonctions)
SELECT set_config('event_village.table_booking', 'on', true);
UPDATE public.table_reservations SET short_code = public.table_short_code() WHERE short_code IS NULL;
SELECT set_config('event_village.table_booking', 'off', true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_table_reservations_short_code ON public.table_reservations(short_code);
ALTER TABLE public.table_reservations ALTER COLUMN short_code SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Fiche partenaire de l'établissement : VALIDE pour écrire (NULL si oui, sinon le refus)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.table_partner_fiche_refusal(p_partner_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN pa.status::text = 'SUSPENDU'
                THEN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED',
                         'message', 'Votre compte organisateur est suspendu : vos établissements et leurs réservations ne sont plus modifiables.')
                ELSE jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre compte partenaire doit être validé avant cette action.') END
      FROM public.partners pa
     WHERE pa.id = p_partner_id AND pa.status::text <> 'VALIDE';
$$;

-- ----------------------------------------------------------------------------
-- 3. Aperçu d'annulation par le client (montant rendu affiché avant de confirmer)
-- ----------------------------------------------------------------------------
-- Même règle que table_reservation_cancel (20261123000112, recopiée plus bas) et même calcul que table_refund_payment
-- (arrondi de chaque paiement encaissé) : rien n'est calculé par l'écran.
CREATE OR REPLACE FUNCTION public.table_cancel_preview(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client uuid := public.try_uuid(p->>'client_id');
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    r        record;
    v_now    timestamp := public.hall_dakar_now();
    v_free   numeric := public.fin_setting_num('tables.cancel_free_hours');
    v_pct    numeric;
    v_refund numeric;
BEGIN
    SELECT * INTO r FROM public.table_reservations WHERE id = v_res_id;
    IF v_res_id IS NULL OR NOT FOUND OR r.client_id IS DISTINCT FROM v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE') THEN
        RETURN jsonb_build_object('ok', true, 'can_cancel', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette réservation est déjà annulée ou terminée.');
    END IF;
    IF lower(r.slot) <= v_now THEN
        RETURN jsonb_build_object('ok', true, 'can_cancel', false, 'code', 'ALREADY_STARTED', 'message', 'L’heure de la réservation est passée : elle ne peut plus être annulée.');
    END IF;
    v_pct := CASE WHEN r.booking_state <> 'EN_ATTENTE_ACCEPTATION'
                  THEN public.table_client_refund_percent(lower(r.slot), v_now, v_free) ELSE 100 END;
    SELECT COALESCE(sum(round(py.amount * v_pct / 100)), 0) INTO v_refund
      FROM public.payments py
     WHERE py.table_reservation_id = r.id AND py.status::text = 'SUCCESS'
       AND NOT EXISTS (SELECT 1 FROM public.refunds f WHERE f.payment_id = py.id AND f.refund_transaction_id = 'REFUND-TABLE-' || py.id::text);
    RETURN jsonb_build_object('ok', true, 'can_cancel', true, 'paid_amount', r.paid_amount - r.refunded_amount,
                              'refund_amount', v_refund, 'kept_amount', GREATEST(r.paid_amount - r.refunded_amount - v_refund, 0),
                              'refund_percent', CASE WHEN r.paid_amount > 0 THEN v_pct ELSE 0 END,
                              'free_until', to_char(lower(r.slot) - v_free * interval '1 hour', 'YYYY-MM-DD"T"HH24:MI'),
                              'cancel_free_hours', v_free);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. « J'arrive » : le client confirme sa venue (rappel), l'établissement est prévenu
-- ----------------------------------------------------------------------------
-- Réservation confirmée du client, de 24 h avant l'heure à la fin du délai d'absence ; une fois (idempotent).
CREATE OR REPLACE FUNCTION public.table_client_coming(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client uuid := public.try_uuid(p->>'client_id');
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    r        record;
    v_now    timestamp := public.hall_dakar_now();
    v_grace  interval := public.fin_setting_num('tables.no_show_minutes') * interval '1 minute';
BEGIN
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT * INTO r FROM public.table_reservations WHERE id = v_res_id FOR UPDATE;
    IF r.client_id IS DISTINCT FROM v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF r.booking_state <> 'CONFIRMEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CONFIRMED', 'message', 'Seule une réservation confirmée peut être confirmée ainsi.');
    END IF;
    IF v_now < lower(r.slot) - interval '24 hours' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_EARLY', 'message', 'Vous pourrez confirmer votre venue le jour de la réservation.');
    END IF;
    IF v_now >= lower(r.slot) + v_grace THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_LATE', 'message', 'L’heure de garde de la table est passée.');
    END IF;
    IF r.client_coming_at IS NULL THEN
        PERFORM set_config('event_village.table_booking', 'on', true);
        UPDATE public.table_reservations SET client_coming_at = now(), updated_at = now() WHERE id = r.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
        VALUES (v_client, 'CLIENT', 'TABLE_CLIENT_COMING', 'table_reservations', r.id, jsonb_build_object('client_coming', true));
        PERFORM public.table_notify('TABLE_CLIENT_COMING', r.id, 'OWNER');
    END IF;
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id,
                              'held_until', to_char(lower(r.slot) + v_grace, 'HH24:MI'));
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Recettes des établissements d'une partenaire, lues dans le grand livre (comme hall_partner_earnings)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.table_partner_earnings(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid;
    v_rows    jsonb;
    v_avail   numeric;
    v_coming  numeric;
BEGIN
    SELECT pa.id INTO v_partner FROM public.partners pa WHERE pa.user_id = p_actor;
    IF p_actor IS NULL OR v_partner IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Espace réservé aux partenaires.');
    END IF;
    WITH per AS (
        SELECT r.id, r.venue_id, v.name AS venue_name, r.reservation_date, r.reservation_time, upper(r.slot) AS ends_at,
               r.guest_count, r.booking_state, r.paid_amount, r.refunded_amount,
               COALESCE(sum(l.amount), 0) AS earned,
               COALESCE(sum(l.amount) FILTER (WHERE l.available_at <= now()), 0) AS available,
               max(l.available_at) FILTER (WHERE l.entry_type = 'VENTE') AS available_at
          FROM public.table_reservations r
          JOIN public.venues v ON v.id = r.venue_id
          JOIN public.payments py ON py.table_reservation_id = r.id
          JOIN public.finance_ledger l ON l.payment_id = py.id AND l.account_kind = 'ORGANISATEUR'
         WHERE r.partner_id = v_partner
         GROUP BY r.id, v.name
    ), latest AS (
        SELECT * FROM per ORDER BY reservation_date DESC, reservation_time DESC, id LIMIT 200
    )
    SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object(
               'reservation_id', id, 'venue_id', venue_id, 'venue_name', venue_name, 'date', reservation_date,
               'time', to_char(reservation_time, 'HH24:MI'), 'end_time', to_char(ends_at, 'HH24:MI'), 'guests', guest_count,
               'booking_state', booking_state, 'paid_amount', paid_amount, 'refunded_amount', refunded_amount,
               'earned', earned, 'available_at', available_at, 'available', available_at IS NOT NULL AND available_at <= now())
             ORDER BY reservation_date DESC, reservation_time DESC, id) FROM latest), '[]'::jsonb),
           (SELECT COALESCE(sum(available), 0) FROM per),
           (SELECT COALESCE(sum(earned - available), 0) FROM per)
      INTO v_rows, v_avail, v_coming;
    RETURN jsonb_build_object('ok', true, 'available_total', v_avail, 'upcoming_total', v_coming, 'rows', v_rows);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Devis affiché avant de réserver (même calcul que table_reserve : acompte par personne × personnes, frais de
--    service arrondis au franc supérieur) et règles de l'établissement public
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.table_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_guests   integer;
    v          record;
    v_rate     numeric := public.fin_setting_num('tables.service_fee_rate');
    v_deposit  numeric := 0;
    v_fee      numeric := 0;
BEGIN
    IF v_venue_id IS NULL OR NOT public.venue_is_public(v_venue_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est plus proposé.');
    END IF;
    BEGIN
        v_guests := (p->>'guests')::int;
    EXCEPTION WHEN others THEN
        v_guests := NULL;
    END;
    IF v_guests IS NULL OR v_guests < 1 OR v_guests > 50 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_GUESTS', 'message', 'Indiquez un nombre de personnes entre 1 et 50.');
    END IF;
    SELECT * INTO v FROM public.venues WHERE id = v_venue_id;
    IF v.deposit_per_person IS NOT NULL THEN
        v_deposit := v.deposit_per_person * v_guests;
        v_fee := public.fin_round_up(v_deposit * v_rate / 100);
    END IF;
    RETURN jsonb_build_object('ok', true, 'guests', v_guests, 'deposit_per_person', COALESCE(v.deposit_per_person, 0),
        'deposit_amount', v_deposit, 'service_fee_rate', CASE WHEN v_deposit > 0 THEN v_rate ELSE 0 END, 'service_fee_amount', v_fee,
        'total_amount', v_deposit + v_fee, 'confirmation_mode', v.confirmation_mode,
        'slot_minutes', COALESCE(v.slot_minutes, public.fin_setting_num('tables.slot_minutes')::int),
        'hold_minutes', public.fin_setting_num('tables.hold_minutes'), 'response_minutes', public.fin_setting_num('tables.response_minutes'),
        'cancel_free_hours', public.fin_setting_num('tables.cancel_free_hours'), 'no_show_minutes', public.fin_setting_num('tables.no_show_minutes'));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Présence : fiche VALIDE (F1)
-- ----------------------------------------------------------------------------
-- Recopie de 20261123000106_l11a_annulation.sql:316-362 ; changement : refus pour une fiche qui n'est pas VALIDE.
CREATE OR REPLACE FUNCTION public.table_reservation_presence(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_action text := upper(COALESCE(p->>'action', ''));
    v_now    timestamp := public.hall_dakar_now();
    r        record;
BEGIN
    IF v_action NOT IN ('ARRIVEE', 'ABSENT') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Indiquez si le client est arrivé ou absent.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;
    IF v_actor IS NULL OR v_actor <> r.owner_id
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    -- Lot 11b (F1) : fiche partenaire VALIDE exigée (une fiche suspendue ne marque plus un client arrivé ou absent)
    IF public.table_partner_fiche_refusal(r.partner_id) IS NOT NULL THEN
        RETURN public.table_partner_fiche_refusal(r.partner_id);
    END IF;
    IF r.booking_state <> 'CONFIRMEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CONFIRMED', 'message', 'Seule une réservation confirmée peut être marquée ainsi.');
    END IF;
    IF (v_action = 'ARRIVEE' AND v_now < lower(r.slot) - interval '1 hour') OR (v_action = 'ABSENT' AND v_now < lower(r.slot)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_EARLY', 'message', 'Il est trop tôt : attendez l’heure de la réservation.');
    END IF;
    IF v_now >= upper(r.slot) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_LATE', 'message', 'Le créneau de cette réservation est terminé.');
    END IF;
    IF v_action = 'ABSENT' THEN
        RETURN public.table_close_apply(r.id, 'ABSENT', NULL, v_actor, 'Client absent', 0);
    END IF;
    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations SET booking_state = 'ARRIVEE', arrived_at = now(), updated_at = now() WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'TABLE_GUEST_ARRIVED', 'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state), jsonb_build_object('booking_state', 'ARRIVEE'));
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'booking_state', 'ARRIVEE');
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Annulation par l'établissement : fiche VALIDE (F1)
-- ----------------------------------------------------------------------------
-- Recopie de 20261123000112_l11a_cv_annulation_demande.sql:14-79 ; changement : refus pour une fiche qui n'est pas VALIDE (origine établissement).
CREATE OR REPLACE FUNCTION public.table_reservation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_origin text := upper(COALESCE(p->>'origin', ''));
    v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    r        record;
    v_pct    numeric;
    v_state  text;
BEGIN
    IF v_origin NOT IN ('CLIENT', 'ETABLISSEMENT', 'EVENT_VILLAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ORIGIN', 'message', 'Annulation refusée.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;

    -- Droits : le client sur la sienne, l'établissement sur celles de ses établissements, Event Village avec le droit
    -- des remboursements (ou la modération des services pour une demande jamais payée)
    IF v_origin = 'CLIENT' AND (v_actor IS NULL OR v_actor <> r.client_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF v_origin = 'ETABLISSEMENT' AND (v_actor IS NULL OR v_actor <> r.owner_id
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    -- Lot 11b (F1) : l'établissement annule seulement avec une fiche partenaire VALIDE
    IF v_origin = 'ETABLISSEMENT' AND public.table_partner_fiche_refusal(r.partner_id) IS NOT NULL THEN
        RETURN public.table_partner_fiche_refusal(r.partner_id);
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND (v_actor IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
        OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                OR public.has_admin_permission(v_actor, 'refunds.manage')
                OR (r.paid_amount = 0 AND r.booking_state IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION')
                    AND public.has_admin_permission(v_actor, 'events.write')))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler cette réservation.');
    END IF;
    IF v_origin IN ('ETABLISSEMENT', 'EVENT_VILLAGE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette réservation est déjà annulée ou terminée.');
    END IF;
    IF v_origin IN ('CLIENT', 'ETABLISSEMENT') AND lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_STARTED', 'message', 'L’heure de la réservation est passée : elle ne peut plus être annulée.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND upper(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ENDED', 'message', 'La réservation est terminée : elle ne peut plus être annulée.');
    END IF;

    -- Contre-vérification de la 11a (T3) : une demande que l'établissement n'a pas encore acceptée est rendue en entier,
    -- quelle que soit l'heure ; la règle des tables.cancel_free_hours ne vaut que pour une réservation confirmée
    v_pct := CASE WHEN v_origin = 'CLIENT' AND r.booking_state <> 'EN_ATTENTE_ACCEPTATION'
                  THEN public.table_client_refund_percent(lower(r.slot), public.hall_dakar_now(), public.fin_setting_num('tables.cancel_free_hours'))
                  ELSE 100 END;
    v_state := CASE v_origin WHEN 'CLIENT' THEN 'ANNULEE_CLIENT' WHEN 'ETABLISSEMENT' THEN 'ANNULEE_ETABLISSEMENT' ELSE 'ANNULEE_EV' END;
    RETURN public.table_close_apply(r.id, v_state, v_origin, v_actor, COALESCE(v_reason, 'Annulation par le client'), v_pct)
           || jsonb_build_object('cancel_free_hours', public.fin_setting_num('tables.cancel_free_hours'));
END;
$$;

REVOKE ALL ON FUNCTION public.table_short_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_partner_fiche_refusal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_cancel_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_client_coming(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_partner_earnings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_quote(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reservation_presence(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reservation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_short_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.table_partner_fiche_refusal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_cancel_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_client_coming(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_partner_earnings(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_quote(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reservation_presence(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reservation_cancel(jsonb) TO service_role;

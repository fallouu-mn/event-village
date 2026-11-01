-- ============================================================================
-- EVENT VILLAGE — LOT 5 : dette du lot 4 (tâche 5.0, contrat C1 à C8)
-- ============================================================================
--  C1. Transferts entre particuliers : ticket_transfer_initiate, ticket_transfer_cancel et
--      ticket_transfers_expire posent le transfert et tickets.transfer_locked dans la même
--      transaction (la réclamation, ticket_transfer_claim, existe depuis le lot 4).
--  C2. Clôture de caisse : shift_close, sous verrou de la caisse, écart relu sous verrou, justification
--      et co-signature par PIN régisseur vérifiées dans la transaction, alerte in-app atomique ;
--      controller_shifts.closed_by.
--  C3. atomic_partner_remove_controller : refuse p_partner_id NULL, ne retire le rôle CONTROLEUR que
--      si une affectation de ce partenaire a été retirée, renvoie removed_assignments, search_path fixé.
--  C4. user_roles_set : l'ensemble des rôles d'un compte remplacé en une transaction (tout ou rien).
--  C6. otp_check : essai sérialisé par verrou sur la ligne du code, compteur atomique, limite de 5,
--      consommation dans la même transaction.
--  C7. Vente au guichet = entrée immédiate, billet sans compte : tickets.user_id et payments.client_id
--      nullables sous CHECK, tickets.sale_channel, ticket_scans.method COUNTER ; counter_sale crée les
--      billets UTILISE, leurs lignes ticket_scans acceptées, le paiement hors plateforme et l'incrément
--      de la caisse en une transaction, idempotente par clé ; free_tickets_claim marque ses billets FREE.
--  C8. scan_incidents (incidents techniques du scan, à part de ticket_scans) et scan_incident_log.
-- Toutes les fonctions : SECURITY DEFINER, search_path = public, EXECUTE au seul service_role.
-- ============================================================================

-- ── Outil : texte → uuid, NULL si la valeur n'est pas un identifiant ────────
CREATE OR REPLACE FUNCTION public.try_uuid(p_value text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_value::uuid END
$$;

-- ============================================================================
-- C7 — schéma du billet sans compte
-- ============================================================================
ALTER TABLE public.tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sale_channel TEXT;
-- Reprise : ventes au guichet du lot 4 (paiement COUNTER_SALE), billets gratuits (prix 0 sans
-- paiement, free_tickets_claim), le reste vendu en ligne. Aucune invitation n'existait avant ce lot.
UPDATE public.tickets t
   SET sale_channel = CASE
           WHEN EXISTS (SELECT 1 FROM public.payments p WHERE p.id = t.payment_id AND p.metadata->>'source' = 'COUNTER_SALE') THEN 'COUNTER'
           WHEN t.price = 0 AND t.payment_id IS NULL THEN 'FREE'
           ELSE 'ONLINE'
       END
 WHERE t.sale_channel IS NULL;
ALTER TABLE public.tickets ALTER COLUMN sale_channel SET DEFAULT 'ONLINE';
ALTER TABLE public.tickets ALTER COLUMN sale_channel SET NOT NULL;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_sale_channel_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_sale_channel_check
    CHECK (sale_channel IN ('ONLINE', 'FREE', 'INVITATION', 'COUNTER'));
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_holder_or_counter;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_holder_or_counter
    CHECK (user_id IS NOT NULL OR sale_channel = 'COUNTER');
CREATE INDEX IF NOT EXISTS idx_tickets_event_channel ON public.tickets (event_id, sale_channel);
COMMENT ON COLUMN public.tickets.sale_channel IS
    'Lot 5 (C7) : canal d''émission — ONLINE (paiement en ligne), FREE (billet gratuit), INVITATION, COUNTER (vente au guichet, sans compte).';

ALTER TABLE public.payments ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_client_or_counter_sale;
ALTER TABLE public.payments ADD CONSTRAINT payments_client_or_counter_sale
    CHECK (client_id IS NOT NULL OR (NOT is_platform_payment AND metadata->>'source' = 'COUNTER_SALE'));

-- ticket_scans.method : COUNTER (vente au guichet = entrée immédiate). Le CHECK de colonne du lot 4
-- (20261101000010_lot4_scan.sql:39) est retrouvé par sa définition, quel que soit son nom.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = 'public.ticket_scans'::regclass AND contype = 'c'
           AND pg_get_constraintdef(oid) ~ 'method' AND pg_get_constraintdef(oid) ~ 'MANUAL'
    LOOP
        EXECUTE format('ALTER TABLE public.ticket_scans DROP CONSTRAINT %I', c.conname);
    END LOOP;
END;
$$;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_method_check CHECK (method IN ('QR', 'MANUAL', 'COUNTER'));

-- ============================================================================
-- C1 — transferts entre particuliers
-- ============================================================================
-- Ordre des verrous partout : transferts du billet, puis billet (comme ticket_transfer_claim).
CREATE OR REPLACE FUNCTION public.ticket_transfer_initiate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    v_actor uuid := public.try_uuid(COALESCE(p->>'actor_id', p->>'from_user_id'));
    v_recipient text := NULLIF(btrim(COALESCE(p->>'recipient', p->>'to_phone_or_email', '')), '');
    v_hash text := p->>'claim_token_hash';
    v_expires timestamptz;
    t record;
    v_event_status text;
    v_event_title text;
    v_id uuid;
BEGIN
    IF v_ticket IS NULL OR v_actor IS NULL OR v_recipient IS NULL OR char_length(v_recipient) > 254
       OR v_hash IS NULL OR v_hash !~ '^[0-9a-f]{64}$' OR NULLIF(p->>'expires_at', '') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de transfert incomplète.');
    END IF;
    v_expires := (p->>'expires_at')::timestamptz;
    IF v_expires <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Échéance du transfert invalide.');
    END IF;

    PERFORM 1 FROM public.ticket_transfers WHERE ticket_id = v_ticket AND status = 'PENDING' FOR UPDATE;
    SELECT * INTO t FROM public.tickets WHERE id = v_ticket FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF t.user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_OWNER', 'message', 'Vous n''êtes pas le porteur de ce billet.');
    END IF;
    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_TRANSFERABLE', 'status', t.status::text,
                                  'message', 'Seul un billet valide peut être transféré.');
    END IF;
    IF t.checked_in_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_USED', 'message', 'Ce billet a déjà servi à l''entrée.');
    END IF;
    SELECT status::text, title INTO v_event_status, v_event_title FROM public.events WHERE id = t.event_id;
    IF v_event_status IS NULL OR v_event_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n''accepte plus les transferts de billets.');
    END IF;

    -- Un transfert échu que le cron n'a pas encore traité ne bloque pas le porteur
    UPDATE public.ticket_transfers SET status = 'EXPIRED', expired_at = now()
     WHERE ticket_id = v_ticket AND status = 'PENDING' AND expires_at <= now();
    IF EXISTS (SELECT 1 FROM public.ticket_transfers WHERE ticket_id = v_ticket AND status = 'PENDING') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_PENDING', 'message', 'Ce billet est déjà engagé dans un transfert en attente.');
    END IF;

    INSERT INTO public.ticket_transfers (ticket_id, from_user_id, to_phone_or_email, status, claim_token_hash, expires_at)
    VALUES (v_ticket, v_actor, v_recipient, 'PENDING', v_hash, v_expires)
    RETURNING id INTO v_id;
    UPDATE public.tickets SET transfer_locked = TRUE, updated_at = now() WHERE id = v_ticket;

    RETURN jsonb_build_object('ok', true, 'transfer_id', v_id, 'ticket_id', t.id, 'ticket_number', t.ticket_number,
                              'event_id', t.event_id, 'event_title', v_event_title, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.ticket_transfer_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer uuid := public.try_uuid(p->>'transfer_id');
    v_actor uuid := public.try_uuid(COALESCE(p->>'actor_id', p->>'from_user_id'));
    tr record;
BEGIN
    IF v_transfer IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande d''annulation incomplète.');
    END IF;
    SELECT * INTO tr FROM public.ticket_transfers WHERE id = v_transfer FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Transfert introuvable.');
    END IF;
    IF tr.from_user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_SENDER', 'message', 'Vous n''êtes pas l''émetteur de ce transfert.');
    END IF;
    IF tr.status::text <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'status', tr.status::text,
                                  'message', 'Ce transfert n''est plus en attente.');
    END IF;
    PERFORM 1 FROM public.tickets WHERE id = tr.ticket_id FOR UPDATE;
    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now() WHERE id = tr.id;
    UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = tr.ticket_id;
    RETURN jsonb_build_object('ok', true, 'transfer_id', tr.id, 'ticket_id', tr.ticket_id, 'to_phone_or_email', tr.to_phone_or_email);
END;
$$;

-- p : { limit? } (défaut 500). Les transferts en cours de réclamation (verrouillés) sont laissés au passage suivant.
CREATE OR REPLACE FUNCTION public.ticket_transfers_expire(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer := 500;
    v_expired jsonb;
    v_unlocked integer;
BEGIN
    IF jsonb_typeof(p->'limit') = 'number' THEN
        v_limit := GREATEST(1, LEAST(5000, (p->>'limit')::numeric::integer));
    END IF;
    WITH due AS (
        SELECT id FROM public.ticket_transfers
         WHERE status = 'PENDING' AND expires_at <= now()
         ORDER BY expires_at, id
         LIMIT v_limit
           FOR UPDATE SKIP LOCKED
    ), upd AS (
        UPDATE public.ticket_transfers tt SET status = 'EXPIRED', expired_at = now()
          FROM due WHERE tt.id = due.id
        RETURNING tt.id, tt.ticket_id, tt.from_user_id, tt.to_phone_or_email
    ), unlocked AS (
        UPDATE public.tickets t SET transfer_locked = FALSE, updated_at = now()
          FROM upd WHERE t.id = upd.ticket_id AND t.transfer_locked
        RETURNING t.id
    )
    SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'ticket_id', u.ticket_id, 'from_user_id', u.from_user_id,
                                                         'to_phone_or_email', u.to_phone_or_email) ORDER BY u.id) FROM upd u), '[]'::jsonb),
           (SELECT count(*)::int FROM unlocked)
      INTO v_expired, v_unlocked;
    RETURN jsonb_build_object('ok', true, 'expired_count', jsonb_array_length(v_expired), 'unlocked_count', v_unlocked, 'expired', v_expired);
END;
$$;

-- ============================================================================
-- C2 — clôture de caisse
-- ============================================================================
ALTER TABLE public.controller_shifts ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.users(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.controller_shifts.closed_by IS
    'Lot 5 (C2) : auteur de la clôture (contrôleur de la caisse, partenaire propriétaire ou admin).';

-- p : { shift_id, actor_id, declared_cash_total (entier ≥ 0), justification?, pin_salt?, pin_hash? }.
-- Le PIN régisseur est haché par la route (HMAC avec REGISSEUR_PIN_KEY, clé jamais stockée en base) avec le
-- sel lu juste avant ; le haché et le sel sont comparés ici, sous verrou, à ceux de l'événement (un PIN
-- régénéré entre-temps donne PIN_INVALID).
CREATE OR REPLACE FUNCTION public.shift_close(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift uuid := public.try_uuid(p->>'shift_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_just text := NULLIF(btrim(COALESCE(p->>'justification', '')), '');
    v_pin_salt text := NULLIF(p->>'pin_salt', '');
    v_pin_hash text := NULLIF(p->>'pin_hash', '');
    sh record;
    pin record;
    v_role text;
    v_declared numeric;
    v_disc numeric;
    v_cosigned boolean := FALSE;
    v_partner_user uuid;
    v_event_title text;
    v_ctrl_name text;
    v_amount_txt text;
    v_alert uuid;
BEGIN
    IF v_shift IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de clôture incomplète.');
    END IF;
    SELECT * INTO sh FROM public.controller_shifts WHERE id = v_shift FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status = 'ACTIF') THEN
        v_role := CASE
            WHEN sh.controller_id = v_actor THEN 'CAISSE'
            WHEN EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = sh.partner_id AND pa.user_id = v_actor) THEN 'PARTENAIRE'
            WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN 'ADMIN'
        END;
    END IF;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF sh.status <> 'OUVERT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_OPEN', 'status', sh.status,
                                  'message', 'Cette session de caisse est déjà clôturée.');
    END IF;
    IF jsonb_typeof(p->'declared_cash_total') IS DISTINCT FROM 'number' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;
    v_declared := (p->>'declared_cash_total')::numeric;
    IF v_declared < 0 OR v_declared <> trunc(v_declared) OR v_declared > 9999999999 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;

    v_disc := v_declared - sh.expected_cash_total;   -- total attendu relu sous verrou
    IF v_disc <> 0 THEN
        IF v_just IS NULL OR char_length(v_just) < 10 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'JUSTIFICATION_REQUIRED', 'expected', sh.expected_cash_total,
                                      'declared', v_declared, 'discrepancy', v_disc,
                                      'message', 'Un écart de caisse doit être justifié (10 caractères au moins).');
        END IF;
        IF char_length(v_just) > 1000 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_JUSTIFICATION', 'message', 'La justification est limitée à 1 000 caractères.');
        END IF;
        IF v_pin_salt IS NULL OR v_pin_hash IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_REQUIRED', 'expected', sh.expected_cash_total,
                                      'declared', v_declared, 'discrepancy', v_disc,
                                      'message', 'Le code PIN régisseur est obligatoire pour co-signer une clôture avec écart.');
        END IF;
        SELECT pin_hash, pin_salt INTO pin FROM public.event_regisseur_pins WHERE event_id = sh.event_id FOR SHARE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_NOT_SET', 'message', 'Aucun code PIN régisseur n''a été généré pour cet événement.');
        END IF;
        IF pin.pin_salt IS DISTINCT FROM v_pin_salt OR pin.pin_hash IS DISTINCT FROM v_pin_hash THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_INVALID', 'message', 'Code PIN régisseur incorrect.');
        END IF;
        v_cosigned := TRUE;
    END IF;

    UPDATE public.controller_shifts
       SET status = 'CLOTURE',
           declared_cash_total = v_declared,
           discrepancy_amount = v_disc,
           discrepancy_justification = CASE WHEN v_disc <> 0 THEN v_just END,
           closed_at = now(),
           closed_by = v_actor,
           closing_confirmed_by_pin = v_cosigned,
           updated_at = now()
     WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'SHIFT_CLOSED', 'controller_shifts', sh.id,
            jsonb_build_object('event_id', sh.event_id, 'expected', sh.expected_cash_total, 'declared', v_declared,
                               'discrepancy', v_disc, 'pin_cosigned', v_cosigned, 'closed_by_role', v_role));

    SELECT title INTO v_event_title FROM public.events WHERE id = sh.event_id;
    SELECT NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') INTO v_ctrl_name
      FROM public.users WHERE id = sh.controller_id;
    IF v_disc <> 0 THEN
        SELECT user_id INTO v_partner_user FROM public.partners WHERE id = sh.partner_id;
        v_amount_txt := CASE WHEN v_disc > 0 THEN '+' ELSE '-' END
            || regexp_replace(trunc(abs(v_disc))::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') || ' F CFA';
        IF v_partner_user IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, type, title, content, channel, status, sent_at, metadata)
            VALUES (v_partner_user, 'ALERT', 'Écart de caisse détecté',
                    format('La caisse de %s sur « %s » a été clôturée avec un écart de %s. Justification : %s',
                           COALESCE(v_ctrl_name, 'votre contrôleur'), COALESCE(v_event_title, 'votre événement'), v_amount_txt, v_just),
                    'PUSH', 'SENT', now(),
                    jsonb_build_object('shift_id', sh.id, 'event_id', sh.event_id, 'discrepancy_amount', v_disc,
                                       'expected', sh.expected_cash_total, 'declared', v_declared, 'closed_by', v_actor))
            RETURNING id INTO v_alert;
        END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'shift_id', sh.id, 'event_id', sh.event_id, 'partner_id', sh.partner_id,
                              'expected', sh.expected_cash_total, 'declared', v_declared, 'discrepancy', v_disc,
                              'pin_cosigned', v_cosigned, 'closed_by', v_actor, 'closed_by_role', v_role,
                              'alert_id', v_alert, 'event_title', v_event_title, 'controller_name', v_ctrl_name,
                              'justification', CASE WHEN v_disc <> 0 THEN v_just END);
END;
$$;

-- ============================================================================
-- C3 — retrait d'un contrôleur de l'équipe d'un partenaire
-- ============================================================================
-- 20260906000001_atomic_partner_remove_controller.sql : avec p_partner_id NULL, rien n'était supprimé mais
-- le rôle CONTROLEUR d'un compte sans affectation l'était ; aucune vérification d'appartenance ; pas de
-- search_path. Même signature (appelée par app/api/partner/team/controller/[controllerId]/route.ts).
CREATE OR REPLACE FUNCTION public.atomic_partner_remove_controller(p_partner_id uuid, p_controller_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_removed integer;
    v_remaining integer;
    v_role_removed integer := 0;
BEGIN
    IF p_partner_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_REQUIRED', 'message', 'Précisez l''organisateur dont le contrôleur doit être retiré.');
    END IF;
    IF p_controller_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_REQUIRED', 'message', 'Contrôleur à retirer non précisé.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = p_partner_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Organisateur introuvable.');
    END IF;

    -- Verrous : retrait concurrent du même contrôleur, puis profil (sérialise avec user_roles_set)
    PERFORM pg_advisory_xact_lock(hashtext('smart_delete_' || p_controller_id::text));
    PERFORM 1 FROM public.users WHERE id = p_controller_id FOR UPDATE;

    -- Le trigger controller_removal_guard refuse (EV409) le retrait d'une affectation à caisse ouverte
    WITH del AS (
        DELETE FROM public.event_controllers ec
         USING public.events e
         WHERE ec.event_id = e.id AND e.partner_id = p_partner_id AND ec.user_id = p_controller_id
        RETURNING ec.id
    )
    SELECT count(*)::int INTO v_removed FROM del;
    IF v_removed = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_NOT_IN_TEAM', 'removed_assignments', 0,
                                  'message', 'Ce contrôleur ne fait pas partie de l''équipe de cet organisateur.');
    END IF;

    SELECT count(*)::int INTO v_remaining FROM public.event_controllers WHERE user_id = p_controller_id;
    IF v_remaining = 0 THEN
        DELETE FROM public.user_roles WHERE user_id = p_controller_id AND role = 'CONTROLEUR';
        GET DIAGNOSTICS v_role_removed = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object('ok', true, 'removed_assignments', v_removed, 'remaining_assignments', v_remaining,
                              'is_exclusive', (v_remaining = 0), 'role_removed', (v_role_removed > 0),
                              'new_role', CASE WHEN v_remaining = 0 THEN 'CLIENT' ELSE 'CONTROLEUR' END);
END;
$$;

-- ============================================================================
-- C4 — rôles d'un compte remplacés en une transaction
-- ============================================================================
-- p : { user_id, roles text[], actor_id }. CLIENT toujours conservé. Si le trigger controller_removal_guard
-- refuse le retrait de CONTROLEUR (caisse ouverte, EV409), aucun rôle n'est modifié.
CREATE OR REPLACE FUNCTION public.user_roles_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_target text[];
    v_before text[];
    v_invalid text[];
    v_actor_super boolean;
BEGIN
    IF v_user IS NULL OR v_actor IS NULL OR jsonb_typeof(p->'roles') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Changement de rôles incomplet.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Changement de rôles réservé à un administrateur actif.');
    END IF;
    v_actor_super := EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role = 'SUPERADMIN');

    SELECT array_agg(DISTINCT x ORDER BY x) INTO v_target
      FROM (SELECT jsonb_array_elements_text(p->'roles') AS x UNION SELECT 'CLIENT') s;
    SELECT array_agg(x ORDER BY x) INTO v_invalid
      FROM unnest(v_target) AS x
     WHERE x NOT IN (SELECT unnest(enum_range(NULL::public.user_role))::text);
    IF v_invalid IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ROLE', 'roles', to_jsonb(v_invalid), 'message', 'Rôle inconnu.');
    END IF;

    PERFORM 1 FROM public.users WHERE id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY[]::text[]) INTO v_before
      FROM public.user_roles WHERE user_id = v_user;
    IF NOT v_actor_super AND ('SUPERADMIN' = ANY (v_target) OR 'SUPERADMIN' = ANY (v_before)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_REQUIRED', 'message', 'Seul un superadmin peut attribuer ou retirer le rôle de superadmin.');
    END IF;

    BEGIN
        DELETE FROM public.user_roles WHERE user_id = v_user AND NOT (role::text = ANY (v_target));
        INSERT INTO public.user_roles (user_id, role)
        SELECT v_user, x::public.user_role FROM unnest(v_target) AS x
        ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN SQLSTATE 'EV409' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_HAS_OPEN_SHIFT',
                                  'message', 'Ce contrôleur a une caisse ouverte : clôturez-la avant de lui retirer ce rôle.');
    END;

    RETURN jsonb_build_object('ok', true,
        'before', to_jsonb(v_before),
        'after', to_jsonb(v_target),
        'added', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_target) x WHERE NOT (x = ANY (v_before))), '[]'::jsonb),
        'removed', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_before) x WHERE NOT (x = ANY (v_target))), '[]'::jsonb));
END;
$$;

-- ============================================================================
-- C6 — vérification d'un code OTP
-- ============================================================================
-- p : { phone | user_id, purpose | purposes[], code_hash, consume? (défaut true) }. Le haché candidat est
-- calculé par lib/auth/otp-store.ts (OTP_HASH_SECRET, hors base). Les essais sur un même code sont
-- sérialisés par le verrou de sa ligne : 5 comparaisons au plus, quel que soit le parallélisme.
CREATE OR REPLACE FUNCTION public.otp_check(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max constant integer := 5;
    v_phone text := NULLIF(btrim(COALESCE(p->>'phone', '')), '');
    v_user uuid := public.try_uuid(p->>'user_id');
    v_hash text := p->>'code_hash';
    v_consume boolean := TRUE;
    v_purposes text[];
    r record;
    v_attempts integer;
BEGIN
    IF jsonb_typeof(p->'consume') = 'boolean' THEN
        v_consume := (p->>'consume')::boolean;
    END IF;
    IF jsonb_typeof(p->'purposes') = 'array' THEN
        SELECT array_agg(x) INTO v_purposes FROM jsonb_array_elements_text(p->'purposes') AS x;
    ELSIF NULLIF(p->>'purpose', '') IS NOT NULL THEN
        v_purposes := ARRAY[p->>'purpose'];
    END IF;
    IF v_phone IS NULL AND v_user IS NOT NULL THEN
        SELECT phone INTO v_phone FROM public.users WHERE id = v_user;
    END IF;
    IF v_phone IS NULL OR v_purposes IS NULL OR cardinality(v_purposes) = 0
       OR v_hash IS NULL OR v_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Vérification du code incomplète.');
    END IF;

    SELECT id, code_hash, expires_at, attempts INTO r
      FROM public.otp_codes
     WHERE phone = v_phone AND purpose = ANY (v_purposes) AND verified = FALSE
     ORDER BY created_at DESC
     LIMIT 1
       FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
    END IF;
    IF r.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EXPIRED');
    END IF;
    IF r.attempts >= v_max THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_ATTEMPTS', 'attempts', r.attempts);
    END IF;
    IF r.code_hash = v_hash THEN
        IF v_consume THEN
            UPDATE public.otp_codes SET verified = TRUE WHERE id = r.id;
        END IF;
        RETURN jsonb_build_object('ok', true, 'id', r.id, 'consumed', v_consume);
    END IF;
    UPDATE public.otp_codes SET attempts = attempts + 1 WHERE id = r.id RETURNING attempts INTO v_attempts;
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN v_attempts >= v_max THEN 'TOO_MANY_ATTEMPTS' ELSE 'INVALID' END,
                              'attempts', v_attempts);
END;
$$;

-- ============================================================================
-- C7 — vente au guichet = entrée immédiate
-- ============================================================================
-- p : { seller_id, event_id, items [{ category_id, quantity }], buyer_phone? (9 chiffres), idempotency_key }.
-- Aucun rattachement au compte du numéro : le numéro n'est pas une identité vérifiée ; le vendeur n'est
-- jamais porteur. Même clé (par vendeur) → même vente, sans nouvelle écriture. Le partenaire et l'admin
-- ne vendent pas au guichet (vendeur affecté à l'événement avec la permission espèces). Fenêtre et statut
-- de l'événement : scan_event_problem (lot 4).
CREATE OR REPLACE FUNCTION public.counter_sale(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller uuid := public.try_uuid(p->>'seller_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_items jsonb := p->'items';
    v_key text := NULLIF(btrim(COALESCE(p->>'idempotency_key', '')), '');
    v_phone text := NULLIF(btrim(COALESCE(p->>'buyer_phone', '')), '');
    v_store_key text;
    v_problems jsonb;
    v_event_problem text;
    sh record;
    prev record;
    v_partner uuid;
    v_amount numeric := 0;
    v_payment uuid;
    v_tx text;
    v_item record;
    v_ticket uuid;
    v_scan uuid;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_scans uuid[] := ARRAY[]::uuid[];
BEGIN
    IF v_seller IS NULL OR v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Vente incomplète : vendeur et événement requis.');
    END IF;
    IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REQUIRED', 'message', 'Clé d''idempotence obligatoire.');
    END IF;
    IF v_phone IS NOT NULL AND v_phone !~ '^7[05678][0-9]{7}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE', 'message', 'Numéro de l''acheteur invalide.');
    END IF;
    v_store_key := 'COUNTER:' || v_seller::text || ':' || v_key;

    IF NOT public.fin_setting_bool('access.counter_sale_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COUNTER_SALE_DISABLED', 'message', 'La vente au guichet est désactivée.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_seller AND u.status = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Vente réservée au contrôleur affecté à l''événement.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller AND ec.can_accept_cash) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CASH_PERMISSION', 'message', 'Permission espèces requise.');
    END IF;

    -- Rejeu d'une vente déjà enregistrée (réponse identique, même si la caisse a été clôturée depuis)
    SELECT id, transaction_id, amount, shift_id, event_id INTO prev FROM public.payments WHERE idempotency_key = v_store_key;
    IF NOT FOUND THEN
        SELECT * INTO sh FROM public.controller_shifts
         WHERE controller_id = v_seller AND event_id = v_event AND status = 'OUVERT' FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_OPEN_SHIFT', 'message', 'Ouvrez une caisse avant de vendre.');
        END IF;
        -- Deux appels simultanés avec la même clé : sérialisés par le verrou de la caisse
        SELECT id, transaction_id, amount, shift_id, event_id INTO prev FROM public.payments WHERE idempotency_key = v_store_key;
    END IF;
    IF prev.id IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'replayed', true, 'payment_id', prev.id, 'transaction_id', prev.transaction_id,
            'amount', prev.amount, 'shift_id', prev.shift_id, 'event_id', prev.event_id,
            'ticket_ids', COALESCE((SELECT jsonb_agg(t.id ORDER BY t.created_at, t.id) FROM public.tickets t WHERE t.payment_id = prev.id), '[]'::jsonb),
            'scan_ids', COALESCE((SELECT jsonb_agg(s.id ORDER BY s.created_at, s.id) FROM public.ticket_scans s
                                    JOIN public.tickets t ON t.id = s.ticket_id
                                   WHERE t.payment_id = prev.id AND s.accepted), '[]'::jsonb));
    END IF;

    v_event_problem := public.scan_event_problem(v_event);
    IF v_event_problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_CLOSED', 'result', v_event_problem,
                                  'message', 'Cet événement n''est pas ouvert à la vente au guichet.');
    END IF;
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'message', 'Panier vide ou invalide.');
    END IF;
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT public.try_uuid(e->>'category_id') FROM jsonb_array_elements(v_items) e) ORDER BY id FOR UPDATE;
    -- Contrôles de vente du lot 2, hors fenêtre de vente en ligne et visibilité (vente sur place)
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event, v_items)) x
     WHERE x->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY', 'CATEGORY_INACTIVE',
                          'MAX_PER_ORDER', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems,
                                  'message', 'Vente impossible : vérifiez les catégories et les quantités.');
    END IF;
    SELECT COALESCE(sum(c.price * (e->>'quantity')::int), 0) INTO v_amount
      FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid;
    SELECT partner_id INTO v_partner FROM public.events WHERE id = v_event;
    v_tx := 'TX-GUICHET-' || upper(replace(gen_random_uuid()::text, '-', ''));

    INSERT INTO public.payments (transaction_id, client_id, partner_id, event_id, payment_target, amount, currency, payment_method,
                                 is_platform_payment, offline_payment_method, aggregator, facial_amount, aggregator_fee, service_fee,
                                 gross_event_village_revenue, net_event_village_revenue, partner_payout_amount, status, paid_at,
                                 shift_id, payer_phone, idempotency_key, metadata)
    VALUES (v_tx, NULL, v_partner, v_event, 'TICKET', v_amount, 'XOF',
            'ESPECES', FALSE, 'ESPECES', NULL, v_amount, 0, 0, 0, 0, 0, 'SUCCESS', now(), sh.id,
            v_phone, v_store_key, jsonb_build_object('source', 'COUNTER_SALE', 'seller_id', v_seller))
    RETURNING id INTO v_payment;

    FOR v_item IN
        SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity, c.price
          FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid
    LOOP
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        FOR i IN 1 .. v_item.quantity LOOP
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, qr_code, status,
                                        sale_channel, checked_in_at, checked_in_by)
            VALUES (v_event, v_item.category_id, NULL, v_payment,
                    'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                    v_item.price, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'UTILISE',
                    'COUNTER', now(), v_seller)
            RETURNING id INTO v_ticket;
            -- Entrée immédiate : scan accepté du vendeur (le trigger ticket_scans_enrich recopie catégorie,
            -- rôle CONTROLEUR et point d'entrée de l'affectation)
            INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified,
                                             payload_hash, shift_id, amount_due)
            VALUES (v_ticket, v_event, v_seller, 'valid', TRUE, 'COUNTER', FALSE, NULL, sh.id, v_item.price)
            RETURNING id INTO v_scan;
            v_ids := v_ids || v_ticket;
            v_scans := v_scans || v_scan;
        END LOOP;
    END LOOP;
    UPDATE public.payments SET ticket_id = v_ids[1] WHERE id = v_payment;
    UPDATE public.controller_shifts SET expected_cash_total = expected_cash_total + v_amount, updated_at = now() WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_seller, 'CAISSE', 'COUNTER_SALE', 'payments', v_payment,
            jsonb_build_object('event_id', v_event, 'shift_id', sh.id, 'amount', v_amount, 'ticket_ids', to_jsonb(v_ids),
                               'scan_ids', to_jsonb(v_scans), 'buyer_phone_given', v_phone IS NOT NULL));
    RETURN jsonb_build_object('ok', true, 'replayed', false, 'payment_id', v_payment, 'transaction_id', v_tx,
                              'ticket_ids', to_jsonb(v_ids), 'scan_ids', to_jsonb(v_scans), 'amount', v_amount,
                              'shift_id', sh.id, 'event_id', v_event);
END;
$$;

-- Billets gratuits : canal FREE (20261031000018_lot2_billets_gratuits.sql, seule la colonne sale_channel change)
CREATE OR REPLACE FUNCTION public.free_tickets_claim(p_user_id uuid, p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_problems jsonb;
    v_item record;
    v_cat record;
    v_already integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
BEGIN
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(p_items) e)
     ORDER BY id FOR UPDATE;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT id, price, max_per_order, name INTO v_cat FROM public.ticket_categories WHERE id = v_item.category_id;
        IF FOUND AND v_cat.price <> 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_FREE', 'message', format('La catégorie « %s » est payante.', v_cat.name));
        END IF;
    END LOOP;

    v_problems := public.ticket_sale_problems(p_event_id, p_items);
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems);
    END IF;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT c.id, c.event_id, c.max_per_order, c.name INTO v_cat FROM public.ticket_categories c WHERE c.id = v_item.category_id;
        SELECT count(*) INTO v_already FROM public.tickets
         WHERE user_id = p_user_id AND category_id = v_item.category_id AND status IN ('VALIDE', 'UTILISE');
        IF v_already + v_item.quantity > v_cat.max_per_order THEN
            RAISE EXCEPTION USING ERRCODE = 'EV409', MESSAGE = format('Limite de %s billet(s) gratuit(s) « %s » par compte atteinte.', v_cat.max_per_order, v_cat.name);
        END IF;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel)
            SELECT v_cat.event_id, v_item.category_id, p_user_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'FREE'
              FROM generate_series(1, v_item.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'ticket_ids', to_jsonb(v_ticket_ids));
EXCEPTION WHEN SQLSTATE 'EV409' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FREE_LIMIT_REACHED', 'message', SQLERRM);
END;
$$;

-- ============================================================================
-- C7 — ticket_scan : un billet vendu au guichet (sans compte) reste reconnu
-- ============================================================================
-- 20261101000010_lot4_scan.sql:130 : le billet était lu par une jointure INTERNE sur users ; un billet sans
-- porteur (canal COUNTER) aurait donné « invalid » au lieu de « already_used ». Seule la jointure devient
-- externe (et le porteur affiché « Vente au guichet ») ; le reste de la fonction est inchangé.
CREATE OR REPLACE FUNCTION public.ticket_scan(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    v_scanner uuid := (p->>'scanner_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_method text := COALESCE(p->>'method', 'QR');
    v_identity boolean := COALESCE((p->>'identity_verified')::boolean, FALSE);
    v_hash text := NULLIF(p->>'payload_hash', '');
    v_pre text := NULLIF(p->>'pre_result', '');
    v_ticket_id uuid;
    t record;
    v_problem text;
    v_pay_status text;
    v_order_status text;
    v_scope text;
    v_scan uuid;
    v_info jsonb;
BEGIN
    IF v_method NOT IN ('QR', 'MANUAL') THEN
        RAISE EXCEPTION 'ticket_scan : méthode % inconnue', v_method;
    END IF;
    -- 1. Droit du scanneur sur l'événement, avant toute lecture du billet ou du code
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        PERFORM public.scan_log(NULL, v_event, v_scanner, 'forbidden', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- 2. Refus décidé avant la base (payload qui n'est pas un QR dynamique)
    IF v_pre IS NOT NULL THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, v_pre, FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', v_pre, 'scan_id', v_scan);
    END IF;
    -- 3. Saisie manuelle : périmètre réglé et pièce d'identité vérifiée
    IF v_method = 'MANUAL' THEN
        v_scope := public.fin_setting_text('access.manual_entry_scope');
        IF NOT v_identity
           OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
                   SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
            v_scan := public.scan_log(NULL, v_event, v_scanner, 'manual_entry_refused', FALSE, v_method, v_identity, v_hash);
            RETURN jsonb_build_object('result', 'manual_entry_refused', 'scan_id', v_scan);
        END IF;
        SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = upper(btrim(p->>'ticket_number'));
    ELSE
        v_ticket_id := NULLIF(p->>'ticket_id', '')::uuid;
    END IF;
    -- 4. Billet de l'événement (aucune donnée sinon)
    SELECT tk.*, c.name AS category_name, u.first_name, u.last_name
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
     WHERE tk.id = v_ticket_id
       FOR UPDATE OF tk;
    IF NOT FOUND THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, 'invalid', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    IF t.event_id <> v_event THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'wrong_event', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'wrong_event', 'scan_id', v_scan);
    END IF;
    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                 'holder', CASE WHEN t.user_id IS NULL THEN 'Vente au guichet' ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END, 'price', t.price,
                                 'is_manual_entry', v_method = 'MANUAL');
    -- 5. Code dynamique (calculé hors base avec la clé maître)
    IF v_method = 'QR' AND NOT COALESCE((p->>'totp_ok')::boolean, FALSE) THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'qr_expired', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'qr_expired', 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    -- 7. Billet
    v_problem := CASE t.status::text
        WHEN 'VALIDE' THEN NULL
        WHEN 'UTILISE' THEN 'already_used'
        WHEN 'ANNULE' THEN 'cancelled'
        WHEN 'REMBOURSE' THEN 'refunded'
        WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
        ELSE 'invalid' END;
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at));
    END IF;
    -- 8. Paiement
    IF t.price > 0 THEN
        IF t.payment_id IS NOT NULL THEN
            SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
        END IF;
        IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
            IF t.order_id IS NOT NULL THEN
                SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
            END IF;
            IF t.payment_id IS NULL AND v_order_status IS NOT NULL AND v_order_status <> 'SUCCESS' THEN
                v_scan := public.scan_log(t.id, v_event, v_scanner, 'cash_required', FALSE, v_method, v_identity, v_hash, t.price);
                RETURN jsonb_build_object('result', 'cash_required', 'scan_id', v_scan, 'amount_due', t.price, 'ticket', v_info);
            END IF;
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_scan := public.scan_log(t.id, v_event, v_scanner, 'payment_required', FALSE, v_method, v_identity, v_hash);
                RETURN jsonb_build_object('result', 'payment_required', 'scan_id', v_scan, 'ticket', v_info);
            END IF;
        END IF;
    END IF;
    -- 9. Compostage (une seule ligne modifiée, sous verrou)
    UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner, updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    IF NOT FOUND THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'already_used', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'already_used', 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    v_scan := public.scan_log(t.id, v_event, v_scanner, 'valid', TRUE, v_method, v_identity, v_hash);
    RETURN jsonb_build_object('result', 'valid', 'scan_id', v_scan, 'ticket', v_info);
END;
$;

-- ============================================================================
-- C8 — incidents techniques du scan
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scan_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scanner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('RATE_LIMITED', 'SERVER_ERROR', 'GUARD_UNAVAILABLE', 'NETWORK', 'TIMEOUT')),
    source TEXT NOT NULL CHECK (source IN ('SERVER', 'DEVICE')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_incidents_event_time ON public.scan_incidents (event_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_scan_incidents_event_scanner ON public.scan_incidents (event_id, scanner_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_scan_incidents_scanner ON public.scan_incidents (scanner_id, created_at);
COMMENT ON TABLE public.scan_incidents IS
    'Lot 5 (C8) : incidents techniques du scan (quota dépassé, erreur serveur, garde indisponible, coupure réseau, délai dépassé), à part de ticket_scans. Écrits par le service_role ; lus par le partenaire propriétaire de l''événement et les admins.';
ALTER TABLE public.scan_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scan_incidents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.scan_incidents TO service_role;
GRANT SELECT ON TABLE public.scan_incidents TO authenticated;
DROP POLICY IF EXISTS scan_incidents_owner_admin_select ON public.scan_incidents;
CREATE POLICY scan_incidents_owner_admin_select ON public.scan_incidents
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                    WHERE e.id = scan_incidents.event_id AND pa.user_id = auth.uid())
    );
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scan_incidents') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_incidents;
    END IF;
END;
$$;

-- p : { scanner_id, event_id?, source ('SERVER'|'DEVICE'), incidents: [{ kind, at? }] } (20 au plus).
-- SERVER : RATE_LIMITED, SERVER_ERROR, GUARD_UNAVAILABLE ; event_id gardé seulement si le scanneur est
-- autorisé sur l'événement (sinon NULL : personne ne gonfle les incidents de l'événement d'autrui).
-- DEVICE : NETWORK, TIMEOUT ; ignoré si le scanneur n'est pas autorisé sur l'événement.
-- Horodatage déclaré borné à [maintenant − 12 h, maintenant], sinon l'heure de réception.
CREATE OR REPLACE FUNCTION public.scan_incident_log(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_source text := p->>'source';
    v_items jsonb := p->'incidents';
    v_allowed text[];
    v_authorized boolean;
    v_count integer;
BEGIN
    IF v_scanner IS NULL OR v_source IS NULL OR v_source NOT IN ('SERVER', 'DEVICE')
       OR jsonb_typeof(v_items) IS DISTINCT FROM 'array' OR jsonb_array_length(v_items) = 0 OR jsonb_array_length(v_items) > 20 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Signalement d''incident invalide.');
    END IF;
    v_allowed := CASE WHEN v_source = 'SERVER' THEN ARRAY['RATE_LIMITED', 'SERVER_ERROR', 'GUARD_UNAVAILABLE'] ELSE ARRAY['NETWORK', 'TIMEOUT'] END;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) x WHERE NOT (COALESCE(x->>'kind', '') = ANY (v_allowed))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_KIND', 'message', 'Type d''incident inconnu.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_scanner) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SCANNER_NOT_FOUND', 'message', 'Scanneur introuvable.');
    END IF;
    v_authorized := v_event IS NOT NULL AND public.scan_scanner_authorized(v_scanner, v_event);
    IF v_source = 'DEVICE' AND NOT v_authorized THEN
        RETURN jsonb_build_object('ok', true, 'logged', 0, 'ignored', true);
    END IF;
    INSERT INTO public.scan_incidents (scanner_id, event_id, kind, source, occurred_at)
    SELECT v_scanner, CASE WHEN v_authorized THEN v_event END, x->>'kind', v_source,
           -- CASE imbriqués : la conversion n'est évaluée que si le format est reconnu
           CASE WHEN COALESCE(x->>'at', '') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$' THEN
                CASE WHEN (x->>'at')::timestamptz BETWEEN now() - interval '12 hours' AND now() + interval '1 minute'
                     THEN LEAST((x->>'at')::timestamptz, now())
                     ELSE now() END
                ELSE now() END
      FROM jsonb_array_elements(v_items) x;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'logged', v_count, 'ignored', false, 'event_kept', v_authorized);
END;
$$;

-- ============================================================================
-- Privilèges : service_role uniquement
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.try_uuid(text)',
        'public.ticket_transfer_initiate(jsonb)',
        'public.ticket_transfer_cancel(jsonb)',
        'public.ticket_transfers_expire(jsonb)',
        'public.shift_close(jsonb)',
        'public.atomic_partner_remove_controller(uuid, uuid)',
        'public.user_roles_set(jsonb)',
        'public.otp_check(jsonb)',
        'public.counter_sale(jsonb)',
        'public.free_tickets_claim(uuid, uuid, jsonb)',
        'public.ticket_scan(jsonb)',
        'public.scan_incident_log(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

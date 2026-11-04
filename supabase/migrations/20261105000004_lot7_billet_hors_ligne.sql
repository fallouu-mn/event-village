-- ============================================================================
-- EVENT VILLAGE — LOT 7, TÂCHE 7.1 (serveur) et 7.6 : billet présentable sans réseau
-- (contrat M4, décisions D26 à D31, D37, D38, D86)
-- ============================================================================
--  1. ticket_secret_versions : historique des versions du secret de chaque billet (porteur, motif, instant
--     clock_timestamp() pris après le verrou de ligne). Seule preuve de « la version courante au moment T »
--     pour les invariants (p)(q) (D86).
--  2. Reprise : une ligne BACKFILL par billet existant, pour sa version courante.
--  3. Triggers sur tickets, SEUL point de rotation de la version (D27) :
--       - trg_tickets_secret_issue (AFTER INSERT) : ligne ISSUE de la version d'émission ;
--       - trg_tickets_secret_guard (BEFORE UPDATE) : version + 1 et nouveau secret quand le porteur change,
--         quand le billet quitte VALIDE pour autre chose que UTILISE (annulation, remboursement), quand le
--         secret ou la version sont changés explicitement ; une version qui saute (≠ + 1) est refusée (TK409).
--         VALIDE → UTILISE ne tourne pas : le second scan d'un même code doit rester already_used ;
--       - trg_tickets_secret_log (AFTER UPDATE, version changée) : ligne d'historique (TRANSFER, CANCEL,
--         REFUND, REGENERATE).
--     ticket_transfer_claim (lot 4, recopiée par 20261105000003) incrémente déjà la version et régénère le
--     secret dans la même instruction : le trigger l'accepte (+ 1) sans second incrément.
--  4. ticket_secret_rotate(p) : régénération du secret (D28), service_role, sans écran au lot 7.
--  5. ticket_offline_downloads : journal des téléchargements de codes hors ligne, avec l'instantané de
--     décision écrit sous verrou ; aucun code ni secret (D38 : les refus ne sont pas journalisés).
--  6. ticket_offline_window(event) : fenêtre de téléchargement [début − 24 h ; fin + access.scan_window_after_hours]
--     et fenêtre de scan (scan_window), source unique du calcul (le navigateur ne calcule rien).
--  7. ticket_offline_grant(p) : décision sous verrou (événement FOR SHARE, puis billet FOR SHARE : même ordre
--     que ticket_transfer_accept, D20), plage glissante de 48 h au plus (D31), journal, secret rendu à Node
--     seulement (jamais au navigateur). `now` n'est admis que pour les bornes des tests (refusé s'il est dans
--     le passé de plus d'une minute, INVALID_NOW) ; aucune route ne le passe.
--  8. ticket_offline_info(p) : disponibilité hors ligne de chaque billet d'un compte (GET /api/tickets).
-- Interface utilisée par 20261105000005 (scan, A4) : tickets.security_version (colonne existante) seulement ;
-- ticket_scan compare sous verrou la version présentée à t.security_version.
-- Rejouable : CREATE TABLE / INDEX IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS, ON CONFLICT DO
-- NOTHING ; aucun BEGIN ni COMMIT.
-- Privilèges (règle 1A.3) : chaque fonction, triggers compris : SECURITY DEFINER, search_path = public,
-- volatilité explicite, REVOKE ALL FROM PUBLIC, anon, authenticated, puis GRANT EXECUTE TO service_role.
-- Tables : RLS activée sans politique, service_role seul, hors publication temps réel.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Historique des versions du secret (M4.1)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_secret_versions (
    id bigserial PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    version integer NOT NULL CHECK (version >= 1),
    holder_user_id uuid NULL,
    reason text NOT NULL CHECK (reason IN ('ISSUE', 'BACKFILL', 'TRANSFER', 'CANCEL', 'REFUND', 'REGENERATE')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ticket_secret_versions_uq UNIQUE (ticket_id, version)
);
COMMENT ON TABLE public.ticket_secret_versions IS
    'Lot 7 (7.1, 7.6) : une ligne par version du secret d''un billet (porteur à cette version, NULL pour un billet du guichet sans compte ; motif ; instant clock_timestamp() pris après le verrou de ligne). Écrite par les triggers trg_tickets_secret_*. Service_role uniquement.';
ALTER TABLE public.ticket_secret_versions ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.ticket_secret_versions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ticket_secret_versions TO service_role;
REVOKE ALL ON SEQUENCE public.ticket_secret_versions_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ticket_secret_versions_id_seq TO service_role;


-- ----------------------------------------------------------------------------
-- 2. Reprise (M4.2) : la version courante de chaque billet existant
-- ----------------------------------------------------------------------------
INSERT INTO public.ticket_secret_versions (ticket_id, version, holder_user_id, reason, created_at)
SELECT t.id, t.security_version, t.user_id, 'BACKFILL', now()
  FROM public.tickets t
ON CONFLICT (ticket_id, version) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Triggers de rotation (M4.3)
-- ----------------------------------------------------------------------------
-- Émission : version d'émission (1, ou celle posée à l'insertion) au nom du porteur.
CREATE OR REPLACE FUNCTION public.ticket_secret_version_issue()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ticket_secret_versions (ticket_id, version, holder_user_id, reason, created_at)
    VALUES (NEW.id, NEW.security_version, NEW.user_id, 'ISSUE', clock_timestamp())
    ON CONFLICT (ticket_id, version) DO NOTHING;
    RETURN NULL;
END;
$$;

-- Garde : seul point où la version avance (d'une unité exactement) ; un nouveau secret est tiré quand
-- l'appelant n'en pose pas lui-même.
CREATE OR REPLACE FUNCTION public.ticket_secret_rotate_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_need boolean;
BEGIN
    v_need := NEW.user_id IS DISTINCT FROM OLD.user_id
           OR (OLD.status::text = 'VALIDE' AND NEW.status::text NOT IN ('VALIDE', 'UTILISE'))
           OR NEW.totp_secret IS DISTINCT FROM OLD.totp_secret
           OR NEW.security_version IS DISTINCT FROM OLD.security_version;
    IF NOT v_need THEN
        RETURN NEW;
    END IF;
    IF NEW.security_version IS DISTINCT FROM OLD.security_version
       AND NEW.security_version IS DISTINCT FROM OLD.security_version + 1 THEN
        RAISE EXCEPTION 'TK409 : la version du secret ne peut avancer que d''une unité (billet %, version % demandée, version courante %)',
            OLD.id, NEW.security_version, OLD.security_version
            USING ERRCODE = 'P0001';
    END IF;
    NEW.security_version := OLD.security_version + 1;
    IF NEW.totp_secret IS NOT DISTINCT FROM OLD.totp_secret THEN
        NEW.totp_secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    END IF;
    RETURN NEW;
END;
$$;

-- Historique : motif posé par la fonction appelante (ev.secret_rotation_reason, local à la transaction),
-- sinon déduit du changement.
CREATE OR REPLACE FUNCTION public.ticket_secret_version_log()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ticket_secret_versions (ticket_id, version, holder_user_id, reason, created_at)
    VALUES (
        NEW.id,
        NEW.security_version,
        NEW.user_id,
        COALESCE(NULLIF(current_setting('ev.secret_rotation_reason', true), ''),
                 CASE WHEN NEW.user_id IS DISTINCT FROM OLD.user_id THEN 'TRANSFER'
                      WHEN NEW.status::text = 'ANNULE' THEN 'CANCEL'
                      WHEN NEW.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'REFUND'
                      ELSE 'REGENERATE' END),
        clock_timestamp());
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_secret_issue ON public.tickets;
CREATE TRIGGER trg_tickets_secret_issue
    AFTER INSERT ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.ticket_secret_version_issue();

DROP TRIGGER IF EXISTS trg_tickets_secret_guard ON public.tickets;
CREATE TRIGGER trg_tickets_secret_guard
    BEFORE UPDATE OF user_id, status, totp_secret, security_version ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.ticket_secret_rotate_guard();

-- Sans liste de colonnes : la version peut avoir été avancée par la garde sans figurer dans le SET.
DROP TRIGGER IF EXISTS trg_tickets_secret_log ON public.tickets;
CREATE TRIGGER trg_tickets_secret_log
    AFTER UPDATE ON public.tickets
    FOR EACH ROW
    WHEN (NEW.security_version IS DISTINCT FROM OLD.security_version)
    EXECUTE FUNCTION public.ticket_secret_version_log();


-- ----------------------------------------------------------------------------
-- 4. Régénération du secret (M4.4, D28) : { ticket_id, actor_id?, reason? }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_secret_rotate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    v_status text;
    v_version integer;
BEGIN
    IF NULLIF(p->>'reason', '') IS NOT NULL AND p->>'reason' <> 'REGENERATE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REASON',
            'message', 'Seule la régénération du secret passe par cette fonction.');
    END IF;
    IF v_ticket IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    SELECT status::text INTO v_status FROM public.tickets WHERE id = v_ticket FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF v_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_VALID',
            'message', 'Seul un billet valable peut recevoir un nouveau secret.');
    END IF;
    PERFORM set_config('ev.secret_rotation_reason', 'REGENERATE', true);
    UPDATE public.tickets
       SET security_version = security_version + 1, updated_at = now()
     WHERE id = v_ticket
    RETURNING security_version INTO v_version;
    -- Les triggers AFTER ROW s'exécutent à la fin de l'instruction : le motif est lu, puis effacé pour la
    -- suite de la transaction.
    PERFORM set_config('ev.secret_rotation_reason', '', true);
    RETURN jsonb_build_object('ok', true, 'ticket_id', v_ticket, 'secret_version', v_version);
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. Journal des téléchargements hors ligne (M4.5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_offline_downloads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    secret_version integer NOT NULL CHECK (secret_version >= 1),
    downloaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    first_step_at timestamptz NOT NULL,
    last_step_at timestamptz NOT NULL,
    codes_count integer NOT NULL CHECK (codes_count BETWEEN 1 AND 8641),
    decision jsonb NOT NULL,
    CONSTRAINT ticket_offline_downloads_steps_chk CHECK (last_step_at >= first_step_at)
);
CREATE INDEX IF NOT EXISTS idx_ticket_offline_downloads_ticket ON public.ticket_offline_downloads (ticket_id, downloaded_at);
CREATE INDEX IF NOT EXISTS idx_ticket_offline_downloads_user ON public.ticket_offline_downloads (user_id, downloaded_at);
COMMENT ON TABLE public.ticket_offline_downloads IS
    'Lot 7 (7.1) : un téléchargement de codes hors ligne accordé (porteur, billet, version du secret, plage, instantané de décision écrit sous verrou). Aucun code ni secret. Les refus ne sont pas journalisés (D38). Service_role uniquement.';
COMMENT ON COLUMN public.ticket_offline_downloads.decision IS
    'Instantané : holder_user_id, ticket_status, event_status, transfer_locked, event_start_at, event_end_at, after_hours, before_hours, window_opens_at, window_closes_at, scan_opens_at, scan_closes_at.';
ALTER TABLE public.ticket_offline_downloads ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.ticket_offline_downloads FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ticket_offline_downloads TO service_role;


-- ----------------------------------------------------------------------------
-- 6. Fenêtres d'un événement (M4.6) : début et fin (Dakar), téléchargement [début − 24 h ; fin + after],
--    scan (scan_window). Une seule requête : un seul instantané des réglages access.*.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_offline_window(p_event uuid)
RETURNS TABLE (
    event_start_at timestamptz,
    event_end_at timestamptz,
    opens_at timestamptz,
    closes_at timestamptz,
    scan_opens_at timestamptz,
    scan_closes_at timestamptz,
    after_hours integer,
    before_hours integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT b.start_at,
           b.end_at,
           b.start_at - interval '24 hours',
           b.end_at + make_interval(hours => b.after_h),
           sw.opens_at,
           sw.closes_at,
           b.after_h,
           b.before_h
      FROM (SELECT ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') AS start_at,
                   public.event_end_at(e.id) AS end_at,
                   public.fin_setting_num('access.scan_window_after_hours')::int AS after_h,
                   public.fin_setting_num('access.scan_window_before_hours')::int AS before_h
              FROM public.events e
             WHERE e.id = p_event) b
     CROSS JOIN LATERAL public.scan_window(p_event) sw
$$;


-- ----------------------------------------------------------------------------
-- 7. Téléchargement des codes hors ligne (M4.7) : { ticket_id, user_id, now? }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_offline_grant(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    v_user uuid := public.try_uuid(p->>'user_id');
    v_now timestamptz;
    v_event uuid;
    v_estatus text;
    v_title text;
    v_location text;
    v_city text;
    v_category text;
    t record;
    w record;
    v_first timestamptz;
    v_last_end timestamptz;
    v_last timestamptz;
    v_count integer;
    v_complete boolean;
    v_decision jsonb;
    v_download uuid;
    v_not_found constant jsonb := jsonb_build_object('ok', false, 'http', 404, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
BEGIN
    -- Heure des tests seulement (bornes à la seconde) ; jamais dans le passé de plus d'une minute.
    IF NULLIF(p->>'now', '') IS NOT NULL THEN
        BEGIN
            v_now := (p->>'now')::timestamptz;
        EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
            RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_NOW', 'message', 'Heure illisible.');
        END;
        IF v_now < clock_timestamp() - interval '1 minute' THEN
            RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_NOW', 'message', 'L''heure fournie est dans le passé.');
        END IF;
    END IF;

    -- 1. Billet (lecture), puis 2. événement FOR SHARE, puis 3. billet FOR SHARE (ordre de D20).
    IF v_ticket IS NULL OR v_user IS NULL THEN
        RETURN v_not_found;
    END IF;
    SELECT tk.event_id INTO v_event FROM public.tickets tk WHERE tk.id = v_ticket;
    IF NOT FOUND THEN
        RETURN v_not_found;
    END IF;
    SELECT e.status::text, e.title, e.location, e.city INTO v_estatus, v_title, v_location, v_city
      FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN v_not_found;
    END IF;
    SELECT tk.id, tk.event_id, tk.user_id, tk.status::text AS status, tk.security_version, tk.totp_secret,
           tk.transfer_locked, tk.ticket_number, tk.category_id
      INTO t FROM public.tickets tk WHERE tk.id = v_ticket FOR SHARE;
    IF NOT FOUND THEN
        RETURN v_not_found;
    END IF;
    -- 4. Porteur seul (même corps que l'inconnu : aucun oracle).
    IF t.event_id IS DISTINCT FROM v_event THEN
        RETURN v_not_found;
    END IF;
    IF t.user_id IS DISTINCT FROM v_user THEN
        RETURN v_not_found;
    END IF;
    -- 5. Billet VALIDE, événement PUBLIE, aucun transfert en attente.
    IF t.status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', 'TICKET_NOT_VALID', 'message', 'Ce billet n''est plus valable à l''entrée.');
    END IF;
    IF v_estatus IS DISTINCT FROM 'PUBLIE' THEN
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', 'EVENT_NOT_PUBLISHED',
            'message', 'Cet événement n''est pas ouvert : les codes hors ligne ne sont pas disponibles.');
    END IF;
    IF t.transfer_locked THEN
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', 'TRANSFER_PENDING',
            'message', 'Ce billet est en cours de transfert : les codes hors ligne ne sont pas disponibles.');
    END IF;

    -- 6. Fenêtre de téléchargement, à l'heure prise après les verrous.
    IF v_now IS NULL THEN
        v_now := clock_timestamp();
    END IF;
    SELECT * INTO w FROM public.ticket_offline_window(v_event);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fenêtre hors ligne incalculable pour l''événement %', v_event;
    END IF;
    IF w.opens_at IS NULL OR w.closes_at IS NULL OR w.scan_opens_at IS NULL OR w.scan_closes_at IS NULL THEN
        RAISE EXCEPTION 'fenêtre hors ligne incalculable pour l''événement % (date ou réglage manquant)', v_event;
    END IF;
    IF v_now < w.opens_at OR v_now > w.closes_at THEN
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', 'OFFLINE_WINDOW_CLOSED',
            'message', 'Les codes hors ligne sont disponibles de 24 h avant le début de l''événement jusqu''à la fin du contrôle des entrées.',
            'available_from', w.opens_at, 'available_until', w.closes_at);
    END IF;

    -- 7. Plage glissante : du pas de max(ouverture du scan, maintenant − 20 s), 48 h au plus (D31).
    v_first := to_timestamp(floor(extract(epoch FROM greatest(w.scan_opens_at, v_now - interval '20 seconds')) / 20) * 20);
    v_last_end := least(w.scan_closes_at, v_first + interval '48 hours');
    v_count := ceil(extract(epoch FROM (v_last_end - v_first)) / 20)::integer;
    v_count := least(greatest(v_count, 1), 8640);
    v_last := v_first + (v_count - 1) * interval '20 seconds';
    v_complete := v_first + v_count * interval '20 seconds' >= w.scan_closes_at;

    -- 8. Journal, avec l'instantané de décision pris sous verrou (aucun code, aucun secret).
    v_decision := jsonb_build_object(
        'holder_user_id', t.user_id,
        'ticket_status', t.status,
        'event_status', v_estatus,
        'transfer_locked', t.transfer_locked,
        'event_start_at', w.event_start_at,
        'event_end_at', w.event_end_at,
        'after_hours', w.after_hours,
        'before_hours', w.before_hours,
        'window_opens_at', w.opens_at,
        'window_closes_at', w.closes_at,
        'scan_opens_at', w.scan_opens_at,
        'scan_closes_at', w.scan_closes_at);
    INSERT INTO public.ticket_offline_downloads
        (ticket_id, user_id, event_id, secret_version, downloaded_at, first_step_at, last_step_at, codes_count, decision)
    VALUES (t.id, v_user, v_event, t.security_version, v_now, v_first, v_last, v_count, v_decision)
    RETURNING id INTO v_download;

    SELECT c.name INTO v_category FROM public.ticket_categories c WHERE c.id = t.category_id;

    -- 9. Réponse à Node : le secret sert à calculer les codes côté serveur et n'est jamais renvoyé au navigateur.
    RETURN jsonb_build_object(
        'ok', true,
        'ticket_id', t.id,
        'secret_version', t.security_version,
        'totp_secret', t.totp_secret,
        'first_counter', (extract(epoch FROM v_first) / 20)::bigint,
        'count', v_count,
        'first_step_at', v_first,
        'last_step_at', v_last,
        'scan_opens_at', w.scan_opens_at,
        'scan_closes_at', w.scan_closes_at,
        'complete', v_complete,
        'download_id', v_download,
        'ticket', jsonb_build_object(
            'ticket_number', t.ticket_number,
            'category', COALESCE(v_category, ''),
            'event_title', COALESCE(v_title, ''),
            'event_start_at', w.event_start_at,
            'location', COALESCE(v_location, ''),
            'city', COALESCE(v_city, '')));
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. Disponibilité hors ligne des billets d'un compte (M4.8) : { user_id }
--    reason : NULL (disponible), NOT_YET, CLOSED, TICKET_NOT_VALID, EVENT_NOT_PUBLISHED, TRANSFER_PENDING
--    (même ordre de contrôle que ticket_offline_grant).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_offline_info(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_now timestamptz := now();
    v_tickets jsonb;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_USER', 'message', 'Compte introuvable.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'ticket_id', s.id,
               'secret_version', s.security_version,
               'available', s.reason IS NULL,
               'available_from', s.opens_at,
               'available_until', s.closes_at,
               'reason', s.reason) ORDER BY s.id), '[]'::jsonb)
      INTO v_tickets
      FROM (SELECT t.id, t.security_version, w.opens_at, w.closes_at,
                   CASE WHEN t.status::text <> 'VALIDE' THEN 'TICKET_NOT_VALID'
                        WHEN e.status::text <> 'PUBLIE' THEN 'EVENT_NOT_PUBLISHED'
                        WHEN t.transfer_locked THEN 'TRANSFER_PENDING'
                        WHEN w.opens_at IS NULL OR w.closes_at IS NULL THEN 'CLOSED'
                        WHEN v_now < w.opens_at THEN 'NOT_YET'
                        WHEN v_now > w.closes_at THEN 'CLOSED'
                   END AS reason
              FROM public.tickets t
              JOIN public.events e ON e.id = t.event_id
              LEFT JOIN LATERAL public.ticket_offline_window(t.event_id) w ON TRUE
             WHERE t.user_id = v_user) s;
    RETURN jsonb_build_object('ok', true, 'tickets', v_tickets);
END;
$$;


-- ----------------------------------------------------------------------------
-- 9. Privilèges : service_role uniquement (RPC et fonctions de triggers, règle 1A.3)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.ticket_secret_version_issue()',
        'public.ticket_secret_rotate_guard()',
        'public.ticket_secret_version_log()',
        'public.ticket_secret_rotate(jsonb)',
        'public.ticket_offline_window(uuid)',
        'public.ticket_offline_grant(jsonb)',
        'public.ticket_offline_info(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

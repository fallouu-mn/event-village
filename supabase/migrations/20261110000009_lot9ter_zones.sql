-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : zones, portes et scan (contrat 3.1 n° 09, 3.4 F27 à F39, C.1.2, C.2.2, C.3.3)
-- ============================================================================
-- Tâches fusionnées, dans l'ordre de leurs commits (section 10) : 9t.15 (consigne 1, zones et portes, fix(9t.15)),
-- 9t.16 (consigne 2, lisibilité du résultat, fix(9t.16)), 9t.17 (consigne 3, branche GUEST_LIST de la liste des
-- invités, délégation fix(9t.17-SZ) ; objets de 20261110000008_lot9ter_invites.sql).
-- Rejouable : aucun BEGIN ni COMMIT ; CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS
-- puis ADD (rien n'en dépend), pose gardée par le catalogue de ticket_categories_event_id_id_key (zone_categories en
-- dépend : jamais de DROP, EC2), CREATE OR REPLACE, DROP TRIGGER IF EXISTS puis CREATE. DDL avant toute fonction ;
-- aucune donnée reprise. ticket_scans_result_check (gelée, 20261109000008:172-176) n'est pas touchée : les verdicts
-- de zone vont dans zone_result (arbitrage 9, A3).
--  1. Tables event_zones (ENTREE | CONTROLE), zone_categories (admissions, clés composées : même événement garanti),
--     event_gates ; RLS sans politique, service_role seul (x2).
--  2. event_controllers.gate_id (+ event_controllers_gate_fk, même événement) et gate_change_allowed ;
--     ticket_scans.gate_id, zone_id, zone_result, result nullable, ticket_scans_outcome_one (exactement un des deux
--     verdicts), ticket_scans_zone_not_accepted (un verdict de zone n'est jamais une entrée) ;
--     ticket_categories.scan_color (palette fermée de 8 clés) et entry_instruction (1 à 60 caractères), jamais
--     accordées à anon ni authenticated.
--  3. Nouvelles : scan_gate_context (F27), scan_zone_verdict (F28), scan_log_at (F29, miroir de scan_log sans DEFAULT),
--     event_zones_get (F30), event_zones_save (F31), event_controller_gate_set (F32), controller_gate_select (F33),
--     zone_categories_default_admit (F34, trigger AFTER INSERT sur ticket_categories).
--  4. Recopies (une seule dans le lot, signature, volatilité et type de retour identiques) :
--     F35 ticket_scans_enrich    (base 20261101000013_lot4_pilotage.sql:28-56)   : point d'entrée et zone de la porte ;
--     F36 ticket_scan            (base 20261109000008_lot9bis_cycle.sql:1006-1210) : contexte de porte, règle des zones ;
--     F37 ticket_manual_lookup   (base 20261109000008_lot9bis_cycle.sql:1217-1310) : aperçu à une porte ;
--     F38 counter_sale           (base 20261106000001_lot8_canaux.sql:314-478)    : guichet = entrée, règle des zones ;
--     F39 controller_scan_stats  (base 20261105000005_lot7_scan.sql:374-439)      : compteurs par porte, scan_is_refusal.
-- Verrous (contrat 3.7, C.9) : le scan lit zones et portes sans verrou (l'insertion du journal prend un KEY SHARE par
-- clé étrangère) ; event_zones_save prend événement (NKU), catégories, zones, portes, affectations à une porte, et
-- jamais un billet ni une ligne du journal ; event_controller_gate_set et controller_gate_select prennent l'événement
-- en SHARE puis l'affectation. Aucun cycle.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) DDL : zones, admissions, portes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    kind text NOT NULL CHECK (kind IN ('ENTREE', 'CONTROLE')),
    position smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 99),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_zones_event_id_id_key UNIQUE (event_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_zones_name ON public.event_zones (event_id, lower(btrim(name)));

-- Clé composée des catégories (EC2 : pose gardée, jamais DROP : zone_categories en dépend)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.ticket_categories'::regclass AND conname = 'ticket_categories_event_id_id_key') THEN
        ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_event_id_id_key UNIQUE (event_id, id);
    END IF;
END $$;

-- Catégories admises
CREATE TABLE IF NOT EXISTS public.zone_categories (
    event_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    category_id uuid NOT NULL,
    PRIMARY KEY (zone_id, category_id),
    FOREIGN KEY (event_id, zone_id) REFERENCES public.event_zones (event_id, id) ON DELETE CASCADE,
    FOREIGN KEY (event_id, category_id) REFERENCES public.ticket_categories (event_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_zone_categories_category ON public.zone_categories (category_id);

-- Portes
CREATE TABLE IF NOT EXISTS public.event_gates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_gates_event_id_id_key UNIQUE (event_id, id),
    FOREIGN KEY (event_id, zone_id) REFERENCES public.event_zones (event_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_gates_name ON public.event_gates (event_id, lower(btrim(name)));

-- Affectation d'un contrôleur à une porte
ALTER TABLE public.event_controllers ADD COLUMN IF NOT EXISTS gate_id uuid;
ALTER TABLE public.event_controllers ADD COLUMN IF NOT EXISTS gate_change_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_controllers DROP CONSTRAINT IF EXISTS event_controllers_gate_fk;
ALTER TABLE public.event_controllers ADD CONSTRAINT event_controllers_gate_fk
    FOREIGN KEY (event_id, gate_id) REFERENCES public.event_gates (event_id, id) ON DELETE RESTRICT;

-- Journal : porte, zone, verdict de zone (A3 : jamais dans result)
ALTER TABLE public.ticket_scans ADD COLUMN IF NOT EXISTS gate_id uuid REFERENCES public.event_gates(id) ON DELETE RESTRICT;
ALTER TABLE public.ticket_scans ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.event_zones(id) ON DELETE RESTRICT;
ALTER TABLE public.ticket_scans ADD COLUMN IF NOT EXISTS zone_result text;
ALTER TABLE public.ticket_scans ALTER COLUMN result DROP NOT NULL;
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_zone_result_check;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_zone_result_check
    CHECK (zone_result IS NULL OR zone_result IN ('wrong_zone', 'not_entered', 'zone_ok'));
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_outcome_one;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_outcome_one CHECK ((result IS NULL) <> (zone_result IS NULL));
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_zone_not_accepted;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_zone_not_accepted CHECK (zone_result IS NULL OR NOT accepted);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_gate ON public.ticket_scans (event_id, gate_id, created_at);

-- Catégorie : couleur et consigne (privées : aucun GRANT SELECT de colonne)
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS scan_color text;
ALTER TABLE public.ticket_categories DROP CONSTRAINT IF EXISTS ticket_categories_scan_color_check;
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_scan_color_check
    CHECK (scan_color IS NULL OR scan_color IN ('BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR'));
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS entry_instruction text;
ALTER TABLE public.ticket_categories DROP CONSTRAINT IF EXISTS ticket_categories_entry_instruction_check;
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_entry_instruction_check
    CHECK (entry_instruction IS NULL OR char_length(entry_instruction) BETWEEN 1 AND 60);

-- Tables nouvelles : RLS, aucune politique, service_role seul (convention, x2)
ALTER TABLE public.event_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_zones, public.zone_categories, public.event_gates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.event_zones, public.zone_categories, public.event_gates TO service_role;

COMMENT ON TABLE public.event_zones IS
    'Lot 9 ter (consigne 1) : zones d''un événement. ENTREE composte le billet (la personne entre) ; CONTROLE vérifie la catégorie sans composter. Sans aucune ligne : zone implicite « Entrée » calculée, chemin d''avant le lot. Service_role seul.';
COMMENT ON TABLE public.zone_categories IS
    'Lot 9 ter (consigne 1) : catégories admises par une zone (même événement garanti par les clés composées). Une catégorie créée après les zones est admise par toutes les zones ENTREE (trigger trg_ticket_categories_zone_admit). Service_role seul.';
COMMENT ON TABLE public.event_gates IS
    'Lot 9 ter (consigne 1) : portes d''une zone ; un contrôleur affecté scanne à sa porte (event_controllers.gate_id). Une porte citée par un scan n''est ni supprimée ni déplacée (GATE_IN_USE). Service_role seul.';
COMMENT ON COLUMN public.event_controllers.gate_id IS
    'Lot 9 ter (consigne 1) : porte du contrôleur sur un événement à zones (même événement : event_controllers_gate_fk) ; NULL : aucune porte (GATE_REQUIRED au scan d''un événement à zones).';
COMMENT ON COLUMN public.event_controllers.gate_change_allowed IS
    'Lot 9 ter (consigne 1) : la partenaire autorise le contrôleur à changer lui-même de porte (controller_gate_select, journalisé).';
COMMENT ON COLUMN public.ticket_scans.gate_id IS
    'Lot 9 ter (consigne 1) : porte du scan (événement à zones) ; NULL sans zone.';
COMMENT ON COLUMN public.ticket_scans.zone_id IS
    'Lot 9 ter (consigne 1) : zone de la porte, posée par ticket_scans_enrich ; NULL pour la zone implicite.';
COMMENT ON COLUMN public.ticket_scans.zone_result IS
    'Lot 9 ter (consigne 1) : verdict de zone (wrong_zone, not_entered, zone_ok), jamais une entrée acceptée ; exactement l''un de result et zone_result est posé (ticket_scans_outcome_one).';
COMMENT ON COLUMN public.ticket_categories.scan_color IS
    'Lot 9 ter (consigne 2) : couleur de la catégorie à l''écran du scanner (palette fermée de 8 clés). Jamais accordée à anon ni authenticated (la consigne d''entrée n''est servie qu''au scanneur autorisé et à la propriétaire).';
COMMENT ON COLUMN public.ticket_categories.entry_instruction IS
    'Lot 9 ter (consigne 2) : consigne d''entrée montrée au contrôleur sur l''entrée validée (1 à 60 caractères). Jamais accordée à anon ni authenticated (la consigne d''entrée n''est servie qu''au scanneur autorisé et à la propriétaire).';


-- ----------------------------------------------------------------------------
-- (2) F34 zone_categories_default_admit (nouvelle) : catégorie créée après les zones
-- ----------------------------------------------------------------------------
-- Admise par toutes les zones ENTREE de son événement, jamais par une zone CONTROLE ; sans zone, rien n'est écrit.
CREATE OR REPLACE FUNCTION public.zone_categories_default_admit()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.zone_categories (event_id, zone_id, category_id)
    SELECT NEW.event_id, z.id, NEW.id
      FROM public.event_zones z
     WHERE z.event_id = NEW.event_id AND z.kind = 'ENTREE'
    ON CONFLICT DO NOTHING;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_categories_zone_admit ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_zone_admit
    AFTER INSERT ON public.ticket_categories
    FOR EACH ROW EXECUTE FUNCTION public.zone_categories_default_admit();


-- ----------------------------------------------------------------------------
-- (3) F27 scan_gate_context (nouvelle) : porte et zone d'un scan, sans verrou
-- ----------------------------------------------------------------------------
-- Événement sans zone : zone implicite « Entrée » (aucune ligne écrite) ; une porte annoncée (non nulle) dit un écran
-- périmé (zones supprimées pendant le contrôle) : GATE_CHANGED. Événement à zones : contrôleur affecté → sa porte,
-- annoncée à l'identique (sinon GATE_CHANGED ; sans porte GATE_REQUIRED) ; propriétaire ou admin (sans affectation)
-- → la porte annoncée, de cet événement (sinon GATE_REQUIRED ou GATE_INVALID). En cas de problème, porte et zone NULL.
CREATE OR REPLACE FUNCTION public.scan_gate_context(p_scanner uuid, p_event uuid, p_claimed uuid, p_claimed_given boolean)
RETURNS TABLE (configured boolean, gate_id uuid, gate_name text, zone_id uuid, zone_name text, zone_kind text, problem text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assigned boolean;
    v_assigned_gate uuid;
    v_gate uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = p_event) THEN
        IF COALESCE(p_claimed_given, FALSE) AND p_claimed IS NOT NULL THEN
            RETURN QUERY SELECT FALSE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_CHANGED'::text;
        ELSE
            RETURN QUERY SELECT FALSE, NULL::uuid, NULL::text, NULL::uuid, 'Entrée'::text, 'ENTREE'::text, NULL::text;
        END IF;
        RETURN;
    END IF;

    SELECT TRUE, ec.gate_id INTO v_assigned, v_assigned_gate
      FROM public.event_controllers ec
     WHERE ec.event_id = p_event AND ec.user_id = p_scanner;
    IF COALESCE(v_assigned, FALSE) THEN
        IF v_assigned_gate IS NULL THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_REQUIRED'::text;
            RETURN;
        END IF;
        IF NOT COALESCE(p_claimed_given, FALSE) OR p_claimed IS DISTINCT FROM v_assigned_gate THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_CHANGED'::text;
            RETURN;
        END IF;
        v_gate := v_assigned_gate;
    ELSE
        IF NOT COALESCE(p_claimed_given, FALSE) OR p_claimed IS NULL THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_REQUIRED'::text;
            RETURN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.event_gates eg WHERE eg.id = p_claimed AND eg.event_id = p_event) THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_INVALID'::text;
            RETURN;
        END IF;
        v_gate := p_claimed;
    END IF;

    RETURN QUERY
    SELECT TRUE, eg.id, eg.name, z.id, z.name, z.kind, NULL::text
      FROM public.event_gates eg
      JOIN public.event_zones z ON z.id = eg.zone_id
     WHERE eg.id = v_gate;
    IF NOT FOUND THEN
        -- Porte supprimée entre la lecture de l'affectation et celle de la porte : jamais un scan sans porte
        RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_INVALID'::text;
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- (4) F28 scan_zone_verdict (nouvelle) : verdict de zone d'une catégorie, sans verrou
-- ----------------------------------------------------------------------------
-- Zone implicite : aucune règle. ENTREE : admise → aucun verdict, sinon wrong_zone. CONTROLE : non admise → wrong_zone ;
-- admise : billet UTILISE → zone_ok, VALIDE → not_entered. Zones proposées (wrong_zone, not_entered) : les 2 premières
-- autres zones qui admettent la catégorie ; un billet pas encore entré (VALIDE) n'est envoyé qu'à une zone ENTREE
-- (un contrôle ne le ferait pas entrer) ; un billet entré (UTILISE) voit d'abord les zones de contrôle. Tri : type
-- d'abord, puis position, nom, identifiant. Jamais NULL pour ces deux verdicts ([] si aucune).
CREATE OR REPLACE FUNCTION public.scan_zone_verdict(p_event uuid, p_zone uuid, p_kind text, p_category uuid, p_status text)
RETURNS TABLE (zone_result text, redirect_zones jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admitted boolean;
    v_result text;
    v_first text;
BEGIN
    IF p_zone IS NULL THEN
        RETURN QUERY SELECT NULL::text, NULL::jsonb;
        RETURN;
    END IF;
    v_admitted := EXISTS (SELECT 1 FROM public.zone_categories zc WHERE zc.zone_id = p_zone AND zc.category_id = p_category);
    IF p_kind = 'ENTREE' THEN
        IF v_admitted THEN
            RETURN QUERY SELECT NULL::text, NULL::jsonb;
            RETURN;
        END IF;
        v_result := 'wrong_zone';
    ELSIF p_kind = 'CONTROLE' THEN
        IF NOT v_admitted THEN
            v_result := 'wrong_zone';
        ELSIF p_status = 'UTILISE' THEN
            RETURN QUERY SELECT 'zone_ok'::text, NULL::jsonb;
            RETURN;
        ELSIF p_status = 'VALIDE' THEN
            v_result := 'not_entered';
        ELSE
            RETURN QUERY SELECT NULL::text, NULL::jsonb;
            RETURN;
        END IF;
    ELSE
        RETURN QUERY SELECT NULL::text, NULL::jsonb;
        RETURN;
    END IF;

    v_first := CASE WHEN p_status = 'UTILISE' THEN 'CONTROLE' ELSE 'ENTREE' END;
    RETURN QUERY
    SELECT v_result,
           COALESCE((SELECT jsonb_agg(x.name ORDER BY x.ord)
                       FROM (SELECT z.name,
                                    row_number() OVER (ORDER BY CASE WHEN z.kind = v_first THEN 0 ELSE 1 END, z.position,
                                                                lower(btrim(z.name)), z.id) AS ord
                               FROM public.event_zones z
                              WHERE z.event_id = p_event AND z.id <> p_zone
                                AND (p_status = 'UTILISE' OR z.kind = 'ENTREE')
                                AND EXISTS (SELECT 1 FROM public.zone_categories zc
                                             WHERE zc.zone_id = z.id AND zc.category_id = p_category)) x
                      WHERE x.ord <= 2), '[]'::jsonb);
END;
$$;


-- ----------------------------------------------------------------------------
-- (5) F29 scan_log_at (nouvelle) : ligne du journal avec porte, zone et verdict de zone
-- ----------------------------------------------------------------------------
-- Miroir exact de scan_log (20261105000005_lot7_scan.sql:41-60, inchangée et seule à garder ses DEFAULT) + verdict de
-- zone, porte et zone ; aucun DEFAULT (aucune surcharge ambiguë, PGRST203). Une ligne de zone est datée par
-- clock_timestamp() : écrite après le verrou du billet, elle suit l'entrée qu'elle lit (x9) ; toute autre ligne garde
-- now() (x11 compare created_at et claimed_at, tous deux now()).
CREATE OR REPLACE FUNCTION public.scan_log_at(p_ticket uuid, p_event uuid, p_scanner uuid, p_result text, p_zone_result text,
                                              p_accepted boolean, p_method text, p_identity boolean, p_hash text, p_amount numeric,
                                              p_secret_version integer, p_client_key text, p_gate uuid, p_zone uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, zone_result, accepted, method, identity_verified,
                                     payload_hash, amount_due, secret_version, client_key, gate_id, zone_id, created_at)
    VALUES (p_ticket, p_event, p_scanner, p_result, p_zone_result, p_accepted, p_method, COALESCE(p_identity, FALSE),
            p_hash, p_amount, p_secret_version, p_client_key, p_gate, p_zone,
            CASE WHEN p_zone_result IS NOT NULL THEN clock_timestamp() ELSE now() END)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


-- ----------------------------------------------------------------------------
-- (6) F35 ticket_scans_enrich (recopie, base 20261101000013_lot4_pilotage.sql:28-56 ; trigger :58-61 inchangé)
-- ----------------------------------------------------------------------------
-- Changement unique : une porte posée donne la zone de la ligne et son point d'entrée (nom de la porte), pour
-- l'affecté comme pour la propriétaire ou l'admin. Sans porte : comportement d'avant à l'octet. VOLATILE écrit
-- (défaut de la base).
CREATE OR REPLACE FUNCTION public.ticket_scans_enrich()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry text;
    v_assigned boolean := FALSE;
    v_gate_name text;
    v_gate_zone uuid;
BEGIN
    IF NEW.category_id IS NULL AND NEW.ticket_id IS NOT NULL THEN
        SELECT category_id INTO NEW.category_id FROM public.tickets WHERE id = NEW.ticket_id;
    END IF;
    -- Lot 9 ter (consigne 1) : porte du scan → zone et point d'entrée
    IF NEW.gate_id IS NOT NULL THEN
        SELECT g.name, g.zone_id INTO v_gate_name, v_gate_zone FROM public.event_gates g WHERE g.id = NEW.gate_id;
        NEW.zone_id := COALESCE(NEW.zone_id, v_gate_zone);
    END IF;
    IF NEW.event_id IS NOT NULL THEN
        SELECT TRUE, entry_point INTO v_assigned, v_entry
          FROM public.event_controllers WHERE event_id = NEW.event_id AND user_id = NEW.scanner_id;
        IF COALESCE(v_assigned, FALSE) THEN
            NEW.scanner_role := COALESCE(NEW.scanner_role, 'CONTROLEUR');
            NEW.entry_point := COALESCE(v_gate_name, NEW.entry_point, v_entry);
        ELSIF EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                       WHERE e.id = NEW.event_id AND p.user_id = NEW.scanner_id) THEN
            NEW.scanner_role := COALESCE(NEW.scanner_role, 'PARTENAIRE');
        ELSIF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = NEW.scanner_id AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN
            NEW.scanner_role := COALESCE(NEW.scanner_role, 'ADMIN');
        END IF;
        IF v_gate_name IS NOT NULL AND NOT COALESCE(v_assigned, FALSE) THEN
            NEW.entry_point := v_gate_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- (7) F30 event_zones_get (nouvelle) : configuration des zones d'un événement
-- ----------------------------------------------------------------------------
-- p = { event_id, actor_id }. Lecture : propriétaire, admin events.read (pilotage_access) ; refus pilotage_refusal.
-- can_edit : propriétaire actif, événement ni TERMINE, ni ANNULE, ni EN_ATTENTE ; sinon edit_block dit pourquoi.
CREATE OR REPLACE FUNCTION public.event_zones_get(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_code text;
    a record;
    v_status text;
    v_block text;
    v_zones jsonb;
    v_categories jsonb;
    v_controllers jsonb;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event;
    SELECT * INTO a FROM public.event_actor_profile_perm(v_event, v_actor, 'events.read');
    v_block := CASE
        WHEN NOT COALESCE(a.is_owner, FALSE) THEN 'Seul l’organisateur modifie les zones de son événement.'
        WHEN NOT COALESCE(a.is_active, FALSE) THEN 'Votre compte n’est pas actif.'
        WHEN v_status IN ('TERMINE', 'ANNULE') THEN 'Les zones d’un événement terminé ou annulé ne peuvent plus être modifiées.'
        WHEN v_status = 'EN_ATTENTE' THEN 'L’événement est en cours de validation : retirez-le de la validation pour modifier ses zones.'
        END;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', z.id, 'name', z.name, 'kind', z.kind, 'position', z.position,
               'category_ids', COALESCE((SELECT jsonb_agg(zc.category_id ORDER BY zc.category_id)
                                           FROM public.zone_categories zc WHERE zc.zone_id = z.id), '[]'::jsonb),
               'gates', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                            'id', eg.id, 'name', eg.name,
                                            'in_use', EXISTS (SELECT 1 FROM public.ticket_scans sc
                                                               WHERE sc.event_id = v_event AND sc.gate_id = eg.id),
                                            'controller_count', (SELECT count(*) FROM public.event_controllers ec
                                                                  WHERE ec.event_id = v_event AND ec.gate_id = eg.id))
                                        ORDER BY lower(btrim(eg.name)), eg.id)
                                    FROM public.event_gates eg WHERE eg.zone_id = z.id), '[]'::jsonb))
           ORDER BY z.position, lower(btrim(z.name)), z.id), '[]'::jsonb)
      INTO v_zones
      FROM public.event_zones z
     WHERE z.event_id = v_event;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'is_active', c.is_active,
                                                 'scan_color', c.scan_color, 'entry_instruction', c.entry_instruction)
                              ORDER BY c.price, c.name, c.id), '[]'::jsonb)
      INTO v_categories
      FROM public.ticket_categories c
     WHERE c.event_id = v_event;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', x.name, 'gate_id', x.gate_id,
                                                 'gate_change_allowed', x.gate_change_allowed)
                              ORDER BY x.name, x.user_id), '[]'::jsonb)
      INTO v_controllers
      FROM (SELECT ec.user_id, COALESCE(public.pilotage_display_name(u.first_name, u.last_name), 'Contrôleur') AS name,
                   ec.gate_id, ec.gate_change_allowed
              FROM public.event_controllers ec
              LEFT JOIN public.users u ON u.id = ec.user_id
             WHERE ec.event_id = v_event) x;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event,
                              'configured', jsonb_array_length(v_zones) > 0,
                              'can_edit', v_block IS NULL, 'edit_block', v_block,
                              'zones', v_zones, 'categories', v_categories, 'controllers', v_controllers);
END;
$$;


-- ----------------------------------------------------------------------------
-- (8) F31 event_zones_save (nouvelle) : configuration complète des zones et des portes
-- ----------------------------------------------------------------------------
-- p = { event_id, actor_id, zones: [{ id?, name, kind, position?, category_ids, gates: [{ id?, name }] }] } ;
-- zones: [] = retour à la zone implicite. Forme (sans verrou), garde de la billetterie (événement NKU, propriétaire,
-- statut, catégories FOR UPDATE), catégories de l'événement, toute catégorie admise par une zone ENTREE, verrous des
-- zones, des portes et des affectations à une porte, porte ou zone déjà citée par un scan protégée, écritures (deux
-- passes sur les noms : un échange ne viole jamais l'unicité), audit sans nom de personne, puis la configuration lue.
-- Aucune insertion dans event_controllers ; aucune notification.
CREATE OR REPLACE FUNCTION public.event_zones_save(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_zones jsonb := p->'zones';
    v_n integer;
    v_guard jsonb;
    v_code text;
    z jsonb;
    gt jsonb;
    i integer;
    j integer;
    v_name text;
    v_key text;
    v_total_gates integer := 0;
    v_zone_keys text[] := ARRAY[]::text[];
    v_gate_keys text[] := ARRAY[]::text[];
    v_req_zones uuid[] := ARRAY[]::uuid[];
    v_req_gates uuid[] := ARRAY[]::uuid[];
    v_final_zones uuid[] := ARRAY[]::uuid[];
    v_has_entry boolean := FALSE;
    v_id uuid;
    v_zone uuid;
    v_pos integer;
    v_cat uuid;
    r record;
    v_admissions integer;
BEGIN
    -- 1. Forme, sans verrou
    IF v_event IS NULL OR v_actor IS NULL OR v_zones IS NULL OR jsonb_typeof(v_zones) <> 'array' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.');
    END IF;
    v_n := jsonb_array_length(v_zones);
    IF v_n > 20 THEN
        RETURN public.event_edit_refusal('TOO_MANY_ZONES', '20 zones au plus par événement.');
    END IF;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        IF jsonb_typeof(z) <> 'object' OR jsonb_typeof(z->'gates') IS DISTINCT FROM 'array'
           OR jsonb_typeof(z->'category_ids') IS DISTINCT FROM 'array' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i);
        END IF;
        v_total_gates := v_total_gates + jsonb_array_length(z->'gates');
    END LOOP;
    IF v_total_gates > 50 THEN
        RETURN public.event_edit_refusal('TOO_MANY_GATES', '50 portes au plus par événement.');
    END IF;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_name := CASE WHEN jsonb_typeof(z->'name') = 'string' THEN btrim(z->>'name') END;
        IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 OR v_name ~ '[[:cntrl:]]' THEN
            RETURN public.event_edit_refusal('ZONE_NAME_INVALID', 'Donnez à chaque zone un nom de 1 à 40 caractères.', 'zones.' || i || '.name');
        END IF;
        IF COALESCE(z->>'kind', '') NOT IN ('ENTREE', 'CONTROLE') THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.kind');
        END IF;
        IF COALESCE(jsonb_typeof(z->'position'), 'null') <> 'null'
           AND (jsonb_typeof(z->'position') <> 'number' OR (z->>'position') !~ '^[0-9]{1,2}$') THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.position');
        END IF;
        IF COALESCE(jsonb_typeof(z->'id'), 'null') <> 'null' THEN
            v_id := CASE WHEN jsonb_typeof(z->'id') = 'string' THEN public.try_uuid(z->>'id') END;
            IF v_id IS NULL OR v_id = ANY (v_req_zones) THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.id');
            END IF;
            v_req_zones := v_req_zones || v_id;
        END IF;
        FOR j IN 0 .. jsonb_array_length(z->'category_ids') - 1 LOOP
            IF jsonb_typeof(z->'category_ids'->j) <> 'string' OR public.try_uuid(z->'category_ids'->>j) IS NULL THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.category_ids');
            END IF;
        END LOOP;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            gt := z->'gates'->j;
            IF jsonb_typeof(gt) <> 'object' THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.gates.' || j);
            END IF;
            v_name := CASE WHEN jsonb_typeof(gt->'name') = 'string' THEN btrim(gt->>'name') END;
            IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 OR v_name ~ '[[:cntrl:]]' THEN
                RETURN public.event_edit_refusal('ZONE_NAME_INVALID', 'Donnez à chaque porte un nom de 1 à 40 caractères.',
                                                 'zones.' || i || '.gates.' || j || '.name');
            END IF;
            IF COALESCE(jsonb_typeof(gt->'id'), 'null') <> 'null' THEN
                v_id := CASE WHEN jsonb_typeof(gt->'id') = 'string' THEN public.try_uuid(gt->>'id') END;
                IF v_id IS NULL OR v_id = ANY (v_req_gates) THEN
                    RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.gates.' || j || '.id');
                END IF;
                v_req_gates := v_req_gates || v_id;
            END IF;
        END LOOP;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_key := lower(btrim(z->>'name'));
        IF v_key = ANY (v_zone_keys) THEN
            RETURN public.event_edit_refusal('ZONE_NAME_TAKEN', 'Deux zones portent le nom ' || btrim(z->>'name') || ' : choisissez des noms différents.',
                                             'zones.' || i || '.name');
        END IF;
        v_zone_keys := v_zone_keys || v_key;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            v_key := lower(btrim(z->'gates'->j->>'name'));
            IF v_key = ANY (v_gate_keys) THEN
                RETURN public.event_edit_refusal('GATE_NAME_TAKEN', 'Deux portes portent le nom ' || btrim(z->'gates'->j->>'name') || ' : choisissez des noms différents.',
                                                 'zones.' || i || '.gates.' || j || '.name');
            END IF;
            v_gate_keys := v_gate_keys || v_key;
        END LOOP;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        IF jsonb_array_length(z->'gates') = 0 THEN
            RETURN public.event_edit_refusal('ZONE_WITHOUT_GATE', 'La zone ' || btrim(z->>'name') || ' n’a aucune porte : ajoutez-en au moins une.',
                                             'zones.' || i || '.gates');
        END IF;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        IF jsonb_array_length(z->'category_ids') = 0 THEN
            RETURN public.event_edit_refusal('ZONE_WITHOUT_CATEGORY', 'La zone ' || btrim(z->>'name') || ' n’admet aucune catégorie : cochez-en au moins une.',
                                             'zones.' || i || '.category_ids');
        END IF;
        IF z->>'kind' = 'ENTREE' THEN
            v_has_entry := TRUE;
        END IF;
    END LOOP;
    IF v_n > 0 AND NOT v_has_entry THEN
        RETURN public.event_edit_refusal('NO_ENTRANCE_ZONE', 'Il faut au moins une zone de type Entrée : c’est là que les billets sont compostés.');
    END IF;

    -- 2. Verrous : événement NKU, droits du propriétaire, statut, catégories ORDER BY id FOR UPDATE. Un admin, même
    --    muni de events.write, ne modifie pas les zones (C-D7) ; textes de la garde dits pour les zones.
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF NOT COALESCE((v_guard->>'ok')::boolean, FALSE) THEN
        v_code := v_guard->>'code';
        IF v_code = 'EVENT_NOT_FOUND' AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = v_event)
           AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            v_code := 'ADMIN_CANNOT_EDIT';
        END IF;
        RETURN public.event_edit_refusal(v_code, CASE v_code
            WHEN 'ADMIN_CANNOT_EDIT' THEN 'Seul l’organisateur modifie les zones de son événement.'
            WHEN 'EVENT_LOCKED' THEN 'Les zones d’un événement terminé ou annulé ne peuvent plus être modifiées.'
            WHEN 'WITHDRAW_TO_EDIT' THEN 'L’événement est en cours de validation : retirez-le de la validation pour modifier ses zones.'
            WHEN 'ACCOUNT_NOT_ACTIVE' THEN 'Votre compte n’est pas actif.'
            ELSE COALESCE(v_guard->>'message', 'Événement introuvable.') END);
    END IF;

    -- 3. Catégories citées : toutes de l'événement ; toute catégorie (active ou non, x10) entre par une zone ENTREE
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        FOR j IN 0 .. jsonb_array_length(z->'category_ids') - 1 LOOP
            v_cat := public.try_uuid(z->'category_ids'->>j);
            IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.id = v_cat AND c.event_id = v_event) THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.category_ids');
            END IF;
        END LOOP;
    END LOOP;
    IF v_n > 0 THEN
        SELECT c.name INTO v_name
          FROM public.ticket_categories c
         WHERE c.event_id = v_event
           AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_zones) zz
                             CROSS JOIN LATERAL jsonb_array_elements_text(zz->'category_ids') cid
                            WHERE zz->>'kind' = 'ENTREE' AND public.try_uuid(cid) = c.id)
         ORDER BY c.price, c.name, c.id
         LIMIT 1;
        IF FOUND THEN
            RETURN public.event_edit_refusal('CATEGORY_WITHOUT_ENTRANCE',
                'La catégorie ' || v_name || ' n’entre par aucune zone de type Entrée : cochez-la dans une zone d’entrée.');
        END IF;
    END IF;

    -- 4. Verrous suivants : zones, portes (attend les scans en cours, qui tiennent un KEY SHARE par leur clé
    --    étrangère), affectations à une porte
    PERFORM 1 FROM public.event_zones ez WHERE ez.event_id = v_event ORDER BY ez.id FOR UPDATE;
    PERFORM 1 FROM public.event_gates eg WHERE eg.event_id = v_event ORDER BY eg.id FOR UPDATE;
    PERFORM 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.gate_id IS NOT NULL ORDER BY ec.id FOR UPDATE;

    -- 5. Identifiants fournis : zones et portes de cet événement
    IF EXISTS (SELECT 1 FROM unnest(v_req_zones) rz(id)
                WHERE NOT EXISTS (SELECT 1 FROM public.event_zones ez WHERE ez.id = rz.id AND ez.event_id = v_event)) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.');
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_req_gates) rg(id)
                WHERE NOT EXISTS (SELECT 1 FROM public.event_gates eg WHERE eg.id = rg.id AND eg.event_id = v_event)) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.');
    END IF;

    -- 6. Porte supprimée : citée par un scan → GATE_IN_USE ; affectée → GATE_ASSIGNED. Porte gardée changée de zone :
    --    citée par un scan → GATE_IN_USE. Zone supprimée ou changée de type : citée par un scan → ZONE_IN_USE (EC6).
    FOR r IN SELECT eg.id, eg.name FROM public.event_gates eg
              WHERE eg.event_id = v_event AND NOT (eg.id = ANY (v_req_gates))
              ORDER BY lower(btrim(eg.name)), eg.id LOOP
        IF EXISTS (SELECT 1 FROM public.ticket_scans sc WHERE sc.event_id = v_event AND sc.gate_id = r.id) THEN
            RETURN public.event_edit_refusal('GATE_IN_USE', 'La porte ' || r.name || ' a déjà servi au contrôle : elle ne peut être ni supprimée ni changée de zone.');
        END IF;
        IF EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.gate_id = r.id) THEN
            RETURN public.event_edit_refusal('GATE_ASSIGNED', 'Des contrôleurs sont affectés à la porte ' || r.name || ' : changez d’abord leur porte dans l’équipe.');
        END IF;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_zone := CASE WHEN COALESCE(jsonb_typeof(z->'id'), 'null') <> 'null' THEN public.try_uuid(z->>'id') END;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            gt := z->'gates'->j;
            CONTINUE WHEN COALESCE(jsonb_typeof(gt->'id'), 'null') = 'null';
            SELECT eg.id, eg.name, eg.zone_id INTO r FROM public.event_gates eg WHERE eg.id = public.try_uuid(gt->>'id');
            IF r.zone_id IS DISTINCT FROM v_zone
               AND EXISTS (SELECT 1 FROM public.ticket_scans sc WHERE sc.event_id = v_event AND sc.gate_id = r.id) THEN
                RETURN public.event_edit_refusal('GATE_IN_USE', 'La porte ' || r.name || ' a déjà servi au contrôle : elle ne peut être ni supprimée ni changée de zone.');
            END IF;
        END LOOP;
    END LOOP;
    FOR r IN SELECT ez.id, ez.name, ez.kind FROM public.event_zones ez
              WHERE ez.event_id = v_event
              ORDER BY ez.position, lower(btrim(ez.name)), ez.id LOOP
        IF (NOT (r.id = ANY (v_req_zones))
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_zones) zz
                        WHERE COALESCE(jsonb_typeof(zz->'id'), 'null') <> 'null' AND public.try_uuid(zz->>'id') = r.id
                          AND zz->>'kind' IS DISTINCT FROM r.kind))
           AND EXISTS (SELECT 1 FROM public.ticket_scans sc WHERE sc.event_id = v_event AND sc.zone_id = r.id) THEN
            RETURN public.event_edit_refusal('ZONE_IN_USE', 'La zone ' || r.name || ' a déjà servi au contrôle : son type ne peut plus changer et elle ne peut plus être supprimée.');
        END IF;
    END LOOP;

    -- 7. Écritures. Portes absentes supprimées d'abord ; toutes les zones et les portes gardées prennent leur identifiant
    --    pour nom (première passe : un échange ou un nom repris d'une zone supprimée ne viole jamais l'unicité) ; zones
    --    absentes supprimées en dernier, une fois leurs portes gardées déplacées (clé étrangère RESTRICT des portes).
    DELETE FROM public.zone_categories zc WHERE zc.event_id = v_event;
    DELETE FROM public.event_gates eg WHERE eg.event_id = v_event AND NOT (eg.id = ANY (v_req_gates));
    UPDATE public.event_zones ez SET name = ez.id::text WHERE ez.event_id = v_event;
    UPDATE public.event_gates eg SET name = eg.id::text WHERE eg.event_id = v_event;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_pos := CASE WHEN jsonb_typeof(z->'position') = 'number' THEN (z->>'position')::integer ELSE i END;
        v_zone := CASE WHEN COALESCE(jsonb_typeof(z->'id'), 'null') <> 'null' THEN public.try_uuid(z->>'id') END;
        IF v_zone IS NOT NULL THEN
            UPDATE public.event_zones SET name = btrim(z->>'name'), kind = z->>'kind', position = v_pos, updated_at = now()
             WHERE id = v_zone;
        ELSE
            INSERT INTO public.event_zones (event_id, name, kind, position)
            VALUES (v_event, btrim(z->>'name'), z->>'kind', v_pos)
            RETURNING id INTO v_zone;
        END IF;
        v_final_zones := v_final_zones || v_zone;
        INSERT INTO public.zone_categories (event_id, zone_id, category_id)
        SELECT DISTINCT v_event, v_zone, public.try_uuid(cid)
          FROM jsonb_array_elements_text(z->'category_ids') cid
        ON CONFLICT DO NOTHING;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            gt := z->'gates'->j;
            IF COALESCE(jsonb_typeof(gt->'id'), 'null') <> 'null' THEN
                UPDATE public.event_gates SET name = btrim(gt->>'name'), zone_id = v_zone WHERE id = public.try_uuid(gt->>'id');
            ELSE
                INSERT INTO public.event_gates (event_id, zone_id, name) VALUES (v_event, v_zone, btrim(gt->>'name'));
            END IF;
        END LOOP;
    END LOOP;
    DELETE FROM public.event_zones ez WHERE ez.event_id = v_event AND NOT (ez.id = ANY (v_final_zones));
    -- Porte renommée : le point d'entrée des contrôleurs qui y sont affectés suit
    UPDATE public.event_controllers ec SET entry_point = eg.name
      FROM public.event_gates eg
     WHERE eg.id = ec.gate_id AND ec.event_id = v_event AND ec.entry_point IS DISTINCT FROM eg.name;

    -- 8. Audit (aucun nom de personne)
    SELECT count(*) INTO v_admissions FROM public.zone_categories zc WHERE zc.event_id = v_event;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_ZONES_UPDATED', 'events', v_event,
            jsonb_build_object('zones', v_n, 'gates', v_total_gates, 'admissions', v_admissions, 'implicit', v_n = 0));

    -- 9. Configuration enregistrée
    RETURN public.event_zones_get(jsonb_build_object('event_id', v_event, 'actor_id', v_actor));
END;
$$;


-- ----------------------------------------------------------------------------
-- (9) F32 event_controller_gate_set (nouvelle) : porte d'un contrôleur affecté
-- ----------------------------------------------------------------------------
-- p = { actor_id, event_id, controller_id, gate_id | null, gate_change_allowed? }. Propriétaire, ou admin events.write.
-- Porte de cet événement (sinon GATE_INVALID, aussi sans zone) ; contrôleur affecté (sinon NOT_ASSIGNED) ; le point
-- d'entrée prend le nom de la porte (retirée : NULL sur un événement à zones, inchangé sans zone). Audit
-- CONTROLLER_GATE_SET ; aucune insertion dans event_controllers ; aucune notification.
CREATE OR REPLACE FUNCTION public.event_controller_gate_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_controller uuid := public.try_uuid(p->>'controller_id');
    v_gate uuid := public.try_uuid(p->>'gate_id');
    v_allowed boolean;
    v_status text;
    a record;
    ec record;
    v_gate_name text;
    v_gate_json jsonb := 'null'::jsonb;
    v_configured boolean;
BEGIN
    IF v_actor IS NULL OR v_event IS NULL OR v_controller IS NULL
       OR (COALESCE(jsonb_typeof(p->'gate_id'), 'null') <> 'null' AND v_gate IS NULL)
       OR COALESCE(jsonb_typeof(p->'gate_change_allowed'), 'null') NOT IN ('null', 'boolean') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande invalide.');
    END IF;
    v_allowed := COALESCE((p->>'gate_change_allowed')::boolean, FALSE);
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (COALESCE(a.is_owner, FALSE) OR COALESCE(a.is_staff, FALSE)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT COALESCE(a.is_active, FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    v_configured := EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event);
    IF v_gate IS NOT NULL THEN
        SELECT eg.name, jsonb_build_object('id', eg.id, 'name', eg.name,
                                           'zone', jsonb_build_object('id', z.id, 'name', z.name, 'kind', z.kind))
          INTO v_gate_name, v_gate_json
          FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
         WHERE eg.id = v_gate AND eg.event_id = v_event;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_INVALID', 'message', 'Porte inconnue : choisissez une porte de cet événement.');
        END IF;
    END IF;
    SELECT x.id, x.gate_id INTO ec FROM public.event_controllers x
     WHERE x.event_id = v_event AND x.user_id = v_controller FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Ce contrôleur n’est pas affecté à cet événement.');
    END IF;
    UPDATE public.event_controllers
       SET gate_id = v_gate,
           gate_change_allowed = v_allowed,
           entry_point = CASE WHEN v_gate IS NOT NULL THEN v_gate_name WHEN v_configured THEN NULL ELSE entry_point END
     WHERE id = ec.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN COALESCE(a.is_owner, FALSE) THEN 'PARTENAIRE' ELSE 'ADMIN' END, 'CONTROLLER_GATE_SET',
            'event_controllers', ec.id,
            jsonb_build_object('event_id', v_event, 'controller_id', v_controller, 'gate_id', v_gate,
                               'gate_change_allowed', v_allowed, 'previous_gate_id', ec.gate_id));
    RETURN jsonb_build_object('ok', true, 'controller_id', v_controller, 'gate', v_gate_json, 'gate_change_allowed', v_allowed);
END;
$$;


-- ----------------------------------------------------------------------------
-- (10) F33 controller_gate_select (nouvelle) : le contrôleur autorisé change lui-même de porte
-- ----------------------------------------------------------------------------
-- p = { actor_id, event_id, gate_id }. Compte actif, affecté, autorisé par la partenaire (gate_change_allowed), porte
-- de cet événement ; sans PIN régisseur ; audit CONTROLLER_GATE_CHANGED { event_id, from_gate_id, to_gate_id }.
CREATE OR REPLACE FUNCTION public.controller_gate_select(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_gate uuid := public.try_uuid(p->>'gate_id');
    ec record;
    g record;
BEGIN
    IF v_actor IS NULL OR v_event IS NULL OR v_gate IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande invalide.');
    END IF;
    PERFORM 1 FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    SELECT x.id, x.gate_id, x.gate_change_allowed INTO ec FROM public.event_controllers x
     WHERE x.event_id = v_event AND x.user_id = v_actor FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Vous n’êtes pas affecté à cet événement.');
    END IF;
    IF NOT ec.gate_change_allowed THEN
        RETURN jsonb_build_object('ok', false, 'code', 'GATE_CHANGE_NOT_ALLOWED', 'message', 'L’organisateur ne vous autorise pas à changer de porte.');
    END IF;
    SELECT eg.id, eg.name, z.id AS zone_id, z.name AS zone_name, z.kind AS zone_kind INTO g
      FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
     WHERE eg.id = v_gate AND eg.event_id = v_event;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'GATE_INVALID', 'message', 'Porte inconnue : choisissez une porte de cet événement.');
    END IF;
    UPDATE public.event_controllers SET gate_id = v_gate, entry_point = g.name WHERE id = ec.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'CONTROLEUR', 'CONTROLLER_GATE_CHANGED', 'event_controllers', ec.id,
            jsonb_build_object('event_id', v_event, 'from_gate_id', ec.gate_id, 'to_gate_id', v_gate));
    RETURN jsonb_build_object('ok', true,
        'gate', jsonb_build_object('id', g.id, 'name', g.name,
                                   'zone', jsonb_build_object('id', g.zone_id, 'name', g.zone_name, 'kind', g.zone_kind)));
END;
$$;


-- ----------------------------------------------------------------------------
-- (11) F36 ticket_scan (recopie, base 20261109000008_lot9bis_cycle.sql:1006-1210)
-- ----------------------------------------------------------------------------
-- Changements (numéros d'étapes de la base) :
--  9t.15 : étape 1 ter bis (contexte de porte, après le rejeu : problème → 409 sans ligne, sans audit, sans donnée du
--          billet) ; chaque ligne des étapes 2 à 9 par scan_log_at avec la porte et la zone (l'étape 1, forbidden,
--          garde scan_log) ; étape 7 bis-zone (porte de CONTRÔLE : refus rouges du billet, puis verdict de zone, jamais
--          de compostage) ; étape 8 bis (porte d'ENTRÉE : mauvaise zone après les refus rouges) ; toute réponse qui
--          porte le billet porte aussi `zone` et `gate` ; le rejeu rend le verdict de zone avec son billet.
--  9t.16 : billet servi avec `category_color` (ticket_categories.scan_color), `origin` (ticket_origin, F5, règle R50 :
--          un ancien billet encaissé à l'entrée est « Guichet »), `entry_instruction` sur l'entrée validée seulement,
--          `checked_in_gate` (porte, sinon point d'entrée, de la ligne acceptée) sur « déjà utilisé » et « accès
--          autorisé », lu après le verrou du billet (le perdant d'une course voit la porte du gagnant) ; même billet au
--          rejeu.
--  9t.17 (délégation fix(9t.17-SZ), D-inv 3.3) : méthode GUEST_LIST (validation par la liste des invités) : même garde
--          que la saisie manuelle (pièce vérifiée, access.manual_entry_scope) ; billet désigné par son identifiant ; un
--          billet qui n'est pas une invitation donne `invalid` sans ticket_id ni donnée (requête forgée) ; étape 7 bis :
--          transfert d'invitation PENDING ou EXPIRED du billet pris FOR UPDATE SKIP LOCKED (un autre transfert en
--          attente, ou l'invitation tenue par une acceptation en cours : transfer_pending) ; étape 9 : billet déverrouillé
--          et transfert clos ADMITTED avec claimed_at = now() dans la transaction du compostage (même heure que la ligne
--          GUEST_LIST, x11) ; `is_guest_list` dans le billet ; porteur « {nom de l'invité} » ou « Invité » pour une
--          invitation sans porteur (au lieu de « Vente au guichet »), au rejeu aussi.
CREATE OR REPLACE FUNCTION public.ticket_scan(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := (p->>'scanner_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_method text := COALESCE(p->>'method', 'QR');
    v_identity boolean := COALESCE((p->>'identity_verified')::boolean, FALSE);
    v_hash text := NULLIF(p->>'payload_hash', '');
    v_pre text := NULLIF(p->>'pre_result', '');
    v_key text := NULLIF(btrim(COALESCE(p->>'client_key', '')), '');
    -- Lot 8 (8.2 e) : lecture sans cast ; toute valeur non `false` compte comme un renvoi, jamais un compostage
    v_replay_only boolean := COALESCE(p->>'replay_only', 'false') <> 'false';
    v_version integer;
    v_ticket_id uuid;
    t record;
    s record;
    v_problem text;
    v_pay_status text;
    v_order_status text;
    v_scope text;
    v_scan uuid;
    v_info jsonb;
    v_reply jsonb;
    v_checked_at timestamptz;
    v_checked_by uuid;
    -- Lot 9 ter (9t.15) : porte annoncée, contexte de porte et verdict de zone
    v_gate_given boolean := p ? 'gate_id';
    v_claimed uuid := public.try_uuid(p->>'gate_id');
    g record;
    v_zone_result text;
    v_redirect jsonb;
    v_zone jsonb;
    v_gate jsonb;
    v_kind text;
    -- Lot 9 ter (9t.16) : porte du premier compostage
    v_checked_gate text;
    -- Lot 9 ter (9t.17) : transfert d'invitation clos par la liste des invités
    v_invite uuid;
BEGIN
    IF v_method NOT IN ('QR', 'MANUAL', 'GUEST_LIST') THEN
        RAISE EXCEPTION 'ticket_scan : méthode % inconnue', v_method;
    END IF;
    -- Clé d'idempotence : facultative pour la RPC (seed, appels internes), obligatoire pour la route
    IF v_key IS NOT NULL AND v_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN
        RETURN jsonb_build_object('http', 400, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
    END IF;
    -- Lot 8 (8.2 e) : un renvoi sans clé ne désigne aucune lecture, refus avant toute écriture
    IF v_replay_only AND v_key IS NULL THEN
        RETURN jsonb_build_object('http', 400, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
    END IF;
    -- Version du secret présentée (QR seulement) ; absente ou illisible : NULL, refusée à l'étape 5 (D32)
    IF v_method = 'QR' AND COALESCE(p->>'secret_version', '') ~ '^[1-9][0-9]{0,8}$' THEN
        v_version := (p->>'secret_version')::integer;
    END IF;
    -- 0. Deux envois simultanés de la même clé par le même scanneur : sérialisés
    IF v_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('scan:' || COALESCE(v_scanner::text, '') || ':' || v_key));
    END IF;
    -- 1. Droit du scanneur sur l'événement, avant toute lecture du billet ou du code
    --    (refus journalisé sans la clé : il n'est pas rejouable et ne bloque pas une lecture ultérieure)
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        -- Lot 8 (L43) : un renvoi n'écrit rien, pas même `forbidden`
        IF NOT v_replay_only THEN
            PERFORM public.scan_log(NULL, v_event, v_scanner, 'forbidden', FALSE, v_method, v_identity, v_hash, NULL, v_version, NULL);
        END IF;
        RETURN jsonb_build_object('http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- 1 bis. Rejeu de la même lecture (réponse perdue, relance automatique) : verdict d'origine, aucune ligne
    IF v_key IS NOT NULL THEN
        -- Lot 8 (8.2 e) : un renvoi est propre à l'événement demandé
        SELECT * INTO s FROM public.ticket_scans
         WHERE scanner_id = v_scanner AND client_key = v_key
           AND (NOT v_replay_only OR event_id = v_event);
        IF FOUND THEN
            -- Lot 9 ter : une ligne de zone rend son verdict de zone (result NULL)
            v_reply := jsonb_build_object('result', COALESCE(s.result, s.zone_result), 'scan_id', s.id, 'replayed', TRUE,
                                          'consumed', s.consumed_at IS NOT NULL);
            IF s.amount_due IS NOT NULL THEN
                v_reply := v_reply || jsonb_build_object('amount_due', s.amount_due);
            END IF;
            -- Le billet n'est rendu que si la réponse d'origine le rendait (jamais pour un billet introuvable,
            -- d'un autre événement, ou une lecture refusée avant le billet). Lot 9 ter : COALESCE, sinon une ligne de
            -- zone (result NULL) perdrait son billet (NULL NOT IN … vaut NULL).
            IF s.ticket_id IS NOT NULL AND COALESCE(s.result, s.zone_result) NOT IN ('invalid', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'forbidden') THEN
                SELECT tk.*, c.name AS category_name, c.scan_color, c.entry_instruction, u.first_name, u.last_name,
                       pay.id AS pay_id, pay.is_platform_payment AS pay_platform
                  INTO t
                  FROM public.tickets tk
                  JOIN public.ticket_categories c ON c.id = tk.category_id
                  LEFT JOIN public.users u ON u.id = tk.user_id
                  LEFT JOIN public.payments pay ON pay.id = tk.payment_id
                 WHERE tk.id = s.ticket_id;
                IF FOUND THEN
                    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                                 'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                                                                WHEN t.user_id IS NULL THEN 'Vente au guichet'
                                                                ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END,
                                                 'price', t.price, 'is_manual_entry', s.method = 'MANUAL',
                                                 'checked_in_at', t.checked_in_at,
                                                 'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner,
                                                 'category_color', t.scan_color,
                                                 'origin', public.ticket_origin(t.sale_channel, t.price, t.pay_id IS NOT NULL AND NOT t.pay_platform),
                                                 'is_guest_list', s.method = 'GUEST_LIST');
                    -- Lot 9 ter (9t.16) : porte du compostage sur « déjà utilisé » et « accès autorisé » ; consigne sur
                    -- l'entrée validée seulement
                    IF COALESCE(s.result, s.zone_result) IN ('already_used', 'zone_ok') THEN
                        SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
                          FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
                         WHERE a.ticket_id = t.id AND a.accepted;
                        v_info := v_info || jsonb_build_object('checked_in_gate', v_checked_gate);
                    END IF;
                    IF s.result = 'valid' THEN
                        v_info := v_info || jsonb_build_object('entry_instruction', t.entry_instruction);
                    END IF;
                    -- Zone et porte de la ligne d'origine (zone NULL : zone implicite)
                    IF s.zone_id IS NULL THEN
                        v_zone := jsonb_build_object('id', NULL, 'name', 'Entrée', 'kind', 'ENTREE', 'implicit', TRUE);
                        v_kind := NULL;
                    ELSE
                        SELECT jsonb_build_object('id', z.id, 'name', z.name, 'kind', z.kind, 'implicit', FALSE), z.kind
                          INTO v_zone, v_kind
                          FROM public.event_zones z WHERE z.id = s.zone_id;
                    END IF;
                    SELECT jsonb_build_object('id', eg.id, 'name', eg.name) INTO v_gate
                      FROM public.event_gates eg WHERE eg.id = s.gate_id;
                    v_reply := v_reply || jsonb_build_object('ticket', v_info, 'zone', v_zone, 'gate', COALESCE(v_gate, 'null'::jsonb));
                    IF s.zone_result IN ('wrong_zone', 'not_entered') THEN
                        SELECT vz.redirect_zones INTO v_redirect
                          FROM public.scan_zone_verdict(s.event_id, s.zone_id, v_kind, t.category_id,
                                                        CASE WHEN s.zone_result = 'not_entered' OR v_kind = 'ENTREE' THEN 'VALIDE'
                                                             ELSE t.status::text END) vz;
                        v_reply := v_reply || jsonb_build_object('redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
                    END IF;
                END IF;
            END IF;
            RETURN v_reply;
        END IF;
    END IF;
    -- 1 ter. Lot 8 (L42) : renvoi sans ligne pour cette clé, rien n'a été traité et rien ne l'est ici. Le
    --        spectateur n'est plus devant le contrôleur : les étapes 2 à 9 ne sont jamais atteintes.
    IF v_replay_only THEN
        RETURN jsonb_build_object('result', 'not_processed', 'replayed', FALSE, 'code', 'REPLAY_NOT_FOUND');
    END IF;
    -- 1 ter bis. Lot 9 ter (9t.15) : porte du scan. Un problème de porte n'écrit aucune ligne ni aucun audit et ne
    --            lit rien du billet : la même clé reste utilisable une fois la porte corrigée (C-D3, C-D4).
    SELECT * INTO g FROM public.scan_gate_context(v_scanner, v_event, v_claimed, v_gate_given);
    IF g.problem IS NOT NULL THEN
        RETURN jsonb_build_object('http', 409, 'code', g.problem);
    END IF;
    v_zone := jsonb_build_object('id', g.zone_id, 'name', g.zone_name, 'kind', g.zone_kind, 'implicit', NOT g.configured);
    v_gate := CASE WHEN g.gate_id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('id', g.gate_id, 'name', g.gate_name) END;
    -- 2. Refus décidé avant la base (payload qui n'est pas un QR dynamique)
    IF v_pre IS NOT NULL THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, v_pre, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_pre, 'scan_id', v_scan);
    END IF;
    -- 3. Saisie manuelle : périmètre réglé et pièce d'identité vérifiée. Lot 9 ter (9t.17) : même garde pour la
    --    validation par la liste des invités, qui désigne le billet par son identifiant.
    IF v_method IN ('MANUAL', 'GUEST_LIST') THEN
        v_scope := public.fin_setting_text('access.manual_entry_scope');
        IF NOT v_identity
           OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
                   SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
            v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'manual_entry_refused', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'manual_entry_refused', 'scan_id', v_scan);
        END IF;
        IF v_method = 'MANUAL' THEN
            SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = upper(btrim(p->>'ticket_number'));
        ELSE
            v_ticket_id := public.try_uuid(p->>'ticket_id');
        END IF;
    ELSE
        v_ticket_id := NULLIF(p->>'ticket_id', '')::uuid;
    END IF;
    -- 4. Billet de l'événement (aucune donnée sinon), sous verrou. Lot 9 ter (9t.16) : couleur et consigne de la
    --    catégorie, paiement (origine du billet) lus sans verrou de plus.
    SELECT tk.*, c.name AS category_name, c.scan_color, c.entry_instruction, u.first_name, u.last_name,
           pay.id AS pay_id, pay.is_platform_payment AS pay_platform
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
      LEFT JOIN public.payments pay ON pay.id = tk.payment_id
     WHERE tk.id = v_ticket_id
       FOR UPDATE OF tk;
    IF NOT FOUND THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'invalid', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    IF t.event_id <> v_event THEN
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'wrong_event', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'wrong_event', 'scan_id', v_scan);
    END IF;
    -- Lot 9 ter (9t.17) : la liste des invités ne valide qu'une invitation ; un autre billet désigné par son
    -- identifiant est une requête forgée : ligne invalid sans ticket_id, réponse sans billet
    IF v_method = 'GUEST_LIST' AND t.sale_channel IS DISTINCT FROM 'INVITATION' THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'invalid', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                 'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                                                WHEN t.user_id IS NULL THEN 'Vente au guichet'
                                                ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END, 'price', t.price,
                                 'is_manual_entry', v_method = 'MANUAL',
                                 'category_color', t.scan_color,
                                 'origin', public.ticket_origin(t.sale_channel, t.price, t.pay_id IS NOT NULL AND NOT t.pay_platform),
                                 'is_guest_list', v_method = 'GUEST_LIST');
    -- 5. Code dynamique (calculé hors base avec la clé maître) et version du secret, lus sous le verrou du
    --    billet : une rotation (transfert, annulation, remboursement, régénération) validée avant le verrou
    --    rend le code présenté périmé. Statut d'annulation contrôlé avant la version (D3).
    IF v_method = 'QR' AND (NOT COALESCE((p->>'totp_ok')::boolean, FALSE) OR v_version IS DISTINCT FROM t.security_version) THEN
        v_problem := CASE
            WHEN (SELECT e.status::text FROM public.events e WHERE e.id = v_event) = 'ANNULE' THEN 'event_cancelled'
            WHEN t.status::text = 'ANNULE' THEN 'cancelled'
            WHEN t.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'refunded'
            ELSE 'qr_expired' END;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 7 bis-zone. Lot 9 ter (9t.15) : porte de CONTRÔLE. Refus rouges du billet d'abord (lignes et réponses de l'étape 7),
    --             puis verdict de zone ; jamais de compostage (ni 7 bis, ni 8, ni 9 : C-D5).
    IF g.zone_kind = 'CONTROLE' THEN
        v_problem := CASE t.status::text
            WHEN 'VALIDE' THEN NULL
            WHEN 'UTILISE' THEN NULL
            WHEN 'ANNULE' THEN 'cancelled'
            WHEN 'REMBOURSE' THEN 'refunded'
            WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
            ELSE 'invalid' END;
        IF v_problem IS NOT NULL THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan,
                                      'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                             'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner),
                                      'zone', v_zone, 'gate', v_gate);
        END IF;
        SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
          FROM public.scan_zone_verdict(v_event, g.zone_id, 'CONTROLE', t.category_id, t.status::text) vz;
        IF v_zone_result IS NULL THEN
            RAISE EXCEPTION 'ticket_scan : verdict de zone absent pour le billet % (statut %)', t.id, t.status;
        END IF;
        IF v_zone_result = 'zone_ok' THEN
            -- Lot 9 ter (9t.16) : heure et porte de l'entrée (ligne acceptée, lue sous le verrou du billet)
            SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
              FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
             WHERE a.ticket_id = t.id AND a.accepted;
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, v_zone_result, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', v_zone_result, 'scan_id', v_scan,
                                      'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                             'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner,
                                                                             'checked_in_gate', v_checked_gate),
                                      'zone', v_zone, 'gate', v_gate);
        END IF;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, v_zone_result, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_zone_result, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate,
                                  'redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
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
        v_info := v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                               'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner);
        IF v_problem = 'already_used' THEN
            -- Lot 9 ter (9t.16) : « Déjà utilisé à {heure}, {porte} » (ligne acceptée, lue sous le verrou du billet)
            SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
              FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
             WHERE a.ticket_id = t.id AND a.accepted;
            v_info := v_info || jsonb_build_object('checked_in_gate', v_checked_gate);
        END IF;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 7 bis. Lot 9 bis (R19, R44) : billet engagé dans un transfert encore en attente → refusé, rien de composté.
    --        Un transfert échu est d'abord expiré ; un transfert tenu par une acceptation est sauté (SKIP LOCKED,
    --        X27) et compte comme en attente. Conditions imbriquées : aucun court-circuit garanti sur AND.
    --        Lot 9 ter (9t.17) : par la liste des invités, le transfert d'invitation du billet (PENDING, ou EXPIRED à la
    --        fin de l'événement alors que le contrôle reste ouvert) est pris sans attente ; un autre transfert en attente
    --        (d'un porteur), ou l'invitation tenue par une acceptation en cours (sautée), refuse transfer_pending.
    IF v_method = 'GUEST_LIST' THEN
        PERFORM public.ticket_transfers_expire_due(t.id, TRUE);
        SELECT x.id INTO v_invite
          FROM public.ticket_transfers x
         WHERE x.ticket_id = t.id AND x.from_user_id IS NULL AND x.status::text IN ('PENDING', 'EXPIRED')
         ORDER BY x.created_at DESC, x.id DESC
         LIMIT 1
           FOR UPDATE SKIP LOCKED;
        IF EXISTS (SELECT 1 FROM public.ticket_transfers x
                    WHERE x.ticket_id = t.id AND x.status = 'PENDING' AND x.id IS DISTINCT FROM v_invite) THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'transfer_pending', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'transfer_pending', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
        END IF;
    ELSIF t.transfer_locked THEN
        IF public.ticket_transfers_expire_due(t.id, TRUE) THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'transfer_pending', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'transfer_pending', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
        END IF;
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
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'payment_required', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
                RETURN jsonb_build_object('result', 'payment_required', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
            END IF;
        END IF;
    END IF;
    -- 8 bis. Lot 9 ter (9t.15) : porte d'ENTRÉE explicite qui n'admet pas la catégorie → mauvaise zone (orange), après
    --        les refus rouges (déjà utilisé, annulé, transfert, paiement : C-D6) ; rien composté.
    IF g.zone_id IS NOT NULL AND g.zone_kind = 'ENTREE' THEN
        SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
          FROM public.scan_zone_verdict(v_event, g.zone_id, 'ENTREE', t.category_id, 'VALIDE') vz;
        IF v_zone_result = 'wrong_zone' THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, 'wrong_zone', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'wrong_zone', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate,
                                      'redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
        END IF;
    END IF;
    -- 9. Compostage (une seule ligne modifiée, sous verrou). Lot 9 ter (9t.17) : une invitation validée par la liste
    --    est déverrouillée et son transfert clos ADMITTED (claimed_at = now(), heure de la ligne GUEST_LIST) dans la même
    --    transaction ; aucun avis (billet sans porteur).
    UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner,
                              transfer_locked = CASE WHEN v_invite IS NOT NULL THEN FALSE ELSE transfer_locked END,
                              updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    IF NOT FOUND THEN
        SELECT checked_in_at, checked_in_by INTO v_checked_at, v_checked_by FROM public.tickets WHERE id = t.id;
        SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
          FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
         WHERE a.ticket_id = t.id AND a.accepted;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'already_used', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'already_used', 'scan_id', v_scan,
                                  'ticket', v_info || jsonb_build_object('checked_in_at', v_checked_at,
                                                                         'checked_in_by_me', v_checked_by IS NOT DISTINCT FROM v_scanner,
                                                                         'checked_in_gate', v_checked_gate),
                                  'zone', v_zone, 'gate', v_gate);
    END IF;
    IF v_invite IS NOT NULL THEN
        UPDATE public.ticket_transfers SET status = 'ADMITTED', claimed_at = now() WHERE id = v_invite;
    END IF;
    v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'valid', NULL, TRUE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
    RETURN jsonb_build_object('result', 'valid', 'scan_id', v_scan,
                              'ticket', v_info || jsonb_build_object('checked_in_at', now(), 'checked_in_by_me', TRUE,
                                                                     'entry_instruction', t.entry_instruction),
                              'zone', v_zone, 'gate', v_gate);
END;
$$;


-- ----------------------------------------------------------------------------
-- (12) F37 ticket_manual_lookup (recopie, base 20261109000008_lot9bis_cycle.sql:1217-1310)
-- ----------------------------------------------------------------------------
-- Changements : 9t.15 : contexte de porte après le contrôle de droit (problème → 409, sans audit) ; aperçu à une porte
-- de CONTRÔLE (refus du billet, puis not_entered, zone_ok ou wrong_zone) ou d'ENTRÉE (chemin d'avant, puis
-- wrong_zone si l'entrée était possible) ; zones proposées dans le billet. Toujours aucune ligne ticket_scans.
-- 9t.17 (délégation fix(9t.17-SZ)) : porteur « {nom de l'invité} » ou « Invité » d'une invitation sans porteur.
CREATE OR REPLACE FUNCTION public.ticket_manual_lookup(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_number text := upper(btrim(COALESCE(p->>'ticket_number', '')));
    v_hash text;
    v_scope text;
    t record;
    v_found boolean := FALSE;
    v_preview text;
    v_pay_status text;
    v_order_status text;
    -- Lot 9 ter (9t.15)
    g record;
    v_zone_result text;
    v_redirect jsonb;
    v_ticket jsonb;
BEGIN
    IF v_scanner IS NULL OR v_event IS NULL OR v_number = '' THEN
        RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_INPUT');
    END IF;
    v_hash := encode(sha256(convert_to(v_number, 'UTF8')), 'hex');
    v_scope := public.fin_setting_text('access.manual_entry_scope');
    IF NOT public.scan_scanner_authorized(v_scanner, v_event)
       OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
               SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', NULL,
                jsonb_build_object('event_id', v_event, 'found', NULL, 'refused', 'SCAN_FORBIDDEN', 'ticket_number_hash', v_hash));
        RETURN jsonb_build_object('ok', false, 'http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- Lot 9 ter (9t.15) : porte de la vérification ; un problème de porte ne lit rien du billet et n'écrit rien
    SELECT * INTO g FROM public.scan_gate_context(v_scanner, v_event, public.try_uuid(p->>'gate_id'), p ? 'gate_id');
    IF g.problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', g.problem);
    END IF;

    SELECT tk.id, tk.event_id, tk.ticket_number, tk.status::text AS status, tk.price, tk.payment_id, tk.order_id, tk.user_id,
           tk.transfer_locked, tk.category_id, tk.sale_channel, tk.guest_name, c.name AS category_name, u.first_name, u.last_name
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
     WHERE tk.ticket_number = v_number;
    IF FOUND THEN
        v_found := t.event_id = v_event;
    END IF;
    IF NOT v_found THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', NULL,
                jsonb_build_object('event_id', v_event, 'found', false, 'ticket_number_hash', v_hash));
        RETURN jsonb_build_object('ok', true, 'found', false);
    END IF;

    -- Résultat qu'aurait le scan (étapes 6 à 8 de ticket_scan), sans rien écrire
    v_preview := public.scan_event_problem(v_event);
    IF v_preview IS NULL AND g.zone_kind = 'CONTROLE' THEN
        -- Lot 9 ter (9t.15) : porte de contrôle (étape 7 bis-zone) : jamais de compostage, ni transfert ni paiement
        IF t.status IN ('VALIDE', 'UTILISE') THEN
            SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
              FROM public.scan_zone_verdict(v_event, g.zone_id, 'CONTROLE', t.category_id, t.status) vz;
            v_preview := v_zone_result;
        ELSE
            v_preview := CASE t.status
                WHEN 'ANNULE' THEN 'cancelled'
                WHEN 'REMBOURSE' THEN 'refunded'
                WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
                ELSE 'invalid' END;
        END IF;
    ELSE
        IF v_preview IS NULL THEN
            v_preview := CASE t.status
                WHEN 'VALIDE' THEN NULL
                WHEN 'UTILISE' THEN 'already_used'
                WHEN 'ANNULE' THEN 'cancelled'
                WHEN 'REMBOURSE' THEN 'refunded'
                WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
                ELSE 'invalid' END;
        END IF;
        -- Lot 9 bis (R19, R44) : étape 7 bis de ticket_scan ; un transfert échu est expiré ici aussi (verrous :
        -- transferts du billet, puis billet).
        IF v_preview IS NULL AND t.transfer_locked THEN
            IF public.ticket_transfers_expire_due(t.id, FALSE) THEN
                v_preview := 'transfer_pending';
            END IF;
        END IF;
        IF v_preview IS NULL AND t.price > 0 THEN
            IF t.payment_id IS NOT NULL THEN
                SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
            END IF;
            IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
                IF t.order_id IS NOT NULL THEN
                    SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
                END IF;
                IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                    v_preview := 'payment_required';
                END IF;
            END IF;
        END IF;
        -- Lot 9 ter (9t.15) : porte d'entrée qui n'admet pas la catégorie (étape 8 bis de ticket_scan)
        IF v_preview IS NULL AND g.zone_id IS NOT NULL THEN
            SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
              FROM public.scan_zone_verdict(v_event, g.zone_id, 'ENTREE', t.category_id, 'VALIDE') vz;
            IF v_zone_result = 'wrong_zone' THEN
                v_preview := 'wrong_zone';
            END IF;
        END IF;
    END IF;
    v_preview := COALESCE(v_preview, 'valid');

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', t.id,
            jsonb_build_object('event_id', v_event, 'found', true, 'ticket_number_hash', v_hash));
    v_ticket := jsonb_build_object(
        'ticket_number', t.ticket_number,
        -- Lot 9 ter (9t.17) : une invitation sans porteur est « {nom de l'invité} » ou « Invité », pas une vente au guichet
        'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                       WHEN t.user_id IS NULL THEN 'Vente au guichet'
                       ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END,
        'category', t.category_name,
        'status', t.status,
        'preview', v_preview);
    IF v_preview IN ('wrong_zone', 'not_entered') THEN
        v_ticket := v_ticket || jsonb_build_object('redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
    END IF;
    RETURN jsonb_build_object('ok', true, 'found', true, 'ticket', v_ticket);
END;
$$;


-- ----------------------------------------------------------------------------
-- (13) F38 counter_sale (recopie, base 20261106000001_lot8_canaux.sql:314-478)
-- ----------------------------------------------------------------------------
-- Changements (9t.15, arbitrage 18 : guichet = entrée, soumis à la règle de zone) : 1. après le contrôle du canal et
-- avant les contrôles de vente, sur un événement à zones : vendeur sans porte → GATE_REQUIRED ; porte de contrôle →
-- CATEGORY_NOT_ADMITTED_AT_GATE ; catégorie du panier non admise par la zone de la porte → même code, zones d'entrée
-- qui l'admettent (2 au plus) ; rien n'est écrit, la caisse n'est pas créditée. 2. la ligne acceptée COUNTER porte la
-- porte (zone et point d'entrée posés par ticket_scans_enrich). 3. le rejeu d'une vente faite reste avant tout
-- contrôle de porte (inchangé). Verrous inchangés : zones et portes lues sans verrou.
CREATE OR REPLACE FUNCTION public.counter_sale(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
    v_channel jsonb;
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
    v_rstatus text;
    v_rreason text;
    -- Lot 9 ter (9t.15) : porte du vendeur
    v_gate uuid;
    v_gate_zone uuid;
    v_gate_kind text;
    v_gate_problems jsonb;
    v_gate_message text;
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
        SELECT o.status, o.reason INTO v_rstatus, v_rreason
          FROM public.notification_outbox o WHERE o.idempotency_key = 'COUNTER_RECEIPT:' || prev.id::text || ':SMS';
        RETURN jsonb_build_object('ok', true, 'replayed', true, 'payment_id', prev.id, 'transaction_id', prev.transaction_id,
            'amount', prev.amount, 'shift_id', prev.shift_id, 'event_id', prev.event_id,
            'ticket_ids', COALESCE((SELECT jsonb_agg(t.id ORDER BY t.created_at, t.id) FROM public.tickets t WHERE t.payment_id = prev.id), '[]'::jsonb),
            'scan_ids', COALESCE((SELECT jsonb_agg(s.id ORDER BY s.created_at, s.id) FROM public.ticket_scans s
                                    JOIN public.tickets t ON t.id = s.ticket_id
                                   WHERE t.payment_id = prev.id AND s.accepted), '[]'::jsonb),
            'receipt_queued', v_rstatus IS NOT NULL AND v_rstatus NOT IN ('SKIPPED', 'CANCELLED'),
            'receipt_refusal', CASE WHEN v_rstatus = 'SKIPPED' THEN v_rreason END);
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
    -- Lot 8 (8.0) : canal contrôlé sous le verrou des catégories ; panier mixte refusé en entier
    v_channel := public.ticket_counter_channel_problems(v_event, v_items);
    IF jsonb_array_length(v_channel) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_SOLD_AT_COUNTER', 'problems', v_channel,
                                  'message', 'Une catégorie de ce panier n''est pas vendue au guichet.');
    END IF;
    -- Lot 9 ter (9t.15) : guichet = entrée ; porte du vendeur et règle des zones, rien d'écrit en cas de refus
    IF EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event) THEN
        SELECT ec.gate_id INTO v_gate FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller;
        IF v_gate IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_REQUIRED',
                'message', 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été vendu.');
        END IF;
        SELECT z.id, z.kind INTO v_gate_zone, v_gate_kind
          FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
         WHERE eg.id = v_gate;
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'category_id', c.id, 'category', c.name,
                   'zones', COALESCE((SELECT jsonb_agg(x.name ORDER BY x.position, lower(btrim(x.name)), x.id)
                                        FROM (SELECT z.name, z.position, z.id
                                                FROM public.event_zones z
                                                JOIN public.zone_categories zc ON zc.zone_id = z.id
                                               WHERE z.event_id = v_event AND z.kind = 'ENTREE' AND zc.category_id = c.id
                                               ORDER BY z.position, lower(btrim(z.name)), z.id
                                               LIMIT 2) x), '[]'::jsonb))
                   ORDER BY c.price, c.name, c.id), '[]'::jsonb)
          INTO v_gate_problems
          FROM public.ticket_categories c
         WHERE c.event_id = v_event
           AND c.id IN (SELECT public.try_uuid(e->>'category_id') FROM jsonb_array_elements(v_items) e)
           AND (v_gate_kind IS DISTINCT FROM 'ENTREE'
                OR NOT EXISTS (SELECT 1 FROM public.zone_categories zc WHERE zc.zone_id = v_gate_zone AND zc.category_id = c.id));
        IF v_gate_kind IS DISTINCT FROM 'ENTREE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_ADMITTED_AT_GATE', 'problems', v_gate_problems,
                'message', 'La vente au guichet se fait à une porte d’entrée : demandez à l’organisateur de changer votre porte.');
        END IF;
        IF jsonb_array_length(v_gate_problems) > 0 THEN
            IF jsonb_array_length(v_gate_problems) = 1 THEN
                v_gate_message := (v_gate_problems->0->>'category') || ' n’entre pas par cette porte'
                    || CASE jsonb_array_length(v_gate_problems->0->'zones')
                           WHEN 0 THEN '.'
                           WHEN 1 THEN ' : vendez-la à ' || (v_gate_problems->0->'zones'->>0) || '.'
                           ELSE ' : vendez-la à ' || (v_gate_problems->0->'zones'->>0) || ' ou ' || (v_gate_problems->0->'zones'->>1) || '.' END;
            ELSE
                SELECT 'Ces catégories n’entrent pas par cette porte : ' || string_agg(x.elem->>'category', ', ' ORDER BY x.ord) || '.'
                  INTO v_gate_message
                  FROM jsonb_array_elements(v_gate_problems) WITH ORDINALITY AS x(elem, ord);
            END IF;
            RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_ADMITTED_AT_GATE', 'problems', v_gate_problems,
                                      'message', v_gate_message);
        END IF;
    END IF;
    -- Contrôles de vente du lot 2, hors fenêtre de vente en ligne et canal en ligne (vente sur place)
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
            -- rôle CONTROLEUR et point d'entrée de l'affectation). Lot 9 ter : porte du vendeur (NULL sans zone),
            -- zone et point d'entrée de la porte posés par le même trigger.
            INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified,
                                             payload_hash, shift_id, amount_due, gate_id)
            VALUES (v_ticket, v_event, v_seller, 'valid', TRUE, 'COUNTER', FALSE, NULL, sh.id, v_item.price, v_gate)
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

    -- Lot 6 (J1.3) : reçu SMS au numéro saisi, dans la transaction de la vente (aucun compte rattaché)
    IF v_phone IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'COUNTER_RECEIPT', 'key', 'COUNTER_RECEIPT:' || v_payment::text,
            'phone', '+221' || v_phone, 'event_id', v_event, 'shift_id', sh.id,
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb) || jsonb_build_object(
                'payment_id', v_payment, 'ticket_count', cardinality(v_ids), 'amount', v_amount,
                'reference', upper(left(v_payment::text, 8)))));
        SELECT o.status, o.reason INTO v_rstatus, v_rreason
          FROM public.notification_outbox o WHERE o.idempotency_key = 'COUNTER_RECEIPT:' || v_payment::text || ':SMS';
    END IF;

    RETURN jsonb_build_object('ok', true, 'replayed', false, 'payment_id', v_payment, 'transaction_id', v_tx,
                              'ticket_ids', to_jsonb(v_ids), 'scan_ids', to_jsonb(v_scans), 'amount', v_amount,
                              'shift_id', sh.id, 'event_id', v_event,
                              'receipt_queued', v_rstatus IS NOT NULL AND v_rstatus NOT IN ('SKIPPED', 'CANCELLED'),
                              'receipt_refusal', CASE WHEN v_rstatus = 'SKIPPED' THEN v_rreason END);
END;
$$;


-- ----------------------------------------------------------------------------
-- (14) F39 controller_scan_stats (recopie, base 20261105000005_lot7_scan.sql:374-439)
-- ----------------------------------------------------------------------------
-- Changements (9t.15) : refus = scan_is_refusal (règle unique du lot, F6 ; zone_ok n'est ni entrée ni refus) hors
-- forbidden ; porte posée : entrées acceptées de l'événement à cette porte, contrôles de zone (billets distincts zone_ok)
-- dans `door_checks`, `gate` et `gate_kind` ; motif d'une ligne de zone = son verdict de zone ; derniers scans avec les
-- lignes de zone (result NULL : `<> 'forbidden'` les excluait). Sans porte : clés et valeurs d'avant à l'octet.
CREATE OR REPLACE FUNCTION public.controller_scan_stats(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_limit integer := 20;
    v_entry text;
    v_door bigint;
    v_mine bigint;
    v_refused bigint;
    v_by_result jsonb;
    v_recent jsonb;
    -- Lot 9 ter (9t.15)
    v_gate uuid;
    v_gate_json jsonb;
    v_gate_kind text;
    v_checks bigint := 0;
BEGIN
    IF COALESCE(p->>'limit', '') ~ '^[0-9]{1,6}$' THEN
        v_limit := least(greatest((p->>'limit')::integer, 1), 50);
    END IF;
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        RETURN jsonb_build_object('ok', false, 'http', 404, 'code', 'NOT_FOUND');
    END IF;
    SELECT NULLIF(btrim(ec.entry_point), ''), ec.gate_id INTO v_entry, v_gate
      FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner;
    IF v_gate IS NOT NULL THEN
        SELECT jsonb_build_object('id', eg.id, 'name', eg.name), z.kind INTO v_gate_json, v_gate_kind
          FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
         WHERE eg.id = v_gate;
    END IF;

    SELECT count(*) FILTER (WHERE sc.accepted),
           count(*) FILTER (WHERE public.scan_is_refusal(sc.accepted, sc.result, sc.zone_result, sc.consumed_at)
                                  AND sc.result IS DISTINCT FROM 'forbidden')
      INTO v_mine, v_refused
      FROM public.ticket_scans sc
     WHERE sc.event_id = v_event AND sc.scanner_id = v_scanner;

    IF v_gate IS NOT NULL THEN
        SELECT count(*) FILTER (WHERE sc.accepted),
               count(DISTINCT sc.ticket_id) FILTER (WHERE sc.zone_result = 'zone_ok')
          INTO v_door, v_checks
          FROM public.ticket_scans sc
         WHERE sc.event_id = v_event AND sc.gate_id = v_gate;
    ELSIF v_entry IS NULL THEN
        v_door := v_mine;
    ELSE
        SELECT count(*) INTO v_door
          FROM public.ticket_scans sc
         WHERE sc.event_id = v_event AND sc.accepted AND sc.entry_point = v_entry;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('result', x.result, 'count', x.n) ORDER BY x.n DESC, x.result), '[]'::jsonb)
      INTO v_by_result
      FROM (SELECT COALESCE(sc.result, sc.zone_result) AS result, count(*) AS n
              FROM public.ticket_scans sc
             WHERE sc.event_id = v_event AND sc.scanner_id = v_scanner
               AND public.scan_is_refusal(sc.accepted, sc.result, sc.zone_result, sc.consumed_at)
               AND sc.result IS DISTINCT FROM 'forbidden'
             GROUP BY COALESCE(sc.result, sc.zone_result)) x;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('scan_id', r.id, 'at', r.created_at, 'result', r.result, 'method', r.method,
                                                 'ticket_number', r.ticket_number, 'category', r.category)
                              ORDER BY r.created_at DESC, r.id DESC), '[]'::jsonb)
      INTO v_recent
      FROM (SELECT sc.id, sc.created_at, COALESCE(sc.result, sc.zone_result) AS result, sc.method, tk.ticket_number, c.name AS category
              FROM public.ticket_scans sc
              LEFT JOIN public.tickets tk ON tk.id = sc.ticket_id
              LEFT JOIN public.ticket_categories c ON c.id = COALESCE(sc.category_id, tk.category_id)
             WHERE sc.event_id = v_event AND sc.scanner_id = v_scanner AND COALESCE(sc.result, '') <> 'forbidden'
             ORDER BY sc.created_at DESC, sc.id DESC
             LIMIT v_limit) r;

    RETURN jsonb_build_object('ok', true, 'entry_point', v_entry, 'door_entries', v_door, 'my_entries', v_mine,
                              'my_refusals', v_refused, 'refusals_by_result', v_by_result, 'recent', v_recent,
                              'gate', COALESCE(v_gate_json, 'null'::jsonb), 'gate_kind', v_gate_kind, 'door_checks', v_checks);
END;
$$;


-- ----------------------------------------------------------------------------
-- (15) Privilèges : service_role seul (fonctions de trigger : rien à accorder au-delà)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.scan_gate_context(uuid, uuid, uuid, boolean)',
        'public.scan_zone_verdict(uuid, uuid, text, uuid, text)',
        'public.scan_log_at(uuid, uuid, uuid, text, text, boolean, text, boolean, text, numeric, integer, text, uuid, uuid)',
        'public.event_zones_get(jsonb)',
        'public.event_zones_save(jsonb)',
        'public.event_controller_gate_set(jsonb)',
        'public.controller_gate_select(jsonb)',
        'public.zone_categories_default_admit()',
        'public.ticket_scans_enrich()',
        'public.ticket_scan(jsonb)',
        'public.ticket_manual_lookup(jsonb)',
        'public.counter_sale(jsonb)',
        'public.controller_scan_stats(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

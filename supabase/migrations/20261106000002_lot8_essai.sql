-- ============================================================================
-- EVENT VILLAGE — LOT 8, TÂCHE 8.1 : marquage des opérations simulées (contrat 2.5, 5.4, AR6, L28)
-- ============================================================================
-- Un remboursement ou un retrait créé en mode d'essai ne doit jamais partir en réel, et une opération réelle
-- ne doit jamais partir vers le faux service. La marque est posée en base, à la création, par trigger :
--  1. payments.simulated, cashouts.simulated : faux par défaut, immuables ;
--  2. ev_request_simulated() : vrai si la requête PostgREST porte l'en-tête x-ev-simulation à la valeur 1,
--     envoyé par le seul client service_role d'un serveur d'essai (lib/supabase/server.ts) ;
--  3. un cashout hérite de son paiement, et un retrait hérite de l'origine simulée du solde ;
--  4. l'écriture de send_started_at (réservation d'envoi) est refusée si la marque de la ligne diffère du mode
--     de la requête. Rien n'est lu ici sur le serveur d'envoi : c'est la dernière couche, après le refus dans
--     le code (lib/payments/cashout.service.ts, cashoutSendRefusal).
--
-- Effet sur la production : aucun, l'en-tête n'y est jamais envoyé et les lignes restent à faux. Si l'en-tête
-- cessait d'arriver sur un serveur d'essai, la première opération simulée serait refusée au lieu de passer
-- pour réelle.
--
-- Aucune fonction existante n'est recopiée ; aucun GRANT sur les colonnes : payments et cashouts gardent leurs
-- privilèges. Rejouable : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS ; aucun BEGIN ni
-- COMMIT. Aucune reprise de données : le défaut FALSE décrit toutes les lignes existantes.
-- Privilèges (règle 1A.3) : SECURITY DEFINER, search_path = public, volatilité explicite ; aucun EXECUTE pour
-- PUBLIC, anon et authenticated, service_role seul.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Colonnes
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT FALSE;
ALTER TABLE public.cashouts ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.payments.simulated IS
    'Lot 8 (L28) : paiement créé par un serveur d''essai. Posé par trg_payments_simulated, immuable.';
COMMENT ON COLUMN public.cashouts.simulated IS
    'Lot 8 (L28) : remboursement ou retrait issu du mode d''essai, jamais envoyé en réel. Posé par trg_cashouts_simulated, immuable.';


-- ----------------------------------------------------------------------------
-- 2. Mode de la requête en cours
-- ----------------------------------------------------------------------------
-- PostgREST pose request.headers pour la transaction, noms en minuscules (contrôlé au run 95, PostgREST 16.5).
-- Hors PostgREST (pg_cron, connexion directe) le réglage est absent ou vide : faux.
CREATE OR REPLACE FUNCTION public.ev_request_simulated()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_headers text := current_setting('request.headers', true);
BEGIN
    IF v_headers IS NULL OR v_headers = '' THEN
        RETURN FALSE;
    END IF;
    RETURN COALESCE((v_headers::jsonb ->> 'x-ev-simulation') = '1', FALSE);
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. Marque posée à la création : toute valeur reçue est écrasée
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payments_simulated_set()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.simulated := public.ev_request_simulated();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_simulated ON public.payments;
CREATE TRIGGER trg_payments_simulated
    BEFORE INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.payments_simulated_set();

CREATE OR REPLACE FUNCTION public.cashouts_simulated_set()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.simulated := public.ev_request_simulated()
        OR EXISTS (SELECT 1 FROM public.payments p WHERE p.id = NEW.payment_id AND p.simulated)
        OR (NEW.kind = 'WITHDRAWAL' AND EXISTS (
              SELECT 1 FROM public.finance_ledger l JOIN public.payments p ON p.id = l.payment_id
               WHERE l.owner_id = NEW.beneficiary_user_id AND p.simulated));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashouts_simulated ON public.cashouts;
CREATE TRIGGER trg_cashouts_simulated
    BEFORE INSERT ON public.cashouts
    FOR EACH ROW
    EXECUTE FUNCTION public.cashouts_simulated_set();


-- ----------------------------------------------------------------------------
-- 4. Gardes : marque immuable, réservation d'envoi refusée si les modes diffèrent
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashouts_simulation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.simulated IS DISTINCT FROM OLD.simulated THEN
        RAISE EXCEPTION USING ERRCODE = 'EV422', MESSAGE = 'La marque de simulation d''un versement ne se modifie pas.';
    END IF;
    IF OLD.send_started_at IS NULL AND NEW.send_started_at IS NOT NULL
       AND OLD.simulated IS DISTINCT FROM public.ev_request_simulated() THEN
        RAISE EXCEPTION USING ERRCODE = 'EV403', MESSAGE = 'SIMULATION_MISMATCH';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashouts_simulation_guard ON public.cashouts;
CREATE TRIGGER trg_cashouts_simulation_guard
    BEFORE UPDATE ON public.cashouts
    FOR EACH ROW
    EXECUTE FUNCTION public.cashouts_simulation_guard();

CREATE OR REPLACE FUNCTION public.payments_simulation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.simulated IS DISTINCT FROM OLD.simulated THEN
        RAISE EXCEPTION USING ERRCODE = 'EV422', MESSAGE = 'La marque de simulation d''un paiement ne se modifie pas.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_simulation_guard ON public.payments;
CREATE TRIGGER trg_payments_simulation_guard
    BEFORE UPDATE OF simulated ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.payments_simulation_guard();


-- ----------------------------------------------------------------------------
-- 5. Privilèges
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.ev_request_simulated()',
        'public.payments_simulated_set()',
        'public.cashouts_simulated_set()',
        'public.cashouts_simulation_guard()',
        'public.payments_simulation_guard()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

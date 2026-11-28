-- ============================================================================
-- EVENT VILLAGE — LOT « AVIS », PHASE 2, SOUS-LOT 2h : mots techniques des messages SQL (écart M17 de docs/avis-inventaire.md)
-- ============================================================================
--  - cashouts_simulation_guard (recopie de 20261106000002_lot8_essai.sql:110-127) : le refus « SIMULATION_MISMATCH » devient
--    une phrase (« L'envoi ne correspond pas au mode du paiement : un versement simulé ne part jamais en réel, ni l'inverse. ») ;
--    code d'erreur EV403 inchangé (c'est lui que lit le code) ; SEULE ligne remplacée de la recopie (déclarée au test
--    tests/schema/migration-avis2-rejouable.test.ts) ; déclencheur et droits inchangés (CREATE OR REPLACE).
--  - order_create (12a) et order_create_checked, order_payment_start (12b) gardent OUT_OF_STOCK, NO_PORTIONS_LEFT et
--    ORDER_PRICE_CHANGED : ce sont des codes internes d'exceptions attrapées dans la même fonction (SQLERRM devient « code »
--    de la réponse, qui porte une phrase française) ; exceptions justifiées du garde-fou (tests/schema/design1b-mots.test.ts).
-- Sans BEGIN ni COMMIT, rejouable.
-- ============================================================================

-- cashouts_simulation_guard (recopie de 20261106000002_lot8_essai.sql:110-127)
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
        -- Avis phase 2 (2h, M17) : une phrase au lieu du code (EV403 inchangé)
        RAISE EXCEPTION USING ERRCODE = 'EV403', MESSAGE = 'L''envoi ne correspond pas au mode du paiement : un versement simulé ne part jamais en réel, ni l''inverse.';
    END IF;
    RETURN NEW;
END;
$$;

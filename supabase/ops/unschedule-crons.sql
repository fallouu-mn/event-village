-- ============================================================================
-- EVENT VILLAGE — EXPLOITATION : ARRÊT DES TÂCHES PLANIFIÉES (pg_cron)
-- ============================================================================
-- Lot 6, tâche 6.9 (contrat M2). Ce fichier n'est PAS une migration : il est exécuté par l'opérateur,
-- dans l'éditeur SQL du projet Supabase (procédure : docs/deploiement-projet-neuf.md, section 7).
--
-- Retire toutes les tâches dont le nom commence par ev_ ; les tâches sans ce préfixe ne sont jamais
-- touchées. Transactionnel et idempotent : relancé, il ne fait rien de plus.
--
-- Il laisse en place les deux secrets (ev_app_url, ev_cron_secret) et les extensions pg_cron et
-- pg_net : la reprise se fait en relançant supabase/ops/schedule-crons.sql. Les requêtes HTTP déjà
-- mises en file par pg_net avant l'arrêt partent encore (au plus une par tâche).
-- ============================================================================

BEGIN;

DO $stop$
DECLARE
    j record;
    n integer := 0;
BEGIN
    IF to_regclass('cron.job') IS NULL THEN
        RAISE NOTICE 'pg_cron n''est pas activé sur cette base : aucune tâche à retirer.';
        RETURN;
    END IF;
    FOR j IN
        SELECT c.jobid, c.jobname FROM cron.job c
         WHERE starts_with(c.jobname, 'ev_')
         ORDER BY c.jobid
    LOOP
        PERFORM cron.unschedule(j.jobid);
        n := n + 1;
        RAISE NOTICE 'Tâche retirée : %', j.jobname;
    END LOOP;
    RAISE NOTICE 'Tâches ev_ retirées : %', n;
END
$stop$;

COMMIT;

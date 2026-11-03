-- ============================================================================
-- EVENT VILLAGE — EXPLOITATION : PLANIFICATION DES TÂCHES (pg_cron + pg_net)
-- ============================================================================
-- Lot 6, tâche 6.9 (contrat M1). Ce fichier n'est PAS une migration : il est exécuté par l'opérateur,
-- dans l'éditeur SQL du projet Supabase, après « supabase db push ». Procédure complète :
-- docs/deploiement-projet-neuf.md, section 7.
--
-- Ce que fait le script (transactionnel, tout ou rien ; idempotent, peut être relancé) :
--   1. vérifie que Vault est disponible et que les deux secrets existent :
--        ev_app_url     origine publique de l'application (https://<domaine>, sans chemin) ;
--        ev_cron_secret valeur de CRON_SECRET, identique à celle de l'hébergeur ;
--      les secrets sont créés par l'opérateur, jamais par ce script ;
--   2. active pg_cron et pg_net s'ils ne le sont pas ;
--   3. planifie exactement les 9 tâches ev_% ci-dessous (création ou mise à jour par nom) ;
--   4. retire toute autre tâche ev_% (ancienne tâche ev_event_change_notifications du lot 5…) ;
--      les tâches sans préfixe ev_ ne sont jamais touchées ;
--   5. réactive une tâche ev_% attendue qui aurait été désactivée à la main.
--
-- Aucune valeur secrète n'est écrite dans cron.job : chaque commande relit l'URL et le secret
-- dans Vault à chaque exécution. Changer CRON_SECRET = mettre à jour l'hébergeur et le secret
-- ev_cron_secret, sans relancer ce script.
--
-- Arrêt : supabase/ops/unschedule-crons.sql.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Contrôles préalables : extensions disponibles, Vault, secrets
-- ----------------------------------------------------------------------------
DO $check$
DECLARE
    v_url    text;
    v_secret text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        RAISE EXCEPTION 'Extension pg_cron indisponible sur cette base : la planification est impossible.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
        RAISE EXCEPTION 'Extension pg_net indisponible sur cette base : la planification est impossible.';
    END IF;
    IF to_regclass('vault.decrypted_secrets') IS NULL THEN
        RAISE EXCEPTION 'Vault (extension supabase_vault) absent : activez-le avant de planifier les tâches.';
    END IF;

    SELECT s.decrypted_secret INTO v_url
      FROM vault.decrypted_secrets s WHERE s.name = 'ev_app_url';
    IF v_url IS NULL OR btrim(v_url) = '' THEN
        RAISE EXCEPTION 'Secret Vault ev_app_url absent : créez-le avec l''origine publique de l''application (https://<domaine>), voir docs/deploiement-projet-neuf.md section 7.';
    END IF;
    -- Origine seule. HTTPS obligatoire : le secret part dans un en-tête. HTTP n'est admis que pour un
    -- hôte local ou réservé, qui ne sort jamais sur le réseau public (localhost, 127.0.0.1, *.invalid, *.test).
    IF NOT (v_url ~ '^https://[^[:space:]/?#]+/?$'
            OR v_url ~ '^http://(localhost|127[.]0[.]0[.]1|[^[:space:]/?#]+[.](invalid|test))(:[0-9]+)?/?$') THEN
        RAISE EXCEPTION 'Secret Vault ev_app_url invalide : origine HTTPS attendue, sans chemin (https://<domaine>).';
    END IF;

    SELECT s.decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets s WHERE s.name = 'ev_cron_secret';
    IF v_secret IS NULL OR v_secret = '' THEN
        RAISE EXCEPTION 'Secret Vault ev_cron_secret absent : créez-le avec la valeur de CRON_SECRET, voir docs/deploiement-projet-neuf.md section 7.';
    END IF;
    IF v_secret ~ '[[:space:]]' THEN
        RAISE EXCEPTION 'Secret Vault ev_cron_secret invalide : il ne doit contenir ni espace ni retour à la ligne.';
    END IF;
END
$check$;

-- ----------------------------------------------------------------------------
-- 2. Extensions (créées ici, jamais par une migration : décision 55)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 3 à 5. Tâches attendues, retrait des anciennes, réactivation
-- ----------------------------------------------------------------------------
-- Fréquences (justification complète : docs/deploiement-projet-neuf.md section 7) :
--   notifications-dispatch  chaque minute : première relance à 1 min, reprise des envois interrompus
--                           après 10 min, confirmation d'achat et cloche sans attendre ; un passage
--                           vide coûte une lecture indexée. Délai pg_net 55 s (l'envoyeur travaille
--                           45 s au plus).
--   reminders               toutes les 5 min, décalé d'une minute (1, 6, 11…) pour ne pas tomber avec
--                           la réconciliation ; un rappel est créé dans les 15 min de tolérance.
--   payments-reconcile      toutes les 5 min (seul moyen de connaître les paiements échoués).
--   events-finish           toutes les 15 min, décalé de 3 min.
--   tâches horaires         décalées (7, 17, 27, 37) pour éviter quatre appels simultanés.
--   ev_cron_history_purge   chaque nuit à 03:30 UTC : cron.job_run_details grossit d'environ
--                           1 900 lignes par jour ; 7 jours d'historique gardés.
DO $plan$
DECLARE
    j          record;
    v_expected text[] := ARRAY[]::text[];
BEGIN
    FOR j IN
        SELECT e.jobname, e.schedule, e.path, e.timeout_ms
          FROM (VALUES
            ('ev_notifications_dispatch', '* * * * *',       '/api/cron/notifications-dispatch', 55000),
            ('ev_reminders',              '1-59/5 * * * *',  '/api/cron/reminders',              60000),
            ('ev_payments_reconcile',     '*/5 * * * *',     '/api/cron/payments-reconcile',     60000),
            ('ev_events_finish',          '3-59/15 * * * *', '/api/cron/events-finish',          60000),
            ('ev_stock_reservations',     '7 * * * *',       '/api/cron/stock-reservations',     60000),
            ('ev_ticket_transfers',       '17 * * * *',      '/api/cron/ticket-transfers',       60000),
            ('ev_moratoriums',            '27 * * * *',      '/api/cron/moratoriums',            60000),
            ('ev_referral_commissions',   '37 * * * *',      '/api/cron/referral-commissions',   60000)
          ) AS e(jobname, schedule, path, timeout_ms)
    LOOP
        -- URL et secret relus dans Vault à chaque exécution de la tâche : rien de secret dans cron.job.
        PERFORM cron.schedule(j.jobname, j.schedule, format(
            $cmd$SELECT net.http_post(
    url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ev_app_url'), '/') || %L,
    headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ev_cron_secret'),
        'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := %s)$cmd$, j.path, j.timeout_ms));
        v_expected := v_expected || j.jobname::text;
    END LOOP;

    PERFORM cron.schedule('ev_cron_history_purge', '30 3 * * *',
        $cmd$DELETE FROM cron.job_run_details WHERE COALESCE(end_time, start_time) < now() - interval '7 days'$cmd$);
    v_expected := v_expected || 'ev_cron_history_purge'::text;

    -- Exactement les tâches attendues : toute autre tâche ev_% est retirée.
    FOR j IN
        SELECT c.jobid, c.jobname FROM cron.job c
         WHERE starts_with(c.jobname, 'ev_') AND NOT (c.jobname = ANY (v_expected))
         ORDER BY c.jobid
    LOOP
        PERFORM cron.unschedule(j.jobid);
        RAISE NOTICE 'Ancienne tâche retirée : %', j.jobname;
    END LOOP;

    -- Une tâche attendue désactivée à la main (cron.alter_job) est réactivée.
    FOR j IN
        SELECT c.jobid, c.jobname FROM cron.job c
         WHERE c.jobname = ANY (v_expected) AND NOT c.active
         ORDER BY c.jobid
    LOOP
        PERFORM cron.alter_job(j.jobid, active := true);
        RAISE NOTICE 'Tâche réactivée : %', j.jobname;
    END LOOP;
END
$plan$;

-- Contrôle affiché dans l'éditeur SQL : 9 lignes, toutes actives.
SELECT jobname, schedule, active
  FROM cron.job
 WHERE starts_with(jobname, 'ev_')
 ORDER BY jobname;

COMMIT;

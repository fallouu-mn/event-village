/**
 * Lot 6 — la migration 20261103000005_lot6_billetterie.sql est rejouable après une application antérieure,
 * même partielle (base LOCALE seulement, transaction annulée).
 *
 * Origine (03/11/2026) : sur le projet de production, `db push` a échoué dans cette migration avec
 * « relation "public.event_change_notifications" does not exist (SQLSTATE 42P01) » au bloc de reprise J1.9 :
 * une première application partielle avait déjà ajouté events.notify_version et supprimé la table du lot 5,
 * sans enregistrer la migration. La base de CI, une fois toutes les migrations appliquées, est dans le même
 * état (table du lot 5 supprimée en fin de migration 05) : rejouer le fichier ici reproduit la production.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction, inspect } from '../helpers/db';

const FILE = path.resolve(process.cwd(), 'supabase/migrations/20261103000005_lot6_billetterie.sql');

describe('Lot 6 — migration 05 rejouable (état du projet de production après une application partielle)', () => {
    test('état de départ identique à la production : table du lot 5 absente, events.notify_version présente', async () => {
        const res = await inspect((c) => c.query<{ table_lot5: string | null; colonne: string }>(
            `SELECT to_regclass('public.event_change_notifications')::text AS table_lot5,
                    (SELECT count(*) FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'notify_version')::text AS colonne`,
        ));
        const row = (Array.isArray(res) ? res[res.length - 1] : res).rows[0];
        assert.equal(row.table_lot5, null, 'la table event_change_notifications est supprimée par la migration 05');
        assert.equal(row.colonne, '1', 'events.notify_version est ajoutée par la migration 05');
    });

    test('le fichier appliqué deux fois de plus s’exécute sans erreur (transaction annulée)', async () => {
        const sql = fs.readFileSync(FILE, 'utf8');
        assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, 'la migration ne gère pas elle-même sa transaction');
        await inRolledBackTransaction(async (c) => {
            await c.query(sql);
            await c.query(sql);
            const { rows } = await c.query<{ n: string }>(
                `SELECT count(*)::text AS n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
                  WHERE s.nspname = 'public' AND p.proname IN ('ticket_transfer_initiate', 'ticket_transfer_accept', 'ticket_transfers_incoming')`,
            );
            assert.equal(rows[0].n, '3', 'fonctions de transfert de la migration 05 toujours présentes après le rejeu');
        });
    });

    test('migrations 06, 07 et 08 (pas encore appliquées en production) rejouables elles aussi', async () => {
        // Si leur application en production s'arrêtait en cours de route comme celle de la 05, il faut pouvoir
        // les relancer sans erreur ni doublon.
        const names = ['20261103000006_lot6_pros_admin.sql', '20261103000007_lot6_cloche.sql', '20261103000008_lot6_supervision.sql'];
        for (const name of names) {
            const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        }
    });
});

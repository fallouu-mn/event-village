/**
 * Lot 9 ter (contrat 3.3) — les migrations du lot (20261110000001 à …11) sont rejouables : chacune, déjà appliquée
 * par la CI depuis une base vide, s'exécute encore deux fois de suite sans erreur, dans une transaction annulée
 * (base LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle :
 * tests/schema/migration-lot9bis-rejouable.test.ts:1-70 (inchangé, comme les rejeux des lots 6 à 9).
 *
 * Garde A3 (D-out D-O9, contrat 3.3, rectification 1 du squelette) : aucune des 12 contraintes recréées par une
 * migration gelée (20261103… à 20261109…) n'est élargie ni touchée. Pour chacune, la DERNIÈRE définition gelée
 * (dernier `ALTER TABLE … ADD CONSTRAINT <nom>` des fichiers gelés, dans l'ordre des noms) est posée, dans une
 * transaction annulée, sur une table temporaire de même forme (`CREATE TEMP TABLE … (LIKE …)`, aucun verrou exclusif
 * sur la table réelle) ; son `pg_get_constraintdef` doit égaler celui de la base locale. L'échec nomme la contrainte.
 * Cette garde est verte au run « avant » (aucune migration 20261110… ne touche ces contraintes) : garde-fou annoncé.
 *
 * Rouge avant correctif : les onze fichiers n'existent pas (01 S-RLS, 02 et 10 S-P, 03 et 08 S-I, 04 et 06 S-M,
 * 05 S-A, 07 S-E, 09 S-Z, 11 S-K) ; chaque échec nomme le fichier attendu. En fin de suite, assertLot9terInvariants
 * contrôle toute la base (rouge par la garde de schéma tant que 11 n'est pas livrée).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

/** Migrations du lot 9 ter, dans l'ordre du contrat (section 3.1). */
const LOT9TER_MIGRATIONS = [
    '20261110000001_lot9ter_rls.sql',
    '20261110000002_lot9ter_reglages.sql',
    '20261110000003_lot9ter_transfert_statut.sql',
    '20261110000004_lot9ter_registre.sql',
    '20261110000005_lot9ter_argent.sql',
    '20261110000006_lot9ter_equipe_messages.sql',
    '20261110000007_lot9ter_evenements.sql',
    '20261110000008_lot9ter_invites.sql',
    '20261110000009_lot9ter_zones.sql',
    '20261110000010_lot9ter_pilotage.sql',
    '20261110000011_lot9ter_stock.sql',
] as const;

/** Préfixes gelés (tests/schema/migrations-gelees.test.ts) : 20261104 et 20261107 n'existent pas. */
const FROZEN_PREFIXES = ['20261103', '20261105', '20261106', '20261108', '20261109'] as const;

/** Les 12 contraintes recréées par une migration gelée (contrat 3.3), avec leur table. */
const FROZEN_CONSTRAINTS: ReadonlyArray<[string, string]> = [
    ['admin_signals', 'admin_signals_kind_check'],
    ['tickets', 'tickets_holder_or_counter'],
    ['users', 'users_city_length'],
    ['otp_codes', 'otp_codes_purpose_check'],
    ['partners', 'partners_ninea_length_chk'],
    ['partners', 'partners_rccm_length_chk'],
    ['payments', 'payments_samirpay_amounts_chk'],
    ['cashouts', 'cashouts_samirpay_amounts_chk'],
    ['ticket_transfers', 'ticket_transfers_declined_at_chk'],
    ['ticket_scans', 'ticket_scans_result_check'],
    ['users', 'users_email_pending_chk'],
    ['users', 'users_email_verified_real_chk'],
];

function readMigration(name: string): string {
    const file = path.join(DIR, name);
    assert.ok(fs.existsSync(file), `migration du lot 9 ter absente : supabase/migrations/${name} (contrat, section 3.1)`);
    return fs.readFileSync(file, 'utf8');
}

/** Dernière définition gelée de la contrainte : texte après son nom dans le dernier `ADD CONSTRAINT` des fichiers gelés. */
function lastFrozenDefinition(table: string, name: string): { file: string; definition: string } {
    const files = fs.readdirSync(DIR).filter((f) => FROZEN_PREFIXES.some((p) => f.startsWith(p))).sort();
    const pattern = new RegExp(`ALTER TABLE public\\.${table} ADD CONSTRAINT ${name}\\s+([\\s\\S]*?\\));[ \\t]*\\r?\\n`, 'g');
    let found: { file: string; definition: string } | null = null;
    for (const file of files) {
        const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
        for (const m of Array.from(sql.matchAll(pattern))) found = { file, definition: m[1] };
    }
    assert.ok(found, `${name} : aucune définition gelée trouvée dans les migrations ${FROZEN_PREFIXES.join(', ')}… (contrat 3.3)`);
    return found;
}

after(async () => {
    await assertLot9terInvariants('migration-lot9ter-rejouable');
});

describe('Lot 9 ter — migrations 20261110000001 à …11 rejouables (transaction annulée)', () => {
    test('les migrations 20261110… du dépôt sont exactement les onze du contrat, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261110')).sort();
        assert.deepEqual(present, [...LOT9TER_MIGRATIONS], `migrations 20261110… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of LOT9TER_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const sql = readMigration(name);
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});

describe('Lot 9 ter — garde A3 : les 12 contraintes recréées par une migration gelée gardent leur dernière définition gelée', () => {
    test('la liste des contraintes gardées est celle du contrat (12, rectification 1 du squelette)', () => {
        assert.equal(FROZEN_CONSTRAINTS.length, 12, 'contrat 3.3 : 12 contraintes');
        assert.equal(new Set(FROZEN_CONSTRAINTS.map(([, n]) => n)).size, 12, 'aucun doublon');
    });

    for (const [table, name] of FROZEN_CONSTRAINTS) {
        test(`${name} (public.${table}) : définition de la base locale = dernière définition gelée`, async () => {
            const frozen = lastFrozenDefinition(table, name);
            const { actual, expected } = await inRolledBackTransaction(async (db) => {
                const cur = await db.query<{ def: string }>(
                    `SELECT pg_get_constraintdef(k.oid) AS def FROM pg_constraint k
                      WHERE k.conrelid = $1::regclass AND k.conname = $2`, [`public.${table}`, name]);
                assert.equal(cur.rows.length, 1, `${name} : contrainte absente de public.${table} (gelée, ${frozen.file})`);
                await db.query(`CREATE TEMP TABLE lot9ter_a3_sonde (LIKE public.${table}) ON COMMIT DROP`);
                await db.query(`ALTER TABLE lot9ter_a3_sonde ADD CONSTRAINT lot9ter_a3_sonde_chk ${frozen.definition} NOT VALID`);
                const probe = await db.query<{ def: string }>(
                    `SELECT pg_get_constraintdef(k.oid) AS def FROM pg_constraint k
                      WHERE k.conrelid = 'lot9ter_a3_sonde'::regclass AND k.conname = 'lot9ter_a3_sonde_chk'`);
                assert.equal(probe.rows.length, 1, `${name} : définition gelée posée sur la table d'essai`);
                return { actual: cur.rows[0].def, expected: probe.rows[0].def.replace(/\s+NOT VALID$/, '') };
            });
            assert.equal(actual, expected,
                `${name} : la définition de la base locale diffère de la dernière définition gelée (${frozen.file}) : contrainte élargie ou touchée (A3), interdit`);
        });
    }
});

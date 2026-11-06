/**
 * Lot 7 — les migrations du lot (contrat, section 2 : 20261105000001 à …06 ; section 19.3 : …07) sont rejouables : chacune,
 * déjà appliquée par la CI depuis une base vide, s'exécute encore deux fois de suite sans erreur, dans une
 * transaction annulée (base LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni
 * COMMIT). Modèle : tests/schema/migration-lot6-rejouable.test.ts (incident de production du 03/11/2026 :
 * une migration appliquée partiellement doit pouvoir être relancée).
 *
 * Garde-fou ajouté (vert dès l'écriture) : les migrations 20261103000001 à …08 sont appliquées en
 * production et gelées ; leur contenu (fins de ligne normalisées en LF) doit rester celui de 6fff1bf.
 * Lot 8 (T2, contrat 18.4), vert dès l'écriture, annoncé : gel étendu aux sept migrations 20261105…,
 * appliquées sur event-village-dev (contenu de 7fdcb32), et messages d'échec portés sur 20261106….
 *
 * Rouge avant correctif : les sept fichiers du lot n'existent pas (fix(7.0a), fix(7.0c), fix(7.1s),
 * fix(7.2s), fix(7.3s), fix(7.9) pour …07, ajoutée par W11 : T32).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertTerrainInvariants } from '../helpers/terrain-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

/** Migrations du lot 7, dans l'ordre du contrat (section 2, puis section 19.3 pour la tâche 7.9). */
const LOT7_MIGRATIONS = [
    '20261105000001_lot7_reglages.sql',
    '20261105000002_lot7_sms.sql',
    '20261105000003_lot7_securite.sql',
    '20261105000004_lot7_billet_hors_ligne.sql',
    '20261105000005_lot7_scan.sql',
    '20261105000006_lot7_client.sql',
    '20261105000007_lot7_confirmation.sql',
] as const;

/** Empreintes SHA-256 (LF) des migrations du lot 6 telles qu'appliquées en production (commit 6fff1bf). */
const FROZEN_LOT6: Readonly<Record<string, string>> = {
    '20261103000001_lot6_dette.sql': 'acc99a9b0229e4b44a09eaf9aca1d6c8a77064cc961a03b4d8f726a96dead300',
    '20261103000002_lot6_outbox.sql': '38e0a8c79a90cd736db72d00ea1462f9bd99fed2b00698ebde4d506d3b1bc692',
    '20261103000003_lot6_reglages.sql': '417d821e86e190e48e46c75ace098bc7a826191bc17ee34461a01940c57751b7',
    '20261103000004_lot6_rappels.sql': '8c7b3c381c0aa5cec4cc741db08f793a5c668df4865b006c8d65909f9433b5a0',
    '20261103000005_lot6_billetterie.sql': '22c66cfdebdda9fd2ba8555f1f658d89406d8a7c6fbd8a5b2a4ba6229b2f4a50',
    '20261103000006_lot6_pros_admin.sql': '4d91f067b180a71b298bb5c59c3b213cc0857f0432eca2fe1811891ccd8ae1af',
    '20261103000007_lot6_cloche.sql': '311cbe47f4662fcf880a5386ccf1c8927f91b23d733fab900b06ea55a58daeda',
    '20261103000008_lot6_supervision.sql': '549a66c7ce2a840d9d2e8b27e3a0b0c2fc050a41d44b3e96637129df3288f796',
};

/** Empreintes SHA-256 (LF) des migrations du lot 7 telles qu'appliquées sur event-village-dev (commit 7fdcb32). */
const FROZEN_LOT7: Readonly<Record<string, string>> = {
    '20261105000001_lot7_reglages.sql': 'fffdfaece6c927b9de1d52739de0a85a075eb31dac651675c736e16ba3fe034c',
    '20261105000002_lot7_sms.sql': '767898aa5b2a14dd2fe8ca6a93bc45ca6a70b5f26351987cfd87b5050ba8baa1',
    '20261105000003_lot7_securite.sql': '5aac6c33879aa363f561d25dfdb3dba4686ec6bf1e9a843a849954ee6a3b4ada',
    '20261105000004_lot7_billet_hors_ligne.sql': 'b2aa3c2d3361fac8734a9ae4d5fe833768917b2667cad42b01fed998659b72a4',
    '20261105000005_lot7_scan.sql': 'ad84eea9f79972371e2e8db37e58f555846e974f2e1f807607a53cde14c4aea8',
    '20261105000006_lot7_client.sql': '0372bdb4d89eda3c3df5a174fcc49e2ce8c4faabba7958cc31e0368117fada66',
    '20261105000007_lot7_confirmation.sql': '471bdb1701ec9f948ab50fef38ca84f39651617cc0c8384d2891c9cc4107262f',
};

function readMigration(name: string): string {
    const file = path.join(DIR, name);
    assert.ok(fs.existsSync(file), `migration du lot 7 absente : supabase/migrations/${name} (contrat, section 2)`);
    return fs.readFileSync(file, 'utf8');
}

after(async () => {
    await assertTerrainInvariants('migration-lot7-rejouable');
});

describe('Lot 7 — migrations 20261105000001 à …07 rejouables (transaction annulée)', () => {
    test('les migrations 20261105… du dépôt sont exactement les sept du contrat, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261105')).sort();
        assert.deepEqual(present, [...LOT7_MIGRATIONS], `migrations 20261105… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of LOT7_MIGRATIONS) {
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

describe('Lot 6 — migrations appliquées en production : gelées', () => {
    for (const [name, sha] of Object.entries(FROZEN_LOT6)) {
        test(`${name} inchangée depuis 6fff1bf`, () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration gelée supprimée : supabase/migrations/${name}`);
            const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
            const got = createHash('sha256').update(content, 'utf8').digest('hex');
            assert.equal(got, sha, `${name} a été modifiée : elle est appliquée en production et gelée (contrat, en-tête) ; toute correction passe par une migration 20261106…`);
        });
    }
});

describe('Lot 7 — migrations appliquées sur event-village-dev : gelées', () => {
    for (const [name, sha] of Object.entries(FROZEN_LOT7)) {
        test(`${name} inchangée depuis 7fdcb32`, () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration gelée supprimée : supabase/migrations/${name}`);
            const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
            const got = createHash('sha256').update(content, 'utf8').digest('hex');
            assert.equal(got, sha, `${name} a été modifiée : elle est appliquée sur event-village-dev et gelée (contrat du lot 8, en-tête) ; toute correction passe par une migration 20261106…`);
        });
    }
});

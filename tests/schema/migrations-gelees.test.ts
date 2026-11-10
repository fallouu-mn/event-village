/**
 * Lot 9 (AR7, contrat 3.1) — migrations gelées : 20261103… (lot 6, production), 20261105… (lot 7), 20261106…
 * (lot 8) et, depuis le lot 9 bis (T1, contrat 3.1), 20261108… (lot 9), appliquées sur event-village-dev. Chacune
 * garde son empreinte SHA-256 sur son contenu normalisé en LF, et la liste des fichiers de chaque préfixe reste
 * exacte : ni suppression, ni ajout. Toute correction passe par une migration 20261109….
 *
 * Empreintes : FROZEN_LOT6 et FROZEN_LOT7 recopiées de tests/schema/migration-lot7-rejouable.test.ts (ce fichier ne
 * change pas) ; 20261106… calculées sur 534d6b3 ; 20261108… calculées sur 7cca60f (identiques sur c3f03f6).
 * Sans base : vert dès l'écriture, annoncé ; aucune écriture, donc aucun appel d'invariants (écart signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

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

/** Empreintes SHA-256 (LF) des migrations du lot 8, recalculées sur 534d6b3 (appliquées sur event-village-dev le 07/11). */
const FROZEN_LOT8: Readonly<Record<string, string>> = {
    '20261106000001_lot8_canaux.sql': 'ae8865baafcfa78d2503ee5b54bbc60eb18566d25da1fc91da58c9c6f88e6f27',
    '20261106000002_lot8_essai.sql': '9bd9efc05a6361caf6d7e690e85d27893b7c5f9a8439fe12ce8c442c2cf17420',
    '20261106000003_lot8_paiement.sql': 'fbc767eb14b48bc29ad916d29d62c9916e376fd311750c704cfc0718798a2f26',
    '20261106000004_lot8_commissions.sql': '50eba77a6e806c8cf968bcf9c9c74a707c4eb950f4b19784862cbe0868e4c08d',
    '20261106000005_lot8_scan.sql': '65fd6570660431dee5b666b3d9e716fb7adc64765de5855854739c00a96ca814',
    '20261106000006_lot8_profil.sql': '447b5d1605cddf240f3d1408697eb9ef70f607e1a244321ae76acd4e69470821',
};

/** Empreintes SHA-256 (LF) des migrations du lot 9, calculées sur 7cca60f (appliquées sur event-village-dev le 08/11). */
const FROZEN_LOT9: Readonly<Record<string, string>> = {
    '20261108000001_lot9_securite.sql': 'd7134801d06445c83007dacd76d5e8b38088173e59776652d8d6f9310ee5961f',
    '20261108000002_lot9_invitations.sql': '274fda972bfcc180a05db5da5b058d3e73f8c0f8ee4eecc876c15a845438241e',
    '20261108000003_lot9_decouverte.sql': '1005cd14ab64385088d807201def226ee8d0b805d3c08237c6a8db6eb23d2a27',
    '20261108000004_lot9_compte.sql': '378bf2594b5f095d0ceb261599fb9525cb6a3454de05497b22ab84fb4e5a677e',
    '20261108000005_lot9_nettoyage.sql': 'f842a5208f52bda7ed7910d0669f1f668a8979d8947f6141fb4c05535950c353',
};

const FROZEN: ReadonlyArray<[string, string, Readonly<Record<string, string>>]> = [
    ['20261103', 'lot 6', FROZEN_LOT6],
    ['20261105', 'lot 7', FROZEN_LOT7],
    ['20261106', 'lot 8', FROZEN_LOT8],
    ['20261108', 'lot 9', FROZEN_LOT9],
];

function sha256Lf(name: string): string {
    const content = fs.readFileSync(path.join(DIR, name), 'utf8').replace(/\r\n/g, '\n');
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('Migrations gelées : 20261103…, 20261105…, 20261106…, 20261108…', () => {
    for (const [prefix, lot, frozen] of FROZEN) {
        test(`${prefix}… : la liste des fichiers du ${lot} reste exacte (gelée, toute correction passe par une migration 20261109…)`, () => {
            const present = fs.readdirSync(DIR).filter((f) => f.startsWith(prefix)).sort();
            assert.deepEqual(present, Object.keys(frozen).sort(),
                `${prefix}… : fichiers gelés modifiés. Gelée, toute correction passe par une migration 20261109…`);
        });

        for (const [name, sha] of Object.entries(frozen)) {
            test(`${name} : empreinte inchangée (${lot})`, () => {
                assert.ok(fs.existsSync(path.join(DIR, name)), `migration gelée supprimée : supabase/migrations/${name}`);
                assert.equal(sha256Lf(name), sha, `${name} a été modifiée : gelée, toute correction passe par une migration 20261109…`);
            });
        }
    }
});

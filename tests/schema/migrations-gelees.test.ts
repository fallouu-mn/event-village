/**
 * Lot 9 (AR7, contrat 3.1) — migrations gelées : 20261103… (lot 6, production), 20261105… (lot 7), 20261106…
 * (lot 8) et, depuis le lot 9 bis (T1, contrat 3.1), 20261108… (lot 9), appliquées sur event-village-dev. Chacune
 * garde son empreinte SHA-256 sur son contenu normalisé en LF, et la liste des fichiers de chaque préfixe reste
 * exacte : ni suppression, ni ajout. Depuis le lot 9 ter (contrat 3.2) : 20261109… (lot 9 bis) gelées aussi ; toute
 * correction passe par une migration 20261110….
 *
 * Empreintes : FROZEN_LOT6 et FROZEN_LOT7 recopiées de tests/schema/migration-lot7-rejouable.test.ts (ce fichier ne
 * change pas) ; 20261106… calculées sur 534d6b3 ; 20261108… calculées sur 7cca60f (identiques sur c3f03f6) ;
 * 20261109… calculées sur 2bd6086 (`git show HEAD:<f> | tr -d '\r' | sha256sum`, contrat 3.2, identiques à D-out 3.1).
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

/** Empreintes SHA-256 (LF) des migrations du lot 9 bis, calculées sur 2bd6086 (contrat 3.2). */
const FROZEN_LOT9BIS: Readonly<Record<string, string>> = {
    '20261109000001_lot9bis_reglages.sql': '72128d385f7896ac65d13de80001173ae03e5c364a2ed0366ffd9e2c915f0fc4',
    '20261109000002_lot9bis_transfert_statut.sql': 'd5fb11ef3c6a41a4fea8ac09a5d7cff85185233dcf512e2b9fb1b1e4e143ce0b',
    '20261109000003_lot9bis_registre.sql': 'b36ca37b2b0139d895dd440cc8d7140f8e7d49e4d449ad059cbfe6a78a61994d',
    '20261109000004_lot9bis_droits.sql': '4c513d69567c0dcb959a0f09ffea0bdf7de256c86355eaa843cc48f7f67b4af5',
    '20261109000005_lot9bis_samirpay.sql': '7fa83ec57296aa15741d077210bb934291b3163c001c1cac4defee2dc8a5b08d',
    '20261109000006_lot9bis_argent.sql': '7b6f47e39845c5216701bd61e65a1c0fbec2b0de5e87af1698985408d76a44b3',
    '20261109000007_lot9bis_versements.sql': 'ac251b02a327b97dbe3d4572cd9dabecea3a18e34fcedc43e71cb033758dc436',
    '20261109000008_lot9bis_cycle.sql': 'ab659db52d28fb9111e3d4f24fcb2e49cde07c0301a701bf9ecf97de87800de4',
    '20261109000009_lot9bis_messages.sql': 'a79272720936184029c15c3f79e1d35d0ad05b619d77c95e95702875fc40a4bf',
    '20261109000010_lot9bis_email.sql': '2601cf92da3f665ad6065a080748511fe1b22ba2bd89df1779a824b9e4a197a5',
    '20261109000011_lot9bis_textes.sql': '6b8ac4ac4f812dc998629a0c0999dddf441d53c263f5c33497a093710aed1fb5',
    '20261109000012_lot9bis_mode_reel.sql': 'edb721aa07011c51a17b5ac1d01eedbc70ec8100c7d2620b2c416fa989c33faa',
};

/**
 * Lot 9 quater (consigne : migrations 20261103… à 20261110… gelées) : empreintes SHA-256 (LF) des migrations du lot 9 ter,
 * calculées sur main 0cf8eb8 (appliquées sur event-village-dev le 13/11) ; toute correction passe par une migration 20261111….
 */
const FROZEN_LOT9TER: Readonly<Record<string, string>> = {
    '20261110000001_lot9ter_rls.sql': '320ee25a79efabba825629f0183626a9cdf828a4a0339a28bb5f543adb27fed1',
    '20261110000002_lot9ter_reglages.sql': '045526c9de7dec6107519a21f5952f6ab067d832c7d134c6ec4886249cb6f7b1',
    '20261110000003_lot9ter_transfert_statut.sql': '9b33208fd939cd6fd4157077a41faa08dd4af06a0bfb0a2d39c41572bdecd46a',
    '20261110000004_lot9ter_registre.sql': 'da1aaf91b09956ca7ad452bf73d35ec8ef1524d109d796323f25628f23b07889',
    '20261110000005_lot9ter_argent.sql': '1bf16b24e079e610bb979b5fff96b73e9761427ad11e87bd59c54daf3d3f0233',
    '20261110000006_lot9ter_equipe_messages.sql': 'a430fda75bbdd95c37c15ae4a167b8e69f2dc1fdd9b3d0ca9d996f0fabb0172d',
    '20261110000007_lot9ter_evenements.sql': '1c2aa66dec62ae03ec6975a9db817939220d0d60dd1633b693772632e90b0724',
    '20261110000008_lot9ter_invites.sql': '6c0ed0b7c0b7b67150cf6baa007bd076da948e6a2edc35e0af0305ed0044375b',
    '20261110000009_lot9ter_zones.sql': 'fc602eb84f23736e3593819c4befb567404fdb970b9e76e7aea0c58c1933bf5b',
    '20261110000010_lot9ter_pilotage.sql': 'b14ee14d339fca01504f5e59acb69fd23ddf1d17fe06243e053567d576d2f3fb',
    '20261110000011_lot9ter_stock.sql': '11d8fd1908870973b21969c24a459f50cbab16a59f37c90b1e1675e06b8e8a5e',
};

const FROZEN: ReadonlyArray<[string, string, Readonly<Record<string, string>>]> = [
    ['20261103', 'lot 6', FROZEN_LOT6],
    ['20261105', 'lot 7', FROZEN_LOT7],
    ['20261106', 'lot 8', FROZEN_LOT8],
    ['20261108', 'lot 9', FROZEN_LOT9],
    ['20261109', 'lot 9 bis', FROZEN_LOT9BIS],
    ['20261110', 'lot 9 ter', FROZEN_LOT9TER],
];

function sha256Lf(name: string): string {
    const content = fs.readFileSync(path.join(DIR, name), 'utf8').replace(/\r\n/g, '\n');
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('Migrations gelées : 20261103…, 20261105…, 20261106…, 20261108…, 20261109…', () => {
    for (const [prefix, lot, frozen] of FROZEN) {
        test(`${prefix}… : la liste des fichiers du ${lot} reste exacte (gelée, toute correction passe par une migration 20261110…)`, () => {
            const present = fs.readdirSync(DIR).filter((f) => f.startsWith(prefix)).sort();
            assert.deepEqual(present, Object.keys(frozen).sort(),
                `${prefix}… : fichiers gelés modifiés. Gelée, toute correction passe par une migration 20261110…`);
        });

        for (const [name, sha] of Object.entries(frozen)) {
            test(`${name} : empreinte inchangée (${lot})`, () => {
                assert.ok(fs.existsSync(path.join(DIR, name)), `migration gelée supprimée : supabase/migrations/${name}`);
                assert.equal(sha256Lf(name), sha, `${name} a été modifiée : gelée, toute correction passe par une migration 20261110…`);
            });
        }
    }
});

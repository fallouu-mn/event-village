/**
 * R7 — Lot 1B.2, renforcé au lot 9 (L32, AR3) : par l'API REST, un utilisateur ne modifie plus rien de son profil.
 * status, role, referral_status, referral_code, phone, email, et désormais prénom, nom et photo sont refusés.
 * (Clé anon + signUp / signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { openConcurrentClient } from '../helpers/db';
import { assertDenied, signUpAttacker, uniqueSuffix } from './helpers';
import { randomSenegalPhone } from '../parcours/helpers';

describe('R7 — colonnes protégées de public.users', () => {
    test('compte SUSPENDU qui tente status = ACTIF → refusé, statut inchangé', async () => {
        // Lot 9 quater (A6 : AUD-06) : un compte SUSPENDU ne se connecte plus (bloqué chez GoTrue) ; le compte est suspendu
        // en base locale après sa connexion, sa session reste valable (comme r6). Modification signalée au rapport.
        const suspended = await signUpAttacker('r7-susp');
        const db = await openConcurrentClient({ applicationName: 'ev-test-r7' });
        try {
            await db.query(`UPDATE public.users SET status = 'SUSPENDU' WHERE id = $1`, [suspended.userId]);
            await db.commit();
        } finally {
            await db.close();
        }
        const { error } = await suspended.client.from('users').update({ status: 'ACTIF' }).eq('id', suspended.userId).select('status');
        assertDenied(error, 'réactivation de son propre compte (status)');
        const { data: after, error: readErr } = await suspended.client.from('users').select('status').eq('id', suspended.userId).single();
        assert.equal(readErr, null, `relecture du profil : ${readErr?.message}`);
        assert.equal(after.status, 'SUSPENDU');
    });

    test('CLIENT qui change son téléphone par REST → refusé', async () => {
        const client = await signUpAttacker('r7-phone');
        const phone = randomSenegalPhone('78');
        const { error } = await client.client.from('users').update({ phone }).eq('id', client.userId).select('phone');
        assertDenied(error, 'changement de téléphone par REST');
        const { data: after } = await client.client.from('users').select('phone').eq('id', client.userId).single();
        assert.notEqual(after?.phone, phone);
    });

    test('CLIENT qui change son email, son rôle, son statut de parrainage ou son code → refusé', async () => {
        const client = await signUpAttacker('r7-cols');
        const attempts: Record<string, unknown> = {
            email: `r7-${uniqueSuffix().toLowerCase()}@test.eventvillage.local`,
            role: 'SUPERADMIN',
            referral_status: 'AMBASSADEUR',
            referral_code: `R7${uniqueSuffix()}`,
            status: 'SUSPENDU',
        };
        for (const [column, value] of Object.entries(attempts)) {
            const { error } = await client.client.from('users').update({ [column]: value }).eq('id', client.userId).select('id');
            assertDenied(error, `modification de users.${column}`);
        }
    });

    test('CLIENT qui change son prénom, son nom et sa photo par REST → refusé, la route est seule à écrire', async () => {
        const client = await signUpAttacker('r7-ok');
        const patch = { first_name: 'Prénom-R7', last_name: 'Nom-R7', avatar_url: 'https://example.invalid/avatar-r7.png' };
        const { error } = await client.client.from('users').update(patch).eq('id', client.userId).select('first_name, last_name, avatar_url');
        assertDenied(error, 'modification du prénom, du nom et de la photo par REST');
        const { data: after, error: readErr } = await client.client.from('users').select('first_name').eq('id', client.userId).single(); assert.ok(!readErr && after && after.first_name !== patch.first_name, `prénom modifié ou illisible : ${readErr?.message ?? after?.first_name}`);
    });

    // Lot 9 bis (I1, T64) : la marque de compte de démonstration n'est écrite que par le serveur. La colonne doit
    // d'abord exister (lue en base locale), sinon le refus PGRST204 d'une colonne inconnue passerait pour un refus.
    // Aide chargée ici : un import de tête décalerait la ligne 46, citée par docs/recette-billetterie.md.
    test('CLIENT qui pose ou retire demo_account par REST → refusé, valeur inchangée', async () => {
        const { inspect } = await import('../helpers/db');
        const client = await signUpAttacker('r7-demo');
        const readMark = (): Promise<boolean | null> => inspect(async (db) => {
            const col = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'demo_account'`);
            assert.equal(col.rowCount, 1, 'colonne public.users.demo_account absente — migration 20261109000012_lot9bis_mode_reel (I1)');
            const { rows } = await db.query<{ demo_account: boolean }>('SELECT demo_account FROM public.users WHERE id = $1', [client.userId]);
            return rows[0]?.demo_account ?? null;
        });
        assert.equal(await readMark(), false, 'un compte inscrit n\'est pas un compte de démonstration');
        for (const value of [true, false]) {
            const { error } = await client.client.from('users').update({ demo_account: value }).eq('id', client.userId).select('id');
            assertDenied(error, `modification de users.demo_account (${String(value)})`);
        }
        assert.equal(await readMark(), false, 'demo_account inchangé');
    });
});

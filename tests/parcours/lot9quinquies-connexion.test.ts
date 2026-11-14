/**
 * Lot 9 quinquies, A1 (AUTH-01, T3) — essais de mot de passe limités par compte : 10 échecs par 15 minutes, puis 429 avec
 * le délai ; clé = compte résolu par le serveur, ou empreinte de l'identifiant saisi s'il n'existe pas, sans révéler
 * l'existence ; au 10e échec, une fois par jour, SMS au titulaire.
 * (La preuve « 20 adresses IP » est la suite d'audit tests/audit-auth/auth-01, inchangée.)
 *
 * Cas :
 *  1. compte connu et numéro inconnu : même refus (texte, code) au 11e essai, délai réel ≤ 15 min ;
 *  2. au 11e essai, même le bon mot de passe est refusé ;
 *  3. 10e échec : un seul avis ACCOUNT_LOGIN_FAILURES (SMS et email), pas un de plus aux essais suivants ; texte du SMS ;
 *  4. un succès ne compte pas : 9 échecs puis 4 connexions réussies → toutes acceptées.
 * Chaque essai vient d'une adresse neuve (aucune limite par IP en jeu).
 * Rouge avant correctif : aucun refus par compte (20 réponses 401).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { newBuyer } from './paiement-helpers';
import { dispatchAt, outboxRows } from './notif-helpers';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-connexion');
});

function freshIp(): string {
    const b = randomBytes(3);
    return `203.0.${b[0]}.${(b[1] % 250) + 1}`;
}

interface Reply { status: number; body: Record<string, unknown> }

async function login(identifier: string, password: string): Promise<Reply> {
    const { POST } = await import('../../app/api/auth/login/route');
    const res = await POST(new NextRequest(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp() },
        body: JSON.stringify({ identifier, password }),
    }));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function failTimes(identifier: string, n: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < n; i += 1) statuses.push((await login(identifier, `Faux-${randomBytes(4).toString('hex')}`)).status);
    return statuses;
}

describe('A1 — essais de mot de passe limités par compte', () => {
    test('compte connu et numéro inconnu : 10 échecs, puis le même 429 (texte, code), délai réel de 15 minutes au plus', async () => {
        const known = await newBuyer('a1-connu');
        const unknownPhone = randomSenegalPhone('76');
        assert.deepEqual(await failTimes(known.phoneE164, 10), Array(10).fill(401), 'compte connu : 10 refus 401');
        assert.deepEqual(await failTimes(unknownPhone, 10), Array(10).fill(401), 'numéro inconnu : 10 refus 401');
        const a = await login(known.phoneE164, 'Encore-un-essai');
        const b = await login(unknownPhone, 'Encore-un-essai');
        console.log(`[A1] compte connu : ${a.status} ${JSON.stringify(a.body)} ; numéro inconnu : ${b.status} ${JSON.stringify(b.body)}`);
        assert.equal(a.status, 429, 'compte connu : 429 au 11e essai');
        assert.equal(b.status, 429, 'numéro inconnu : 429 au 11e essai');
        assert.equal(a.body.code, 'LOGIN_ACCOUNT_LOCKED');
        assert.deepEqual([a.body.code, a.body.error], [b.body.code, b.body.error], 'même refus : l\'existence du compte n\'est pas révélée');
        for (const r of [a, b]) {
            const s = Number(r.body.retryAfterSeconds);
            assert.ok(Number.isInteger(s) && s > 0 && s <= 900, `délai réel en secondes (≤ 15 min) : ${r.body.retryAfterSeconds}`);
            assert.match(String(r.body.error), /Réessayez dans \d+ (secondes?|minutes)\./, `délai dit en mots : ${r.body.error}`);
        }
    });

    test('au 11e essai, même le bon mot de passe est refusé', async () => {
        const target = await newBuyer('a1-bon-mdp');
        await failTimes(target.email, 10);
        const r = await login(target.email, STRONG_PASSWORD);
        assert.equal(r.status, 429, `bon mot de passe après 10 échecs : ${r.status} ${JSON.stringify(r.body)}`);
    });

    test('10e échec : un seul avis ACCOUNT_LOGIN_FAILURES (SMS et email) pour la journée ; texte du SMS', async () => {
        const target = await newBuyer('a1-avis');
        await failTimes(target.phoneE164, 9);
        assert.equal((await outboxRows({ type: 'ACCOUNT_LOGIN_FAILURES', userId: target.userId })).length, 0, 'aucun avis avant le 10e échec');
        await failTimes(target.phoneE164, 1);
        const rows = await outboxRows({ type: 'ACCOUNT_LOGIN_FAILURES', userId: target.userId });
        assert.deepEqual(rows.map((r) => r.channel).sort(), ['EMAIL', 'SMS'], `avis du 10e échec : ${JSON.stringify(rows.map((r) => [r.channel, r.status]))}`);
        await failTimes(target.phoneE164, 5);
        assert.equal((await outboxRows({ type: 'ACCOUNT_LOGIN_FAILURES', userId: target.userId })).length, 2, 'aucun avis de plus le même jour');
        const before = getFakes().sms.messagesTo(target.phoneE164).length;
        await dispatchAt(new Date(), { ids: rows.filter((r) => r.channel === 'SMS').map((r) => r.id) });
        assert.deepEqual(getFakes().sms.messagesTo(target.phoneE164).slice(before).map((m) => m.message), [
            `Event Village : plusieurs connexions ont échoué sur votre compte. Si ce n'est pas vous, changez votre mot de passe : ${APP_URL}/forgot-password`,
        ], 'SMS au titulaire');
    });

    test('un succès ne compte pas : 9 échecs puis 4 connexions réussies, toutes acceptées', async () => {
        const target = await newBuyer('a1-succes');
        await failTimes(target.email, 9);
        for (let i = 1; i <= 4; i += 1) {
            const r = await login(target.email, STRONG_PASSWORD);
            assert.equal(r.status, 200, `connexion réussie n°${i} : ${r.status} ${JSON.stringify(r.body)}`);
        }
    });
});

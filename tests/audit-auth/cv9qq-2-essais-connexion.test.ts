/**
 * Contre-vérification du lot 9 quinquies, attaque 2 — 10 mauvais mots de passe par compte et par 15 minutes (A1).
 *
 * L'attaquant connaît le numéro et l'adresse du compte, pas le mot de passe. Il essaie de dépasser la limite :
 *  a. 25 essais EN PARALLÈLE sur POST /api/auth/login : au plus 10 essais vérifiés, puis 429 ; le bon mot de passe aussi ;
 *  b. en alternant le numéro et l'adresse email (vérifiée) du même compte : la limite est commune ;
 *  c. directement chez GoTrue (/auth/v1/token, clé publique), sans passer par l'application ;
 *  d. par la connexion par code : après le blocage, le code SMS a ses propres limites (5 essais par code, 3 codes par
 *     15 minutes et par numéro) et ne permet pas de deviner.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { STRONG_PASSWORD } from '../parcours/helpers';
import { newBuyer } from '../parcours/paiement-helpers';
import { markEmailVerified } from '../parcours/notif-helpers';
import { anonClient, post } from './cv9qq-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('cv9qq-2-essais-connexion');
});

const wrong = (): string => `Faux mot de passe ${randomBytes(4).toString('hex')}`;
const login = (identifier: string, password: string) => post('auth/login', { identifier, password });

describe('Attaque 2 — dépasser 10 mauvais mots de passe', () => {
    test('a. 25 essais en parallèle : au plus 10 vérifiés, les autres 429 ; puis le bon mot de passe refusé', async () => {
        const u = await newBuyer('cv9qq-parallele');
        const replies = await Promise.all(Array.from({ length: 25 }, () => login(u.phone9, wrong())));
        const tally = replies.reduce<Record<number, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
        console.log(`[CV9QQ-2a] 25 essais parallèles : ${JSON.stringify(tally)}`);
        assert.ok((tally[401] ?? 0) <= 10, `plus de 10 mots de passe vérifiés en parallèle : ${JSON.stringify(tally)}`);
        assert.equal((tally[401] ?? 0) + (tally[429] ?? 0), 25, `réponses inattendues : ${JSON.stringify(tally)}`);
        const right = await login(u.phone9, STRONG_PASSWORD);
        assert.deepEqual([right.status, right.body.code], [429, 'LOGIN_ACCOUNT_LOCKED'], JSON.stringify(right.body));
    });

    test('b. numéro puis adresse email du même compte : limite commune (11e essai refusé)', async () => {
        const u = await newBuyer('cv9qq-email');
        await markEmailVerified(u.userId);
        const statuses: string[] = [];
        for (let i = 0; i < 6; i += 1) statuses.push(`num:${(await login(u.phone9, wrong())).status}`);
        for (let i = 0; i < 4; i += 1) statuses.push(`email:${(await login(u.email, wrong())).status}`);
        const eleventhByEmail = await login(u.email.toUpperCase(), STRONG_PASSWORD);
        const eleventhByPhone = await login(u.phoneE164, STRONG_PASSWORD);
        console.log(`[CV9QQ-2b] ${statuses.join(' ')} ; 11e (email, bon mot de passe) : ${eleventhByEmail.status} ; 11e (numéro) : ${eleventhByPhone.status}`);
        assert.deepEqual(statuses.filter((s) => !s.endsWith(':401')), [], 'les 10 premiers essais sont des échecs');
        assert.equal(eleventhByEmail.status, 429, `adresse email après 10 échecs : ${JSON.stringify(eleventhByEmail.body)}`);
        assert.equal(eleventhByPhone.status, 429, `numéro après 10 échecs : ${JSON.stringify(eleventhByPhone.body)}`);
    });

    test('c. directement chez GoTrue (clé publique) : 12 mauvais mots de passe, puis le bon est refusé', async () => {
        const u = await newBuyer('cv9qq-gotrue');
        const gotrue = anonClient();
        const errors: string[] = [];
        for (let i = 0; i < 12; i += 1) {
            const { error } = await gotrue.auth.signInWithPassword({ email: u.email, password: wrong() });
            errors.push(error ? String(error.status ?? error.code ?? 'erreur') : 'SESSION');
        }
        const right = await gotrue.auth.signInWithPassword({ email: u.email, password: STRONG_PASSWORD });
        console.log(`[CV9QQ-2c] GoTrue direct, 12 faux : ${errors.join(',')} ; bon mot de passe ensuite : ${right.error ? `refusé ${right.error.status}` : 'SESSION OUVERTE'}`);
        const viaApp = await login(u.email, STRONG_PASSWORD);
        console.log(`[CV9QQ-2c] même compte par l'application ensuite : ${viaApp.status} ${String(viaApp.body.code ?? '')}`);
        assert.notEqual(right.error, null, 'GoTrue ouvre une session après 12 mauvais mots de passe : la limite par compte ne vaut que pour /api/auth/login');
    });

    test('d. connexion par code après le blocage : 5 essais par code, puis le bon code est refusé ; 3 codes par 15 minutes', async () => {
        const u = await newBuyer('cv9qq-code');
        for (let i = 0; i < 10; i += 1) await login(u.phone9, wrong());
        assert.equal((await login(u.phone9, STRONG_PASSWORD)).status, 429, 'compte bloqué');
        const since = getFakes().sms.messagesTo(u.phoneE164).length;
        const sent = await post('auth/send-otp', { phone: u.phoneE164, purpose: 'LOGIN' });
        assert.equal(sent.status, 200, JSON.stringify(sent.body));
        const code = getFakes().sms.messagesTo(u.phoneE164).slice(since).at(-1)?.message.match(/\b(\d{6})\b/)?.[1];
        assert.ok(code, 'code reçu par le titulaire');
        const bad = code === '000000' ? '111111' : '000000';
        const tries: number[] = [];
        for (let i = 0; i < 5; i += 1) tries.push((await post('auth/verify-otp', { phone: u.phoneE164, otpCode: bad })).status);
        const after5 = await post('auth/verify-otp', { phone: u.phoneE164, otpCode: code });
        console.log(`[CV9QQ-2d] 5 codes faux : ${tries.join(',')} ; bon code ensuite : ${after5.status} ${String(after5.body.code ?? '')}`);
        assert.notEqual(after5.status, 200, 'le bon code passe après 5 essais faux');
        const sends: number[] = [];
        for (let i = 0; i < 3; i += 1) sends.push((await post('auth/send-otp', { phone: u.phoneE164, purpose: 'LOGIN' })).status);
        console.log(`[CV9QQ-2d] codes demandés ensuite (déjà 1 dans les 15 minutes) : ${sends.join(',')}`);
        assert.ok(sends.includes(429), `aucune limite des codes par numéro : ${sends.join(',')}`);
    });
});

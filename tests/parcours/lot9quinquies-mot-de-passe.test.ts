/**
 * Lot 9 quinquies, A7 (AUTH-11) — règle du mot de passe, décision du chef de projet : 10 caractères au moins, sans
 * obligation de majuscule ni de caractère spécial, 64 au plus, refus des mots de passe courants (liste de 10 000 dans le
 * dépôt, complétée de mots sénégalais évidents : senegal, dakar, teranga, 221…, 77…, suites de chiffres, nom de
 * l'application). Même minimum dans GoTrue (supabase/config.toml). Nouveaux mots de passe seulement. La liste de contrôle
 * de l'écran suit la règle.
 * Cas :
 *  1. règle partagée (écrans et serveur) : refus et acceptations exacts ;
 *  2. liste du serveur : 10 000 entrées au moins ; « Sunshine2026! » refusé comme « sunshine » ;
 *  3. route : POST /api/account/password refuse « Senegal2026! » et accepte « ma soirée au théâtre » ;
 *  4. GoTrue : minimum_password_length = 10 ;
 *  5. liste de contrôle de l'écran : critères de la règle, plus de majuscule ni de caractère spécial exigés.
 * Rouge avant correctif : 8 caractères, majuscule, chiffre et caractère spécial exigés, aucune liste.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { STRONG_PASSWORD } from './helpers';
import { newBuyer } from './paiement-helpers';
import { jsonRequest } from './finance-helpers';
import { invoke, routeHandler } from './pilotage-helpers';

const ROOT = process.cwd();
/** Exemples publics de la règle (A7, critère de l'audit AUTH-11), jamais des secrets. */
const REFUSED_SAMPLE = 'Senegal2026!';
const ACCEPTED_SAMPLE = 'ma soirée au théâtre';

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-mot-de-passe');
});

async function sharedSchema(): Promise<{ safeParse: (v: string) => { success: boolean; error?: { issues: Array<{ message: string }> } } }> {
    const mod = (await import('../../lib/validations/auth')) as unknown as { StrongPasswordSchema: { safeParse: (v: string) => { success: boolean; error?: { issues: Array<{ message: string }> } } } };
    return mod.StrongPasswordSchema;
}

const REFUSED = [
    ['9 caractères', 'abcdefghi'],
    ['65 caractères', 'a'.repeat(30) + ' ' + 'b'.repeat(34)],
    ['Senegal2026!', 'Senegal2026!'],
    ['dakar12345', 'dakar12345'],
    ['Teranga!!2026', 'Teranga!!2026'],
    ['numéro 221', '221771234567'],
    ['numéro 77', '7712345678'],
    ['suite croissante', '0123456789'],
    ['suite décroissante', '9876543210'],
    ['répétition', 'aaaaaaaaaa'],
    ['nom de l\'application', 'MonEventVillage2026'],
] as const;

const ACCEPTED = [
    ['phrase avec accents', 'ma soirée au théâtre'],
    ['minuscules seules', 'tamarinier bleu'],
    ['64 caractères', 'x'.repeat(10) + ' ' + 'mot de passe tres long '.repeat(2) + 'y'.repeat(7)],
] as const;

describe('A7 — règle du mot de passe', () => {
    test('règle partagée : refus des mots de passe courts, longs, évidents ; acceptation sans majuscule ni caractère spécial', async () => {
        const schema = await sharedSchema();
        const issues: string[] = [];
        for (const [label, pw] of REFUSED) {
            const r = schema.safeParse(pw);
            if (r.success) issues.push(`accepté à tort : ${label} (${pw.length} caractères)`);
        }
        for (const [label, pw] of ACCEPTED) {
            assert.ok(pw.length >= 10 && pw.length <= 64, `${label} : ${pw.length} caractères`);
            const r = schema.safeParse(pw);
            if (!r.success) issues.push(`refusé à tort : ${label} — ${r.error?.issues[0]?.message}`);
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('liste du serveur : 10 000 entrées au moins ; mots de passe courants refusés, avec ou sans chiffres autour', async () => {
        const policy = (await import('../../lib/auth/password-policy.server')) as unknown as {
            commonPasswordCount(): number; isCommonPassword(p: string): boolean; serverPasswordRuleMessage(p: string): string | null;
        };
        assert.ok(policy.commonPasswordCount() >= 10_000, `entrées : ${policy.commonPasswordCount()}`);
        for (const pw of ['basketball', 'Sunshine2026!', '123password!!', 'qwertyuiop', 'Manchester99']) {
            assert.equal(policy.isCommonPassword(pw), true, `${pw} : courant`);
            assert.ok(policy.serverPasswordRuleMessage(pw), `${pw} : refusé par le serveur`);
        }
        for (const pw of ['ma soirée au théâtre', 'tamarinier bleu']) assert.equal(policy.serverPasswordRuleMessage(pw), null, `${pw} : accepté`);
    });

    test('POST /api/account/password : « Senegal2026! » refusé (400), « ma soirée au théâtre » accepté', async () => {
        const user = await newBuyer('a7-route');
        const handler = await routeHandler('../../app/api/account/password/route', 'POST', 'POST /api/account/password');
        const refused = await invoke(handler, jsonRequest('/api/account/password', 'POST', user.accessToken, { current_password: STRONG_PASSWORD, new_password: REFUSED_SAMPLE }));
        assert.equal(refused.status, 400, `Senegal2026! : ${JSON.stringify(refused.body)}`);
        const ok = await invoke(handler, jsonRequest('/api/account/password', 'POST', user.accessToken, { current_password: STRONG_PASSWORD, new_password: ACCEPTED_SAMPLE }));
        assert.equal(ok.status, 200, `phrase : ${JSON.stringify(ok.body)}`);
    });

    test('GoTrue : minimum_password_length = 10 (supabase/config.toml)', () => {
        const toml = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
        assert.match(toml, /^minimum_password_length = 10$/m);
    });

    test('liste de contrôle de l\'écran : critères de la règle, plus de majuscule ni de caractère spécial exigés', () => {
        const src = fs.readFileSync(path.join(ROOT, 'components/auth/PasswordStrengthChecklist.tsx'), 'utf8');
        assert.ok(src.includes('PASSWORD_CRITERIA_LABELS') || src.includes('Au moins 10 caractères'), 'critère des 10 caractères');
        assert.ok(!/majuscule/i.test(src), 'aucune majuscule exigée');
        assert.ok(!/caract[eè]re sp[ée]cial/i.test(src), 'aucun caractère spécial exigé');
        for (const rel of ['components/profile/PasswordChangeDialog.tsx', 'app/controller/setup/page.tsx', 'app/controller/profile/page.tsx', 'app/register/page.tsx', 'app/reset-password/page.tsx']) {
            const page = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            assert.ok(!page.includes('8 caractères au moins'), `${rel} : ancienne aide « 8 caractères au moins »`);
        }
    });
});

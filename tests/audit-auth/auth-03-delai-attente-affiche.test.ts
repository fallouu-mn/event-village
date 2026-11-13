/**
 * Audit de l'authentification — AUTH-03 : quand une limite est atteinte, trois écrans affichent un faux délai
 * (expérience ; OWASP ASVS 4.0 V2.2.1 : l'anti-automatisation ne doit pas empêcher l'utilisateur légitime de savoir
 * quand réessayer).
 *
 * Toutes les routes rendent le délai dans `retryAfterSeconds` (lib/security/quota-http.ts:17, lib/sms/sms-http.ts:13) ;
 * aucune ne rend `remainingSeconds` (aucune occurrence sous app/api ni lib). Or la connexion par code
 * (components/auth/LoginForm.tsx:400, :416), « Mot de passe oublié » (app/forgot-password/page.tsx:266-267) et
 * l'inscription partenaire (app/partner/register/page.tsx:323) lisent `remainingSeconds` : elles affichent « 60 s »
 * (ou rien) alors que l'attente réelle peut être d'une heure ou d'un jour (SMS_OTP_PER_PHONE_DAY, SMS_OTP_PER_IP_DAY).
 * Constat déjà noté par le guide (W2-01), non repris par le lot 9 quater.
 *
 * Test ROUGE tant que l'écart existe : toute lecture de `remainingSeconds` dans ces écrans doit aussi lire
 * `retryAfterSeconds` (champ réellement envoyé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCREENS = ['components/auth/LoginForm.tsx', 'app/forgot-password/page.tsx', 'app/partner/register/page.tsx'];

describe('AUTH-03 — délai d\'attente affiché après un refus 429', () => {
    test('aucune route ne rend remainingSeconds : le champ envoyé est retryAfterSeconds', () => {
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
                const rel = path.join(dir, e.name);
                if (e.isDirectory()) walk(rel);
                else if (/\.tsx?$/.test(e.name) && fs.readFileSync(path.join(ROOT, rel), 'utf8').includes('remainingSeconds')) offenders.push(rel);
            }
        };
        walk('app/api');
        walk('lib');
        assert.deepEqual(offenders, [], `routes ou modules serveur qui rendent remainingSeconds : ${offenders.join(', ')}`);
    });

    for (const rel of SCREENS) {
        test(`${rel} : chaque lecture de remainingSeconds lit aussi retryAfterSeconds`, () => {
            const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/);
            const wrong = lines
                .map((l, i) => ({ l, n: i + 1 }))
                .filter(({ l }) => /\.remainingSeconds\b/.test(l) && !l.includes('retryAfterSeconds') && !/^\s*(\*|\/\/)/.test(l))
                .map(({ l, n }) => `${rel}:${n} ${l.trim().slice(0, 120)}`);
            assert.deepEqual(wrong, [], `délai lu dans un champ que le serveur n'envoie jamais :\n${wrong.join('\n')}`);
        });
    }
});

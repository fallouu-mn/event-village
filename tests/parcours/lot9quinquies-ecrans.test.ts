/**
 * Lot 9 quinquies, B1 (AUTH-06), B4 (AUTH-07), B5 (A7 de la revue), B6 (E-57) — écrans et réglages.
 *
 * B1 : réglages SUPERADMIN support.whatsapp, support.phone, support.email (validés en base) ; page publique /aide (contact
 *      et cinq réponses) ; essai:check-reel exige au moins un contact ; chaque message « contactez le support » du serveur
 *      donne le lien de la page d'aide ; la connexion a un lien vers /aide.
 * B4 : « Se déconnecter » ferme seulement cet appareil ; « Déconnecter tous mes appareils » dans le profil, avec
 *      confirmation « Vos billets hors ligne seront effacés sur les autres téléphones. » ; le scanner suit.
 * B5 : aide sous le champ de connexion ; bandeau « Adresse email non vérifiée » et « Recevoir le lien de vérification ».
 * B6 : « Recevoir un code de connexion » ouvre l'onglet « Code SMS », numéro prérempli.
 * Rouge avant correctif : réglages, page et textes absents ; « Se déconnecter » global.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspect, writeLocal } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { superadminId } from './finance-helpers';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-ecrans');
});

describe('B1 — joindre le support', () => {
    test('réglages du contact : valeurs valides acceptées, invalides refusées (finance_setting_set), lecture servie à l\'écran', async () => {
        const actor = await superadminId();
        const set = async (key: string, value: string) => writeLocal(async (c) => (await c.query<{ r: { ok: boolean; code?: string } }>(
            'SELECT public.finance_setting_set($1, $2::jsonb, $3, $4) AS r', [key, JSON.stringify({ value }), actor, 'test du lot 9 quinquies'])).rows[0].r);
        const before = await inspect(async (c) => (await c.query(`SELECT key, value FROM public.platform_settings WHERE key LIKE 'support.%' ORDER BY key`)).rows);
        assert.deepEqual(before.map((r) => r.key), ['support.email', 'support.phone', 'support.whatsapp'], 'trois réglages');
        try {
            assert.equal((await set('support.whatsapp', '+221771234567')).ok, true);
            assert.equal((await set('support.email', 'support@exemple.sn')).ok, true);
            assert.equal((await set('support.phone', '')).ok, true, 'vide : non renseigné');
            assert.equal((await set('support.whatsapp', '77 123 45 67')).code, 'INVALID_VALUE', 'format international exigé');
            assert.equal((await set('support.email', 'pas-une-adresse')).code, 'INVALID_VALUE');
            const reply = await inspect(async (c) => (await c.query(`SELECT public.essai_check_reel('{}'::jsonb) AS r`)).rows[0].r);
            assert.equal(Number(reply.support?.filled), 2, `essai_check_reel : réglages renseignés ${JSON.stringify(reply.support)}`);
        } finally {
            for (const r of before) await writeLocal((c) => c.query('UPDATE public.platform_settings SET value = $2 WHERE key = $1', [r.key, r.value]));
        }
        const route = read('app/api/admin/finance-settings/route.ts');
        assert.ok(route.includes('key.like.support.%'), 'la route des réglages sert support.*');
        assert.match(route, /finance\|access\|notif\|features\|support/, 'la route accepte la modification de support.*');
    });

    test('essai:check-reel : aucun contact → point à traiter ; inactivité relevée → point à traiter', async () => {
        const core = (await import('../../scripts/dev/essai-check-reel.core.mjs')) as unknown as {
            configReport(reply: unknown, env: Record<string, string>): { lines: string[]; points: number };
        };
        assert.equal(core.configReport({ support: { filled: 0 } }, {}).points, 1);
        assert.equal(core.configReport({ support: { filled: 1 } }, {}).points, 0);
        assert.equal(core.configReport({ support: { filled: 1 } }, { ADMIN_IDLE_TIMEOUT_MINUTES: '240' }).points, 1);
    });

    test('page publique /aide : contact lu dans les réglages, cinq réponses courtes ; route publique ; lien depuis la connexion', () => {
        const page = read('app/aide/page.tsx');
        assert.ok(page.includes('getSupportContact'), 'contact lu dans les réglages');
        for (const t of ['Mon billet', 'Un remboursement', 'Mot de passe oublié', 'Compte suspendu', 'Devenir organisateur']) assert.ok(page.includes(`'${t}'`), `réponse « ${t} »`);
        assert.ok(read('middleware.ts').includes("'/aide'"), 'page servie sans session');
        assert.ok(read('components/auth/LoginForm.tsx').includes('href="/aide"'), 'lien vers /aide sur la connexion');
    });

    test('messages du serveur : « contactez le support » est toujours suivi du lien de la page d\'aide', () => {
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
                const rel = path.join(dir, e.name);
                if (e.isDirectory()) walk(rel);
                else if (/\.ts$/.test(e.name)) {
                    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
                    if (/contacte[zr] le support\s*[.'"`]/i.test(src) && !/contactSupport\(/.test(src)) offenders.push(rel.replace(/\\/g, '/'));
                }
            }
        };
        walk('app/api');
        walk('lib/auth');
        walk('lib/admin');
        walk('lib/sms');
        assert.deepEqual(offenders, [], `messages sans lien d'aide : ${offenders.join(', ')}`);
    });
});

describe('B4 — se déconnecter', () => {
    test('« Se déconnecter » : cet appareil seulement ; « Déconnecter tous mes appareils » avec confirmation ; scanner', () => {
        const provider = read('components/providers/AuthProvider.tsx');
        assert.match(provider, /signOut\(\{ scope: 'local' \}\)/, 'AuthProvider : portée locale');
        assert.ok(provider.includes('/api/auth/sign-out-global'), 'signOutEverywhere : révocation de toutes les sessions');
        const profile = read('app/profile/page.tsx');
        assert.ok(profile.includes('Déconnecter tous mes appareils'));
        assert.ok(profile.includes('Vos billets hors ligne seront effacés sur les autres téléphones.'));
        for (const rel of ['app/controller/layout.tsx', 'app/controller/scanner/page.tsx']) {
            const src = read(rel);
            assert.ok(!src.includes("scope: 'global'"), `${rel} : plus de déconnexion globale`);
            assert.ok(!src.includes('tous vos appareils'), `${rel} : texte suivi`);
        }
    });
});

describe('B5 et B6 — connexion et profil', () => {
    test('B5 : aide sous le champ de connexion ; bandeau du profil', () => {
        assert.ok(read('components/auth/LoginForm.tsx').includes('Email : seulement si votre adresse a été vérifiée. Sinon, utilisez votre numéro.'));
        const form = read('components/profile/ProfileForm.tsx');
        assert.ok(form.includes('Adresse email non vérifiée') && form.includes('Recevoir le lien de vérification'));
    });

    test('B6 : « Recevoir un code de connexion » ouvre l\'onglet Code SMS, numéro prérempli (hors de l\'adresse)', () => {
        const reg = read('app/register/page.tsx');
        assert.ok(reg.includes('/login?mode=code'), 'lien vers l\'onglet Code SMS');
        assert.ok(reg.includes('LOGIN_PREFILL_PHONE_KEY'), 'numéro passé par sessionStorage');
        const login = read('components/auth/LoginForm.tsx');
        assert.ok(login.includes("modeParam === 'code'"), 'onglet Code SMS ouvert');
        assert.ok(read('app/login/page.tsx').includes('modeParam={modeParam}'));
    });
});

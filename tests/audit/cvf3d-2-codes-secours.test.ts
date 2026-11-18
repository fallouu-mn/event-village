/**
 * Contre-vérification de la finition 3d, attaque 2 — codes de secours du SUPERADMIN et « J'ai perdu mon téléphone »
 * (GET et POST /api/admin/security/backup-codes ; POST /api/admin/step-up/recovery ; POST /api/admin/security/phone/start
 * et /confirm ; admin_backup_codes_generate, admin_backup_code_use).
 *  a. Rejouer un code : un à un, puis deux usages du même code en parallèle.
 *  b. Deviner : 5 codes faux puis le bon ; 10 codes faux en parallèle puis le bon.
 *  c. Anciens codes après régénération.
 *  d. Régénérer sans mot de passe récent, puis sans code administrateur récent.
 *  e. Lire les codes après leur affichage : base (empreintes, journal, boîte d'envoi), REST (table et fonctions), réponses
 *     des routes, journal du serveur (console).
 *  f. Usage par un ADMIN non SUPERADMIN, et par un SUPERADMIN rétrogradé puis renommé (anciens codes).
 *  g. « J'ai perdu mon téléphone » n'ouvre jamais l'administration sans mot de passe ET code de secours valide : mot de passe
 *     faux, code faux, code d'un autre Superadmin, sans session, compte client ; témoin : les deux justes ouvrent.
 *  h. Le SUPERADMIN change son numéro par l'écran client (Profil) avec un code administrateur vieux de 2 heures, alors que
 *     « Sécurité du compte » exige un code de moins de 10 minutes.
 *  i. Téléphone perdu : après le code de secours et le changement de numéro, la session restée ouverte sur le téléphone perdu
 *     garde-t-elle le pouvoir d'administration par la REST ?
 * Sortie brute `[CVF3D-2]`.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspect } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { newAdmin } from '../parcours/notif-helpers';
import { newBuyer } from '../parcours/paiement-helpers';
import { anonClient, restRpc, userClient } from './cvf1-helpers';
import {
    ageDeviceCode, call, captureConsole, confirmIdentity, confirmPasswordOnly, digits, freshSession, lastSmsCode, othersSeen,
    phoneOf, randomSenegalPhone, refreshError, show, smsTo, steppedUpSession, STRONG_PASSWORD, superadmin,
    type Reply, type Row, type TestAdmin,
} from './cvf3d-helpers';

const BACKUP = 'admin/security/backup-codes';
const RECOVERY = 'admin/step-up/recovery';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generate = (token: string): Promise<Reply> => call('POST', BACKUP, { token, body: {} });
const status = (token: string): Promise<Reply> => call('GET', BACKUP, { token });
const recover = (token: string | null, password: string, code: string): Promise<Reply> => call('POST', RECOVERY, { token, body: { password, code } });

async function withCodes(label: string): Promise<{ sa: TestAdmin; codes: string[] }> {
    const sa = await superadmin(label);
    const r = await generate(sa.accessToken);
    assert.equal(r.status, 200, `création des codes (montage) : ${show(r)}`);
    const codes = r.body.codes as string[];
    assert.equal(codes.length, 10);
    return { sa, codes };
}

async function openCodes(userId: string): Promise<number> {
    return inspect(async (c) => Number((await c.query(
        `SELECT count(*)::int AS n FROM public.admin_backup_codes WHERE user_id = $1 AND used_at IS NULL AND revoked_at IS NULL`, [userId])).rows[0].n));
}

/** Code de la bonne forme qui n'est pas dans la liste. */
function guess(codes: string[], i: number): string {
    for (let k = 0; ; k += 1) {
        let s = '';
        for (let j = 0; j < 10; j += 1) s += ALPHABET[(i * 7 + k * 13 + j * 5 + j * j) % ALPHABET.length];
        const c = `${s.slice(0, 5)}-${s.slice(5)}`;
        if (!codes.includes(c)) return c;
    }
}

function forms(code: string): string[] {
    const bare = code.replace('-', '');
    return [code, bare, bare.toLowerCase()];
}

function sha(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Une route d'administration est-elle ouverte pour cette session ? (code de la session, sans rien saisir) */
async function adminOpen(token: string): Promise<Reply> {
    return status(token);
}

after(async () => {
    await assertFinition3dInvariants('cvf3d-2-codes-secours');
});

describe('2. usage des codes', () => {
    test('a. rejouer un code : refusé, un à un comme en parallèle', async () => {
        const { sa, codes } = await withCodes('cvf3d2-a');
        const s1 = await freshSession(sa.email);
        const first = await recover(s1.token, STRONG_PASSWORD, codes[0]);
        const s2 = await freshSession(sa.email);
        const replay = await recover(s2.token, STRONG_PASSWORD, codes[0]);
        const [s3, s4] = [await freshSession(sa.email), await freshSession(sa.email)];
        const race = await Promise.all([recover(s3.token, STRONG_PASSWORD, codes[1]), recover(s4.token, STRONG_PASSWORD, codes[1])]);
        const left = await openCodes(sa.userId);
        console.log(`[CVF3D-2a] premier usage : ${show(first)} ; rejeu : ${show(replay)} ; même code en parallèle : ${race.map(show).join(' | ')} ; codes restants : ${left}`);
        assert.equal(first.status, 200, show(first));
        assert.deepEqual([replay.status, replay.body.code], [403, 'BACKUP_CODE_INVALID'], show(replay));
        assert.equal(race.filter((r) => r.status === 200).length, 1, 'un seul usage du même code en parallèle');
        assert.equal(left, 8, 'deux codes consommés, pas plus');
    });

    test('b. deviner : 5 codes faux puis le bon (429) ; 10 codes faux en parallèle puis le bon (429) ; rien de consommé', async () => {
        const { sa, codes } = await withCodes('cvf3d2-b');
        const s = await freshSession(sa.email);
        const seq: string[] = [];
        for (let i = 0; i < 5; i += 1) {
            const r = await recover(s.token, STRONG_PASSWORD, guess(codes, i));
            seq.push(`${r.status} ${String(r.body.code)}`);
        }
        const right = await recover(s.token, STRONG_PASSWORD, codes[0]);

        const b2 = await withCodes('cvf3d2-b2');
        const s2 = await freshSession(b2.sa.email);
        const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => recover(s2.token, STRONG_PASSWORD, guess(b2.codes, i))));
        const right2 = await recover(s2.token, STRONG_PASSWORD, b2.codes[0]);
        const counted = burst.filter((r) => r.body.code === 'BACKUP_CODE_INVALID').length;
        console.log(`[CVF3D-2b] un à un : ${seq.join(' | ')} ; bon code ensuite : ${show(right)} ; codes restants : ${await openCodes(sa.userId)}`);
        console.log(`[CVF3D-2b] 10 en parallèle : ${burst.map((r) => `${r.status} ${String(r.body.code)}`).join(' | ')} ; essais évalués : ${counted} ; bon code ensuite : ${show(right2)} ; codes restants : ${await openCodes(b2.sa.userId)}`);
        assert.deepEqual(seq, Array(5).fill('403 BACKUP_CODE_INVALID'));
        assert.deepEqual([right.status, right.body.code], [429, 'RECOVERY_RATE_LIMITED'], show(right));
        assert.ok(counted <= 5, `codes faux évalués en parallèle : ${counted} (5 au plus)`);
        assert.deepEqual([right2.status, right2.body.code], [429, 'RECOVERY_RATE_LIMITED'], show(right2));
        assert.equal(await openCodes(sa.userId), 10, 'aucun code consommé');
        assert.equal(await openCodes(b2.sa.userId), 10, 'aucun code consommé (parallèle)');
    });

    test('c. anciens codes après régénération : refusés ; nouveaux : acceptés', async () => {
        const { sa, codes: old } = await withCodes('cvf3d2-c');
        await confirmIdentity(sa);
        const again = await generate(sa.accessToken);
        assert.equal(again.status, 200, show(again));
        const fresh = again.body.codes as string[];
        const s = await freshSession(sa.email);
        const withOld = await recover(s.token, STRONG_PASSWORD, old[3]);
        const withNew = await recover(s.token, STRONG_PASSWORD, fresh[3]);
        console.log(`[CVF3D-2c] ancien code : ${show(withOld)} ; nouveau code : ${show(withNew)} ; codes communs aux deux séries : ${old.filter((c) => fresh.includes(c)).length}`);
        assert.deepEqual([withOld.status, withOld.body.code], [403, 'BACKUP_CODE_INVALID'], show(withOld));
        assert.equal(withNew.status, 200, show(withNew));
    });

    test('d. régénérer sans mot de passe récent, puis sans code récent : refusé, anciens codes intacts', async () => {
        const { sa } = await withCodes('cvf3d2-d');
        const s = await steppedUpSession(sa.email);
        const noPassword = await generate(s.token);
        await confirmPasswordOnly(s.token);
        await ageDeviceCode(sa.userId, 11);
        const noCode = await generate(s.token);
        const left = await openCodes(sa.userId);
        console.log(`[CVF3D-2d] sans mot de passe : ${show(noPassword)} ; sans code récent : ${show(noCode)} ; codes valables : ${left}`);
        assert.deepEqual([noPassword.status, noPassword.body.code], [403, 'PASSWORD_CONFIRMATION_REQUIRED'], show(noPassword));
        assert.deepEqual([noCode.status, noCode.body.code], [403, 'ADMIN_CODE_CONFIRMATION_REQUIRED'], show(noCode));
        assert.equal(left, 10, 'anciens codes intacts');
    });
});

describe('2. les codes ne se relisent jamais', () => {
    test('e. base, REST, réponses et journal du serveur : aucun code en clair après l\'affichage', async () => {
        const sa = await superadmin('cvf3d2-e');
        const shown = await captureConsole(() => generate(sa.accessToken));
        assert.equal(shown.value.status, 200, show(shown.value));
        const codes = shown.value.body.codes as string[];
        const s = await freshSession(sa.email);
        const later = await captureConsole(async () => [
            await status(sa.accessToken),
            await recover(s.token, STRONG_PASSWORD, guess(codes, 1)),
            await recover(s.token, STRONG_PASSWORD, codes[0]),
            await status(sa.accessToken),
        ]);
        const replies = later.value;
        const secrets = codes.flatMap(forms);
        const found: string[] = [];
        const look = (where: string, text: string): void => {
            for (const sec of secrets) if (text.includes(sec)) found.push(`${where} : ${sec}`);
        };
        // Base : table des codes (toutes colonnes), journal et boîte d'envoi du compte
        const stored = await inspect(async (c) => (await c.query(`SELECT to_jsonb(t)::text AS j, code_hash FROM public.admin_backup_codes t WHERE user_id = $1`, [sa.userId])).rows);
        for (const r of stored) look('admin_backup_codes', String(r.j));
        const plainHashes = new Set(codes.flatMap((c) => forms(c).map(sha)));
        const unkeyed = stored.filter((r) => plainHashes.has(String(r.code_hash))).length;
        const audit = await inspect(async (c) => (await c.query(`SELECT coalesce(string_agg(to_jsonb(a)::text, ' '), '') AS j FROM public.audit_logs a WHERE a.user_id = $1 OR a.object_id::text = $1::text`, [sa.userId])).rows[0].j);
        look('audit_logs', String(audit));
        const box = await inspect(async (c) => (await c.query(`SELECT coalesce(string_agg(to_jsonb(o)::text, ' '), '') AS j FROM public.notification_outbox o WHERE o.recipient_user_id = $1 OR o.recipient_phone = $2`, [sa.userId, sa.phoneE164])).rows[0].j);
        look('notification_outbox', String(box));
        // Réponses des routes après l'affichage, et journal du serveur pendant l'affichage et après
        replies.forEach((r, i) => look(`réponse ${i + 1}`, JSON.stringify(r.body)));
        look('console (après l\'affichage)', later.text);
        look('console (pendant l\'affichage)', shown.text);
        // REST : table et fonctions, avec le jeton du Superadmin et sans jeton
        const rest: string[] = [];
        for (const [who, client] of [['superadmin', userClient(sa.accessToken)], ['anonyme', anonClient()]] as const) {
            const { data, error } = await client.from('admin_backup_codes').select('*');
            rest.push(`${who} table : ${error ? `refus ${error.code ?? ''}` : `${(data ?? []).length} ligne(s)`}`);
            if (!error && (data ?? []).length > 0) found.push(`REST ${who} : ${(data ?? []).length} ligne(s) de admin_backup_codes`);
            for (const fn of ['admin_backup_codes_status', 'admin_backup_code_use', 'admin_backup_codes_generate']) {
                const r = await restRpc(client, fn, { p: { user_id: sa.userId } });
                rest.push(`${who} ${fn} : ${r.ok ? 'EXÉCUTÉE' : 'refus'}`);
                if (r.ok) found.push(`REST ${who} : ${fn} exécutée`);
            }
        }
        const keys = Object.keys(replies[3].body).sort();
        console.log(`[CVF3D-2e] empreintes : ${stored.length} ligne(s), empreintes sans clé (SHA-256 du code) : ${unkeyed} ; GET après usage : ${show(replies[3])} ; REST : ${rest.join(' ; ')} ; codes retrouvés : ${found.length === 0 ? 'aucun' : found.join(' | ')}`);
        assert.equal(unkeyed, 0, 'empreinte calculable sans la clé du serveur');
        assert.deepEqual(keys, ['generated_at', 'remaining'], `GET rend d'autres champs : ${keys.join(', ')}`);
        assert.deepEqual(found, [], `codes de secours relus après leur affichage :\n${found.join('\n')}`);
    });
});

describe('2. qui a des codes', () => {
    test('f. ADMIN non SUPERADMIN : 403 partout ; SUPERADMIN rétrogradé puis renommé : anciens codes refusés', async () => {
        const admin = await newAdmin('cvf3d2-f', ['users.read']);
        await confirmIdentity(admin);
        const post = await generate(admin.accessToken);
        const get = await status(admin.accessToken);
        const rec = await recover(admin.accessToken, STRONG_PASSWORD, 'ABCDE-FGH23');
        const rows = await inspect(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM public.admin_backup_codes WHERE user_id = $1`, [admin.userId])).rows[0].n));

        const boss = await superadmin('cvf3d2-f-boss');
        const { sa, codes } = await withCodes('cvf3d2-f-sa');
        const role = (body: Row): Promise<Reply> => call('POST', 'admin/users/[id]/role', { token: boss.accessToken, path: `/api/admin/users/${sa.userId}/role`, params: { id: sa.userId }, body });
        const down = await role({ role: 'ADMIN', reason: 'Contre-vérification : retrait du rôle' });
        const asAdmin = await freshSession(sa.email);
        const recAsAdmin = await recover(asAdmin.token, STRONG_PASSWORD, codes[0]);
        await confirmIdentity(boss);
        const up = await role({ role: 'SUPERADMIN', reason: 'Contre-vérification : rôle rendu' });
        const again = await freshSession(sa.email);
        const recAgain = await recover(again.token, STRONG_PASSWORD, codes[1]);
        const left = await openCodes(sa.userId);
        console.log(`[CVF3D-2f] ADMIN : création ${show(post)} ; lecture ${show(get)} ; secours ${show(rec)} ; lignes ${rows}`);
        console.log(`[CVF3D-2f] SUPERADMIN rétrogradé : ${show(down)} ; secours en ADMIN : ${show(recAsAdmin)} ; rôle rendu : ${show(up)} ; ancien code ensuite : ${show(recAgain)} ; codes valables : ${left}`);
        assert.deepEqual([post.status, post.body.code], [403, 'SUPERADMIN_ONLY'], show(post));
        assert.equal(get.status, 403, show(get));
        assert.deepEqual([rec.status, rec.body.code], [403, 'NO_BACKUP_CODES'], show(rec));
        assert.equal(rows, 0);
        assert.equal(down.status, 200, `rétrogradation (montage) : ${show(down)}`);
        assert.equal(up.status, 200, `rôle rendu (montage) : ${show(up)}`);
        assert.notEqual(recAsAdmin.status, 200, `code de secours d'un compte rétrogradé : ${show(recAsAdmin)}`);
        assert.notEqual(recAgain.status, 200, `ancien code après rétrogradation puis rôle rendu : ${show(recAgain)}`);
        assert.equal(left, 0, 'anciens codes encore valables');
    });
});

describe('2. « J\'ai perdu mon téléphone »', () => {
    test('g. jamais d\'ouverture sans mot de passe ET code de secours valide ; témoin : les deux justes ouvrent', async () => {
        const { sa, codes } = await withCodes('cvf3d2-g');
        const other = await withCodes('cvf3d2-g-autre');
        const client = await newBuyer('cvf3d2-g-client');
        const s = await freshSession(sa.email);
        const closed0 = await adminOpen(s.token);
        const wrongPassword = await recover(s.token, 'Mauvais#Mot-de-passe-1', codes[0]);
        const wrongCode = await recover(s.token, STRONG_PASSWORD, guess(codes, 2));
        const foreignCode = await recover(s.token, STRONG_PASSWORD, other.codes[0]);
        const closed1 = await adminOpen(s.token);
        const anon = await recover(null, STRONG_PASSWORD, codes[0]);
        const asClient = await recover(client.accessToken, STRONG_PASSWORD, codes[0]);
        const left = [await openCodes(sa.userId), await openCodes(other.sa.userId)];
        const good = await recover(s.token, STRONG_PASSWORD, codes[0]);
        const open = await adminOpen(s.token);
        console.log(`[CVF3D-2g] avant : ${show(closed0)} ; mot de passe faux : ${show(wrongPassword)} ; code faux : ${show(wrongCode)} ; code d'un autre Superadmin : ${show(foreignCode)} ; administration ensuite : ${show(closed1)}`);
        console.log(`[CVF3D-2g] sans session : ${show(anon)} ; compte client : ${show(asClient)} ; codes valables : ${left.join(' et ')} ; témoin (les deux justes) : ${show(good)} ; administration : ${show(open)}`);
        assert.equal(closed0.status, 403, `session sans code : ${show(closed0)}`);
        for (const r of [wrongPassword, wrongCode, foreignCode]) assert.deepEqual([r.status, r.body.code], [403, 'BACKUP_CODE_INVALID'], show(r));
        assert.equal(closed1.status, 403, `administration ouverte après des essais faux : ${show(closed1)}`);
        assert.equal(anon.status, 401, show(anon));
        assert.equal(asClient.status, 403, show(asClient));
        assert.deepEqual(left, [10, 10], 'aucun code consommé par un essai faux');
        assert.equal(good.status, 200, show(good));
        assert.equal(open.status, 200, `témoin : ${show(open)}`);
    });

    test('h. le SUPERADMIN change son numéro par l\'écran client avec un code vieux de 2 heures (« Sécurité du compte » exige 10 minutes)', async () => {
        const sa = await superadmin('cvf3d2-h', false);
        await ageDeviceCode(sa.userId, 120);
        await confirmPasswordOnly(sa.accessToken);
        const phone = randomSenegalPhone('77');
        const viaSecurity = await call('POST', 'admin/security/phone/start', { token: sa.accessToken, body: { phone } });
        const s = await call('POST', 'account/phone/start', { token: sa.accessToken, body: { phone } });
        let c: Reply | null = null;
        if (s.status === 200 && smsTo(phone).length > 0) {
            c = await call('POST', 'account/phone/confirm', { token: sa.accessToken, body: { phone, code: await lastSmsCode(phone) } });
        }
        const now = await phoneOf(sa.userId);
        console.log(`[CVF3D-2h] « Sécurité du compte » : ${show(viaSecurity)} ; écran client : début ${show(s)}, validation ${c ? show(c) : '—'} ; numéro du compte : ${now} (avant : ${sa.phoneE164})`);
        assert.deepEqual([viaSecurity.status, viaSecurity.body.code], [403, 'ADMIN_CODE_CONFIRMATION_REQUIRED'], `témoin : ${show(viaSecurity)}`);
        assert.equal(digits(now), digits(sa.phoneE164), `numéro du Superadmin changé sans code récent, par l'écran client (${now})`);
    });

    test('i. après le code de secours et le changement de numéro, la session du téléphone perdu ne lit plus rien par la REST', async () => {
        const { sa, codes } = await withCodes('cvf3d2-i');
        const lost = await steppedUpSession(sa.email);
        const seenBefore = await othersSeen(lost.token, sa.userId);
        const owner = await freshSession(sa.email);
        const rec = await recover(owner.token, STRONG_PASSWORD, codes[0]);
        assert.equal(rec.status, 200, `code de secours (montage) : ${show(rec)}`);
        const phone = randomSenegalPhone('77');
        const st = await call('POST', 'admin/security/phone/start', { token: owner.token, body: { phone } });
        assert.equal(st.status, 200, `début du changement (montage) : ${show(st)}`);
        const done = await call('POST', 'admin/security/phone/confirm', { token: owner.token, body: { request_id: String(st.body.request_id), code: await lastSmsCode(phone) } });
        assert.equal(done.status, 200, `changement (montage) : ${show(done)}`);
        const route = await call('GET', 'admin/security/backup-codes', { token: lost.token });
        const refresh = await refreshError(lost.refresh);
        const seenAfter = await othersSeen(lost.token, sa.userId);
        console.log(`[CVF3D-2i] changement : ${show(done)} ; session du téléphone perdu : route ${show(route)}, rafraîchissement ${refresh ?? 'ACCEPTÉ'}, comptes d'autrui par la REST avant ${seenBefore.n} puis ${seenAfter.n}${seenAfter.error ? ` (${seenAfter.error})` : ''}`);
        assert.ok(seenBefore.n > 0, 'témoin : avant, la session lit les comptes d\'autrui');
        assert.ok(route.status === 401 || route.status === 403, `route servie à la session révoquée : ${show(route)}`);
        assert.notEqual(refresh, null, 'rafraîchissement encore accepté');
        assert.equal(seenAfter.n, 0, `session du téléphone perdu, révoquée : ${seenAfter.n} compte(s) d'autrui encore lus par la REST`);
    });
});

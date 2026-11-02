/**
 * Lot 6, tâche 6.2 — routes des abonnements push web (contrat F4, C5 ; S2 « Canaux »).
 *  - GET /api/push/config : session exigée ; `{ enabled, publicKey }` ; canal désactivé sans les trois
 *    variables VAPID, avec une configuration partielle ou un VAPID_SUBJECT qui n'est ni mailto: ni https: ;
 *  - POST /api/push/subscriptions : session exigée (401, 403 pour un compte suspendu) ; canal désactivé →
 *    409 PUSH_NOT_CONFIGURED ; corps validé strictement (champ inconnu, clés de mauvaise taille, point
 *    d'arrivée invalide ou trop long → 400, rien d'écrit) ; liste blanche anti-SSRF (http, hôte inconnu,
 *    faux sous-domaine, identifiants dans l'URL → 400 PUSH_ENDPOINT_REFUSED ; FCM, Mozilla, Apple,
 *    *.notify.windows.com admis) ; PUSH_ENDPOINT_ALLOWED_ORIGINS REMPLACE la liste (origine exacte,
 *    https://*.suffixe, http seulement pour 127.0.0.1 / localhost) ; clés normalisées en base64url sans
 *    « = » ; vapid_key_id de la clé courante ; un point d'arrivée réattribué au compte qui s'inscrit
 *    (upsert) ; 10 appareils au plus (le plus ancien supprimé) ; quota PUSH_SUBSCRIBE_PER_USER_HOUR → 429 ;
 *  - DELETE /api/push/subscriptions : suppression par le propriétaire seulement (`{ removed }`).
 * Les routes sont appelées dans le processus (NextRequest, jeton Bearer d'un compte neuf) ; l'état est lu
 * dans public.push_subscriptions par le service_role, filtré par compte ou par point d'arrivée.
 *
 * Rouge avant correctif : app/api/push/config/route.ts et app/api/push/subscriptions/route.ts n'existent
 * pas (échec « route … absente »), ni la table push_subscriptions (PGRST205).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { service, newBuyer, type Buyer } from './paiement-helpers';
import { jsonRequest } from './finance-helpers';
import {
    assertNotificationInvariants, fakeBrowserSubscription, loadLotModule, newVapidKeys, withEnv, withVapid, type VapidKeys,
} from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('push-abonnements');
});

const CONFIG_ROUTE = '../../app/api/push/config/route';
const SUBSCRIPTIONS_ROUTE = '../../app/api/push/subscriptions/route';
const NO_VAPID = { VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined, VAPID_SUBJECT: undefined };

type Handler = (req: NextRequest) => Promise<Response>;

async function handler(relPath: string, method: 'GET' | 'POST' | 'DELETE'): Promise<Handler> {
    const mod = await loadLotModule(relPath, `route ${method} ${relPath.replace('../../app', '').replace('/route', '')} (contrat F4)`);
    assert.equal(typeof mod[method], 'function', `${relPath.replace(/^(\.\.\/)+/, '')} : ${method} non exporté (contrat F4)`);
    return mod[method] as Handler;
}

interface Reply { status: number; body: Record<string, unknown> }

async function call(relPath: string, method: 'GET' | 'POST' | 'DELETE', urlPath: string, token: string | null, body?: unknown): Promise<Reply> {
    const fn = await handler(relPath, method);
    const res = await fn(jsonRequest(urlPath, method, token, body));
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    if (text) {
        try {
            parsed = JSON.parse(text) as Record<string, unknown>;
        } catch {
            parsed = { raw: text }; // réponse non JSON : gardée telle quelle pour le message d'échec
        }
    }
    return { status: res.status, body: parsed };
}

const getConfig = (token: string | null): Promise<Reply> => call(CONFIG_ROUTE, 'GET', '/api/push/config', token);
const subscribe = (token: string | null, body: unknown): Promise<Reply> => call(SUBSCRIPTIONS_ROUTE, 'POST', '/api/push/subscriptions', token, body);
const unsubscribe = (token: string | null, body: unknown): Promise<Reply> => call(SUBSCRIPTIONS_ROUTE, 'DELETE', '/api/push/subscriptions', token, body);

interface SubscriptionRow {
    id: string; user_id: string; endpoint: string; p256dh: string; auth: string; vapid_key_id: string; user_agent: string | null; created_at: string;
}

async function subscriptionsOf(userId: string): Promise<SubscriptionRow[]> {
    const { data, error } = await service.from('push_subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    assert.equal(error, null, `lecture de push_subscriptions : ${error?.message} (code ${error?.code}) — table du contrat C5, migration 20261103000002`);
    return (data ?? []) as SubscriptionRow[];
}

async function byEndpoint(endpoint: string): Promise<SubscriptionRow[]> {
    const { data, error } = await service.from('push_subscriptions').select('*').eq('endpoint', endpoint);
    assert.equal(error, null, `lecture de push_subscriptions : ${error?.message} (code ${error?.code})`);
    return (data ?? []) as SubscriptionRow[];
}

function bodyFor(endpoint?: string, userAgent = 'Mozilla/5.0 (test lot 6)'): { endpoint: string; keys: { p256dh: string; auth: string }; userAgent: string } {
    const sub = fakeBrowserSubscription(endpoint ? { endpoint } : {});
    return { ...sub.json, userAgent };
}

function expectOk(r: Reply, what: string): void {
    assert.equal(r.status, 200, `${what} : ${r.status} ${JSON.stringify(r.body)}`);
    assert.equal(r.body.subscribed, true, `${what} : { subscribed: true } attendu (${JSON.stringify(r.body)})`);
}

function token(): string {
    return randomBytes(24).toString('base64url');
}

// ── Configuration ──────────────────────────────────────────────────────────

describe('6.2 GET /api/push/config (contrat F4)', () => {
    test('session exigée ; sans VAPID : { enabled: false, publicKey: null } ; avec : la clé publique courante', async () => {
        const buyer = await newBuyer('push-config');
        const anon = await getConfig(null);
        assert.equal(anon.status, 401, `sans session : ${JSON.stringify(anon.body)}`);
        await withEnv(NO_VAPID, async () => {
            const r = await getConfig(buyer.accessToken);
            assert.equal(r.status, 200, JSON.stringify(r.body));
            assert.deepEqual(r.body, { enabled: false, publicKey: null });
        });
        await withVapid(async (keys) => {
            const r = await getConfig(buyer.accessToken);
            assert.equal(r.status, 200, JSON.stringify(r.body));
            assert.deepEqual(r.body, { enabled: true, publicKey: keys.publicKey });
        });
    });

    test('configuration partielle ou sujet invalide : canal désactivé (les trois variables ou aucune ; sujet mailto: ou https:)', async () => {
        const buyer = await newBuyer('push-config-partiel');
        const keys = newVapidKeys();
        const partials: Array<Record<string, string | undefined>> = [
            { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: undefined },
            { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: undefined, VAPID_SUBJECT: keys.subject },
            { VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: keys.subject },
            { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'ftp://notifications.example' },
            { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'http://notifications.example' },
        ];
        for (const env of partials) {
            await withEnv(env, async () => {
                const r = await getConfig(buyer.accessToken);
                assert.equal(r.status, 200, `${JSON.stringify(Object.keys(env).filter((k) => env[k] !== undefined))} : ${JSON.stringify(r.body)}`);
                assert.deepEqual(r.body, { enabled: false, publicKey: null }, `configuration ${JSON.stringify({ ...env, VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY ? '…' : undefined })}`);
            });
        }
        await withEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'https://eventvillage.sn/contact' }, async () => {
            const r = await getConfig(buyer.accessToken);
            assert.deepEqual(r.body, { enabled: true, publicKey: keys.publicKey }, 'sujet https: admis');
        });
    });
});

// ── Inscription ────────────────────────────────────────────────────────────

describe('6.2 POST /api/push/subscriptions : inscription d\'un appareil (contrat F4, C5)', () => {
    test('session exigée ; compte suspendu refusé ; canal désactivé → 409 PUSH_NOT_CONFIGURED, rien d\'écrit', async () => {
        const buyer = await newBuyer('push-sub-garde');
        const body = bodyFor();
        await withVapid(async () => {
            const anon = await subscribe(null, body);
            assert.equal(anon.status, 401, `sans session : ${JSON.stringify(anon.body)}`);
        });
        await withEnv(NO_VAPID, async () => {
            const r = await subscribe(buyer.accessToken, body);
            assert.equal(r.status, 409, `sans VAPID : ${JSON.stringify(r.body)}`);
            assert.equal(r.body.code, 'PUSH_NOT_CONFIGURED');
            assert.equal(typeof r.body.error, 'string', 'message humain');
        });
        assert.equal((await byEndpoint(body.endpoint)).length, 0, 'aucun abonnement écrit');

        const suspended = await newBuyer('push-sub-suspendu');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const sBody = bodyFor();
        await withVapid(async () => {
            const r = await subscribe(suspended.accessToken, sBody);
            assert.equal(r.status, 403, `compte suspendu : ${JSON.stringify(r.body)}`);
        });
        assert.equal((await byEndpoint(sBody.endpoint)).length, 0, 'compte suspendu : rien d’écrit');
    });

    test('inscription valide : 200 { subscribed: true }, ligne au compte avec les clés, vapid_key_id courant et user_agent', async () => {
        const buyer = await newBuyer('push-sub-ok');
        const body = bodyFor(undefined, 'Mozilla/5.0 (Linux; Android 14) Chrome/130');
        await withVapid(async (keys) => {
            expectOk(await subscribe(buyer.accessToken, body), 'inscription');
            const rows = await subscriptionsOf(buyer.userId);
            assert.equal(rows.length, 1, `une ligne : ${JSON.stringify(rows)}`);
            assert.deepEqual(
                { endpoint: rows[0].endpoint, p256dh: rows[0].p256dh, auth: rows[0].auth, vapid_key_id: rows[0].vapid_key_id, user_agent: rows[0].user_agent },
                { endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, vapid_key_id: keys.keyId, user_agent: body.userAgent });
            expectOk(await subscribe(buyer.accessToken, body), 'réinscription du même appareil');
            assert.equal((await subscriptionsOf(buyer.userId)).length, 1, 'réinscription : toujours une ligne (upsert sur endpoint)');
        });
    });

    test('clés envoyées en base64 standard avec « = » : enregistrées en base64url sans « = »', async () => {
        const buyer = await newBuyer('push-sub-norm');
        const sub = fakeBrowserSubscription();
        const toStd = (b64url: string): string => Buffer.from(b64url, 'base64url').toString('base64');
        const p256dhStd = toStd(sub.keys.p256dh);
        const authStd = toStd(sub.keys.auth);
        assert.ok(p256dhStd.endsWith('=') && authStd.endsWith('='), 'précondition : forme standard avec remplissage');
        await withVapid(async () => {
            expectOk(await subscribe(buyer.accessToken, { endpoint: sub.endpoint, keys: { p256dh: p256dhStd, auth: authStd } }), 'clés en base64 standard');
        });
        const [row] = await byEndpoint(sub.endpoint);
        assert.ok(row, 'abonnement écrit');
        assert.deepEqual({ p256dh: row.p256dh, auth: row.auth }, sub.keys, 'clés normalisées (base64url sans « = »)');
    });

    test('validation stricte du corps : 400 et rien d\'écrit (champ inconnu, clés de mauvaise taille, point d\'arrivée invalide ou trop long)', async () => {
        const buyer = await newBuyer('push-sub-zod');
        const valid = bodyFor();
        const b64 = (n: number): string => randomBytes(n).toString('base64url');
        const longEndpoint = `https://fcm.googleapis.com/fcm/send/${'a'.repeat(2050)}`;
        const cases: Array<[string, unknown, string]> = [
            ['champ inconnu', { ...valid, admin: true }, valid.endpoint],
            ['clé auth absente', { endpoint: valid.endpoint, keys: { p256dh: valid.keys.p256dh } }, valid.endpoint],
            ['clés absentes', { endpoint: valid.endpoint }, valid.endpoint],
            ['p256dh de 64 octets', { endpoint: valid.endpoint, keys: { p256dh: b64(64), auth: valid.keys.auth } }, valid.endpoint],
            ['p256dh de 66 octets', { endpoint: valid.endpoint, keys: { p256dh: b64(66), auth: valid.keys.auth } }, valid.endpoint],
            ['auth de 15 octets', { endpoint: valid.endpoint, keys: { p256dh: valid.keys.p256dh, auth: b64(15) } }, valid.endpoint],
            ['auth de 17 octets', { endpoint: valid.endpoint, keys: { p256dh: valid.keys.p256dh, auth: b64(17) } }, valid.endpoint],
            ['clé non base64', { endpoint: valid.endpoint, keys: { p256dh: `${valid.keys.p256dh.slice(0, 80)}!!!!!!!`, auth: valid.keys.auth } }, valid.endpoint],
            ['point d\'arrivée qui n\'est pas une URL', { endpoint: 'pas-une-url', keys: valid.keys }, 'pas-une-url'],
            ['point d\'arrivée de plus de 2 048 caractères', { endpoint: longEndpoint, keys: valid.keys }, longEndpoint],
            ['corps vide', {}, valid.endpoint],
        ];
        await withVapid(async () => {
            for (const [label, body, endpoint] of cases) {
                const r = await subscribe(buyer.accessToken, body);
                assert.equal(r.status, 400, `${label} : ${r.status} ${JSON.stringify(r.body)}`);
                assert.equal(typeof r.body.error, 'string', `${label} : message d'erreur`);
                assert.equal((await byEndpoint(endpoint)).length, 0, `${label} : rien d'écrit`);
            }
        });
        assert.equal((await subscriptionsOf(buyer.userId)).length, 0, 'aucun abonnement au compte');
    });

    test('liste blanche des services push : refus 400 PUSH_ENDPOINT_REFUSED, services connus admis', async () => {
        const buyer = await newBuyer('push-sub-liste');
        const id = (): string => randomUUID();
        const refused = [
            `http://fcm.googleapis.com/fcm/send/${id()}`,
            `https://push.example.com/send/${id()}`,
            `https://fcm.googleapis.com.evil.example/fcm/send/${id()}`,
            `https://evil.example/fcm.googleapis.com/${id()}`,
            `https://fcm.googleapis.com@evil.example/fcm/send/${id()}`,
            `https://evilnotify.windows.com/w/?token=${id()}`,
            `https://notify.windows.com.evil.example/w/?token=${id()}`,
            `http://127.0.0.1:4010/push/${id()}`,
            `https://web.push.apple.com:8443/${id()}`,
        ];
        const accepted = [
            `https://fcm.googleapis.com/fcm/send/${id()}`,
            `https://updates.push.services.mozilla.com/wpush/v2/${id()}`,
            `https://web.push.apple.com/${id()}`,
            `https://wns2-par02p.notify.windows.com/w/?token=${id()}`,
        ];
        await withVapid(async () => {
            for (const endpoint of refused) {
                const r = await subscribe(buyer.accessToken, bodyFor(endpoint));
                assert.equal(r.status, 400, `${endpoint} : ${r.status} ${JSON.stringify(r.body)}`);
                assert.equal(r.body.code, 'PUSH_ENDPOINT_REFUSED', `${endpoint} : code`);
                assert.equal((await byEndpoint(endpoint)).length, 0, `${endpoint} : rien d'écrit`);
            }
            for (const endpoint of accepted) expectOk(await subscribe(buyer.accessToken, bodyFor(endpoint)), endpoint);
        });
        assert.deepEqual((await subscriptionsOf(buyer.userId)).map((s) => s.endpoint).sort(), [...accepted].sort(), 'seuls les services connus sont enregistrés');
    });

    test('PUSH_ENDPOINT_ALLOWED_ORIGINS remplace la liste : origine exacte, https://*.suffixe, http seulement en local', async () => {
        const buyer = await newBuyer('push-sub-origines');
        const id = (): string => randomUUID();
        await withVapid(() => withEnv({ PUSH_ENDPOINT_ALLOWED_ORIGINS: 'http://127.0.0.1:4010,https://*.push.example.test,http://push.lan.example' }, async () => {
            const ok = [`http://127.0.0.1:4010/push/${id()}`, `https://a.push.example.test/x/${id()}`];
            const ko = [
                `https://fcm.googleapis.com/fcm/send/${id()}`,
                `http://127.0.0.1:4011/push/${id()}`,
                `https://push.example.test.evil.example/x/${id()}`,
                `http://a.push.example.test/x/${id()}`,
                `http://push.lan.example/push/${id()}`,
            ];
            for (const endpoint of ok) expectOk(await subscribe(buyer.accessToken, bodyFor(endpoint)), endpoint);
            for (const endpoint of ko) {
                const r = await subscribe(buyer.accessToken, bodyFor(endpoint));
                assert.equal(r.status, 400, `${endpoint} : ${r.status} ${JSON.stringify(r.body)}`);
                assert.equal(r.body.code, 'PUSH_ENDPOINT_REFUSED', `${endpoint} : code`);
            }
            assert.equal((await subscriptionsOf(buyer.userId)).length, ok.length, 'seules les origines configurées sont enregistrées');
        }));
    });

    test('point d\'arrivée déjà inscrit par un autre compte : réattribué au compte qui s\'inscrit, une seule ligne, vapid_key_id courant', async () => {
        const a = await newBuyer('push-sub-a');
        const b = await newBuyer('push-sub-b');
        const body = bodyFor();
        const first: VapidKeys = newVapidKeys();
        const second: VapidKeys = newVapidKeys();
        await withVapid(async () => { expectOk(await subscribe(a.accessToken, body), 'compte A'); }, first);
        await withVapid(async () => { expectOk(await subscribe(b.accessToken, body), 'compte B'); }, second);
        const rows = await byEndpoint(body.endpoint);
        assert.equal(rows.length, 1, `une seule ligne pour l'appareil : ${JSON.stringify(rows)}`);
        assert.equal(rows[0].user_id, b.userId, 'appareil réattribué au compte B');
        assert.equal(rows[0].vapid_key_id, second.keyId, 'vapid_key_id de la clé courante');
        assert.equal((await subscriptionsOf(a.userId)).length, 0, 'compte A : plus d’appareil');
    });

    test('10 appareils au plus par compte : le onzième remplace le plus ancien', async () => {
        const buyer = await newBuyer('push-sub-dix');
        const bodies = Array.from({ length: 11 }, () => bodyFor());
        await withVapid(async () => {
            for (let i = 0; i < bodies.length; i++) expectOk(await subscribe(buyer.accessToken, bodies[i]), `appareil ${i + 1}`);
        });
        const endpoints = (await subscriptionsOf(buyer.userId)).map((s) => s.endpoint);
        assert.equal(endpoints.length, 10, `10 appareils : ${endpoints.length}`);
        assert.ok(!endpoints.includes(bodies[0].endpoint), 'le plus ancien est supprimé');
        assert.deepEqual([...endpoints].sort(), bodies.slice(1).map((b) => b.endpoint).sort(), 'les 10 plus récents restent');
    });

    test('quota PUSH_SUBSCRIBE_PER_USER_HOUR : au-delà → 429, rien d\'écrit', async () => {
        const buyer = await newBuyer('push-sub-quota');
        const bodies = [bodyFor(), bodyFor(), bodyFor()];
        await withVapid(() => withEnv({ PUSH_SUBSCRIBE_PER_USER_HOUR: '2' }, async () => {
            expectOk(await subscribe(buyer.accessToken, bodies[0]), 'inscription 1');
            expectOk(await subscribe(buyer.accessToken, bodies[1]), 'inscription 2');
            const r = await subscribe(buyer.accessToken, bodies[2]);
            assert.equal(r.status, 429, `inscription 3 : ${r.status} ${JSON.stringify(r.body)}`);
            assert.equal(typeof r.body.error, 'string', 'message humain');
        }));
        assert.equal((await byEndpoint(bodies[2].endpoint)).length, 0, 'au-delà du quota : rien d’écrit');
        assert.equal((await subscriptionsOf(buyer.userId)).length, 2);
    });
});

// ── Désinscription ─────────────────────────────────────────────────────────

describe('6.2 DELETE /api/push/subscriptions : désinscription par le propriétaire seulement (contrat F4)', () => {
    test('un autre compte ne supprime rien ({ removed: false }) ; le propriétaire supprime ({ removed: true }) ; session exigée', async () => {
        const owner: Buyer = await newBuyer('push-del-proprio');
        const other: Buyer = await newBuyer('push-del-autre');
        const body = bodyFor();
        await withVapid(async () => { expectOk(await subscribe(owner.accessToken, body), 'inscription'); });

        const anon = await unsubscribe(null, { endpoint: body.endpoint });
        assert.equal(anon.status, 401, `sans session : ${JSON.stringify(anon.body)}`);

        const byOther = await unsubscribe(other.accessToken, { endpoint: body.endpoint });
        assert.equal(byOther.status, 200, JSON.stringify(byOther.body));
        assert.deepEqual(byOther.body, { removed: false }, 'appareil d’un autre compte : rien supprimé');
        assert.equal((await byEndpoint(body.endpoint)).length, 1, 'abonnement intact');

        const byOwner = await unsubscribe(owner.accessToken, { endpoint: body.endpoint });
        assert.equal(byOwner.status, 200, JSON.stringify(byOwner.body));
        assert.deepEqual(byOwner.body, { removed: true });
        assert.equal((await byEndpoint(body.endpoint)).length, 0, 'abonnement supprimé');

        const again = await unsubscribe(owner.accessToken, { endpoint: body.endpoint });
        assert.deepEqual(again.body, { removed: false }, 'seconde suppression : rien à supprimer');

        const invalid = await unsubscribe(owner.accessToken, { endpoint: 42, extra: token() });
        assert.equal(invalid.status, 400, `corps invalide : ${JSON.stringify(invalid.body)}`);
    });
});

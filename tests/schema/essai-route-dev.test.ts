/**
 * Lot 9, tâche 9.3, A40 (contrat 4.4, 5.4, L43, D-sec 9) — POST /api/dev/samirpay/[action] (route.dev.ts) rend
 * l'échec du webhook : webhook de l'application hors 2xx → `{ ok:false, status, code:'FAKE_SERVICE_ERROR', error, message }`
 * en 502, au lieu de `{ ok:true }`. Sans base : fetch simulé, NODE_ENV=development et EV_INTEGRATIONS=fake le temps
 * de l'appel. Suite sans écriture : aucun invariant appelé (signalé).
 *
 * Rouge avant correctif : webhook 500, 404 ou 301 → 200 ok:true.
 * Verts dès l'écriture (témoins, signalés) : webhook 200 et 204, refuse sans webhookStatus, service injoignable.
 */
import '../helpers/env';
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/dev/samirpay/[action]/route.dev';

const MESSAGE = 'L’application a refusé la confirmation du paiement simulé.';

interface Call { url: string; body: unknown }

let calls: Call[] = [];
let restoreEnv: Array<() => void> = [];
let restoreFetch: () => void;

function setEnv(name: string, value: string): void {
    const env = process.env as Record<string, string | undefined>;
    const previous = env[name];
    env[name] = value;
    restoreEnv.push(() => {
        if (previous === undefined) delete env[name];
        else env[name] = previous;
    });
}

/** Réponse du faux service au point de contrôle : corps de fake-core.mjs. */
function fakeService(status: number, body: Record<string, unknown>): void {
    const previous = globalThis.fetch;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? 'null')) });
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    restoreFetch = () => { globalThis.fetch = previous; };
}

function post(action: string, transactionId: string): Promise<Response> {
    return POST(new NextRequest(`http://127.0.0.1:3000/api/dev/samirpay/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transactionId }),
    }), { params: { action } });
}

beforeEach(() => {
    calls = [];
    restoreEnv = [];
    restoreFetch = () => undefined;
    setEnv('NODE_ENV', 'development');
    setEnv('EV_INTEGRATIONS', 'fake');
});

afterEach(() => {
    restoreFetch();
    for (const restore of restoreEnv.reverse()) restore();
});

async function asJson(res: Response): Promise<Record<string, unknown>> {
    return await res.json() as Record<string, unknown>;
}

describe('A40 — route de développement : webhook en échec', () => {
    for (const webhookStatus of [500, 404, 301]) {
        test(`validate, webhook ${webhookStatus} : 502, ok:false, FAKE_SERVICE_ERROR, message`, async () => {
            fakeService(200, { status: 'SUCCESS', webhookStatus });
            const previousError = console.error;
            const logged: string[] = [];
            console.error = (...args: unknown[]): void => { logged.push(args.map(String).join(' ')); };
            let res: Response;
            try {
                res = await post('validate', randomUUID());
            } finally {
                console.error = previousError;
            }
            assert.equal(res.status, 502, `webhook ${webhookStatus} présenté comme un succès`);
            assert.deepEqual(await asJson(res), { ok: false, status: 'SUCCESS', code: 'FAKE_SERVICE_ERROR', error: MESSAGE, message: MESSAGE });
            assert.equal(logged.length, 1, `un journal attendu : ${logged.join(' | ')}`);
            assert.match(logged[0], new RegExp(`HTTP ${webhookStatus}`), 'le statut du webhook est journalisé');
        });
    }

    test('témoin : webhook 200, ok:true (vert dès l’écriture)', async () => {
        fakeService(200, { status: 'SUCCESS', webhookStatus: 200 });
        const transactionId = randomUUID();
        const res = await post('validate', transactionId);
        assert.equal(res.status, 200);
        assert.deepEqual(await asJson(res), { ok: true, status: 'SUCCESS' });
        assert.deepEqual(calls, [{ url: 'http://127.0.0.1:4010/__test/samirpay/complete', body: { transactionId } }], 'un seul appel au point de contrôle');
    });

    test('témoin : webhook 204, ok:true (vert dès l’écriture)', async () => {
        fakeService(200, { status: 'SUCCESS', webhookStatus: 204 });
        const res = await post('validate', randomUUID());
        assert.equal(res.status, 200);
        assert.deepEqual(await asJson(res), { ok: true, status: 'SUCCESS' });
    });

    test('témoin : refuse sans webhookStatus, ok:true (vert dès l’écriture)', async () => {
        fakeService(200, { status: 'FAILED' });
        const transactionId = randomUUID();
        const res = await post('refuse', transactionId);
        assert.equal(res.status, 200);
        assert.deepEqual(await asJson(res), { ok: true, status: 'FAILED' });
        assert.equal(calls[0].url, 'http://127.0.0.1:4010/__test/samirpay/fail');
    });

    test('témoin : hors NODE_ENV=development, 404 sans appel au faux service (vert dès l’écriture)', async () => {
        fakeService(200, { status: 'SUCCESS', webhookStatus: 500 });
        setEnv('NODE_ENV', 'production');
        const res = await post('validate', randomUUID());
        assert.equal(res.status, 404);
        assert.deepEqual(calls, [], 'aucun appel');
    });
});
